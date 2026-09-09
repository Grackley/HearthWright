#!/usr/bin/env node

const fs = require('fs')
const path = require('path')

const projectRoot = path.resolve(__dirname, '..')

const parseArguments = (values) => {
  const result = {}
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index]
    if (!value.startsWith('--')) continue
    const next = values[index + 1]
    result[value.slice(2)] = next && !next.startsWith('--') ? next : true
    if (next && !next.startsWith('--')) index += 1
  }
  return result
}

const args = parseArguments(process.argv.slice(2))
const inventoryPath = path.resolve(
  projectRoot,
  args.inventory || 'visual-assets/captures/inventory-20260909-1.0-isolated/capture-manifest.json',
)
const mappingPath = path.resolve(
  projectRoot,
  args.mapping || 'visual-assets/bundles/current/mapping-report.json',
)
const bundlePath = path.resolve(projectRoot, args.bundle || 'visual-assets/bundles/current/manifest.json')
const outputPath = path.resolve(projectRoot, args.output || 'src/data/capturedBuildablePieces.ts')

const inventory = JSON.parse(fs.readFileSync(inventoryPath, 'utf8'))
const mapping = JSON.parse(fs.readFileSync(mappingPath, 'utf8'))
const bundle = fs.existsSync(bundlePath) ? JSON.parse(fs.readFileSync(bundlePath, 'utf8')) : { pieces: {} }
const mappedPrefabs = new Set(
  mapping.mapped
    .filter((entry) => !entry.pieceId.startsWith('buildable-'))
    .map((entry) => entry.prefabName.toLowerCase()),
)

const slug = (value) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

const roundMeter = (value) => Math.max(0.1, Math.round(Number(value || 0.1) * 10) / 10)

const displayName = (record) => {
  const names = {
    darkwood_beam_67: 'Darkwood Beam 67°',
    itemstand: 'Item Stand (Vertical)',
    itemstandh: 'Item Stand (Horizontal)',
    piece_grausten_roof_45_arch_corner: 'Grausten Arched Roof Corner A',
    piece_grausten_roof_45_arch_corner2: 'Grausten Arched Roof Corner B',
    piece_grausten_roof_45_corner: 'Grausten Roof Corner A',
    piece_grausten_roof_45_corner2: 'Grausten Roof Corner B',
    piece_gift2: 'Yuleklapp (Medium)',
    piece_gift3: 'Yuleklapp (Large)',
  }
  return names[record.prefabName] || record.displayName
}

const familyFor = (record) => {
  const value = `${record.prefabName} ${record.displayName}`.toLowerCase()
  if (/^(stave_|scale_)/.test(record.prefabName) || /timberwood|scalewood/.test(value)) return 'Timberwood'
  if (record.prefabName === 'piece_icecube') return 'Ice'
  if (record.prefabName === 'piece_drawbridge_log') return 'Corewood'
  if (record.prefabName === 'piece_drawbridge') return 'Timberwood'
  if (value.includes('blackmarble') || value.includes('black marble')) return 'Black marble'
  if (value.includes('grausten')) return 'Grausten'
  if (value.includes('flametal')) return 'Flametal'
  if (value.includes('ashwood') || value.includes('blackwood')) return 'Ashwood'
  if (value.includes('darkwood')) return 'Darkwood'
  if (value.includes('woodiron') || value.includes('wood iron')) return 'Wood iron'
  if (value.includes('log ') || value.includes('corewood')) return 'Corewood'
  if (value.includes('stone')) return 'Stone'
  if (value.includes('crystal')) return 'Crystal'
  if (value.includes('dvergr')) return 'Dvergr'
  if (value.includes('wood')) return 'Wood'
  return record.resources?.[0]?.displayName || record.category
}

const categoryFor = (record) => {
  const name = displayName(record).toLowerCase()
  if (
    record.category === 'BuildingWorkbench' ||
    record.category === 'BuildingStonecutter' ||
    (record.category === 'DeepNorth' && /wall|roof|beam|pole|gate/.test(name)) ||
    record.prefabName === 'wood_fence_gate' ||
    record.prefabName === 'stone_fence'
  ) {
    return /wall|door|gate|window|shutter|fence|stakewall/.test(name) ? 'Walls' : 'Structure'
  }
  if (record.category === 'Crafting') return 'Crafting'
  return 'Furniture'
}

const groupFor = (record, category, family) => {
  const name = displayName(record).toLowerCase()
  if (category === 'Structure') {
    if (name.includes('roof')) return `${family} roofs`
    if (/beam|pole|pillar|column|arch/.test(name)) return `${family} beams & supports`
    if (/floor|stair|ladder/.test(name)) return `${family} floors & stairs`
    return 'Architectural details'
  }
  if (category === 'Walls') {
    if (/door|gate|window|shutter/.test(name)) return 'Doors, gates & windows'
    if (/fence|stakewall/.test(name)) return 'Fences & defensive walls'
    return `${family} walls`
  }
  if (category === 'Crafting') {
    if (record.stationExtensions?.length) return record.stationExtensions[0].stationName
    if (record.prefabName === 'artisan_ext1') return 'Artisan Table'
    if (/kiln|foundry|furnace|fermenter|obliterator|extractor/.test(name)) return 'Processing stations'
    return 'Standalone crafting'
  }
  if (!record.enabled) return 'Seasonal'
  if (/lantern/.test(name)) return 'Fire & lighting'
  if (/chair|bench|throne/.test(name)) return 'Seating'
  if (/table/.test(name)) return 'Tables'
  if (/chest|wardrobe/.test(name)) return 'Storage'
  if (/rug|carpet/.test(name)) return 'Rugs'
  if (name.includes('hot tub')) return 'Comfort'
  if (/ stack| pile/.test(` ${name}`)) return 'Material storage'
  if (/portal|ward|shield generator|ballista|trap|sharp stakes|stakewall|target|t\.w\.i\.g\./.test(name)) {
    return 'Utility & defenses'
  }
  return 'Decor & utility'
}

const visualFor = (record, category) => {
  const name = record.displayName.toLowerCase()
  if (category === 'Walls') return 'wall'
  if (category === 'Structure') {
    if (name.includes('floor') || name.includes('roof')) return 'floor'
    if (name.includes('stair')) return 'stairs'
    if (/beam|pole/.test(name)) return 'wall'
    return 'decor'
  }
  if (category === 'Crafting') {
    if (record.prefabName === 'artisan_ext1') return 'upgrade'
    if (record.stationExtensions?.length) return 'upgrade'
    return /kiln|foundry|furnace|fermenter|obliterator|extractor/.test(name) ? 'processing' : 'station'
  }
  if (/ stack| pile/.test(` ${name}`)) return 'storage'
  if (/chest|wardrobe/.test(name)) return 'storage'
  if (/chair|bench|throne/.test(name)) return 'seating'
  if (/table/.test(name)) return 'table'
  if (/rug|carpet/.test(name)) return 'rug'
  if (/lantern/.test(name)) return 'light'
  if (/curtain|drapes|garland/.test(name)) return 'banner'
  return 'decor'
}

const shapeFor = (record, category) => {
  const name = record.displayName.toLowerCase()
  if (category === 'Walls') return 'line'
  if (/pot|pile|ward|shield generator/.test(name)) return 'circle'
  return 'rect'
}

const colorFor = (category, family, record) => {
  const stationColors = { 'Black Forge': '#45666b', 'Galdr Table': '#706887', Cauldron: '#a05f49' }
  const stationColor = stationColors[record.stationExtensions?.[0]?.stationName]
  if (stationColor) return stationColor
  const familyColors = {
    'Black marble': '#1f1e23',
    Grausten: '#9b958e',
    Stone: '#898d89',
    Flametal: '#6f6260',
    Ashwood: '#bd784a',
    Darkwood: '#76513b',
    'Wood iron': '#766e61',
    Corewood: '#8a6748',
    Wood: '#b17a4d',
    Crystal: '#8ebac4',
    Timberwood: '#94724e',
    Ice: '#a4d7dd',
    Dvergr: '#786b5b',
  }
  if (familyColors[family]) return familyColors[family]
  if (record.prefabName === 'artisan_ext1') return '#9a7f50'
  if (category === 'Crafting') return '#718f83'
  if (!record.enabled) return '#806b5e'
  return '#9b7955'
}

const records = inventory.pieces
  .filter(
    (record) =>
      record.prefabName !== 'piece_repair' &&
      record.pieceTables.includes('Hammer / _HammerPieceTable') &&
      !mappedPrefabs.has(record.prefabName.toLowerCase()),
  )
  .sort(
    (left, right) =>
      left.category.localeCompare(right.category) ||
      left.displayName.localeCompare(right.displayName) ||
      left.prefabName.localeCompare(right.prefabName),
  )

const seeds = records.map((record) => {
  // Valheim 1.0 replaces the prefab; keep the planner ID used in saved projects.
  const id = `buildable-${slug(record.prefabName === 'wood_wall_roof_a' ? 'wood_wall_roof' : record.prefabName)}`
  const category = categoryFor(record)
  const family = familyFor(record)
  const shape = shapeFor(record, category)
  const measured = bundle.pieces?.[id]?.measuredFootprint
  let width = roundMeter(measured?.width || record.geometryBounds?.width)
  let depth = roundMeter(measured?.depth || record.geometryBounds?.depth)
  if (record.prefabName === 'wood_beam_1') width = 1
  if (record.prefabName === 'wood_beam') width = 2
  if (shape === 'circle') width = depth = Math.max(width, depth)
  return {
    id,
    sourcePrefab: record.prefabName,
    name: displayName(record),
    category,
    group: groupFor(record, category, family),
    shape,
    width,
    depth,
    material: family,
    color: colorFor(category, family, record),
    visual: visualFor(record, category),
    snapPoints: [],
    tags: [
      'captured-buildable',
      slug(record.prefabName),
      ...(record.prefabName === 'artisan_ext1' || record.stationExtensions?.length ? ['upgrade'] : []),
      ...(!record.enabled ? ['seasonal'] : []),
    ],
  }
})

const source = `import type { PieceCategory, PieceShape, PieceVisual, SnapPointName } from '../types'\n\nexport interface CapturedBuildableSeed {\n  id: string\n  sourcePrefab: string\n  name: string\n  category: PieceCategory\n  group: string\n  shape: PieceShape\n  width: number\n  depth: number\n  material: string\n  color: string\n  visual: PieceVisual\n  snapPoints: SnapPointName[]\n  tags: string[]\n}\n\n// Generated from Valheim ${inventory.gameVersion}'s registered Hammer piece table.\n// Re-run tools/generate-buildable-supplement.cjs after a game-version inventory capture.\nexport const CAPTURED_BUILDABLE_SEEDS: CapturedBuildableSeed[] = ${JSON.stringify(seeds, null, 2)}\n`

fs.mkdirSync(path.dirname(outputPath), { recursive: true })
fs.writeFileSync(outputPath, source)

const inventoryByPrefab = new Map(inventory.pieces.map((record) => [record.prefabName.toLowerCase(), record]))
const comfortEntries = [
  ...mapping.mapped.filter((entry) => !entry.pieceId.startsWith('buildable-')),
  ...seeds.map((seed) => ({ pieceId: seed.id, prefabName: seed.sourcePrefab })),
]
  .flatMap(({ pieceId, prefabName }) => {
    const comfort = inventoryByPrefab.get(prefabName.toLowerCase())?.comfort ?? 0
    return comfort > 0 ? [[pieceId, comfort]] : []
  })
  .sort(([first], [second]) => first.localeCompare(second))
const comfortPath = path.resolve(projectRoot, args['comfort-output'] || 'src/data/comfort.ts')
fs.writeFileSync(
  comfortPath,
  `// Captured from Piece.m_comfort in Valheim ${inventory.gameVersion}. Entries with zero comfort are omitted.\nexport const CAPTURED_COMFORT_BY_PIECE_ID: Readonly<Record<string, number>> = ${JSON.stringify(Object.fromEntries(comfortEntries), null, 2)}\n`,
)
process.stdout.write(`Generated ${seeds.length} missing Hammer pieces in ${outputPath}.\n`)
