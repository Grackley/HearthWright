import { describe, expect, it } from 'vitest'
import snapMetadata from './snap-metadata.cjs'

const { projectPrefabOrigin, projectPrefabPoint, projectSnapPoints, selectRangeProjectionBounds } =
  snapMetadata

describe('captured snap-point projection', () => {
  it('projects the Wood Door to corners and the center of both ends', () => {
    const raw = [
      { x: 1, y: 1, z: 0 },
      { x: -1, y: 1, z: 0 },
      { x: 1, y: -1, z: 0 },
      { x: -1, y: -1, z: 0 },
      { x: 1, y: -1, z: 0.264 },
      { x: -1, y: -1, z: 0.264 },
      { x: 1, y: -1, z: -0.264 },
      { x: -1, y: -1, z: -0.264 },
    ]

    expect(projectSnapPoints(raw)).toEqual([
      { x: 1, y: 0 },
      { x: -1, y: 0 },
      { x: 1, y: 0.264 },
      { x: -1, y: 0.264 },
      { x: 1, y: -0.264 },
      { x: -1, y: -0.264 },
    ])
  })

  it('normalizes asymmetric prefab pivots to the centered captured visual', () => {
    expect(
      projectSnapPoints(
        [
          { x: -2, y: 0, z: 0 },
          { x: 0, y: 2, z: 0 },
        ],
        { centerX: -1, centerZ: 0 },
      ),
    ).toEqual([
      { x: -1, y: 0 },
      { x: 1, y: 0 },
    ])
    expect(projectPrefabOrigin({ centerX: -1, centerZ: 0.25 })).toEqual({ x: 1, y: -0.25 })
    expect(projectSnapPoints([])).toEqual([])
  })

  it('uses a complete snap layout instead of polluted renderer bounds', () => {
    expect(
      projectSnapPoints(
        [
          { x: -0.5, z: -0.5 },
          { x: 0.5, z: -0.5 },
          { x: 0.5, z: 0.5 },
          { x: -0.5, z: 0.5 },
        ],
        { centerX: 0.7425, centerZ: 0.2424 },
      ),
    ).toEqual([
      { x: -0.5, y: -0.5 },
      { x: 0.5, y: -0.5 },
      { x: 0.5, y: 0.5 },
      { x: -0.5, y: 0.5 },
    ])
  })

  it('keeps linear pieces on their shared prefab snap plane', () => {
    expect(
      projectSnapPoints(
        [
          { x: -0.5, z: 0 },
          { x: 0.5, z: 0 },
        ],
        { centerX: 0.007, centerZ: -0.0637 },
        true,
      ),
    ).toEqual([
      { x: -0.5, y: 0 },
      { x: 0.5, y: 0 },
    ])
  })

  it('projects captured child positions into the planner-centered footprint', () => {
    expect(projectPrefabPoint({ x: 1.25, z: -0.5 }, { centerX: 0.25, centerZ: -1 })).toEqual({
      x: 1,
      y: 0.5,
    })
  })

  it('uses mesh geometry to center ranges when effect renderers pollute the visual bounds', () => {
    const visualBounds = { available: true, centerX: -1.0398, centerZ: 0.7548 }
    const geometryBounds = { available: true, centerX: -0.0222, centerZ: 0.0599 }
    expect(selectRangeProjectionBounds(visualBounds, geometryBounds)).toBe(geometryBounds)
    expect(
      projectPrefabPoint({ x: 0, z: 0 }, selectRangeProjectionBounds(visualBounds, geometryBounds)),
    ).toEqual({
      x: 0.0222,
      y: -0.0599,
    })
  })
})
