import { describe, expect, it } from 'vitest'
import { pieceById } from '../data/pieces'
import { linePlacementPositions } from './linePlacement'

describe('linePlacementPositions', () => {
  it('connects roof anchors instead of spacing pieces by their overhangs', () => {
    const roof = pieceById('buildable-wood-roof')
    const anchors = {
      [roof.id]: [
        { x: -1, y: -1 },
        { x: 1, y: -1 },
        { x: -1, y: 1 },
        { x: 1, y: 1 },
      ],
    }
    expect(roof.width).toBeGreaterThan(2)
    const result = linePlacementPositions({ x: 0, y: 0 }, { x: 20, y: 0 }, roof, 0, anchors)
    expect(result).toHaveLength(11)
    expect(result.at(-1)!.x).toBe(20)
    expect(result[1].x - 1).toBe(result[0].x + 1)
  })

  it('uses horizontal projected beam length and keeps the fallback for an empty snap set', () => {
    const beam = pieceById('buildable-wood-beam-26')
    const anchors = {
      [beam.id]: [
        { x: -1, y: 0 },
        { x: 1, y: 0 },
      ],
    }
    const result = linePlacementPositions({ x: 0, y: 0 }, { x: 0, y: -6 }, beam, 90, anchors)
    expect(result).toHaveLength(4)
    expect(result.at(-1)!.y).toBeCloseTo(-6)
    expect(linePlacementPositions({ x: 0, y: 0 }, { x: 10, y: 0 }, beam, 0, { [beam.id]: [] })[1].x).toBe(
      beam.width,
    )
  })
  it('places an aligned horizontal run', () => {
    const result = linePlacementPositions({ x: 0, y: 0 }, { x: 6.1, y: 0.2 }, pieceById('wood-floor-2x2'), 0)
    expect(result.map(({ x, y }) => ({ x, y }))).toEqual([
      { x: 0, y: 0 },
      { x: 2, y: 0 },
      { x: 4, y: 0 },
      { x: 6, y: 0 },
    ])
  })

  it('uses the rotated piece axis', () => {
    const result = linePlacementPositions({ x: 2, y: 3 }, { x: 2, y: 9 }, pieceById('stone-wall'), 90)
    expect(result).toHaveLength(4)
    expect(result.at(-1)!.x).toBeCloseTo(2)
    expect(result.at(-1)!.y).toBeCloseTo(9)
  })

  it('places a run in the negative direction', () => {
    const result = linePlacementPositions({ x: 0, y: 0 }, { x: 0.2, y: -4.1 }, pieceById('wood-floor-2x2'), 0)
    expect(result.map(({ x, y }) => ({ x, y }))).toEqual([
      { x: 0, y: 0 },
      { x: 0, y: -2 },
      { x: 0, y: -4 },
    ])
  })
})
