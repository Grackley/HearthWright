import { describe, expect, it } from 'vitest'
import type { PieceRangeMap, PlacedPiece } from '../types'
import { connectedStationExtensions, effectiveCraftingRange, playerBaseRanges } from './rangeOverlays'

const stationPiece: PlacedPiece = {
  id: 'station',
  pieceId: 'workbench',
  x: 10,
  y: 20,
  rotation: 0,
  level: 0,
}

const ranges: PieceRangeMap = {
  workbench: {
    origin: { x: 0, y: 0 },
    effectAreas: [],
    stationExtensions: [],
    craftingStations: [
      {
        nameToken: '$piece_workbench',
        displayName: 'Workbench',
        rangeBuild: 20,
        extraRangePerLevel: 4,
        offset: { x: 0, y: 0 },
      },
    ],
  },
  adze: {
    origin: { x: 0, y: 0 },
    effectAreas: [],
    craftingStations: [],
    stationExtensions: [
      {
        extensionNameToken: '$piece_workbench_ext3',
        extensionName: 'Adze',
        stationNameToken: '$piece_workbench',
        stationName: 'Workbench',
        maxStationDistance: 5,
        stack: false,
        offset: { x: 0, y: 0 },
      },
    ],
  },
}

describe('crafting range overlays', () => {
  it('increases station range for a connected same-level upgrade', () => {
    const adze: PlacedPiece = { id: 'adze', pieceId: 'adze', x: 14, y: 20, rotation: 0, level: 0 }
    const result = effectiveCraftingRange(
      stationPiece,
      ranges.workbench.craftingStations[0],
      [stationPiece, adze],
      ranges,
    )

    expect(result.radius).toBe(24)
    expect(result.extensions.map(({ piece }) => piece.id)).toEqual(['adze'])
  })

  it('does not count out-of-range, cross-level, or duplicate non-stacking upgrades', () => {
    const pieces: PlacedPiece[] = [
      stationPiece,
      { id: 'first', pieceId: 'adze', x: 14.9, y: 20, rotation: 0, level: 0 },
      { id: 'duplicate', pieceId: 'adze', x: 13, y: 20, rotation: 0, level: 0 },
      { id: 'boundary', pieceId: 'adze', x: 15, y: 20, rotation: 0, level: 0 },
      { id: 'upper', pieceId: 'adze', x: 10, y: 20, rotation: 0, level: 1 },
    ]

    expect(
      connectedStationExtensions(stationPiece, ranges.workbench.craftingStations[0], pieces, ranges),
    ).toHaveLength(1)
  })

  it('keeps actual PlayerBase areas while removing a redundant contained ring', () => {
    expect(
      playerBaseRanges(stationPiece, {
        ...ranges.workbench,
        effectAreas: [
          { type: 'Heat, PlayerBase, Fire', radius: 30, offset: { x: 0, y: 0 } },
          { type: 'PlayerBase', radius: 20, offset: { x: 0, y: 0 } },
          { type: 'Heat, Fire', radius: 5, offset: { x: 0, y: 0 } },
        ],
      }),
    ).toEqual([{ center: { x: 10, y: 20 }, radius: 30 }])
  })
})
