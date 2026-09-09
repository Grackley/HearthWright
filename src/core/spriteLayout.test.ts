import { describe, expect, it } from 'vitest'
import { spriteLayout } from './spriteLayout'

describe('spriteLayout', () => {
  it('fills structural footprints all the way to their snap extents', () => {
    const wall = spriteLayout(455, 99, 2, 0.16, 'stretch')
    expect(wall).toMatchObject({ rotateQuarterTurn: false, width: 2, height: 0.16 })
  })

  it('rotates a portrait furniture image into a landscape footprint without stretching it', () => {
    const rug = spriteLayout(250, 350, 2.2, 1.4, 'contain')
    expect(rug.rotateQuarterTurn).toBe(true)
    expect(rug.width).toBeCloseTo(1.96)
    expect(rug.height).toBe(1.4)
  })

  it('contains ordinary furniture at its natural aspect ratio', () => {
    const furniture = spriteLayout(400, 200, 3, 2, 'contain')
    expect(furniture).toMatchObject({ rotateQuarterTurn: false, width: 3, height: 1.5 })
  })
})
