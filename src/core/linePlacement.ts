import type { PieceDefinition, PieceSnapPointMap, PlacedPiece, Point } from '../types'
import { placementSpacing } from './placementSpacing'

const MAX_LINE_PIECES = 200

export const linePlacementPositions = (
  start: Point,
  end: Point,
  piece: PieceDefinition,
  rotation: number,
  extracted?: PieceSnapPointMap,
): PlacedPiece[] => {
  const radians = (rotation * Math.PI) / 180
  const axis = { x: Math.cos(radians), y: Math.sin(radians) }
  const perpendicular = { x: -axis.y, y: axis.x }
  const delta = { x: end.x - start.x, y: end.y - start.y }
  const alongWidth = delta.x * axis.x + delta.y * axis.y
  const alongDepth = delta.x * perpendicular.x + delta.y * perpendicular.y
  const useWidth = Math.abs(alongWidth) >= Math.abs(alongDepth)
  const direction = useWidth ? axis : perpendicular
  const projection = useWidth ? alongWidth : alongDepth
  const spacing = placementSpacing(piece, extracted)
  const step = useWidth ? spacing.width : spacing.depth
  const count = Math.min(MAX_LINE_PIECES, Math.max(1, Math.round(Math.abs(projection) / step) + 1))
  const sign = projection < 0 ? -1 : 1

  return Array.from({ length: count }, (_, index) => ({
    id: `line-${index}`,
    pieceId: piece.id,
    x: start.x + direction.x * step * index * sign,
    y: start.y + direction.y * step * index * sign,
    rotation,
  }))
}
