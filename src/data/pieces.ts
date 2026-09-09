import type { PieceCategory, PieceDefinition, PieceShape, PieceVisual, SnapPointName } from '../types'
import { CAPTURED_BUILDABLE_SEEDS } from './capturedBuildablePieces'
import { CAPTURED_COMFORT_BY_PIECE_ID } from './comfort'

const allCorners = ['nw', 'ne', 'se', 'sw', 'n', 'e', 's', 'w'] as const
const thinLineSnaps: SnapPointName[] = ['w', 'e', 'center']
const woodDoorSnaps: SnapPointName[] = ['nw', 'ne', 'se', 'sw', 'w', 'e']
const gateEndSnaps: SnapPointName[] = ['w', 'e']
const thickWallSnaps: SnapPointName[] = ['nw', 'ne', 'se', 'sw', 'n', 's']

const corePieces: PieceDefinition[] = [
  {
    id: 'wood-floor-2x2',
    name: 'Wood floor 2×2',
    category: 'Structure',
    group: 'Floors',
    shape: 'rect',
    width: 2,
    depth: 2,
    color: '#d49b5b',
    material: 'Wood',
    cost: '2 wood',
    snapPoints: [...allCorners],
    tags: ['floor', 'foundation', 'wood', '2x2'],
    visual: 'floor',
  },
  {
    id: 'wood-floor-1x1',
    name: 'Wood floor 1×1',
    category: 'Structure',
    group: 'Floors',
    shape: 'rect',
    width: 1,
    depth: 1,
    color: '#c98f51',
    material: 'Wood',
    cost: '1 wood',
    snapPoints: [...allCorners],
    tags: ['floor', 'wood', '1x1'],
    visual: 'floor',
  },
  {
    id: 'ashwood-floor-2x2',
    name: 'Ashwood Floor 2×2',
    category: 'Structure',
    group: 'Floors',
    shape: 'rect',
    width: 2,
    depth: 2,
    color: '#c98653',
    material: 'Ashwood',
    cost: '4 ashwood',
    snapPoints: [...allCorners],
    tags: ['floor', 'ashlands', 'ashwood', '2x2'],
    visual: 'floor',
  },
  {
    id: 'ashwood-floor-1x1',
    name: 'Ashwood Floor 1×1',
    category: 'Structure',
    group: 'Floors',
    shape: 'rect',
    width: 1,
    depth: 1,
    color: '#bd784a',
    material: 'Ashwood',
    cost: '2 ashwood',
    snapPoints: [...allCorners],
    tags: ['floor', 'ashlands', 'ashwood', '1x1'],
    visual: 'floor',
  },
  {
    id: 'ashwood-decorative-floor',
    name: 'Ashwood Decorative Floor',
    category: 'Structure',
    group: 'Floors',
    shape: 'rect',
    width: 2,
    depth: 2,
    color: '#d39762',
    material: 'Ashwood',
    cost: '4 ashwood',
    snapPoints: [...allCorners],
    tags: ['floor', 'ashlands', 'ashwood', 'decorative', '2x2'],
    visual: 'floor',
  },
  {
    id: 'stone-floor-2x2',
    name: 'Stone floor 2×2',
    category: 'Structure',
    group: 'Floors',
    shape: 'rect',
    width: 2,
    depth: 2,
    color: '#89918d',
    material: 'Stone',
    cost: '6 stone',
    snapPoints: [...allCorners],
    tags: ['floor', 'foundation', 'stone', '2x2'],
    visual: 'floor',
  },
  {
    id: 'black-marble-floor',
    name: 'Black marble floor',
    category: 'Structure',
    group: 'Floors',
    shape: 'rect',
    width: 2,
    depth: 2,
    color: '#1e1d22',
    material: 'Black marble',
    cost: '4 black marble',
    snapPoints: [...allCorners],
    tags: ['floor', 'mistlands', 'marble', '2x2'],
    visual: 'floor',
  },
  {
    id: 'black-marble-floor-triangle',
    name: 'Black Marble Floor Triangle',
    category: 'Structure',
    group: 'Floors',
    shape: 'triangle',
    width: 2,
    depth: 2,
    color: '#1a191e',
    material: 'Black marble',
    cost: '3 black marble',
    snapPoints: [...allCorners],
    tags: ['floor', 'mistlands', 'marble', 'triangle', '2x2'],
    visual: 'floor',
  },
  {
    id: 'cage-floor-2x2',
    name: 'Cage Floor 2×2',
    category: 'Structure',
    group: 'Floors',
    shape: 'rect',
    width: 2,
    depth: 2,
    color: '#677276',
    material: 'Iron',
    cost: '2 iron',
    snapPoints: [...allCorners],
    tags: ['floor', 'cage', 'iron', '2x2'],
    visual: 'floor',
  },
  {
    id: 'cage-floor-1x1',
    name: 'Cage Floor 1×1',
    category: 'Structure',
    group: 'Floors',
    shape: 'rect',
    width: 1,
    depth: 1,
    color: '#59666a',
    material: 'Iron',
    cost: '1 iron',
    snapPoints: [...allCorners],
    tags: ['floor', 'cage', 'iron', '1x1'],
    visual: 'floor',
  },
  {
    id: 'grausten-floor-4x4',
    name: 'Grausten Floor 4×4',
    category: 'Structure',
    group: 'Floors',
    shape: 'rect',
    width: 4,
    depth: 4,
    color: '#a39b91',
    material: 'Grausten',
    cost: '8 grausten',
    snapPoints: [...allCorners],
    tags: ['floor', 'ashlands', 'grausten', '4x4'],
    visual: 'floor',
  },
  {
    id: 'grausten-floor-2x2',
    name: 'Grausten Floor 2×2',
    category: 'Structure',
    group: 'Floors',
    shape: 'rect',
    width: 2,
    depth: 2,
    color: '#aaa298',
    material: 'Grausten',
    cost: '4 grausten',
    snapPoints: [...allCorners],
    tags: ['floor', 'ashlands', 'grausten', '2x2'],
    visual: 'floor',
  },
  {
    id: 'grausten-floor-1x1',
    name: 'Grausten Floor 1×1',
    category: 'Structure',
    group: 'Floors',
    shape: 'rect',
    width: 1,
    depth: 1,
    color: '#918b84',
    material: 'Grausten',
    cost: '2 grausten',
    snapPoints: [...allCorners],
    tags: ['floor', 'ashlands', 'grausten', '1x1'],
    visual: 'floor',
  },
  {
    id: 'wood-wall-2x2',
    name: 'Wood wall 2×2',
    category: 'Walls',
    group: 'Walls',
    shape: 'line',
    width: 2,
    depth: 0.4,
    color: '#e2aa67',
    material: 'Wood',
    cost: '2 wood',
    snapPoints: thinLineSnaps,
    tags: ['wall', 'wood', '2x2'],
    visual: 'wall',
  },
  {
    id: 'wood-wall-1x1',
    name: 'Wood wall 1×1',
    category: 'Walls',
    group: 'Walls',
    shape: 'line',
    width: 1,
    depth: 0.4,
    color: '#d19a5d',
    material: 'Wood',
    cost: '1 wood',
    snapPoints: thinLineSnaps,
    tags: ['wall', 'wood', '1x1', 'half-length'],
    visual: 'wall',
  },
  {
    id: 'wood-wall-half',
    name: 'Wood Wall Half',
    category: 'Walls',
    group: 'Walls',
    shape: 'line',
    width: 2,
    depth: 0.4,
    color: '#ca9258',
    material: 'Wood',
    cost: '1 wood',
    snapPoints: thinLineSnaps,
    tags: ['wall', 'wood', 'half-height'],
    visual: 'wall',
  },
  {
    id: 'stone-wall-1x1',
    name: 'Stone Wall 1×1',
    category: 'Walls',
    group: 'Stone walls',
    shape: 'line',
    width: 1,
    depth: 1.2,
    color: '#8b938f',
    material: 'Stone',
    cost: '3 stone',
    snapPoints: [...allCorners],
    tags: ['wall', 'stone', '1x1', 'half-length', 'thick'],
    visual: 'wall',
  },
  {
    id: 'stone-wall',
    name: 'Stone Wall 2×1',
    category: 'Walls',
    group: 'Stone walls',
    shape: 'line',
    width: 2,
    depth: 1.2,
    color: '#9aa19d',
    material: 'Stone',
    cost: '4 stone',
    snapPoints: thickWallSnaps,
    tags: ['wall', 'stone', '2x1', 'thick'],
    visual: 'wall',
  },
  {
    id: 'stone-wall-4x2',
    name: 'Stone Wall 4×2',
    category: 'Walls',
    group: 'Stone walls',
    shape: 'line',
    width: 4,
    depth: 1.4,
    color: '#a3aaa5',
    material: 'Stone',
    cost: '6 stone',
    snapPoints: thickWallSnaps,
    tags: ['wall', 'stone', '4x2', 'thick'],
    visual: 'wall',
  },
  {
    id: 'black-marble-1x1x1',
    name: 'Black Marble 1×1×1',
    category: 'Walls',
    group: 'Black marble blocks',
    shape: 'rect',
    width: 1,
    depth: 1,
    color: '#17161a',
    material: 'Black marble',
    cost: '2 black marble',
    snapPoints: [...allCorners],
    tags: ['wall', 'block', 'marble', '1x1x1', 'half-length', 'thick'],
    visual: 'wall',
  },
  {
    id: 'black-marble-2x1x1',
    name: 'Black Marble 2×1×1',
    category: 'Walls',
    group: 'Black marble blocks',
    shape: 'rect',
    width: 2,
    depth: 1,
    color: '#1a191e',
    material: 'Black marble',
    cost: '4 black marble',
    snapPoints: thickWallSnaps,
    tags: ['wall', 'block', 'marble', '2x1x1', 'thick'],
    visual: 'wall',
  },
  {
    id: 'black-marble-2x2x2',
    name: 'Black Marble 2×2×2',
    category: 'Walls',
    group: 'Black marble blocks',
    shape: 'rect',
    width: 2,
    depth: 2,
    color: '#1e1c21',
    material: 'Black marble',
    cost: '8 black marble',
    snapPoints: [...allCorners],
    tags: ['wall', 'block', 'marble', '2x2x2', 'thick'],
    visual: 'wall',
  },
  {
    id: 'grausten-wall-1x2',
    name: 'Grausten Wall 1×2',
    category: 'Walls',
    group: 'Grausten walls',
    shape: 'line',
    width: 1,
    depth: 0.4,
    color: '#938d86',
    material: 'Grausten',
    cost: '4 grausten',
    snapPoints: thickWallSnaps,
    tags: ['wall', 'grausten', '1x2', 'half-length', 'thick'],
    visual: 'wall',
  },
  {
    id: 'grausten-wall-2x2',
    name: 'Grausten Wall 2×2',
    category: 'Walls',
    group: 'Grausten walls',
    shape: 'line',
    width: 2,
    depth: 0.4,
    color: '#a29b92',
    material: 'Grausten',
    cost: '6 grausten',
    snapPoints: thickWallSnaps,
    tags: ['wall', 'grausten', '2x2', 'thick'],
    visual: 'wall',
  },
  {
    id: 'grausten-wall-4x2',
    name: 'Grausten Wall 4×2',
    category: 'Walls',
    group: 'Grausten walls',
    shape: 'line',
    width: 4,
    depth: 0.4,
    color: '#aaa299',
    material: 'Grausten',
    cost: '12 grausten',
    snapPoints: thickWallSnaps,
    tags: ['wall', 'grausten', '4x2', 'thick'],
    visual: 'wall',
  },
  {
    id: 'cage-wall-1x1',
    name: 'Cage Wall 1×1',
    category: 'Walls',
    group: 'Cage walls',
    shape: 'line',
    width: 1,
    depth: 0.1,
    color: '#66757a',
    material: 'Iron',
    cost: '1 iron',
    snapPoints: thinLineSnaps,
    tags: ['wall', 'cage', 'iron', '1x1'],
    visual: 'wall',
  },
  {
    id: 'cage-wall-2x2',
    name: 'Cage Wall 2×2',
    category: 'Walls',
    group: 'Cage walls',
    shape: 'line',
    width: 2,
    depth: 0.4,
    color: '#718086',
    material: 'Iron',
    cost: '2 iron',
    snapPoints: thinLineSnaps,
    tags: ['wall', 'cage', 'iron', '2x2'],
    visual: 'wall',
  },
  {
    id: 'wood-door-1m',
    name: 'Wood Door',
    category: 'Walls',
    group: 'Doors & gates',
    shape: 'line',
    width: 2,
    depth: 0.5,
    color: '#cc8e52',
    material: 'Wood',
    cost: '4 wood',
    snapPoints: woodDoorSnaps,
    tags: ['door', 'wood', '2m'],
    visual: 'wall',
  },
  {
    id: 'ashwood-door',
    name: 'Ashwood Door',
    category: 'Walls',
    group: 'Doors & gates',
    shape: 'line',
    width: 2,
    depth: 0.5,
    color: '#bd7046',
    material: 'Ashwood + Flametal',
    cost: '3 ashwood · 1 flametal',
    snapPoints: gateEndSnaps,
    tags: ['door', 'ashwood', '2m', 'hinge-right'],
    visual: 'wall',
  },
  {
    id: 'wood-door',
    name: 'Wood Gate',
    category: 'Walls',
    group: 'Doors & gates',
    shape: 'line',
    width: 2,
    depth: 0.5,
    color: '#d97e48',
    material: 'Wood',
    cost: '12 wood',
    snapPoints: gateEndSnaps,
    tags: ['door', 'gate', 'wood'],
    visual: 'wall',
  },
  {
    id: 'darkwood-door',
    name: 'Darkwood Gate',
    category: 'Walls',
    group: 'Doors & gates',
    shape: 'line',
    width: 2,
    depth: 0.6,
    color: '#7f6252',
    material: 'Wood + iron + tar',
    cost: '16 wood · 4 iron · 2 tar',
    snapPoints: gateEndSnaps,
    tags: ['door', 'gate', 'darkwood'],
    visual: 'wall',
  },
  {
    id: 'iron-gate',
    name: 'Iron Gate',
    category: 'Walls',
    group: 'Doors & gates',
    shape: 'line',
    width: 2,
    depth: 0.12,
    color: '#68777a',
    material: 'Iron',
    cost: '4 iron',
    snapPoints: gateEndSnaps,
    tags: ['door', 'gate', 'iron', 'cage'],
    visual: 'wall',
  },
  {
    id: 'flametal-gate',
    name: 'Flametal Gate',
    category: 'Walls',
    group: 'Doors & gates',
    shape: 'line',
    width: 1.5,
    depth: 0.6,
    color: '#9a6858',
    material: 'Flametal',
    cost: '16 flametal',
    snapPoints: gateEndSnaps,
    tags: ['door', 'gate', 'flametal'],
    visual: 'wall',
  },
  {
    id: 'hexagonal-gate',
    name: 'Hexagonal Gate',
    category: 'Walls',
    group: 'Doors & gates',
    shape: 'line',
    width: 4,
    depth: 0.7,
    color: '#796d78',
    material: 'Yggdrasil wood + copper',
    cost: '8 yggdrasil wood · 8 copper',
    snapPoints: ['center'],
    tags: ['door', 'gate', 'hexagonal', 'copper', 'single-leaf', 'hinge-right'],
    visual: 'wall',
  },
]

type CatalogSeed = {
  name: string
  group: string
  width: number
  depth: number
  id?: string
  shape?: PieceShape
  material?: string
  color?: string
  tags?: string[]
  visual?: PieceVisual
  symbol?: string
  snapPoints?: SnapPointName[]
}

const slug = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

const catalogVisual = (category: PieceCategory, seed: CatalogSeed): PieceVisual | undefined => {
  if (seed.visual) return seed.visual
  if (seed.group === 'Stairs & ladders') return seed.name.includes('Ladder') ? 'ladder' : 'stairs'
  if (category === 'Furniture') {
    if (seed.group === 'Beds') return 'bed'
    if (seed.group === 'Seating') return 'seating'
    if (seed.group === 'Tables') return 'table'
    if (seed.group === 'Storage') return 'storage'
    if (seed.group === 'Rugs') return 'rug'
    if (seed.group === 'Banners') return 'banner'
    return 'decor'
  }
  if (category === 'Crafting') {
    if (seed.tags?.includes('upgrade')) return 'upgrade'
    if (seed.tags?.includes('cooking')) return 'cooking'
    if (seed.tags?.includes('processing')) return 'processing'
    return 'station'
  }
  if (category === 'Vehicles' || category === 'Utility') return 'vehicle'
  return undefined
}

const catalogColor = (category: PieceCategory, seed: CatalogSeed) => {
  if (seed.color) return seed.color
  if (category === 'Structure') {
    if (seed.material === 'Black marble') return '#66636c'
    if (seed.material === 'Grausten' || seed.material === 'Stone') return '#99958e'
    if (seed.material === 'Ashwood') return '#c67f4d'
    return '#c99a60'
  }
  if (category === 'Furniture') {
    if (seed.visual === 'fire') return seed.name === 'Bonfire' ? '#d96737' : '#c77a45'
    if (seed.visual === 'light') {
      if (seed.name.includes('Blue')) return '#649bb6'
      if (seed.name.includes('Green')) return '#6f9e70'
      if (seed.name.includes('Wisp') || seed.name.includes('Dvergr')) return '#7ca7ad'
      return '#c6a25d'
    }
    const bannerColors: Record<string, string> = {
      'Black Banner': '#34353b',
      'Blue Banner': '#477699',
      'Blue, Red and White Banner': '#778da3',
      'Green Banner': '#668052',
      'Orange Banner': '#c1763e',
      'Purple Banner': '#7b5b8c',
      'Red Banner': '#a94f45',
      'White Banner': '#d3d0c2',
      'White and Blue Striped Banner': '#91a8b1',
      'White and Red Striped Banner': '#c4978d',
      'Yellow Banner': '#c7a94f',
    }
    if (bannerColors[seed.name]) return bannerColors[seed.name]
    if (seed.group === 'Beds') return seed.name === 'Dragon Bed' ? '#884d49' : '#a96658'
    if (seed.group === 'Seating')
      return seed.name.includes('Marble') || seed.name.includes('Stone') ? '#858581' : '#b17f52'
    if (seed.group === 'Tables') return seed.name.includes('Marble') ? '#67656d' : '#9f7047'
    if (seed.group === 'Storage') return seed.name.includes('Metal') ? '#58666a' : '#82603f'
    if (seed.group === 'Rugs')
      return seed.name.includes('Lox') ? '#806b58' : seed.name.includes('Wolf') ? '#8c9292' : '#a9886b'
    return seed.name === 'Ward' ? '#7c9c83' : '#a88755'
  }
  if (category === 'Crafting') {
    const stationFamilies = [
      { color: '#a8794d', names: ['Workbench', 'Adze', 'Chopping Block', 'Tanning Rack', 'Tool Shelf'] },
      {
        color: '#76645a',
        names: [
          'Forge',
          'Anvils',
          'Forge Bellows',
          'Forge Cooler',
          'Forge Tool Rack',
          'Grinding Wheel',
          "Smith's Anvil",
        ],
      },
      {
        color: '#45666b',
        names: ['Black Forge', 'Black Forge Cooler', 'Metal Cutter', 'Gem Cutter', 'Vice'],
      },
      { color: '#706887', names: ['Galdr Table', 'Feathery Wreath', 'Rune Table', 'Unfading Candles'] },
      {
        color: '#a05f49',
        names: [
          'Cauldron',
          "Butcher's Table",
          'Mortar and Pestle',
          'Pots and Pans',
          'Rolling Pins and Cutting Boards',
          'Spice Rack',
        ],
      },
      { color: '#9a7f50', names: ['Artisan Table'] },
    ]
    const family = stationFamilies.find((candidate) => candidate.names.includes(seed.name))
    if (family) return family.color
    const individualColors: Record<string, string> = {
      'Barber Station': '#9c705a',
      'Cartography Table': '#6f8d91',
      Stonecutter: '#858985',
      'Food Preparation Table': '#a56f4f',
      'Cooking Station': '#985a43',
      'Iron Cooking Station': '#6f5d57',
      'Mead Ketill': '#a66d4d',
      'Stone Oven': '#81766d',
      'Charcoal Kiln': '#4e5753',
      'Eitr Refinery': '#6c607d',
      Smelter: '#626b68',
      'Spinning Wheel': '#9b774e',
      Windmill: '#a39a78',
    }
    return individualColors[seed.name] ?? '#718f83'
  }
  if (category === 'Vehicles' || category === 'Utility') {
    if (seed.group === 'Boats') return '#657f87'
    if (seed.group === 'Siege engines') return '#8a6548'
    return '#92734f'
  }
  return '#cf9a61'
}

const makeCatalogPiece = (category: PieceCategory, seed: CatalogSeed): PieceDefinition => {
  const shape = seed.shape ?? 'rect'
  return {
    id: seed.id ?? `${category.toLowerCase()}-${slug(seed.name)}`,
    name: seed.name,
    category,
    group: seed.group,
    shape,
    width: seed.width,
    depth: seed.depth,
    color: catalogColor(category, seed),
    material: seed.material ?? seed.group,
    cost: 'game-meter footprint',
    snapPoints:
      seed.snapPoints ??
      (shape === 'line' ? ['w', 'e', 'center'] : shape === 'circle' ? ['n', 'e', 's', 'w'] : [...allCorners]),
    tags: [
      category.toLowerCase(),
      seed.group.toLowerCase(),
      ...seed.name.toLowerCase().split(/[^a-z0-9]+/),
      ...(seed.tags ?? []),
    ],
    visual: catalogVisual(category, seed),
    symbol: seed.symbol,
  }
}

const accessSeeds: CatalogSeed[] = [
  { name: 'Ashwood Stair', group: 'Stairs & ladders', width: 1, depth: 2, material: 'Ashwood' },
  { name: 'Black Marble Stair', group: 'Stairs & ladders', width: 2, depth: 2, material: 'Black marble' },
  {
    name: 'Dvergr Spiral Staircase Left',
    group: 'Stairs & ladders',
    width: 2.3,
    depth: 2.3,
    material: 'Black marble',
    shape: 'quarterCircle',
    tags: ['spiral', 'left'],
  },
  {
    name: 'Dvergr Spiral Staircase Right',
    group: 'Stairs & ladders',
    width: 2.3,
    depth: 2.3,
    material: 'Black marble',
    shape: 'quarterCircle',
    tags: ['spiral', 'right'],
  },
  { name: 'Grausten Stairs', group: 'Stairs & ladders', width: 2, depth: 2, material: 'Grausten' },
  {
    name: 'Grausten Steep Stairs',
    group: 'Stairs & ladders',
    width: 1,
    depth: 2,
    material: 'Grausten',
    tags: ['steep'],
  },
  { name: 'Stone Stair', group: 'Stairs & ladders', width: 2, depth: 2, material: 'Stone' },
  { name: 'Wood Ladder', group: 'Stairs & ladders', width: 1, depth: 2, material: 'Wood' },
  { name: 'Wood Stairs', group: 'Stairs & ladders', width: 2, depth: 2, material: 'Wood' },
]

// Current datamined Furniture roster. Dimensions are measured top-down visible footprints.
const furnitureSeeds: CatalogSeed[] = [
  { name: 'Ashwood Bed', group: 'Beds', width: 3, depth: 1.6 },
  { name: 'Bed', group: 'Beds', width: 3.7, depth: 2, id: 'bed' },
  { name: 'Dragon Bed', group: 'Beds', width: 4.3, depth: 3.3 },
  { name: 'Ashwood Bench', group: 'Seating', width: 2, depth: 2 },
  { name: 'Black Marble Bench', group: 'Seating', width: 2.6, depth: 0.6 },
  { name: 'Black Marble Throne', group: 'Seating', width: 1.7, depth: 1.2 },
  { name: 'Bone Throne', group: 'Seating', width: 1.5, depth: 0.8 },
  { name: 'Darkwood Chair', group: 'Seating', width: 0.5, depth: 0.5 },
  { name: 'Raven Throne', group: 'Seating', width: 2.1, depth: 0.9 },
  { name: 'Sitting Log', group: 'Seating', width: 2.7, depth: 0.6 },
  { name: 'Stone Throne', group: 'Seating', width: 1.5, depth: 1.1 },
  { name: 'Stool', group: 'Seating', width: 0.7, depth: 0.6 },
  { name: 'Wood Bench', group: 'Seating', width: 2.5, depth: 0.6 },
  { name: 'Wood Chair', group: 'Seating', width: 0.5, depth: 1.1 },
  { name: 'Black Marble Table', group: 'Tables', width: 2.5, depth: 1.5 },
  { name: 'Long Heavy Table', group: 'Tables', width: 6.6, depth: 1.9 },
  { name: 'Round Table', group: 'Tables', width: 2.5, depth: 2.5, id: 'round-table', shape: 'circle' },
  { name: 'Table', group: 'Tables', width: 3, depth: 1.3 },
  { name: 'Barrel', group: 'Storage', width: 0.9, depth: 0.9, shape: 'circle' },
  { name: 'Black Metal Chest', group: 'Storage', width: 2.2, depth: 1.5 },
  { name: 'Chest', group: 'Storage', width: 1.5, depth: 0.8 },
  { name: 'Personal Chest', group: 'Storage', width: 0.7, depth: 0.5 },
  { name: 'Reinforced Chest', group: 'Storage', width: 1.8, depth: 0.9 },
  { name: 'Treasure Chest', group: 'Storage', width: 1.1, depth: 0.9 },
  { name: 'Campfire', group: 'Fire & lighting', width: 1.5, depth: 1.5, shape: 'circle', visual: 'fire' },
  { name: 'Bonfire', group: 'Fire & lighting', width: 5, depth: 5, shape: 'circle', visual: 'fire' },
  { name: 'Iron Fire Pit', group: 'Fire & lighting', width: 1.4, depth: 1.4, visual: 'fire' },
  { name: 'Hearth', group: 'Fire & lighting', width: 4.2, depth: 3.1, visual: 'fire' },
  {
    name: 'Standing Wood Torch',
    group: 'Fire & lighting',
    width: 0.1,
    depth: 0.1,
    shape: 'circle',
    visual: 'light',
  },
  {
    name: 'Standing Iron Torch',
    group: 'Fire & lighting',
    width: 0.2,
    depth: 0.2,
    shape: 'circle',
    visual: 'light',
  },
  {
    name: 'Standing Green-burning Iron Torch',
    group: 'Fire & lighting',
    width: 0.2,
    depth: 0.2,
    shape: 'circle',
    visual: 'light',
  },
  {
    name: 'Standing Blue-burning Iron Torch',
    group: 'Fire & lighting',
    width: 0.2,
    depth: 0.2,
    shape: 'circle',
    visual: 'light',
  },
  {
    name: 'Wisp Torch',
    group: 'Fire & lighting',
    width: 0.2,
    depth: 0.2,
    shape: 'circle',
    visual: 'light',
  },
  {
    name: 'Resin Candle',
    group: 'Fire & lighting',
    width: 0.2,
    depth: 0.2,
    shape: 'circle',
    visual: 'light',
  },
  { name: 'Sconce', group: 'Fire & lighting', width: 0.4, depth: 0.3, shape: 'line', visual: 'light' },
  {
    name: 'Dvergr Pole Lantern',
    group: 'Fire & lighting',
    width: 1.1,
    depth: 0.5,
    visual: 'light',
  },
  {
    name: 'Dvergr Wall Lantern',
    group: 'Fire & lighting',
    width: 1.1,
    depth: 0.6,
    shape: 'line',
    visual: 'light',
  },
  {
    name: 'Standing Brazier',
    group: 'Fire & lighting',
    width: 0.9,
    depth: 0.9,
    shape: 'circle',
    visual: 'light',
  },
  {
    name: 'Blue Standing Brazier',
    group: 'Fire & lighting',
    width: 0.9,
    depth: 0.9,
    shape: 'circle',
    visual: 'light',
  },
  {
    name: 'Hanging Brazier',
    group: 'Fire & lighting',
    width: 0.9,
    depth: 0.9,
    shape: 'circle',
    visual: 'light',
  },
  {
    name: 'Lava Lantern',
    group: 'Fire & lighting',
    width: 0.3,
    depth: 0.3,
    shape: 'circle',
    visual: 'light',
  },
  { name: 'Fey Lights', group: 'Fire & lighting', width: 4.1, depth: 0.1, shape: 'line', visual: 'light' },
  { name: 'Asksvin Rug', group: 'Rugs', width: 2.7, depth: 2.6 },
  { name: 'Bearskin Rug', group: 'Rugs', width: 5.1, depth: 4.2 },
  { name: 'Deer Rug', group: 'Rugs', width: 3, depth: 2.3 },
  { name: 'Hare Rug', group: 'Rugs', width: 1.6, depth: 0.9 },
  { name: 'Lox Rug', group: 'Rugs', width: 3.8, depth: 2.9 },
  { name: 'Wolf Rug', group: 'Rugs', width: 3.3, depth: 2.4 },
  { name: 'Blue Jute Carpet', group: 'Rugs', width: 3, depth: 3, color: '#355979' },
  { name: 'Red Jute Carpet', group: 'Rugs', width: 4, depth: 3, color: '#713b3b' },
  { name: 'Black Banner', group: 'Banners', width: 1.4, depth: 0.2, shape: 'line' },
  { name: 'Blue Banner', group: 'Banners', width: 1.4, depth: 0.2, shape: 'line' },
  { name: 'Blue, Red and White Banner', group: 'Banners', width: 1.4, depth: 0.2, shape: 'line' },
  { name: 'Green Banner', group: 'Banners', width: 1.4, depth: 0.2, shape: 'line' },
  { name: 'Orange Banner', group: 'Banners', width: 1.4, depth: 0.2, shape: 'line' },
  { name: 'Purple Banner', group: 'Banners', width: 1.4, depth: 0.2, shape: 'line' },
  { name: 'Red Banner', group: 'Banners', width: 1.4, depth: 0.2, shape: 'line' },
  { name: 'White Banner', group: 'Banners', width: 1.4, depth: 0.2, shape: 'line' },
  { name: 'White and Blue Striped Banner', group: 'Banners', width: 1.4, depth: 0.2, shape: 'line' },
  { name: 'White and Red Striped Banner', group: 'Banners', width: 1.4, depth: 0.2, shape: 'line' },
  { name: 'Yellow Banner', group: 'Banners', width: 1.4, depth: 0.2, shape: 'line' },
  { name: 'Jack-o-turnip', group: 'Decor & utility', width: 0.5, depth: 0.5, shape: 'circle' },
  { name: 'Maypole', group: 'Decor & utility', width: 4.2, depth: 0.9 },
  { name: 'Sign', group: 'Decor & utility', width: 0.7, depth: 0.1, shape: 'line' },
  { name: 'Straw', group: 'Decor & utility', width: 1.9, depth: 1.9 },
  { name: 'Ward', group: 'Decor & utility', width: 0.9, depth: 0.9, shape: 'circle' },
  {
    name: 'Armour Stand',
    group: 'Decor & utility',
    width: 1.1,
    depth: 1.1,
    id: 'furniture-armor-stand',
    tags: ['armor', 'armour', 'stand'],
  },
  { name: 'Yuleklapp', group: 'Decor & utility', width: 0.5, depth: 0.3 },
]

// Crafting is ordered by general discovery and grouped around the station it extends.
const craftingSeeds: CatalogSeed[] = [
  {
    name: 'Cooking Station',
    group: 'Camp cooking',
    width: 1.7,
    depth: 0.7,
    tags: ['cooking'],
    symbol: 'COOK',
  },

  { name: 'Workbench', group: 'Workbench', width: 3.7, depth: 1.6, id: 'workbench', symbol: 'WB' },
  { name: 'Chopping Block', group: 'Workbench', width: 0.9, depth: 0.7, tags: ['upgrade'], symbol: '+' },
  { name: 'Tanning Rack', group: 'Workbench', width: 2.4, depth: 1.2, tags: ['upgrade'], symbol: '+' },
  { name: 'Adze', group: 'Workbench', width: 2.1, depth: 1.3, tags: ['upgrade'], symbol: '+' },
  { name: 'Tool Shelf', group: 'Workbench', width: 2, depth: 0.5, tags: ['upgrade'], symbol: '+' },

  { name: 'Forge', group: 'Forge', width: 2, depth: 1.2, symbol: 'FORGE' },
  { name: 'Forge Cooler', group: 'Forge', width: 0.9, depth: 0.9, tags: ['upgrade'], symbol: '+' },
  { name: 'Anvils', group: 'Forge', width: 0.8, depth: 0.8, tags: ['upgrade'], symbol: '+' },
  { name: "Smith's Anvil", group: 'Forge', width: 1.2, depth: 0.9, tags: ['upgrade'], symbol: '+' },
  { name: 'Forge Tool Rack', group: 'Forge', width: 2.5, depth: 0.4, tags: ['upgrade'], symbol: '+' },
  { name: 'Forge Bellows', group: 'Forge', width: 1.7, depth: 1.5, tags: ['upgrade'], symbol: '+' },
  { name: 'Grinding Wheel', group: 'Forge', width: 1, depth: 0.7, tags: ['upgrade'], symbol: '+' },

  {
    name: 'Charcoal Kiln',
    group: 'Smelting',
    width: 4.4,
    depth: 4.4,
    shape: 'circle',
    tags: ['processing'],
    symbol: 'KILN',
  },
  {
    name: 'Smelter',
    group: 'Smelting',
    width: 3.4,
    depth: 3.4,
    shape: 'circle',
    tags: ['processing'],
    symbol: 'SMELT',
  },
  { name: 'Stonecutter', group: 'Stonecutter', width: 3.4, depth: 1.7, symbol: 'STONE' },

  {
    name: 'Cauldron',
    group: 'Cauldron',
    width: 1.4,
    depth: 1.4,
    shape: 'circle',
    tags: ['cooking'],
    symbol: 'POT',
  },
  { name: 'Spice Rack', group: 'Cauldron', width: 2.1, depth: 0.5, tags: ['upgrade'], symbol: '+' },
  { name: "Butcher's Table", group: 'Cauldron', width: 1.2, depth: 1.2, tags: ['upgrade'], symbol: '+' },
  { name: 'Pots and Pans', group: 'Cauldron', width: 2, depth: 0.8, tags: ['upgrade'], symbol: '+' },
  { name: 'Mortar and Pestle', group: 'Cauldron', width: 1.9, depth: 0.9, tags: ['upgrade'], symbol: '+' },
  {
    name: 'Rolling Pins and Cutting Boards',
    group: 'Cauldron',
    width: 0.8,
    depth: 0.3,
    tags: ['upgrade'],
    symbol: '+',
  },

  {
    name: 'Iron Cooking Station',
    group: 'Advanced cooking',
    width: 5,
    depth: 1,
    tags: ['cooking'],
    symbol: 'IRON',
  },
  { name: 'Stone Oven', group: 'Advanced cooking', width: 3, depth: 2, tags: ['cooking'], symbol: 'OVEN' },
  {
    name: 'Food Preparation Table',
    group: 'Advanced cooking',
    width: 2.5,
    depth: 0.7,
    tags: ['food', 'preparation', 'table'],
    visual: 'table',
    symbol: 'FOOD',
  },
  {
    name: 'Mead Ketill',
    group: 'Advanced cooking',
    width: 1.3,
    depth: 1.3,
    shape: 'circle',
    tags: ['cooking'],
    symbol: 'MEAD',
  },

  { name: 'Artisan Table', group: 'Artisan Table', width: 2.8, depth: 1.9, symbol: 'ART' },
  {
    name: 'Spinning Wheel',
    group: 'Artisan machines',
    width: 3.1,
    depth: 2,
    tags: ['processing'],
    symbol: 'SPIN',
  },
  {
    name: 'Windmill',
    group: 'Artisan machines',
    width: 5.8,
    depth: 5.8,
    shape: 'circle',
    tags: ['processing'],
    symbol: 'MILL',
  },
  { name: 'Cartography Table', group: 'Cartography Table', width: 4.5, depth: 2.6, symbol: 'MAP' },
  { name: 'Barber Station', group: 'Barber Station', width: 1.9, depth: 1.4, symbol: 'HAIR' },

  { name: 'Black Forge', group: 'Black Forge', width: 3.8, depth: 1.9, symbol: 'BF' },
  {
    name: 'Black Forge Cooler',
    group: 'Black Forge',
    width: 2.3,
    depth: 0.8,
    tags: ['upgrade'],
    symbol: '+',
  },
  { name: 'Metal Cutter', group: 'Black Forge', width: 0.6, depth: 0.6, tags: ['upgrade'], symbol: '+' },
  { name: 'Gem Cutter', group: 'Black Forge', width: 1.1, depth: 0.9, tags: ['upgrade'], symbol: '+' },
  { name: 'Vice', group: 'Black Forge', width: 0.8, depth: 0.6, tags: ['upgrade'], symbol: '+' },

  { name: 'Galdr Table', group: 'Galdr Table', width: 3.3, depth: 3.3, symbol: 'GALDR' },
  { name: 'Rune Table', group: 'Galdr Table', width: 0.9, depth: 0.9, tags: ['upgrade'], symbol: '+' },
  { name: 'Unfading Candles', group: 'Galdr Table', width: 0.6, depth: 0.5, tags: ['upgrade'], symbol: '+' },
  { name: 'Feathery Wreath', group: 'Galdr Table', width: 1.1, depth: 0.4, tags: ['upgrade'], symbol: '+' },
  {
    name: 'Eitr Refinery',
    group: 'Eitr Refinery',
    width: 5.6,
    depth: 2.9,
    tags: ['processing'],
    symbol: 'EITR',
  },
]

// Full-size clearance footprints for transport and siege equipment. These pieces do not
// expose construction snap points in Valheim, so they intentionally remain free-placeable.
const vehicleSeeds: CatalogSeed[] = [
  { name: 'Raft', group: 'Boats', width: 11.6, depth: 12.8, material: 'Boat', snapPoints: [] },
  { name: 'Karve', group: 'Boats', width: 11.9, depth: 15.4, material: 'Boat', snapPoints: [] },
  { name: 'Longship', group: 'Boats', width: 11.6, depth: 35.4, material: 'Boat', snapPoints: [] },
  { name: 'Drakkar', group: 'Boats', width: 15.2, depth: 35.6, material: 'Boat', snapPoints: [] },
  { name: 'Cart', group: 'Land transport', width: 2.1, depth: 3.4, material: 'Vehicle', snapPoints: [] },
  {
    name: 'Catapult',
    group: 'Siege engines',
    width: 3.8,
    depth: 6,
    material: 'Siege engine',
    snapPoints: [],
  },
  {
    name: 'Battering Ram',
    group: 'Siege engines',
    width: 3.9,
    depth: 5.1,
    material: 'Siege engine',
    snapPoints: [],
  },
]

const sourcePieces: PieceDefinition[] = [
  ...corePieces,
  ...accessSeeds.map((seed) => makeCatalogPiece('Structure', seed)),
  ...furnitureSeeds.map((seed) => makeCatalogPiece('Furniture', seed)),
  ...craftingSeeds.map((seed) => makeCatalogPiece('Crafting', seed)),
  ...vehicleSeeds.map((seed) => makeCatalogPiece('Vehicles', seed)),
  ...CAPTURED_BUILDABLE_SEEDS.map((seed) => makeCatalogPiece(seed.category, seed)),
]

const MATERIAL_CATEGORIES = [
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
] as const satisfies readonly PieceCategory[]

export const CATEGORIES: PieceCategory[] = [...MATERIAL_CATEGORIES, 'Furniture', 'Crafting', 'Utility']

const structuralCategory = (piece: PieceDefinition): PieceCategory => {
  const identity = `${piece.id} ${piece.name} ${piece.material} ${piece.tags.join(' ')}`.toLowerCase()
  if (piece.material === 'Timberwood') return 'Timberwood'
  if (piece.material === 'Ice') return 'Ice'
  if (identity.includes('dvergr') || piece.id === 'hexagonal-gate') return 'Dvergr'
  if (identity.includes('black marble') || identity.includes('black-marble')) return 'Black Marble'
  if (identity.includes('grausten')) return 'Grausten'
  if (identity.includes('ashwood')) return 'Ashwood'
  if (identity.includes('darkwood') || identity.includes('shingle')) return 'Darkwood'
  if (identity.includes('corewood') || /\blog (beam|pole)\b/.test(identity)) return 'Corewood'
  if (identity.includes('stone')) return 'Stone'
  if (
    identity.includes('flametal') ||
    identity.includes('wood iron') ||
    identity.includes('woodiron') ||
    identity.includes('cage') ||
    identity.includes('iron gate')
  )
    return 'Metal'
  return 'Wood'
}

const structuralGroup = (category: PieceCategory, piece: PieceDefinition) => {
  const identity = `${piece.id} ${piece.name} ${piece.group ?? ''} ${piece.tags.join(' ')}`.toLowerCase()
  const includes = (...terms: string[]) => terms.some((term) => identity.includes(term))

  if (includes('drawbridge')) return 'Drawbridges'
  if (includes('scalewood')) return 'Scalewood walls'
  if (category === 'Ice') return 'Blocks'
  if (includes('gate', 'door')) return 'Doors & gates'
  if (includes('fence')) return 'Fences'

  if (category === 'Stone' || category === 'Black Marble') {
    if (includes('stair')) return 'Stairs'
    return 'Blocks & structures'
  }
  if (category === 'Grausten') {
    if (includes('roof')) return 'Roofs'
    if (includes('beam', 'pillar')) return 'Beams & pillars'
    if (includes('stair')) return 'Stairs'
    return 'Blocks & structures'
  }
  if (category === 'Dvergr') {
    if (includes('stair')) return 'Stairs'
    if (includes('gate', 'door')) return 'Doors & gates'
    if (includes('wall', 'stake')) return 'Walls & defenses'
    return 'Structures'
  }
  if (category === 'Metal') {
    if (includes('beam', 'pole', 'pillar')) return 'Beams & supports'
    if (includes('gate', 'door')) return 'Doors & gates'
    return 'Floors & walls'
  }
  if (category === 'Corewood') return 'Beams & poles'

  if (/\bwall\b|\bwindow\b/i.test(piece.name)) return 'Walls & openings'
  if (/roof cross/i.test(piece.name)) return 'Beams & poles'
  if (includes('roof')) return category === 'Darkwood' ? 'Shingle roofs' : 'Roofs'
  if (includes('beam', 'pole')) return 'Beams & poles'
  if (includes('stair', 'ladder')) return 'Stairs & ladders'
  if (includes('gate', 'door')) return 'Doors & gates'
  if (includes('floor')) return 'Floors'
  if (includes('wall', 'window')) return 'Walls & openings'
  if (includes('arch', 'column', 'cornice', 'base', 'tip', 'decorative')) return 'Architectural pieces'
  return 'Structures'
}

const organizePiece = (piece: PieceDefinition): PieceDefinition | undefined => {
  if ((piece.comfort ?? 0) > 0 && piece.category !== 'Furniture') {
    return {
      ...piece,
      category: 'Furniture',
      group: 'Comfort',
      tags: [...new Set([...piece.tags, 'furniture', 'comfort'])],
    }
  }
  if (piece.category === 'Vehicles') {
    return {
      ...piece,
      category: 'Utility',
      tags: [...new Set([...piece.tags, 'utility', 'transport'])],
    }
  }
  if (piece.id === 'furniture-ward' || piece.group === 'Utility & defenses') {
    return {
      ...piece,
      category: 'Utility',
      group: 'Utility & defenses',
      tags: [...new Set([...piece.tags, 'utility', 'defense'])],
    }
  }
  if (piece.id === 'buildable-crystal-wall-1x1') {
    return {
      ...piece,
      category: 'Furniture',
      group: 'Windows & partitions',
      tags: [...new Set([...piece.tags, 'furniture', 'window', 'crystal'])],
    }
  }
  if (piece.category === 'Furniture' || piece.category === 'Crafting' || piece.category === 'Utility')
    return piece

  const category = structuralCategory(piece)
  return {
    ...piece,
    category,
    group: structuralGroup(category, piece),
    tags: [...new Set([...piece.tags, category.toLowerCase()])],
  }
}

export const PIECES: PieceDefinition[] = sourcePieces.flatMap(
  (piece) => organizePiece({ ...piece, comfort: CAPTURED_COMFORT_BY_PIECE_ID[piece.id] ?? 0 }) ?? [],
)

const BUILDING_CATEGORY_SET = new Set<PieceCategory>(MATERIAL_CATEGORIES)
export const isBuildingCategory = (category: PieceCategory) => BUILDING_CATEGORY_SET.has(category)
export const isBuildingPiece = (piece: PieceDefinition) => isBuildingCategory(piece.category)

const PIECE_BY_ID = new Map(PIECES.map((piece) => [piece.id, piece]))

export const pieceById = (id: string) => PIECE_BY_ID.get(id) ?? PIECES[0]
