import { describe, expect, it } from 'vitest'
import { createPieceSpatialIndex } from './spatialIndex'

describe('piece spatial index', () => {
  const pieces = [
    { id: 'near', pieceId: 'wood-floor-2x2', x: 1, y: 1, rotation: 0, level: 0 },
    { id: 'edge', pieceId: 'wood-wall', x: 17, y: 0, rotation: 0, level: 0 },
    { id: 'far', pieceId: 'stone-floor', x: 400, y: 400, rotation: 0, level: 0 },
  ]

  it('returns only pieces intersecting a local view and retains plan order', () => {
    const index = createPieceSpatialIndex(pieces)
    expect(index.query({ left: -2, right: 18, top: -2, bottom: 3 }).map((piece) => piece.id)).toEqual([
      'near',
      'edge',
    ])
  })

  it('supports wide overview queries without missing pieces', () => {
    const index = createPieceSpatialIndex(pieces)
    expect(
      index.query({ left: -1000, right: 1000, top: -1000, bottom: 1000 }).map((piece) => piece.id),
    ).toEqual(['near', 'edge', 'far'])
  })
})
