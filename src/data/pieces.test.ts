import { describe, expect, it } from 'vitest'
import { CAPTURED_BUILDABLE_SEEDS } from './capturedBuildablePieces'
import { CAPTURED_COMFORT_BY_PIECE_ID } from './comfort'
import { CATEGORIES, PIECES } from './pieces'

describe('piece catalog', () => {
  it('organizes the 1.0 construction families and steep variants without mixing them into furniture', () => {
    for (const [name, category, group] of [
      ['Timber Wall', 'Timberwood', 'Walls & openings'],
      ['Scalewood Wall 67° Left (Inverted)', 'Timberwood', 'Scalewood walls'],
      ['Timberwood Drawbridge', 'Timberwood', 'Drawbridges'],
      ['Rustic Drawbridge', 'Corewood', 'Drawbridges'],
      ['Ice Block', 'Ice', 'Blocks'],
      ['Stone Fence', 'Stone', 'Fences'],
      ['Roundpole Gate', 'Wood', 'Doors & gates'],
      ['Wood Wall 67°', 'Wood', 'Walls & openings'],
      ['Shingle Roof 67°', 'Darkwood', 'Shingle roofs'],
      ['Darkwood Beam 67°', 'Darkwood', 'Beams & poles'],
    ]) {
      expect(PIECES.find((piece) => piece.name === name)).toMatchObject({ category, group })
    }
    expect(PIECES.some((piece) => piece.name.startsWith('['))).toBe(false)
  })

  it('keeps the replaced 26-degree wall compatible with existing saved plans', () => {
    expect(CAPTURED_BUILDABLE_SEEDS.find((piece) => piece.id === 'buildable-wood-wall-roof')).toMatchObject({
      sourcePrefab: 'wood_wall_roof_a',
      name: 'Wood Wall 26°',
    })
    expect(PIECES.some((piece) => piece.id === 'buildable-wood-wall-roof-a')).toBe(false)
  })

  it('groups the 1.0 crafting upgrades with the stations they extend', () => {
    for (const [upgrade, station] of [
      ["Smith's Aprons", 'Black Forge'],
      ['Smoker', 'Cauldron'],
      ['Standing Loom', 'Galdr Table'],
    ]) {
      expect(PIECES.find((piece) => piece.name === upgrade)).toMatchObject({
        category: 'Crafting',
        group: station,
        visual: 'upgrade',
        color: PIECES.find((piece) => piece.name === station)!.color,
      })
    }
  })

  it('allocates the current roster to the in-game Furniture and Crafting panels', () => {
    expect(PIECES.filter((piece) => piece.category === 'Furniture')).toHaveLength(125)
    expect(PIECES.filter((piece) => piece.category === 'Crafting')).toHaveLength(54)
    expect(PIECES.find((piece) => piece.name === 'Food Preparation Table')?.category).toBe('Crafting')
    expect(PIECES.find((piece) => piece.name === 'Artisan Press')?.category).toBe('Crafting')
    expect(PIECES.find((piece) => piece.name === 'Barber Station')).toMatchObject({
      category: 'Furniture',
      group: 'Comfort',
    })
  })

  it('keeps every captured comfort-producing catalog piece in Furniture', () => {
    const comfortPieceIds = Object.keys(CAPTURED_COMFORT_BY_PIECE_ID)

    expect(comfortPieceIds.length).toBeGreaterThan(0)
    comfortPieceIds.forEach((pieceId) =>
      expect(PIECES.find((piece) => piece.id === pieceId)?.category).toBe('Furniture'),
    )
  })

  it('covers every registered Hammer piece without planning-only catalog objects', () => {
    expect(CAPTURED_BUILDABLE_SEEDS).toHaveLength(238)
    expect(PIECES).toHaveLength(397)
    expect(PIECES.find((piece) => piece.id === 'window-2m')).toBeUndefined()
    expect(new Set(CAPTURED_BUILDABLE_SEEDS.map((piece) => piece.sourcePrefab)).size).toBe(238)
    expect(CAPTURED_BUILDABLE_SEEDS.every((piece) => piece.tags.includes('captured-buildable'))).toBe(true)
  })

  it('includes the Hot Tub and the complete captured beam and pole supplement', () => {
    expect(PIECES.find((piece) => piece.name === 'Hot Tub')).toMatchObject({
      category: 'Furniture',
      group: 'Comfort',
      width: 3.3,
      depth: 3.7,
    })
    const names = CAPTURED_BUILDABLE_SEEDS.map((piece) => piece.name)
    expect(names).toEqual(
      expect.arrayContaining([
        'Wood Beam 1 m',
        'Wood Beam 2 m',
        'Wood Beam 26°',
        'Wood Beam 45°',
        'Wood Pole 1 m',
        'Wood Pole 2 m',
        'Log Beam 2 m',
        'Log Beam 4 m',
        'Log Pole 2 m',
        'Log Pole 4 m',
        'Darkwood Beam 2 m',
        'Darkwood Beam 4 m',
        'Darkwood Pole 2m',
        'Darkwood Pole 4m',
        'Ashwood Beam 1 m',
        'Ashwood Beam 2 m',
        'Ashwood Pole 1 m',
        'Ashwood Pole 2 m',
        'Wood Iron Beam',
        'Wood Iron Pole',
        'Flametal Beam',
        'Flametal Pillar',
        'Grausten Small Beam',
        'Grausten Medium Beam',
      ]),
    )
  })

  it('uses material-based construction categories followed by the existing object categories', () => {
    expect(CATEGORIES).toEqual([
      'Wood',
      'Corewood',
      'Darkwood',
      'Ashwood',
      'Timberwood',
      'Stone',
      'Black Marble',
      'Grausten',
      'Ice',
      'Metal',
      'Dvergr',
      'Furniture',
      'Crafting',
      'Utility',
    ])
    expect(PIECES.some((piece) => piece.category === 'Structure' || piece.category === 'Walls')).toBe(false)
    CATEGORIES.forEach((category) => expect(PIECES.some((piece) => piece.category === category)).toBe(true))
    const vehicles = PIECES.filter(
      (piece) =>
        piece.category === 'Utility' &&
        ['Boats', 'Land transport', 'Siege engines'].includes(piece.group ?? ''),
    )
    expect(vehicles.map((piece) => piece.name)).toEqual([
      'Raft',
      'Karve',
      'Longship',
      'Drakkar',
      'Cart',
      'Catapult',
      'Battering Ram',
    ])
    expect(vehicles.map((piece) => [piece.name, piece.width, piece.depth])).toEqual([
      ['Raft', 11.6, 12.8],
      ['Karve', 11.9, 15.4],
      ['Longship', 11.6, 35.4],
      ['Drakkar', 15.2, 35.6],
      ['Cart', 2.1, 3.4],
      ['Catapult', 3.8, 6],
      ['Battering Ram', 3.9, 5.1],
    ])
    vehicles.forEach((piece) => {
      expect(piece.visual).toBe('vehicle')
      expect(piece.snapPoints).toEqual([])
    })
    expect(PIECES.find((piece) => piece.name === 'Ward')).toMatchObject({
      category: 'Utility',
      group: 'Utility & defenses',
    })
    expect(
      PIECES.filter((piece) => piece.group === 'Utility & defenses').every(
        (piece) => piece.category === 'Utility',
      ),
    ).toBe(true)
  })

  it('includes vertical access pieces with usable snap points', () => {
    const verticalAccess = PIECES.filter((piece) => /stair|ladder/i.test(piece.name))
    expect(verticalAccess.map((piece) => piece.name)).toEqual(
      expect.arrayContaining([
        'Ashwood Stair',
        'Dvergr Spiral Staircase Left',
        'Dvergr Spiral Staircase Right',
        'Grausten Steep Stairs',
        'Wood Ladder',
        'Wood Stairs',
      ]),
    )
    expect(verticalAccess).toHaveLength(9)
    verticalAccess.forEach((piece) => expect(piece.snapPoints.length).toBeGreaterThan(0))
  })

  it('includes cage walls and distinct one-meter doors', () => {
    expect(PIECES.find((piece) => piece.name === 'Cage Wall 1×1')).toMatchObject({
      width: 1,
      depth: 0.1,
      tags: expect.arrayContaining(['cage']),
    })
    expect(PIECES.find((piece) => piece.name === 'Cage Wall 2×2')).toMatchObject({
      width: 2,
      depth: 0.4,
      tags: expect.arrayContaining(['cage']),
    })
    expect(PIECES.find((piece) => piece.name === 'Wood Door')).toMatchObject({
      width: 2,
      depth: 0.5,
      group: 'Doors & gates',
    })
    expect(PIECES.find((piece) => piece.name === 'Ashwood Door')).toMatchObject({
      width: 2,
      depth: 0.5,
      group: 'Doors & gates',
    })
    expect(PIECES.find((piece) => piece.name === 'Wood Gate')).toMatchObject({
      width: 2,
      depth: 0.5,
      group: 'Doors & gates',
    })
    expect(PIECES.find((piece) => piece.name === 'Darkwood Gate')).toMatchObject({ width: 2, depth: 0.6 })
    expect(PIECES.find((piece) => piece.name === 'Iron Gate')).toMatchObject({ width: 2, depth: 0.12 })
    expect(PIECES.find((piece) => piece.name === 'Flametal Gate')).toMatchObject({ width: 1.5, depth: 0.6 })
    expect(PIECES.find((piece) => piece.name === 'Hexagonal Gate')).toMatchObject({ width: 4, depth: 0.7 })
    expect(PIECES.find((piece) => piece.name === 'Wood Door')?.snapPoints).toEqual([
      'nw',
      'ne',
      'se',
      'sw',
      'w',
      'e',
    ])
    for (const name of ['Ashwood Door', 'Wood Gate', 'Darkwood Gate', 'Iron Gate', 'Flametal Gate']) {
      expect(PIECES.find((piece) => piece.name === name)?.snapPoints).toEqual(['w', 'e'])
    }
    expect(PIECES.find((piece) => piece.name === 'Hexagonal Gate')?.snapPoints).toEqual(['center'])
  })

  it('keeps fire and lighting pieces in a dedicated Furniture group', () => {
    const lighting = PIECES.filter(
      (piece) => piece.category === 'Furniture' && piece.group === 'Fire & lighting',
    )
    expect(lighting).toHaveLength(20)
    expect(lighting.map((piece) => piece.name)).toEqual(
      expect.arrayContaining([
        'Campfire',
        'Bonfire',
        'Iron Fire Pit',
        'Hearth',
        'Sconce',
        'Standing Wood Torch',
        'Dvergr Wall Lantern',
      ]),
    )
  })

  it('keeps every catalog id unique', () => {
    expect(new Set(PIECES.map((piece) => piece.id)).size).toBe(PIECES.length)
  })

  it('uses corner and long-side anchors for thick walls', () => {
    for (const id of ['stone-wall', 'stone-wall-4x2', 'black-marble-2x1x1']) {
      const piece = PIECES.find((candidate) => candidate.id === id)!
      expect(piece.snapPoints).toEqual(['nw', 'ne', 'se', 'sw', 'n', 's'])
      expect(piece.snapPoints).not.toContain('e')
      expect(piece.snapPoints).not.toContain('w')
      expect(piece.snapPoints).not.toContain('center')
    }
    expect(PIECES.find((piece) => piece.id === 'stone-wall-1x1')?.snapPoints).toEqual([
      'nw',
      'ne',
      'se',
      'sw',
      'n',
      'e',
      's',
      'w',
    ])
  })

  it('uses corrected planner dimensions for ladders, walls, and measured objects', () => {
    expect(PIECES.find((piece) => piece.name === 'Wood Ladder')).toMatchObject({ width: 1, depth: 2 })
    expect(PIECES.find((piece) => piece.id === 'stone-wall')).toMatchObject({ depth: 1.2 })
    expect(PIECES.find((piece) => piece.id === 'black-marble-2x1x1')).toMatchObject({ depth: 1 })
    expect(PIECES.find((piece) => piece.id === 'grausten-wall-1x2')).toMatchObject({ width: 1, depth: 0.4 })
    expect(PIECES.find((piece) => piece.name === 'Grausten Steep Stairs')).toMatchObject({
      width: 1,
      depth: 2,
    })
    expect(PIECES.find((piece) => piece.name === 'Hearth')).toMatchObject({ width: 4.2, depth: 3.1 })
    expect(PIECES.find((piece) => piece.name === 'Treasure Chest')).toMatchObject({
      width: 1.1,
      depth: 0.9,
    })
    expect(PIECES.find((piece) => piece.name === 'Reinforced Chest')!.width).toBeLessThan(
      PIECES.find((piece) => piece.name === 'Black Metal Chest')!.width,
    )
  })

  it('uses the measured visible footprints for rugs', () => {
    expect(PIECES.find((piece) => piece.name === 'Asksvin Rug')).toMatchObject({ width: 2.7, depth: 2.6 })
    expect(PIECES.find((piece) => piece.name === 'Bearskin Rug')).toMatchObject({ width: 5.1, depth: 4.2 })
    expect(PIECES.find((piece) => piece.name === 'Hare Rug')).toMatchObject({ width: 1.6, depth: 0.9 })
    expect(PIECES.find((piece) => piece.name === 'Lox Rug')).toMatchObject({ width: 3.8, depth: 2.9 })
    expect(PIECES.find((piece) => piece.name === 'Wolf Rug')).toMatchObject({ width: 3.3, depth: 2.4 })
    expect(PIECES.find((piece) => piece.name === 'Blue Jute Carpet')).toMatchObject({ width: 3, depth: 3 })
    expect(PIECES.find((piece) => piece.name === 'Red Jute Carpet')).toMatchObject({ width: 4, depth: 3 })
  })

  it('distinguishes the measured Workbench and Forge footprints', () => {
    expect(PIECES.find((piece) => piece.name === 'Workbench')).toMatchObject({ width: 3.7, depth: 1.6 })
    expect(PIECES.find((piece) => piece.name === 'Forge')).toMatchObject({ width: 2, depth: 1.2 })
  })

  it('includes the current armour stand with both search spellings', () => {
    expect(PIECES.find((piece) => piece.id === 'furniture-armor-stand')).toMatchObject({
      name: 'Armour Stand',
      width: 1.1,
      depth: 1.1,
      tags: expect.arrayContaining(['armor', 'armour']),
    })
  })

  it('colors crafting upgrades with their matching station family', () => {
    const color = (name: string) => PIECES.find((piece) => piece.name === name)!.color
    expect(color('Adze')).toBe(color('Workbench'))
    expect(color('Anvils')).toBe(color('Forge'))
    expect(color('Black Forge Cooler')).toBe(color('Black Forge'))
    expect(color('Gem Cutter')).toBe(color('Black Forge'))
    expect(color('Feathery Wreath')).toBe(color('Galdr Table'))
    expect(color("Butcher's Table")).toBe(color('Cauldron'))
    expect(color('Artisan Press')).toBe(color('Artisan Table'))
    expect(
      new Set(
        [
          'Workbench',
          'Forge',
          'Black Forge',
          'Galdr Table',
          'Cauldron',
          'Cartography Table',
          'Artisan Table',
          'Stonecutter',
        ].map(color),
      ).size,
    ).toBe(8)
  })

  it('groups upgrades with their station in discovery order', () => {
    const crafting = PIECES.filter((piece) => piece.category === 'Crafting')
    expect(crafting.find((piece) => piece.name === 'Gem Cutter')).toMatchObject({
      group: 'Black Forge',
      visual: 'upgrade',
    })
    expect(crafting.find((piece) => piece.name === 'Rune Table')).toMatchObject({
      group: 'Galdr Table',
      visual: 'upgrade',
    })
    expect(crafting.find((piece) => piece.name === 'Artisan Press')).toMatchObject({
      group: 'Artisan Table',
      visual: 'upgrade',
    })
    expect(crafting.findIndex((piece) => piece.name === 'Workbench')).toBeLessThan(
      crafting.findIndex((piece) => piece.name === 'Forge'),
    )
    expect(crafting.findIndex((piece) => piece.name === 'Forge')).toBeLessThan(
      crafting.findIndex((piece) => piece.name === 'Black Forge'),
    )
  })

  it('uses the nominal one-meter span for the short Wood Beam', () => {
    expect(PIECES.find((piece) => piece.name === 'Wood Beam 1 m')).toMatchObject({
      width: 1,
      depth: 0.4,
    })
    expect(PIECES.find((piece) => piece.name === 'Wood Beam 2 m')).toMatchObject({
      width: 2,
      depth: 0.4,
    })
  })

  it('uses practical material subsections instead of forcing every floor into one group', () => {
    expect(PIECES.find((piece) => piece.name === 'Wood floor 2×2')).toMatchObject({
      category: 'Wood',
      group: 'Floors',
    })
    expect(PIECES.find((piece) => piece.name === 'Ashwood Decorative Floor')).toMatchObject({
      category: 'Ashwood',
      group: 'Floors',
    })
    for (const name of ['Stone floor 2×2', 'Black marble floor', 'Black Marble Floor Triangle']) {
      expect(PIECES.find((piece) => piece.name === name)?.group).toBe('Blocks & structures')
    }
    expect(PIECES.find((piece) => piece.name === 'Cage Floor 2×2')).toMatchObject({
      category: 'Metal',
      group: 'Floors & walls',
    })
    expect(PIECES.find((piece) => piece.name === 'Grausten Floor 4×4')).toMatchObject({
      category: 'Grausten',
      group: 'Blocks & structures',
    })
  })

  it('keeps related roofs, Dvergr structures, and crystal in their practical homes', () => {
    expect(PIECES.find((piece) => piece.name === 'Shingle Roof 26°')).toMatchObject({
      category: 'Darkwood',
      group: 'Shingle roofs',
    })
    expect(PIECES.find((piece) => piece.name === 'Thatch Roof 26°')).toMatchObject({
      category: 'Wood',
      group: 'Roofs',
    })
    expect(PIECES.find((piece) => piece.name === 'Dvergr Spiral Staircase Left')).toMatchObject({
      category: 'Dvergr',
      group: 'Stairs',
    })
    expect(PIECES.find((piece) => piece.name === 'Dvergr Stakewall')).toMatchObject({
      category: 'Utility',
      group: 'Utility & defenses',
    })
    expect(PIECES.find((piece) => piece.name === 'Crystal Wall 1x1')).toMatchObject({
      category: 'Furniture',
      group: 'Windows & partitions',
    })
  })
})
