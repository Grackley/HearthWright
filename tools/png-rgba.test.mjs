import { describe, expect, it } from 'vitest'
import pngRgba from './png-rgba.cjs'

const { darkenPngNeutrals, decodeRgbaPng, encodeRgbaPng } = pngRgba

describe('PNG material correction', () => {
  it('darkens neutral material pixels without muting colored emissive pixels', () => {
    const source = encodeRgbaPng({
      width: 2,
      height: 1,
      pixels: Buffer.from([200, 190, 195, 255, 200, 50, 20, 255]),
    })
    const corrected = decodeRgbaPng(darkenPngNeutrals(source, 0.25))

    expect([...corrected.pixels]).toEqual([50, 48, 49, 255, 200, 50, 20, 255])
  })
})
