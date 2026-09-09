import { pieceById } from '../data/pieces'
import type { PlacedPiece, PlanAnnotation, Point } from '../types'
import { isCultivatorErase } from './farming'
import { pointInPiece, rotatePoint } from './geometry'

export type SelectionBounds = { left: number; right: number; top: number; bottom: number }

const boxFromPoints = (start: Point, end: Point): SelectionBounds => ({
  left: Math.min(start.x, end.x),
  right: Math.max(start.x, end.x),
  top: Math.min(start.y, end.y),
  bottom: Math.max(start.y, end.y),
})

export const annotationBounds = (annotation: PlanAnnotation): SelectionBounds => {
  if (annotation.kind === 'text') {
    const width = Math.max(annotation.size * 0.5, annotation.text.length * annotation.size * 0.58)
    return {
      left: annotation.x,
      right: annotation.x + width,
      top: annotation.y - annotation.size,
      bottom: annotation.y + annotation.size * 0.24,
    }
  }

  if (annotation.kind === 'farm' && annotation.mode === 'area') {
    return {
      left: annotation.x - annotation.width / 2,
      right: annotation.x + annotation.width / 2,
      top: annotation.y - annotation.height / 2,
      bottom: annotation.y + annotation.height / 2,
    }
  }

  const padding = annotation.kind === 'pen' ? annotation.width / 2 : annotation.radius
  return {
    left: Math.min(...annotation.points.map((point) => point.x)) - padding,
    right: Math.max(...annotation.points.map((point) => point.x)) + padding,
    top: Math.min(...annotation.points.map((point) => point.y)) - padding,
    bottom: Math.max(...annotation.points.map((point) => point.y)) + padding,
  }
}

const boxesIntersect = (first: SelectionBounds, second: SelectionBounds) =>
  first.right >= second.left &&
  first.left <= second.right &&
  first.bottom >= second.top &&
  first.top <= second.bottom

const pointInBounds = (point: Point, bounds: SelectionBounds) =>
  point.x >= bounds.left && point.x <= bounds.right && point.y >= bounds.top && point.y <= bounds.bottom

const cross = (first: Point, second: Point, third: Point) =>
  (second.x - first.x) * (third.y - first.y) - (second.y - first.y) * (third.x - first.x)

const segmentsIntersect = (a: Point, b: Point, c: Point, d: Point) => {
  const abC = cross(a, b, c)
  const abD = cross(a, b, d)
  const cdA = cross(c, d, a)
  const cdB = cross(c, d, b)
  const epsilon = 1e-9
  const onSegment = (start: Point, end: Point, point: Point) =>
    point.x >= Math.min(start.x, end.x) - epsilon &&
    point.x <= Math.max(start.x, end.x) + epsilon &&
    point.y >= Math.min(start.y, end.y) - epsilon &&
    point.y <= Math.max(start.y, end.y) + epsilon
  if (Math.abs(abC) <= epsilon && onSegment(a, b, c)) return true
  if (Math.abs(abD) <= epsilon && onSegment(a, b, d)) return true
  if (Math.abs(cdA) <= epsilon && onSegment(c, d, a)) return true
  if (Math.abs(cdB) <= epsilon && onSegment(c, d, b)) return true
  return abC < 0 !== abD < 0 && cdA < 0 !== cdB < 0
}

const pieceBoundary = (piece: PlacedPiece): Point[] => {
  const definition = pieceById(piece.pieceId)
  const width = definition.width
  const depth = definition.depth
  let local: Point[]
  if (definition.shape === 'triangle') {
    local = [
      { x: -width / 2, y: -depth / 2 },
      { x: width / 2, y: depth / 2 },
      { x: -width / 2, y: depth / 2 },
    ]
  } else if (definition.shape === 'quarterCircle') {
    const radius = Math.min(width, depth)
    const right = definition.tags.includes('right')
    const center = { x: right ? width / 2 : -width / 2, y: -depth / 2 }
    const start = right ? Math.PI : 0
    const end = Math.PI / 2
    local = [center]
    for (let index = 0; index <= 12; index += 1) {
      const angle = start + ((end - start) * index) / 12
      local.push({ x: center.x + Math.cos(angle) * radius, y: center.y + Math.sin(angle) * radius })
    }
  } else {
    local = [
      { x: -width / 2, y: -depth / 2 },
      { x: width / 2, y: -depth / 2 },
      { x: width / 2, y: depth / 2 },
      { x: -width / 2, y: depth / 2 },
    ]
  }
  return local.map((point) => {
    const rotated = rotatePoint(point, piece.rotation)
    return { x: piece.x + rotated.x, y: piece.y + rotated.y }
  })
}

export const pieceIntersectsBox = (piece: PlacedPiece, bounds: SelectionBounds) => {
  const definition = pieceById(piece.pieceId)
  if (definition.shape === 'circle') {
    const closestX = Math.max(bounds.left, Math.min(piece.x, bounds.right))
    const closestY = Math.max(bounds.top, Math.min(piece.y, bounds.bottom))
    return Math.hypot(piece.x - closestX, piece.y - closestY) <= definition.width / 2
  }

  const boundary = pieceBoundary(piece)
  if (boundary.some((point) => pointInBounds(point, bounds))) return true
  const boxCorners = [
    { x: bounds.left, y: bounds.top },
    { x: bounds.right, y: bounds.top },
    { x: bounds.right, y: bounds.bottom },
    { x: bounds.left, y: bounds.bottom },
  ]
  if (boxCorners.some((point) => pointInPiece(point, piece))) return true
  const boxEdges = boxCorners.map((point, index) => [point, boxCorners[(index + 1) % boxCorners.length]])
  return boundary.some((point, index) => {
    const next = boundary[(index + 1) % boundary.length]
    return boxEdges.some(([start, end]) => segmentsIntersect(point, next, start, end))
  })
}

const distanceToSegment = (point: Point, start: Point, end: Point) => {
  const dx = end.x - start.x
  const dy = end.y - start.y
  const lengthSquared = dx * dx + dy * dy
  if (lengthSquared === 0) return Math.hypot(point.x - start.x, point.y - start.y)
  const portion = Math.max(
    0,
    Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared),
  )
  return Math.hypot(point.x - (start.x + portion * dx), point.y - (start.y + portion * dy))
}

export const pointInAnnotation = (point: Point, annotation: PlanAnnotation, tolerance = 0) => {
  if (isCultivatorErase(annotation)) return false
  if (annotation.kind === 'text') {
    const bounds = annotationBounds(annotation)
    return (
      point.x >= bounds.left - tolerance &&
      point.x <= bounds.right + tolerance &&
      point.y >= bounds.top - tolerance &&
      point.y <= bounds.bottom + tolerance
    )
  }

  if (annotation.kind === 'farm' && annotation.mode === 'area') {
    const halfWidth = annotation.width / 2
    const halfHeight = annotation.height / 2
    const radius = Math.min(annotation.cornerRadius, halfWidth, halfHeight)
    const dx = Math.abs(point.x - annotation.x)
    const dy = Math.abs(point.y - annotation.y)
    if (dx > halfWidth + tolerance || dy > halfHeight + tolerance) return false
    if (dx <= halfWidth - radius || dy <= halfHeight - radius) return true
    return Math.hypot(dx - (halfWidth - radius), dy - (halfHeight - radius)) <= radius + tolerance
  }

  const threshold = (annotation.kind === 'pen' ? annotation.width / 2 : annotation.radius) + tolerance
  for (let index = 1; index < annotation.points.length; index += 1) {
    if (distanceToSegment(point, annotation.points[index - 1], annotation.points[index]) <= threshold)
      return true
  }
  return (
    annotation.points.length === 1 &&
    Math.hypot(point.x - annotation.points[0].x, point.y - annotation.points[0].y) <= threshold
  )
}

export const piecesIntersectingBox = (pieces: PlacedPiece[], start: Point, end: Point, level: number) => {
  const bounds = boxFromPoints(start, end)
  return pieces
    .filter((piece) => {
      if ((piece.level ?? 0) !== level) return false
      return pieceIntersectsBox(piece, bounds)
    })
    .map((piece) => piece.id)
}

export const annotationsIntersectingBox = (
  annotations: PlanAnnotation[],
  start: Point,
  end: Point,
  level: number,
) => {
  const selection = boxFromPoints(start, end)
  return annotations
    .filter(
      (annotation) =>
        !isCultivatorErase(annotation) &&
        (annotation.level ?? 0) === level &&
        boxesIntersect(selection, annotationBounds(annotation)),
    )
    .map((annotation) => annotation.id)
}

export const duplicateLayout = (pieces: PlacedPiece[], offset: Point, idFactory: () => string) =>
  pieces.map((piece) => ({
    ...piece,
    id: idFactory(),
    x: piece.x + offset.x,
    y: piece.y + offset.y,
  }))

export const cloneAnnotation = (annotation: PlanAnnotation): PlanAnnotation => {
  if (annotation.kind === 'text' || (annotation.kind === 'farm' && annotation.mode === 'area')) {
    return { ...annotation }
  }
  return { ...annotation, points: annotation.points.map((point) => ({ ...point })) }
}

export const translateAnnotation = (annotation: PlanAnnotation, offset: Point): PlanAnnotation => {
  if (annotation.kind === 'text' || (annotation.kind === 'farm' && annotation.mode === 'area')) {
    return { ...annotation, x: annotation.x + offset.x, y: annotation.y + offset.y }
  }
  return {
    ...annotation,
    points: annotation.points.map((point) => ({ x: point.x + offset.x, y: point.y + offset.y })),
  }
}

export const duplicateAnnotations = (
  annotations: PlanAnnotation[],
  offset: Point,
  idFactory: () => string,
): PlanAnnotation[] =>
  annotations.map((annotation) => ({ ...translateAnnotation(annotation, offset), id: idFactory() }))
