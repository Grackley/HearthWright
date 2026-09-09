import { describe, expect, it } from 'vitest'
import { findSavedMap } from './mapLibrary'
import type { LocalMapSummary } from '../types'

const map = (id: string, imageName: string, seed = 'world'): LocalMapSummary => ({
  id,
  seed,
  imageName,
  imageWidth: 8192,
  imageHeight: 8192,
  metersPerPixel: 2.9296875,
  resolution: 'high',
})

describe('saved map restoration', () => {
  const clean = map('clean-id', 'Map_world Large.png')
  const pois = map('poi-id', 'Map_world.png')

  it('restores the exact saved map id', () => {
    expect(findSavedMap([clean, pois], { localMapId: 'clean-id', seed: 'world' })).toBe(clean)
  })

  it('falls back to the exact image name when a path-based id changed', () => {
    expect(findSavedMap([clean, pois], { localMapId: 'old-id', mapImageName: clean.imageName })).toBe(clean)
  })

  it('never guesses between same-seed map variants', () => {
    expect(findSavedMap([clean, pois], { seed: 'world' })).toBeUndefined()
    expect(findSavedMap([clean], { seed: 'world' })).toBe(clean)
  })

  it('does not replace a missing named map with another same-seed image', () => {
    expect(findSavedMap([pois], { mapImageName: clean.imageName, seed: 'world' })).toBeUndefined()
  })
})
