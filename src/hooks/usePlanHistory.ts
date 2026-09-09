import { useCallback, useRef, useState } from 'react'
import { cloneAnnotation, duplicateAnnotations, duplicateLayout } from '../core/selection'
import { reorderPiecesWithinLevels, type LayerOrderCommand } from '../core/layerOrder'
import type { PlacedPiece, PlanAnnotation } from '../types'

const MAX_HISTORY_ENTRIES = 100

type PlanSnapshot = {
  pieces: PlacedPiece[]
  annotations: PlanAnnotation[]
}

type HistoryEffect = { undo: () => void; redo: () => void }
type HistoryEntry = { snapshot: PlanSnapshot; effect?: HistoryEffect }

type ClipboardSnapshot = PlanSnapshot & {
  sourceLevel: number
  offsetOnSameLevel: boolean
}

type ArrayUpdater<T> = T[] | ((current: T[]) => T[])

const planPositionsChanged = (before: PlanSnapshot, after: PlanSnapshot) => {
  const piecesChanged =
    before.pieces.length !== after.pieces.length ||
    before.pieces.some((piece, index) => {
      const next = after.pieces[index]
      return !next || piece.x !== next.x || piece.y !== next.y || piece.rotation !== next.rotation
    })
  if (piecesChanged) return true

  return (
    before.annotations.length !== after.annotations.length ||
    before.annotations.some((annotation, index) => {
      const next = after.annotations[index]
      if (!next || annotation.kind !== next.kind) return true
      if (annotation.kind === 'text' && next.kind === 'text') {
        return annotation.x !== next.x || annotation.y !== next.y
      }
      if (annotation.kind === 'pen' && next.kind === 'pen') {
        return (
          annotation.points.length !== next.points.length ||
          annotation.points.some((point, pointIndex) => {
            const nextPoint = next.points[pointIndex]
            return !nextPoint || point.x !== nextPoint.x || point.y !== nextPoint.y
          })
        )
      }
      if (annotation.kind === 'farm' && next.kind === 'farm') {
        if (annotation.mode !== next.mode) return true
        if (annotation.mode === 'area' && next.mode === 'area') {
          return annotation.x !== next.x || annotation.y !== next.y
        }
        if (annotation.mode === 'cultivator' && next.mode === 'cultivator') {
          return (
            annotation.points.length !== next.points.length ||
            annotation.points.some((point, pointIndex) => {
              const nextPoint = next.points[pointIndex]
              return !nextPoint || point.x !== nextPoint.x || point.y !== nextPoint.y
            })
          )
        }
      }
      return false
    })
  )
}

export const usePlanHistory = (initial: PlanSnapshot) => {
  const [pieces, setPieces] = useState(initial.pieces)
  const [annotations, setAnnotations] = useState(initial.annotations)
  const [, setRevision] = useState(0)
  const piecesRef = useRef(pieces)
  const annotationsRef = useRef(annotations)
  const historyRef = useRef<{ past: HistoryEntry[]; future: HistoryEntry[] }>({ past: [], future: [] })
  const clipboardRef = useRef<ClipboardSnapshot>({
    pieces: [],
    annotations: [],
    sourceLevel: 0,
    offsetOnSameLevel: true,
  })
  const moveOriginRef = useRef<PlanSnapshot | undefined>(undefined)

  piecesRef.current = pieces
  annotationsRef.current = annotations

  const recordPast = useCallback((snapshot: PlanSnapshot, effect?: HistoryEffect) => {
    historyRef.current.past.push({ snapshot, effect })
    if (historyRef.current.past.length > MAX_HISTORY_ENTRIES) historyRef.current.past.shift()
    historyRef.current.future = []
    setRevision((value) => value + 1)
  }, [])

  const applySnapshot = useCallback((snapshot: PlanSnapshot) => {
    piecesRef.current = snapshot.pieces
    annotationsRef.current = snapshot.annotations
    setPieces(snapshot.pieces)
    setAnnotations(snapshot.annotations)
  }, [])

  const commitPlan = useCallback(
    (nextPieces: PlacedPiece[], nextAnnotations: PlanAnnotation[], effect?: HistoryEffect) => {
      const current = { pieces: piecesRef.current, annotations: annotationsRef.current }
      if (nextPieces === current.pieces && nextAnnotations === current.annotations && !effect) return
      recordPast(current, effect)
      applySnapshot({ pieces: nextPieces, annotations: nextAnnotations })
      effect?.redo()
    },
    [applySnapshot, recordPast],
  )

  const commitPieces = useCallback(
    (updater: ArrayUpdater<PlacedPiece>) => {
      const current = piecesRef.current
      const next = typeof updater === 'function' ? updater(current) : updater
      commitPlan(next, annotationsRef.current)
    },
    [commitPlan],
  )

  const commitAnnotations = useCallback(
    (updater: ArrayUpdater<PlanAnnotation>) => {
      const current = annotationsRef.current
      const next = typeof updater === 'function' ? updater(current) : updater
      commitPlan(piecesRef.current, next)
    },
    [commitPlan],
  )

  const setPiecesLive = useCallback((updater: (current: PlacedPiece[]) => PlacedPiece[]) => {
    const next = updater(piecesRef.current)
    piecesRef.current = next
    setPieces(next)
  }, [])

  const setAnnotationsLive = useCallback((updater: (current: PlanAnnotation[]) => PlanAnnotation[]) => {
    const next = updater(annotationsRef.current)
    annotationsRef.current = next
    setAnnotations(next)
  }, [])

  const undo = useCallback(() => {
    const previous = historyRef.current.past.pop()
    if (!previous) return false
    historyRef.current.future.push({
      snapshot: { pieces: piecesRef.current, annotations: annotationsRef.current },
      effect: previous.effect,
    })
    applySnapshot(previous.snapshot)
    previous.effect?.undo()
    setRevision((value) => value + 1)
    return true
  }, [applySnapshot])

  const redo = useCallback(() => {
    const next = historyRef.current.future.pop()
    if (!next) return false
    historyRef.current.past.push({
      snapshot: { pieces: piecesRef.current, annotations: annotationsRef.current },
      effect: next.effect,
    })
    applySnapshot(next.snapshot)
    next.effect?.redo()
    setRevision((value) => value + 1)
    return true
  }, [applySnapshot])

  const clear = useCallback(() => {
    applySnapshot({ pieces: [], annotations: [] })
    historyRef.current = { past: [], future: [] }
    clipboardRef.current = {
      pieces: [],
      annotations: [],
      sourceLevel: 0,
      offsetOnSameLevel: true,
    }
    setRevision((value) => value + 1)
  }, [applySnapshot])

  const replace = useCallback(
    (snapshot: PlanSnapshot) => {
      applySnapshot(snapshot)
      historyRef.current = { past: [], future: [] }
      setRevision((value) => value + 1)
    },
    [applySnapshot],
  )

  const remove = useCallback(
    (ids: string[]) => {
      if (!ids.length) return 0
      const selected = new Set(ids)
      const nextPieces = piecesRef.current.filter((piece) => !selected.has(piece.id))
      const nextAnnotations = annotationsRef.current.filter((annotation) => !selected.has(annotation.id))
      const removed =
        piecesRef.current.length - nextPieces.length + annotationsRef.current.length - nextAnnotations.length
      if (removed) commitPlan(nextPieces, nextAnnotations)
      return removed
    },
    [commitPlan],
  )

  const reorder = useCallback(
    (ids: string[], command: LayerOrderCommand) => {
      const nextPieces = reorderPiecesWithinLevels(piecesRef.current, ids, command)
      if (nextPieces === piecesRef.current) return false
      commitPlan(nextPieces, annotationsRef.current)
      return true
    },
    [commitPlan],
  )

  const selectionSnapshot = useCallback((ids: string[]) => {
    const selected = new Set(ids)
    const selectedPieces = piecesRef.current
      .filter((piece) => selected.has(piece.id))
      .map((piece) => ({ ...piece }))
    const selectedAnnotations = annotationsRef.current
      .filter((annotation) => selected.has(annotation.id))
      .map(cloneAnnotation)
    return { pieces: selectedPieces, annotations: selectedAnnotations }
  }, [])

  const copy = useCallback(
    (ids: string[], sourceLevel = 0) => {
      const copied = selectionSnapshot(ids)
      const count = copied.pieces.length + copied.annotations.length
      if (!count) return 0
      clipboardRef.current = {
        ...copied,
        sourceLevel,
        offsetOnSameLevel: true,
      }
      setRevision((value) => value + 1)
      return count
    },
    [selectionSnapshot],
  )

  const cut = useCallback(
    (ids: string[], sourceLevel = 0) => {
      const copied = selectionSnapshot(ids)
      const count = copied.pieces.length + copied.annotations.length
      if (!count) return 0
      clipboardRef.current = {
        ...copied,
        sourceLevel,
        offsetOnSameLevel: false,
      }
      const selected = new Set(ids)
      commitPlan(
        piecesRef.current.filter((piece) => !selected.has(piece.id)),
        annotationsRef.current.filter((annotation) => !selected.has(annotation.id)),
      )
      return count
    },
    [commitPlan, selectionSnapshot],
  )

  const paste = useCallback(
    (targetLevel = clipboardRef.current.sourceLevel) => {
      const clipboard = clipboardRef.current
      if (!clipboard.pieces.length && !clipboard.annotations.length) return []
      const sameLevel = targetLevel === clipboard.sourceLevel
      const offset = sameLevel && clipboard.offsetOnSameLevel ? { x: 1, y: 1 } : { x: 0, y: 0 }
      const levelOffset = targetLevel - clipboard.sourceLevel
      const nextPieces = duplicateLayout(clipboard.pieces, offset, () => crypto.randomUUID()).map(
        (piece) => ({
          ...piece,
          level: (piece.level ?? 0) + levelOffset,
        }),
      )
      const nextAnnotations = duplicateAnnotations(clipboard.annotations, offset, () =>
        crypto.randomUUID(),
      ).map((annotation) => ({
        ...annotation,
        level: (annotation.level ?? 0) + levelOffset,
      }))
      clipboardRef.current = {
        pieces: nextPieces.map((piece) => ({ ...piece })),
        annotations: nextAnnotations.map(cloneAnnotation),
        sourceLevel: targetLevel,
        offsetOnSameLevel: true,
      }
      commitPlan([...piecesRef.current, ...nextPieces], [...annotationsRef.current, ...nextAnnotations])
      return [...nextPieces, ...nextAnnotations].map((item) => item.id)
    },
    [commitPlan],
  )

  const beginMove = useCallback(() => {
    moveOriginRef.current = { pieces: piecesRef.current, annotations: annotationsRef.current }
  }, [])

  const finishMove = useCallback(() => {
    const origin = moveOriginRef.current
    moveOriginRef.current = undefined
    if (
      !origin ||
      !planPositionsChanged(origin, {
        pieces: piecesRef.current,
        annotations: annotationsRef.current,
      })
    )
      return false
    recordPast(origin)
    return true
  }, [recordPast])

  return {
    pieces,
    annotations,
    piecesRef,
    annotationsRef,
    canUndo: historyRef.current.past.length > 0,
    canRedo: historyRef.current.future.length > 0,
    clipboardCount: clipboardRef.current.pieces.length + clipboardRef.current.annotations.length,
    commitPlan,
    commitPieces,
    commitAnnotations,
    setPiecesLive,
    setAnnotationsLive,
    undo,
    redo,
    clear,
    replace,
    remove,
    reorder,
    copy,
    cut,
    paste,
    beginMove,
    finishMove,
  }
}
