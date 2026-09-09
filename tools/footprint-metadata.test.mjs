import { describe, expect, it } from 'vitest'
import footprintMetadata from './footprint-metadata.cjs'

const { measuredFootprint } = footprintMetadata

describe('visible prefab footprint measurement', () => {
  it('uses the transparent sprite silhouette to exclude invisible geometry bounds', () => {
    expect(
      measuredFootprint(
        { shape: 'rect', width: 2, depth: 1.2 },
        { available: true, width: 4, depth: 4 },
        { width: 324, height: 223 },
      ),
    ).toEqual({ width: 2.8, depth: 1.9 })
  })

  it('preserves the catalog long axis and makes circle footprints round', () => {
    const bounds = { available: true, width: 4.25, depth: 5.07 }
    const sprite = { width: 394, height: 468 }
    expect(measuredFootprint({ shape: 'rect', width: 2.4, depth: 1.5 }, bounds, sprite)).toEqual({
      width: 5.1,
      depth: 4.2,
    })
    expect(measuredFootprint({ shape: 'circle', width: 1, depth: 1 }, bounds, sprite)).toEqual({
      width: 5.1,
      depth: 5.1,
    })
  })

  it('does not report a measurement without valid geometry bounds', () => {
    expect(
      measuredFootprint(
        { shape: 'rect', width: 1, depth: 1 },
        { available: false, width: 0, depth: 0 },
        { width: 100, height: 100 },
      ),
    ).toBeUndefined()
  })
})
