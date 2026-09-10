import { describe, expect, it } from 'vitest'
import { imagePixelToWorld, metersPerPixel, worldToImagePixel } from './mapProjection'

const WORLD_WIDTH = 24576
const IMAGE_SIZE = 8192

describe('Valheim map projection', () => {
  it('derives the supplied export scale', () => {
    expect(metersPerPixel(WORLD_WIDTH, IMAGE_SIZE)).toBe(3)
  })

  it('places world origin at the image center', () => {
    expect(worldToImagePixel({ x: 0, z: 0 }, WORLD_WIDTH, IMAGE_SIZE, IMAGE_SIZE)).toEqual({
      x: 4096,
      y: 4096,
    })
  })

  it('flips positive Valheim Z toward the top of the image', () => {
    const north = worldToImagePixel({ x: 0, z: 6144 }, WORLD_WIDTH, IMAGE_SIZE, IMAGE_SIZE)
    const south = worldToImagePixel({ x: 0, z: -6144 }, WORLD_WIDTH, IMAGE_SIZE, IMAGE_SIZE)
    expect(north.y).toBe(2048)
    expect(south.y).toBe(6144)
  })

  it('maps the full PNG bounds to plus and minus 12,288 meters', () => {
    expect(imagePixelToWorld({ x: 0, y: 0 }, WORLD_WIDTH, IMAGE_SIZE, IMAGE_SIZE)).toEqual({
      x: -12288,
      z: 12288,
    })
    expect(imagePixelToWorld({ x: 8192, y: 8192 }, WORLD_WIDTH, IMAGE_SIZE, IMAGE_SIZE)).toEqual({
      x: 12288,
      z: -12288,
    })
  })

  it('round-trips sub-meter world coordinates', () => {
    const world = { x: 437.2, z: -5250.6 }
    const pixel = worldToImagePixel(world, WORLD_WIDTH, IMAGE_SIZE, IMAGE_SIZE)
    const restored = imagePixelToWorld(pixel, WORLD_WIDTH, IMAGE_SIZE, IMAGE_SIZE)
    expect(restored.x).toBeCloseTo(world.x, 8)
    expect(restored.z).toBeCloseTo(world.z, 8)
  })
})
