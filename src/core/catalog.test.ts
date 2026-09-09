import { describe, expect, it } from 'vitest'
import { searchCatalog } from './catalog'

describe('catalog search', () => {
  it('finds a workbench while browsing wood and restores browsing for empty searches', () => {
    expect(searchCatalog('Wood', 'workbench').some((piece) => piece.id === 'workbench')).toBe(true)
    expect(searchCatalog('Wood', '  ').every((piece) => piece.category === 'Wood')).toBe(true)
  })
  it('matches multiple words without depending on their order', () => {
    expect(searchCatalog('Wood', 'roof thatch').length).toBeGreaterThan(0)
    expect(searchCatalog('Wood', 'nonexistentitem')).toEqual([])
  })
})
