import { describe, expect, it } from 'vitest'
import {
  compareLevels,
  isLevelSnapTarget,
  readLevelViewModes,
  renderedLevelViewMode,
  listBuildingLevels,
  moveBuildingLevel,
  type LevelLayout,
} from './levels'

describe('reordering building levels', () => {
  const layout: LevelLayout = {
    pieces: [
      { id: 'ground', pieceId: 'wood-floor-2x2', x: 4, y: 6, rotation: 90 },
      { id: 'upper', pieceId: 'wood-floor-2x2', x: 4, y: 6, rotation: 22.5, level: 1 },
    ],
    annotations: [
      { id: 'note', kind: 'text', text: 'Upper hall', x: 5, y: 3, size: 1, color: '#fff', level: 1 },
      { id: 'pen', kind: 'pen', points: [{ x: 1, y: 2 }], width: 0.1, color: '#fff', level: 1 },
      {
        id: 'erase',
        kind: 'farm',
        mode: 'cultivator',
        action: 'erase',
        points: [{ x: 2, y: 4 }],
        radius: 3,
        level: 1,
      },
    ],
    activeLevel: 2,
    levelViewModes: { 0: 'hidden', 1: 'actual', 2: 'outline' },
  }

  it('fits an empty added level between occupied floors and moves all notes and visibility with their floor', () => {
    const next = moveBuildingLevel(layout, 2, -1)
    expect(listBuildingLevels(next)).toEqual([0, 1, 2])
    expect(next.activeLevel).toBe(1)
    expect(next.pieces).toEqual([layout.pieces[0], { ...layout.pieces[1], level: 2 }])
    expect(next.annotations).toEqual(layout.annotations.map((item) => ({ ...item, level: 2 })))
    expect(next.levelViewModes).toEqual({ 0: 'hidden', 1: 'outline', 2: 'actual' })
    expect(moveBuildingLevel(next, 1, 1)).toEqual(layout)
    expect(layout.pieces[1].level).toBe(1)
  })

  it('uses adjacent existing floors across basement levels and numbering gaps', () => {
    const initial = {
      ...layout,
      activeLevel: 0,
      levelViewModes: { '-2': 'hidden' as const, 5: 'actual' as const },
    }
    const next = moveBuildingLevel(initial, 0, -1)
    expect(listBuildingLevels(next)).toEqual([-2, 0, 1, 5])
    expect(next.activeLevel).toBe(-2)
    expect(next.pieces[0]).toEqual({ ...layout.pieces[0], level: -2 })
    expect(next.levelViewModes).toEqual({ '-2': 'outline', 0: 'hidden', 5: 'actual' })
    expect(next.pieces[1]).toBe(initial.pieces[1])
  })

  it('does nothing at list boundaries or for a nonexistent level', () => {
    expect(moveBuildingLevel(layout, 0, -1)).toBe(layout)
    expect(moveBuildingLevel(layout, 2, 1)).toBe(layout)
    expect(moveBuildingLevel(layout, 9, -1)).toBe(layout)
  })
})

describe('building level view modes', () => {
  it('always renders the active level as actual', () => {
    expect(renderedLevelViewMode(2, 2, { 2: 'hidden' })).toBe('actual')
  })

  it('defaults inactive levels to dotted outlines', () => {
    expect(renderedLevelViewMode(0, 1, {})).toBe('outline')
  })

  it('keeps outline and actual levels available to snapping but excludes hidden levels', () => {
    const modes = { 0: 'outline', 1: 'actual', 2: 'hidden' } as const
    expect(isLevelSnapTarget(0, 3, modes)).toBe(true)
    expect(isLevelSnapTarget(1, 3, modes)).toBe(true)
    expect(isLevelSnapTarget(2, 3, modes)).toBe(false)
  })

  it('orders lower levels before higher levels and ignores malformed saved modes', () => {
    const levels = [{ level: 2 }, { level: -1 }, {}, { level: 1 }].sort(compareLevels)
    expect(levels.map(({ level }) => level ?? 0)).toEqual([-1, 0, 1, 2])
    expect(readLevelViewModes({ '-1': 'actual', 0: 'outline', 1: 'bad', nope: 'hidden' })).toEqual({
      '-1': 'actual',
      0: 'outline',
    })
  })
})
