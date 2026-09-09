import type {
  PieceDefinition,
  PieceSnapPointMap,
  PlacedPiece,
  Point,
  SnapPointName,
  SnapResult,
} from '../types'
import { pieceById } from '../data/pieces'

export const rotatePoint = (point: Point, degrees: number): Point => {
  const radians = (degrees * Math.PI) / 180
  const cos = Math.cos(radians)
  const sin = Math.sin(radians)
  return { x: point.x * cos - point.y * sin, y: point.x * sin + point.y * cos }
}

export const localSnapPoint = (piece: PieceDefinition, name: SnapPointName): Point => {
  const halfWidth = piece.width / 2
  const halfDepth = piece.depth / 2
  const points: Record<SnapPointName, Point> = {
    nw: { x: -halfWidth, y: -halfDepth },
    ne: { x: halfWidth, y: -halfDepth },
    se: { x: halfWidth, y: halfDepth },
    sw: { x: -halfWidth, y: halfDepth },
    n: { x: 0, y: -halfDepth },
    e: { x: halfWidth, y: 0 },
    s: { x: 0, y: halfDepth },
    w: { x: -halfWidth, y: 0 },
    center: { x: 0, y: 0 },
  }
  return points[name]
}

export const localSnapPoints = (piece: PieceDefinition, extracted?: PieceSnapPointMap): readonly Point[] => {
  const exact = extracted?.[piece.id]
  return exact === undefined ? piece.snapPoints.map((name) => localSnapPoint(piece, name)) : exact
}

export const snapPointRadius = (piece: PieceDefinition, extracted?: PieceSnapPointMap) =>
  localSnapPoints(piece, extracted).reduce(
    (radius, point) => Math.max(radius, Math.hypot(point.x, point.y)),
    0,
  )

export const worldSnapPoints = (placed: PlacedPiece, extracted?: PieceSnapPointMap): Point[] => {
  const definition = pieceById(placed.pieceId)
  return localSnapPoints(definition, extracted).map((point) => {
    const rotated = rotatePoint(point, placed.rotation)
    return { x: placed.x + rotated.x, y: placed.y + rotated.y }
  })
}

export const findSnap = (
  cursor: Point,
  definition: PieceDefinition,
  rotation: number,
  placedPieces: PlacedPiece[],
  thresholdWorld: number,
  extracted?: PieceSnapPointMap,
): SnapResult => {
  let best: SnapResult = { ...cursor, snapped: false }
  let bestDistance = thresholdWorld
  const targetPoints = placedPieces.flatMap((piece) => worldSnapPoints(piece, extracted))

  for (const sourcePoint of localSnapPoints(definition, extracted)) {
    const source = rotatePoint(sourcePoint, rotation)
    for (const target of targetPoints) {
      const candidateX = target.x - source.x
      const candidateY = target.y - source.y
      const distance = Math.hypot(candidateX - cursor.x, candidateY - cursor.y)
      if (distance < bestDistance) {
        bestDistance = distance
        best = {
          x: candidateX,
          y: candidateY,
          target,
          source: { x: candidateX + source.x, y: candidateY + source.y },
          snapped: true,
        }
      }
    }
  }
  return best
}

export type MoveSnapResult = {
  offsetX: number
  offsetY: number
  snapped: boolean
  source?: Point
  target?: Point
}

export const findMoveSnap = (
  movingPieces: PlacedPiece[],
  placedPieces: PlacedPiece[],
  thresholdWorld: number,
  extracted?: PieceSnapPointMap,
): MoveSnapResult => {
  const movingIds = new Set(movingPieces.map(({ id }) => id))
  const sourcePoints = movingPieces.flatMap((piece) => worldSnapPoints(piece, extracted))
  const targetPoints = placedPieces
    .filter(({ id }) => !movingIds.has(id))
    .flatMap((piece) => worldSnapPoints(piece, extracted))
  let best: MoveSnapResult = { offsetX: 0, offsetY: 0, snapped: false }
  if (!(thresholdWorld > 0) || !Number.isFinite(thresholdWorld)) return best
  let bestDistanceSquared = thresholdWorld * thresholdWorld

  // Hash target anchors by the snap tolerance. Each moving anchor only needs
  // the nine neighboring cells, even when a selected group spans the whole plan.
  const buckets = new Map<number, Map<number, { point: Point; order: number }[]>>()
  targetPoints.forEach((point, order) => {
    const x = Math.floor(point.x / thresholdWorld)
    const y = Math.floor(point.y / thresholdWorld)
    let column = buckets.get(x)
    if (!column) buckets.set(x, (column = new Map()))
    let cell = column.get(y)
    if (!cell) column.set(y, (cell = []))
    cell.push({ point, order })
  })

  for (const source of sourcePoints) {
    const cellX = Math.floor(source.x / thresholdWorld)
    const cellY = Math.floor(source.y / thresholdWorld)
    let bestTargetOrder = Infinity
    for (let x = cellX - 1; x <= cellX + 1; x += 1) {
      const column = buckets.get(x)
      if (!column) continue
      for (let y = cellY - 1; y <= cellY + 1; y += 1) {
        for (const { point: target, order } of column.get(y) ?? []) {
          const offsetX = target.x - source.x
          const offsetY = target.y - source.y
          const distanceSquared = offsetX * offsetX + offsetY * offsetY
          if (
            distanceSquared < bestDistanceSquared ||
            (best.source === source && distanceSquared === bestDistanceSquared && order < bestTargetOrder)
          ) {
            bestDistanceSquared = distanceSquared
            bestTargetOrder = order
            best = { offsetX, offsetY, source, target, snapped: true }
          }
        }
      }
    }
    if (bestDistanceSquared === 0) break
  }
  return best
}

export const pointInPiece = (point: Point, placed: PlacedPiece): boolean => {
  const definition = pieceById(placed.pieceId)
  const local = rotatePoint({ x: point.x - placed.x, y: point.y - placed.y }, -placed.rotation)
  const hitDepth = definition.shape === 'line' ? Math.max(definition.depth, 0.12) : definition.depth
  if (definition.shape === 'circle') return Math.hypot(local.x, local.y) <= definition.width / 2
  if (definition.shape === 'triangle') {
    const normalizedX = (local.x + definition.width / 2) / definition.width
    const normalizedY = (local.y + definition.depth / 2) / definition.depth
    return normalizedX >= 0 && normalizedY >= 0 && normalizedX <= normalizedY && normalizedY <= 1
  }
  if (definition.shape === 'quarterCircle') {
    const radius = Math.min(definition.width, definition.depth)
    const right = definition.tags.includes('right')
    const centerX = right ? definition.width / 2 : -definition.width / 2
    const centerY = -definition.depth / 2
    return (
      Math.abs(local.x) <= definition.width / 2 &&
      Math.abs(local.y) <= definition.depth / 2 &&
      Math.hypot(local.x - centerX, local.y - centerY) <= radius
    )
  }
  return Math.abs(local.x) <= definition.width / 2 && Math.abs(local.y) <= hitDepth / 2
}

export const roundTo = (value: number, interval: number) => Math.round(value / interval) * interval

export const formatDistance = (meters: number) =>
  meters >= 1000 ? `${(meters / 1000).toFixed(1)} km` : `${meters.toFixed(meters < 10 ? 1 : 0)} m`
