import type { PieceDefinition, PieceSnapPointMap, PlacedPiece, Point } from '../types'
import { placementSpacing } from './placementSpacing'

export const MAX_BOX_PIECES = 2_500

export const boxPlacementPositions = (
  start: Point,
  end: Point,
  piece: PieceDefinition,
  rotation: number,
  extracted?: PieceSnapPointMap,
): PlacedPiece[] => {
  const radians = (rotation * Math.PI) / 180
  const widthAxis = { x: Math.cos(radians), y: Math.sin(radians) }
  const depthAxis = { x: -widthAxis.y, y: widthAxis.x }
  const delta = { x: end.x - start.x, y: end.y - start.y }
  const widthProjection = delta.x * widthAxis.x + delta.y * widthAxis.y
  const depthProjection = delta.x * depthAxis.x + delta.y * depthAxis.y
  const spacing = placementSpacing(piece, extracted)
  const columns = Math.max(1, Math.round(Math.abs(widthProjection) / spacing.width) + 1)
  const rows = Math.max(1, Math.round(Math.abs(depthProjection) / spacing.depth) + 1)
  const widthSign = widthProjection < 0 ? -1 : 1
  const depthSign = depthProjection < 0 ? -1 : 1
  const placements: PlacedPiece[] = []

  for (let row = 0; row < rows && placements.length < MAX_BOX_PIECES; row += 1) {
    for (let column = 0; column < columns && placements.length < MAX_BOX_PIECES; column += 1) {
      placements.push({
        id: `box-${row}-${column}`,
        pieceId: piece.id,
        x:
          start.x +
          widthAxis.x * spacing.width * column * widthSign +
          depthAxis.x * spacing.depth * row * depthSign,
        y:
          start.y +
          widthAxis.y * spacing.width * column * widthSign +
          depthAxis.y * spacing.depth * row * depthSign,
        rotation,
      })
    }
  }

  return placements
}
