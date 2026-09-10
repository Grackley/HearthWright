import { describe, expect, it } from 'vitest'
import {
  mapImageResolution,
  mapMetersPerPixel,
  mapOverviewDownsampleFactor,
  mapSeedFromFilename,
  mapTileCoordinates,
  mapTileDownsampleFactor,
} from './mapImages'

describe('PNG map calibration', () => {
  it('calibrates full-world Image Only exports at each supported resolution', () => {
    expect(mapMetersPerPixel(4096)).toBe(6)
    expect(mapMetersPerPixel(6144)).toBe(4)
    expect(mapMetersPerPixel(8192)).toBe(3)
  })

  it('recognizes standard image resolutions and keeps one seed across variants', () => {
    expect(mapImageResolution(4096)).toBe('small')
    expect(mapImageResolution(6144)).toBe('medium')
    expect(mapImageResolution(8192)).toBe('high')
    expect(mapSeedFromFilename('Map_8tORtoNI95 Small.png')).toBe('8tORtoNI95')
    expect(mapSeedFromFilename('Map_8tORtoNI95 Med.png')).toBe('8tORtoNI95')
  })

  it('uses small mip tiles at world scale and native tiles at build scale', () => {
    expect(mapTileDownsampleFactor((0.03 * 24576) / 8192)).toBe(16)
    expect(mapTileDownsampleFactor(0.2)).toBe(4)
    expect(mapTileDownsampleFactor(0.4)).toBe(2)
    expect(mapTileDownsampleFactor(0.8)).toBe(1)
    expect(mapTileDownsampleFactor(20)).toBe(1)
    expect(mapOverviewDownsampleFactor(4096, 4096)).toBe(8)
    expect(mapOverviewDownsampleFactor(6144, 6144)).toBe(16)
    expect(mapOverviewDownsampleFactor(8192, 8192)).toBe(16)
  })

  it('returns only intersecting, edge-clamped source tiles', () => {
    expect(
      mapTileCoordinates(8192, 8192, 4, {
        left: 1900,
        right: 4200,
        top: 2000,
        bottom: 2300,
      }),
    ).toEqual([
      { column: 0, row: 0, sourceX: 0, sourceY: 0, sourceWidth: 2048, sourceHeight: 2048 },
      { column: 1, row: 0, sourceX: 2048, sourceY: 0, sourceWidth: 2048, sourceHeight: 2048 },
      { column: 2, row: 0, sourceX: 4096, sourceY: 0, sourceWidth: 2048, sourceHeight: 2048 },
      { column: 0, row: 1, sourceX: 0, sourceY: 2048, sourceWidth: 2048, sourceHeight: 2048 },
      { column: 1, row: 1, sourceX: 2048, sourceY: 2048, sourceWidth: 2048, sourceHeight: 2048 },
      { column: 2, row: 1, sourceX: 4096, sourceY: 2048, sourceWidth: 2048, sourceHeight: 2048 },
    ])

    expect(
      mapTileCoordinates(6144, 6144, 4, {
        left: 6000,
        right: 7000,
        top: 6000,
        bottom: 7000,
      }),
    ).toEqual([{ column: 2, row: 2, sourceX: 4096, sourceY: 4096, sourceWidth: 2048, sourceHeight: 2048 }])
  })
})
