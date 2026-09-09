import { describe, expect, it } from 'vitest'
import type { PlacedPiece } from '../types'
import { reorderPiecesWithinLevels } from './layerOrder'

const piece = (id: string, level = 0) => ({ id, pieceId: 'wood-floor-2x2', x: 0, y: 0, rotation: 0, level })
const ids = (pieces: PlacedPiece[]) => pieces.map(({ id }) => id)

describe('same-level piece order', () => {
  it('moves a selection one step forward or backward', () => {
    const pieces = [piece('a'), piece('b'), piece('c'), piece('d')]
    expect(ids(reorderPiecesWithinLevels(pieces, ['b', 'c'], 'forward'))).toEqual(['a', 'd', 'b', 'c'])
    expect(ids(reorderPiecesWithinLevels(pieces, ['b', 'c'], 'backward'))).toEqual(['b', 'c', 'a', 'd'])
  })

  it('moves a selection to the front or back', () => {
    const pieces = [piece('a'), piece('b'), piece('c'), piece('d')]
    expect(ids(reorderPiecesWithinLevels(pieces, ['b', 'd'], 'front'))).toEqual(['a', 'c', 'b', 'd'])
    expect(ids(reorderPiecesWithinLevels(pieces, ['b', 'd'], 'back'))).toEqual(['b', 'd', 'a', 'c'])
  })

  it('never crosses a building-level boundary', () => {
    const pieces = [piece('ground-a'), piece('upper-a', 1), piece('ground-b'), piece('upper-b', 1)]
    const reordered = reorderPiecesWithinLevels(pieces, ['ground-a'], 'front')
    expect(reordered.filter(({ level }) => (level ?? 0) === 0).map(({ id }) => id)).toEqual([
      'ground-b',
      'ground-a',
    ])
    expect(reordered.filter(({ level }) => level === 1).map(({ id }) => id)).toEqual(['upper-a', 'upper-b'])
  })

  it('returns the original array when order cannot change', () => {
    const pieces = [piece('a'), piece('b')]
    expect(reorderPiecesWithinLevels(pieces, ['b'], 'front')).toBe(pieces)
  })
})
