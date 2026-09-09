import { describe, expect, it } from 'vitest'
import type { VisualBundleManifest } from '../types'
import {
  comfortFromVisualBundle,
  craftingStationsFromVisualBundle,
  rangesFromVisualBundle,
  resourcesFromVisualBundle,
  snapPointsFromVisualBundle,
} from './visualBundle'

describe('comfortFromVisualBundle', () => {
  it('keeps captured zero values and excludes invalid values', () => {
    const pieces = {
      chair: { sprite: '', prefabName: 'chair', displayName: 'Chair', comfort: 2 },
      ward: { sprite: '', prefabName: 'ward', displayName: 'Ward', comfort: 0 },
      invalid: { sprite: '', prefabName: 'invalid', displayName: 'Invalid', comfort: -1 },
    } satisfies VisualBundleManifest['pieces']

    expect(comfortFromVisualBundle(pieces)).toEqual({ chair: 2, ward: 0 })
  })
})

const entry = (snapPoints?: { x: number; y: number }[]) => ({
  sprite: 'sprites/test.png',
  prefabName: 'test_prefab',
  displayName: 'Test Piece',
  ...(snapPoints === undefined ? {} : { snapPoints }),
})

describe('visual bundle snap metadata', () => {
  it('keeps verified empty snap sets distinct from legacy entries with no metadata', () => {
    const pieces = {
      verified: entry([]),
      legacy: entry(),
    } satisfies VisualBundleManifest['pieces']

    expect(snapPointsFromVisualBundle(pieces)).toEqual({ verified: [] })
  })

  it('copies finite extracted coordinates and rejects malformed points', () => {
    const pieces = {
      door: {
        ...entry(),
        snapPoints: [
          { x: -1, y: -0.264 },
          { x: -1, y: 0 },
          { x: 1, y: 0.264 },
          { x: Number.NaN, y: 0 },
        ],
      },
    } as VisualBundleManifest['pieces']

    expect(snapPointsFromVisualBundle(pieces)).toEqual({
      door: [
        { x: -1, y: -0.264 },
        { x: -1, y: 0 },
        { x: 1, y: 0.264 },
      ],
    })
  })

  it('copies valid extracted build requirements and rejects malformed entries', () => {
    const pieces = {
      forge: {
        ...entry(),
        resources: [
          { prefabName: 'Stone', displayName: 'Stone', amount: 4, recover: true },
          { prefabName: 'Wood', displayName: 'Wood', amount: 0, recover: true },
        ],
      },
    } as VisualBundleManifest['pieces']

    expect(resourcesFromVisualBundle(pieces)).toEqual({
      forge: [{ prefabName: 'Stone', displayName: 'Stone', amount: 4, recover: true }],
    })
  })

  it('keeps required crafting stations and verified no-station records distinct', () => {
    const pieces = {
      stone: {
        ...entry(),
        craftingStation: { prefabName: 'piece_stonecutter', displayName: 'Stonecutter' },
      },
      campfire: { ...entry(), craftingStation: null },
      legacy: entry(),
    } satisfies VisualBundleManifest['pieces']

    expect(craftingStationsFromVisualBundle(pieces)).toEqual({
      stone: { prefabName: 'piece_stonecutter', displayName: 'Stonecutter' },
      campfire: null,
    })
  })

  it('copies valid range metadata and preserves the projected prefab origin', () => {
    const pieces = {
      workbench: {
        ...entry(),
        prefabOrigin: { x: -0.4, y: 0.2 },
        rangeOrigin: { x: -0.1, y: 0.05 },
        effectAreas: [
          { type: 'PlayerBase', radius: 20, offset: { x: -0.4, y: 0.2 } },
          { type: 'PlayerBase', radius: -1, offset: { x: 0, y: 0 } },
        ],
        craftingStationRanges: [
          {
            nameToken: '$piece_workbench',
            displayName: 'Workbench',
            rangeBuild: 20,
            extraRangePerLevel: 4,
            offset: { x: -0.4, y: 0.2 },
          },
        ],
        stationExtensions: [],
      },
    } satisfies VisualBundleManifest['pieces']

    expect(rangesFromVisualBundle(pieces)).toEqual({
      workbench: {
        origin: { x: -0.1, y: 0.05 },
        effectAreas: [{ type: 'PlayerBase', radius: 20, offset: { x: -0.4, y: 0.2 } }],
        craftingStations: [
          {
            nameToken: '$piece_workbench',
            displayName: 'Workbench',
            rangeBuild: 20,
            extraRangePerLevel: 4,
            offset: { x: -0.4, y: 0.2 },
          },
        ],
        stationExtensions: [],
      },
    })
  })
})
