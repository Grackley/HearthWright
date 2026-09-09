import type { PieceDefinition, PieceSnapPointMap } from '../types'

// Mesh bounds include roof overhangs and decorative ends. Repeated construction
// follows opposing connection points; an axis without anchors uses its footprint.
export const placementSpacing = (piece: PieceDefinition, extracted?: PieceSnapPointMap) => {
  const points = extracted?.[piece.id]
  const span = (axis: 'x' | 'y', fallback: number) => {
    if (!points?.length) return fallback
    let minimum = Infinity
    let maximum = -Infinity
    for (const point of points) {
      minimum = Math.min(minimum, point[axis])
      maximum = Math.max(maximum, point[axis])
    }
    return maximum - minimum > 0.001 ? maximum - minimum : fallback
  }
  return { width: span('x', piece.width), depth: span('y', piece.depth) }
}
