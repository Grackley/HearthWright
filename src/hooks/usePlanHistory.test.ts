import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { usePlanHistory } from './usePlanHistory'

const floor = { id: 'floor', pieceId: 'wood-floor-2x2', x: 0, y: 0, rotation: 0 }
const label = { id: 'label', kind: 'text' as const, x: 0, y: 0, text: 'Hall', color: '#fff', size: 0.5 }
const cultivated = {
  id: 'cultivated',
  kind: 'farm' as const,
  mode: 'cultivator' as const,
  points: [
    { x: 2, y: 3 },
    { x: 5, y: 3 },
  ],
  radius: 3,
}
const farmArea = {
  id: 'farm-area',
  kind: 'farm' as const,
  mode: 'area' as const,
  x: 10,
  y: 12,
  width: 12,
  height: 8,
  cornerRadius: 3,
}

describe('usePlanHistory', () => {
  it('commits, undoes, and redoes plan edits', () => {
    const { result } = renderHook(() => usePlanHistory({ pieces: [floor], annotations: [] }))

    act(() => result.current.commitPieces((pieces) => [...pieces, { ...floor, id: 'second', x: 2 }]))
    expect(result.current.pieces).toHaveLength(2)
    expect(result.current.canUndo).toBe(true)

    act(() => expect(result.current.undo()).toBe(true))
    expect(result.current.pieces).toEqual([floor])
    expect(result.current.canRedo).toBe(true)

    act(() => expect(result.current.redo()).toBe(true))
    expect(result.current.pieces.map((piece) => piece.id)).toEqual(['floor', 'second'])
  })

  it('records a live drag as one history entry', () => {
    const { result } = renderHook(() => usePlanHistory({ pieces: [floor], annotations: [label] }))

    act(() => {
      result.current.beginMove()
      result.current.setPiecesLive((pieces) => pieces.map((piece) => ({ ...piece, x: 4 })))
      result.current.setAnnotationsLive((annotations) =>
        annotations.map((annotation) => (annotation.kind === 'text' ? { ...annotation, y: 3 } : annotation)),
      )
      expect(result.current.finishMove()).toBe(true)
    })
    expect(result.current.pieces[0].x).toBe(4)
    expect(result.current.annotations[0]).toMatchObject({ y: 3 })

    act(() => result.current.undo())
    expect(result.current.pieces[0].x).toBe(0)
    expect(result.current.annotations[0]).toMatchObject({ y: 0 })
  })

  it('records a rotation performed during a live drag', () => {
    const { result } = renderHook(() => usePlanHistory({ pieces: [floor], annotations: [] }))

    act(() => {
      result.current.beginMove()
      result.current.setPiecesLive((pieces) => pieces.map((piece) => ({ ...piece, rotation: 90 })))
      expect(result.current.finishMove()).toBe(true)
    })
    expect(result.current.pieces[0].rotation).toBe(90)

    act(() => result.current.undo())
    expect(result.current.pieces[0].rotation).toBe(0)
  })

  it('copies, pastes, and removes a mixed selection', () => {
    const { result } = renderHook(() =>
      usePlanHistory({ pieces: [floor], annotations: [label, cultivated, farmArea] }),
    )

    act(() => expect(result.current.copy(['floor', 'label', 'cultivated', 'farm-area'])).toBe(4))
    expect(result.current.clipboardCount).toBe(4)

    let pastedIds: string[] = []
    act(() => {
      pastedIds = result.current.paste()
    })
    expect(pastedIds).toHaveLength(4)
    expect(result.current.pieces[1]).toMatchObject({ x: 1, y: 1 })
    expect(result.current.annotations[3]).toMatchObject({ x: 1, y: 1 })
    expect(result.current.annotations[4]).toMatchObject({
      radius: 3,
      points: [
        { x: 3, y: 4 },
        { x: 6, y: 4 },
      ],
    })
    expect(result.current.annotations[5]).toMatchObject({ x: 11, y: 13, width: 12, height: 8 })

    act(() => expect(result.current.remove(pastedIds)).toBe(4))
    expect(result.current.pieces).toEqual([floor])
    expect(result.current.annotations).toEqual([label, cultivated, farmArea])
  })

  it('pastes onto the target level without disturbing alignment or relative floor spacing', () => {
    const lower = { ...floor, id: 'lower', x: 4, y: 6, level: 1 }
    const upper = { ...floor, id: 'upper', x: 8, y: 10, level: 2 }
    const upperLabel = { ...label, id: 'upper-label', x: 5, y: 7, level: 1 }
    const { result } = renderHook(() => usePlanHistory({ pieces: [lower, upper], annotations: [upperLabel] }))

    act(() => expect(result.current.copy(['lower', 'upper', 'upper-label'], 1)).toBe(3))
    act(() => result.current.paste(4))

    expect(result.current.pieces[2]).toMatchObject({ x: 4, y: 6, level: 4 })
    expect(result.current.pieces[3]).toMatchObject({ x: 8, y: 10, level: 5 })
    expect(result.current.annotations[1]).toMatchObject({ x: 5, y: 7, level: 4 })
  })

  it('cuts as one undoable edit and pastes back at the exact position', () => {
    const upper = { ...floor, x: 7, y: 9, level: 2 }
    const { result } = renderHook(() => usePlanHistory({ pieces: [upper], annotations: [] }))

    act(() => expect(result.current.cut(['floor'], 2)).toBe(1))
    expect(result.current.pieces).toEqual([])
    expect(result.current.clipboardCount).toBe(1)

    act(() => expect(result.current.undo()).toBe(true))
    expect(result.current.pieces).toEqual([upper])

    const second = renderHook(() => usePlanHistory({ pieces: [upper], annotations: [] }))
    act(() => expect(second.result.current.cut(['floor'], 2)).toBe(1))
    act(() => second.result.current.paste(2))
    expect(second.result.current.pieces[0]).toMatchObject({ x: 7, y: 9, level: 2 })
  })

  it('records moving farming footprints as one undoable edit', () => {
    const { result } = renderHook(() => usePlanHistory({ pieces: [], annotations: [cultivated, farmArea] }))

    act(() => {
      result.current.beginMove()
      result.current.setAnnotationsLive((annotations) =>
        annotations.map((annotation) =>
          annotation.kind === 'farm' && annotation.mode === 'area'
            ? { ...annotation, x: 13, y: 14 }
            : annotation.kind === 'farm' && annotation.mode === 'cultivator'
              ? { ...annotation, points: annotation.points.map((point) => ({ x: point.x + 2, y: point.y })) }
              : annotation,
        ),
      )
      expect(result.current.finishMove()).toBe(true)
    })

    expect(result.current.annotations[0]).toMatchObject({
      points: [
        { x: 4, y: 3 },
        { x: 7, y: 3 },
      ],
    })
    expect(result.current.annotations[1]).toMatchObject({ x: 13, y: 14 })

    act(() => result.current.undo())
    expect(result.current.annotations).toEqual([cultivated, farmArea])
  })

  it('records same-level draw-order changes as one undoable edit', () => {
    const second = { ...floor, id: 'second' }
    const upper = { ...floor, id: 'upper', level: 1 }
    const { result } = renderHook(() => usePlanHistory({ pieces: [floor, upper, second], annotations: [] }))

    act(() => expect(result.current.reorder(['floor'], 'front')).toBe(true))
    expect(result.current.pieces.map(({ id }) => id)).toEqual(['second', 'upper', 'floor'])
    expect(result.current.pieces.filter(({ level }) => level === 1)).toEqual([upper])

    act(() => expect(result.current.undo()).toBe(true))
    expect(result.current.pieces.map(({ id }) => id)).toEqual(['floor', 'upper', 'second'])
  })

  it('replaces imported content without adding an undo entry', () => {
    const { result } = renderHook(() => usePlanHistory({ pieces: [floor], annotations: [] }))

    act(() => result.current.replace({ pieces: [], annotations: [label] }))
    expect(result.current.pieces).toEqual([])
    expect(result.current.annotations).toEqual([label])
    expect(result.current.canUndo).toBe(false)
  })
})
