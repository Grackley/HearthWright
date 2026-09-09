import { describe, expect, it } from 'vitest'
import type { PlacedPiece } from '../types'
import { rotateMovingPieceGroup, rotatePieceGroup } from './groupTransform'

const floor = (id: string, x: number, y: number, rotation = 0): PlacedPiece => ({
  id,
  pieceId: 'wood-floor-1x1',
  x,
  y,
  rotation,
})

describe('piece-group rotation', () => {
  it('rotates positions and orientations around the shared footprint center', () => {
    const rotated = rotatePieceGroup([floor('left', 0, 0), floor('right', 2, 0)], ['left', 'right'], 90)

    expect(rotated[0]).toMatchObject({ x: expect.closeTo(1), y: expect.closeTo(-1), rotation: 90 })
    expect(rotated[1]).toMatchObject({ x: expect.closeTo(1), y: expect.closeTo(1), rotation: 90 })
  })

  it('rotates a single selected piece in place and leaves other pieces unchanged', () => {
    const untouched = floor('other', 4, 5, 45)
    const rotated = rotatePieceGroup([floor('selected', 1, 2, 337.5), untouched], ['selected'], 22.5)

    expect(rotated[0]).toMatchObject({ x: expect.closeTo(1), y: expect.closeTo(2), rotation: 0 })
    expect(rotated[1]).toBe(untouched)
  })

  it('returns the original collection when no selected piece exists', () => {
    const pieces = [floor('only', 0, 0)]
    expect(rotatePieceGroup(pieces, ['missing'], 90)).toBe(pieces)
  })

  it('rebases a dragged group after rotation so continued dragging preserves the shared layout', () => {
    const moved = [floor('left', 3, 0), floor('right', 5, 0)]
    const rebased = rotateMovingPieceGroup(moved, { x: 3, y: 0 }, 90)
    const continuedCursor = { x: 4, y: 0 }
    const dx = continuedCursor.x - rebased.start.x
    const dy = continuedCursor.y - rebased.start.y
    const continued = rebased.pieces.map((piece) => ({ ...piece, x: piece.x + dx, y: piece.y + dy }))

    expect(continued[0]).toMatchObject({ x: expect.closeTo(5), y: expect.closeTo(-1), rotation: 90 })
    expect(continued[1]).toMatchObject({ x: expect.closeTo(5), y: expect.closeTo(1), rotation: 90 })
  })
})
