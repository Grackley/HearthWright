import { pieceById } from '../data/pieces'
import type { PlacedPiece, Point } from '../types'
import { rotatePoint } from './geometry'

const footprintCorners = (piece: PlacedPiece): Point[] => {
  const definition = pieceById(piece.pieceId)
  const corners = [
    { x: -definition.width / 2, y: -definition.depth / 2 },
    { x: definition.width / 2, y: -definition.depth / 2 },
    { x: definition.width / 2, y: definition.depth / 2 },
    { x: -definition.width / 2, y: definition.depth / 2 },
  ]
  return corners.map((corner) => {
    const rotated = rotatePoint(corner, piece.rotation)
    return { x: piece.x + rotated.x, y: piece.y + rotated.y }
  })
}

export const rotatePieceGroup = (
  pieces: PlacedPiece[],
  selectedIds: readonly string[],
  amount: number,
): PlacedPiece[] => {
  const selected = new Set(selectedIds)
  const targets = pieces.filter((piece) => selected.has(piece.id))
  if (!targets.length) return pieces

  const corners = targets.flatMap(footprintCorners)
  const left = Math.min(...corners.map(({ x }) => x))
  const right = Math.max(...corners.map(({ x }) => x))
  const top = Math.min(...corners.map(({ y }) => y))
  const bottom = Math.max(...corners.map(({ y }) => y))
  const pivot = { x: (left + right) / 2, y: (top + bottom) / 2 }

  return pieces.map((piece) => {
    if (!selected.has(piece.id)) return piece
    const offset = rotatePoint({ x: piece.x - pivot.x, y: piece.y - pivot.y }, amount)
    return {
      ...piece,
      x: pivot.x + offset.x,
      y: pivot.y + offset.y,
      rotation: (piece.rotation + amount + 360) % 360,
    }
  })
}

export const rotateMovingPieceGroup = (pieces: PlacedPiece[], cursor: Point, amount: number) => ({
  start: { ...cursor },
  pieces: rotatePieceGroup(
    pieces,
    pieces.map((piece) => piece.id),
    amount,
  ),
})
