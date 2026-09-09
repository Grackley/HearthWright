import { describe, expect, it } from 'vitest'
import { placementSnapActive } from './snapMode'

describe('placementSnapActive', () => {
  it('temporarily disables piece snapping while Shift is held', () => {
    expect(placementSnapActive('place', 'piece', false)).toBe(true)
    expect(placementSnapActive('line', 'piece', true)).toBe(false)
    expect(placementSnapActive('box', 'piece', false)).toBe(true)
    expect(placementSnapActive('place', 'free', false)).toBe(false)
  })
})
