import { describe, expect, it } from 'vitest'
import { summarizeSelectedMaterials } from './materials'
import type { PieceDefinition, PieceResourceMap, PlacedPiece } from '../types'

const definition = (id: string, name: string, cost: string): PieceDefinition => ({
  id,
  name,
  cost,
  category: 'Structure',
  shape: 'rect',
  width: 2,
  depth: 2,
  color: '#fff',
  material: 'Building',
  snapPoints: [],
  tags: [],
})

const definitions = {
  floor: definition('floor', 'Wood Floor', '2 wood'),
  wall: definition('wall', 'Stone Wall', '4 stone'),
  marker: definition('marker', 'Window Opening', 'planning guide'),
}

const placed = (id: string, pieceId: string): PlacedPiece => ({ id, pieceId, x: 0, y: 0, rotation: 0 })

describe('selected material summaries', () => {
  it('groups selected pieces by type and combines all material totals', () => {
    const resources: PieceResourceMap = {
      wall: [
        { prefabName: 'Stone', displayName: 'Stone', amount: 4, recover: true },
        { prefabName: 'Wood', displayName: 'Wood', amount: 1, recover: true },
      ],
    }
    const result = summarizeSelectedMaterials(
      [placed('a', 'floor'), placed('b', 'floor'), placed('c', 'wall')],
      (id) => definitions[id as keyof typeof definitions],
      resources,
    )

    expect(result.groups).toEqual([
      { pieceId: 'floor', count: 2, materials: [{ prefabName: 'Wood', displayName: 'Wood', amount: 4 }] },
      {
        pieceId: 'wall',
        count: 1,
        materials: [
          { prefabName: 'Stone', displayName: 'Stone', amount: 4 },
          { prefabName: 'Wood', displayName: 'Wood', amount: 1 },
        ],
      },
    ])
    expect(result.totals).toEqual([
      { prefabName: 'Stone', displayName: 'Stone', amount: 4 },
      { prefabName: 'Wood', displayName: 'Wood', amount: 5 },
    ])
  })

  it('uses extracted resources instead of a definition fallback and leaves planning markers empty', () => {
    const resources: PieceResourceMap = {
      floor: [{ prefabName: 'FineWood', displayName: 'Fine Wood', amount: 3, recover: true }],
    }
    const result = summarizeSelectedMaterials(
      [placed('a', 'floor'), placed('b', 'marker')],
      (id) => definitions[id as keyof typeof definitions],
      resources,
    )
    expect(result.groups[0].materials).toEqual([
      { prefabName: 'FineWood', displayName: 'Fine Wood', amount: 3 },
    ])
    expect(result.groups[1].materials).toEqual([])
  })
})
