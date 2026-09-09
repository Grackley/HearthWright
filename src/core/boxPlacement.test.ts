import { describe, expect, it } from 'vitest'
import { pieceById } from '../data/pieces'
import { boxPlacementPositions, MAX_BOX_PIECES } from './boxPlacement'

describe('boxPlacementPositions', () => {
  it('uses roof connection spacing in both axes after rotation', () => {
    const roof = pieceById('buildable-wood-roof')
    const anchors = {
      [roof.id]: [
        { x: -1, y: -1 },
        { x: 1, y: -1 },
        { x: -1, y: 1 },
        { x: 1, y: 1 },
      ],
    }
    const result = boxPlacementPositions({ x: 10, y: 10 }, { x: 6, y: 14 }, roof, 90, anchors)
    expect(result).toHaveLength(9)
    expect(result.at(-1)).toMatchObject({ x: 6, y: 14 })
  })
  it('fills a rectangular floor area without gaps or duplicate centers', () => {
    const placements = boxPlacementPositions(
      { x: 0, y: 0 },
      { x: 4.1, y: 2.1 },
      pieceById('wood-floor-2x2'),
      0,
    )

    expect(placements.map(({ x, y }) => [x, y])).toEqual([
      [0, 0],
      [2, 0],
      [4, 0],
      [0, 2],
      [2, 2],
      [4, 2],
    ])
  })

  it('follows the piece axes after rotation', () => {
    const placements = boxPlacementPositions(
      { x: 10, y: 10 },
      { x: 8, y: 14 },
      pieceById('wood-floor-2x2'),
      90,
    )

    expect(placements).toHaveLength(6)
    expect(placements.at(-1)).toMatchObject({ x: 8, y: 14, rotation: 90 })
  })

  it('caps oversized fills before they can stall the canvas', () => {
    expect(
      boxPlacementPositions({ x: 0, y: 0 }, { x: 10_000, y: 10_000 }, pieceById('wood-floor-1x1'), 0),
    ).toHaveLength(MAX_BOX_PIECES)
  })
})
