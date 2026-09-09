#!/usr/bin/env node

const fs = require('fs')
const path = require('path')
const { adjustPngBrightness, cropTransparentPng, darkenPngNeutrals } = require('./png-rgba.cjs')
const { measuredFootprint } = require('./footprint-metadata.cjs')
const {
  projectPrefabOrigin,
  projectPrefabPoint,
  projectSnapPoints,
  selectRangeProjectionBounds,
} = require('./snap-metadata.cjs')

const projectRoot = path.resolve(__dirname, '..')

const parseArguments = (values) => {
  const result = {}
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index]
    if (!value.startsWith('--')) continue
    const key = value.slice(2)
    const next = values[index + 1]
    if (!next || next.startsWith('--')) result[key] = true
    else {
      result[key] = next
      index += 1
    }
  }
  return result
}

const args = parseArguments(process.argv.slice(2))
const latestCaptureManifest = () => {
  const capturesDirectory = path.join(projectRoot, 'visual-assets', 'captures')
  if (!fs.existsSync(capturesDirectory)) {
    throw new Error('No local captures were found. Pass --capture <capture-manifest.json>.')
  }
  const manifests = fs
    .readdirSync(capturesDirectory, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(capturesDirectory, entry.name, 'capture-manifest.json'))
    .filter((manifestPath) => fs.existsSync(manifestPath))
    .sort((first, second) => fs.statSync(second).mtimeMs - fs.statSync(first).mtimeMs)
  if (!manifests.length) {
    throw new Error('No local capture manifest was found. Pass --capture <capture-manifest.json>.')
  }
  return manifests[0]
}

const capturePath = args.capture ? path.resolve(projectRoot, args.capture) : latestCaptureManifest()
const metadataCapturePath = args['metadata-capture']
  ? path.resolve(projectRoot, args['metadata-capture'])
  : capturePath
const recipeCapturePath = args['recipe-capture']
  ? path.resolve(projectRoot, args['recipe-capture'])
  : metadataCapturePath
const outputDirectory = path.resolve(projectRoot, args.output || 'visual-assets/bundles/current')
const overridesPath = path.resolve(projectRoot, args.overrides || 'visual-assets/prefab-overrides.json')
const prefabListPath = path.resolve(
  projectRoot,
  args['prefab-list'] || path.join(outputDirectory, 'capture-prefabs.txt'),
)

const readCatalog = () => {
  const sourcePath = path.join(projectRoot, 'src', 'data', 'pieces.ts')
  const source = fs.readFileSync(sourcePath, 'utf8')
  const objectsIn = (sourceText, variableName, pathLabel) => {
    const marker = `const ${variableName}`
    const markerIndex = sourceText.indexOf(marker)
    if (markerIndex < 0) throw new Error(`Could not find ${variableName} in ${pathLabel}`)
    const assignment = sourceText.indexOf('=', markerIndex)
    const start = sourceText.indexOf('[', assignment)
    const objects = []
    let depth = 0
    let objectStart = -1
    let quote = ''
    let escaped = false
    let lineComment = false
    let blockComment = false
    for (let index = start + 1; index < sourceText.length; index += 1) {
      const character = sourceText[index]
      const nextCharacter = sourceText[index + 1]
      if (lineComment) {
        if (character === '\n') lineComment = false
        continue
      }
      if (blockComment) {
        if (character === '*' && nextCharacter === '/') {
          blockComment = false
          index += 1
        }
        continue
      }
      if (quote) {
        if (escaped) escaped = false
        else if (character === '\\') escaped = true
        else if (character === quote) quote = ''
        continue
      }
      if (character === '/' && nextCharacter === '/') {
        lineComment = true
        index += 1
        continue
      }
      if (character === '/' && nextCharacter === '*') {
        blockComment = true
        index += 1
        continue
      }
      if (character === '"' || character === "'") {
        quote = character
        continue
      }
      if (character === '{') {
        if (depth === 0) objectStart = index
        depth += 1
      } else if (character === '}') {
        depth -= 1
        if (depth === 0 && objectStart >= 0) {
          objects.push(sourceText.slice(objectStart, index + 1))
          objectStart = -1
        }
      } else if (character === ']' && depth === 0) break
    }
    return objects
  }
  const property = (objectSource, name) => {
    const match = new RegExp(`["']?${name}["']?\\s*:\\s*(["'])`).exec(objectSource)
    if (!match) return undefined
    const valueStart = match.index + match[0].length
    const quote = match[1]
    let value = ''
    let escaped = false
    for (let index = valueStart; index < objectSource.length; index += 1) {
      const character = objectSource[index]
      if (escaped) {
        value += character
        escaped = false
      } else if (character === '\\') escaped = true
      else if (character === quote) return value
      else value += character
    }
    return value
  }
  const numberProperty = (objectSource, name) => {
    const match = new RegExp(`["']?${name}["']?\\s*:\\s*(-?\\d+(?:\\.\\d+)?)`).exec(objectSource)
    return match ? Number(match[1]) : undefined
  }
  const slug = (value) =>
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
  const catalog = []
  for (const objectSource of objectsIn(source, 'corePieces', sourcePath)) {
    catalog.push({
      id: property(objectSource, 'id'),
      name: property(objectSource, 'name'),
      category: property(objectSource, 'category'),
      shape: property(objectSource, 'shape') || 'rect',
      width: numberProperty(objectSource, 'width'),
      depth: numberProperty(objectSource, 'depth'),
    })
  }
  for (const [variableName, category] of [
    ['accessSeeds', 'Structure'],
    ['furnitureSeeds', 'Furniture'],
    ['craftingSeeds', 'Crafting'],
    ['vehicleSeeds', 'Vehicles'],
  ]) {
    for (const objectSource of objectsIn(source, variableName, sourcePath)) {
      const name = property(objectSource, 'name')
      catalog.push({
        id: property(objectSource, 'id') || `${category.toLowerCase()}-${slug(name)}`,
        name,
        category,
        shape: property(objectSource, 'shape') || 'rect',
        width: numberProperty(objectSource, 'width'),
        depth: numberProperty(objectSource, 'depth'),
      })
    }
  }
  const supplementPath = path.join(projectRoot, 'src', 'data', 'capturedBuildablePieces.ts')
  const supplementSource = fs.readFileSync(supplementPath, 'utf8')
  for (const objectSource of objectsIn(supplementSource, 'CAPTURED_BUILDABLE_SEEDS', supplementPath)) {
    catalog.push({
      id: property(objectSource, 'id'),
      name: property(objectSource, 'name'),
      category: property(objectSource, 'category'),
      shape: property(objectSource, 'shape') || 'rect',
      width: numberProperty(objectSource, 'width'),
      depth: numberProperty(objectSource, 'depth'),
      sourcePrefab: property(objectSource, 'sourcePrefab'),
    })
  }
  return catalog.filter((piece) => piece.id && piece.name && piece.category)
}

const normalize = (value) =>
  String(value || '')
    .toLowerCase()
    .replace(/×/g, 'x')
    .replace(/\bstanding\b/g, '')
    .replace(/\bburning\b/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')

const compact = (value) => normalize(value).replace(/\s+/g, '')

const aliases = {
  'black-marble-1x1x1': ['black marble 1x1'],
  'black-marble-2x1x1': ['black marble 2x1'],
  'black-marble-2x2x2': ['black marble 2x2'],
  'wood-door': ['wood gate'],
  'wood-door-1m': ['wood door'],
  'window-2m': ['dvergr window'],
  'furniture-sconce': ['wall torch'],
  'furniture-standing-wood-torch': ['wood torch'],
  'furniture-standing-iron-torch': ['standing iron torch'],
  'furniture-standing-green-burning-iron-torch': ['green standing iron torch'],
  'furniture-standing-blue-burning-iron-torch': ['blue standing iron torch'],
}

const categoryAffinity = {
  Structure: new Set(['BuildingWorkbench', 'BuildingStonecutter']),
  Walls: new Set(['BuildingWorkbench', 'BuildingStonecutter']),
  Furniture: new Set(['Furniture', 'Misc']),
  Crafting: new Set(['Crafting', 'Food', 'Misc']),
  Vehicles: new Set(['Misc']),
}

const capture = JSON.parse(fs.readFileSync(capturePath, 'utf8'))
const metadataCapture = JSON.parse(fs.readFileSync(metadataCapturePath, 'utf8'))
const recipeCapture = JSON.parse(fs.readFileSync(recipeCapturePath, 'utf8'))
if (capture.gameVersion !== metadataCapture.gameVersion) {
  throw new Error(
    `Sprite capture game version ${capture.gameVersion} does not match metadata capture ${metadataCapture.gameVersion}.`,
  )
}
if (capture.gameVersion !== recipeCapture.gameVersion) {
  throw new Error(
    `Sprite capture game version ${capture.gameVersion} does not match recipe capture ${recipeCapture.gameVersion}.`,
  )
}
const metadataByPrefab = new Map(
  metadataCapture.pieces.map((record) => [record.prefabName.toLowerCase(), record]),
)
const recipesByPrefab = new Map(
  recipeCapture.pieces.map((record) => [record.prefabName.toLowerCase(), record]),
)
const catalog = readCatalog()
const overrides = fs.existsSync(overridesPath) ? JSON.parse(fs.readFileSync(overridesPath, 'utf8')) : {}
const captureDirectory = path.dirname(capturePath)

const rankCandidate = (piece, record, desiredNames) => {
  const recordName = normalize(record.displayName)
  const desired = desiredNames.map(normalize)
  let score = desired.includes(recordName)
    ? 1000
    : desired.some((name) => compact(name) === compact(recordName))
      ? 800
      : 0
  if (!score) return -Infinity
  if (record.enabled) score += 40
  if (categoryAffinity[piece.category]?.has(record.category)) score += 80
  if (record.sprite) score += 20
  if (/dvergrprops|creep|old|test|ruin|disabled|legacy/i.test(record.prefabName)) score -= 100
  if (/^piece_|^wood_|^stone_|^blackmarble_|^ashwood_|^grausten_/i.test(record.prefabName)) score += 15
  return score
}

const mappings = []
const unmatched = []
const ambiguous = []

for (const piece of catalog) {
  const overridePrefab = overrides[piece.id] || piece.sourcePrefab
  const desiredNames = [piece.name, ...(aliases[piece.id] || [])]
  let candidates
  if (overridePrefab) {
    candidates = capture.pieces.filter(
      (record) => record.prefabName.toLowerCase() === overridePrefab.toLowerCase(),
    )
  } else {
    candidates = capture.pieces
      .map((record) => ({ record, score: rankCandidate(piece, record, desiredNames) }))
      .filter((candidate) => Number.isFinite(candidate.score))
      .sort(
        (left, right) =>
          right.score - left.score || left.record.prefabName.localeCompare(right.record.prefabName),
      )
      .map((candidate) => candidate.record)
  }

  if (!candidates.length) {
    unmatched.push({ pieceId: piece.id, name: piece.name, category: piece.category })
    continue
  }

  const selected = candidates[0]
  if (candidates.length > 1 && !overridePrefab) {
    const topScore = rankCandidate(piece, selected, desiredNames)
    const tied = candidates.filter((candidate) => rankCandidate(piece, candidate, desiredNames) === topScore)
    if (tied.length > 1)
      ambiguous.push({
        pieceId: piece.id,
        name: piece.name,
        selected: selected.prefabName,
        candidates: tied.map((record) => record.prefabName),
      })
  }
  mappings.push({
    piece,
    record: selected,
    metadataRecord: metadataByPrefab.get(selected.prefabName.toLowerCase()) || selected,
    overridden: Boolean(overridePrefab),
  })
}

fs.mkdirSync(outputDirectory, { recursive: true })
fs.mkdirSync(path.dirname(prefabListPath), { recursive: true })
fs.writeFileSync(
  prefabListPath,
  [
    ...new Set([
      ...mappings.map(({ record }) => record.prefabName),
      ...catalog.map((piece) => piece.sourcePrefab).filter(Boolean),
      ...Object.values(overrides),
    ]),
  ]
    .sort()
    .join('\n') + '\n',
)

const bundlePieces = {}
const copied = []
const spriteDirectory = path.join(outputDirectory, 'sprites')
fs.mkdirSync(spriteDirectory, { recursive: true })

for (const { piece, record, metadataRecord } of mappings) {
  if (!record.sprite) continue
  const source = path.resolve(captureDirectory, record.sprite)
  if (!fs.existsSync(source)) continue
  const fileName = `${piece.id}.png`
  const optimized = cropTransparentPng(fs.readFileSync(source))
  const isBlackMarbleBuildPiece =
    (piece.category === 'Structure' || piece.category === 'Walls') && /black marble/i.test(piece.name)
  const spriteBuffer =
    piece.id === 'crafting-black-forge'
      ? darkenPngNeutrals(optimized.buffer, 0.24)
      : isBlackMarbleBuildPiece
        ? adjustPngBrightness(optimized.buffer, 0.3)
        : optimized.buffer
  fs.writeFileSync(path.join(spriteDirectory, fileName), spriteBuffer)
  const recipeRecord = recipesByPrefab.get(record.prefabName.toLowerCase())
  const footprint = measuredFootprint(piece, metadataRecord.geometryBounds, optimized)
  const rangeProjectionBounds = selectRangeProjectionBounds(
    metadataRecord.visualBounds,
    metadataRecord.geometryBounds,
  )
  bundlePieces[piece.id] = {
    sprite: `sprites/${fileName}`,
    spriteBounds: { preCropped: true, width: optimized.width, height: optimized.height },
    prefabName: record.prefabName,
    displayName: record.displayName,
    visualBounds: metadataRecord.visualBounds,
    ...(metadataRecord.geometryBounds ? { geometryBounds: metadataRecord.geometryBounds } : {}),
    ...(footprint ? { measuredFootprint: footprint } : {}),
    prefabOrigin: projectPrefabOrigin(metadataRecord.visualBounds),
    rangeOrigin: projectPrefabOrigin(rangeProjectionBounds),
    snapPoints: projectSnapPoints(
      metadataRecord.snapPoints,
      metadataRecord.visualBounds,
      piece.shape === 'line',
    ),
    resources: recipeRecord?.resources || [],
    comfort: Number.isInteger(metadataRecord.comfort) ? metadataRecord.comfort : 0,
    ...(metadataRecord.comfortGroup ? { comfortGroup: metadataRecord.comfortGroup } : {}),
    effectAreas: (metadataRecord.effectAreas || []).map((area) => ({
      type: area.type,
      radius: area.radius,
      offset: projectPrefabPoint(area, rangeProjectionBounds),
    })),
    craftingStationRanges: (metadataRecord.craftingStationRanges || []).map((station) => ({
      nameToken: station.nameToken,
      displayName: station.displayName,
      rangeBuild: station.rangeBuild,
      extraRangePerLevel: station.extraRangePerLevel,
      offset: projectPrefabPoint(station, rangeProjectionBounds),
    })),
    stationExtensions: (metadataRecord.stationExtensions || []).map((extension) => ({
      extensionNameToken: extension.extensionNameToken,
      extensionName: extension.extensionName,
      stationNameToken: extension.stationNameToken,
      stationName: extension.stationName,
      maxStationDistance: extension.maxStationDistance,
      stack: extension.stack,
      offset: projectPrefabPoint(extension, rangeProjectionBounds),
    })),
    ...(recipeRecord && Object.hasOwn(recipeRecord, 'craftingStation')
      ? { craftingStation: recipeRecord.craftingStation }
      : {}),
  }
  copied.push(piece.id)
}

const bundle = {
  schemaVersion: 1,
  id: args.id || 'hearthwright-visuals',
  name: args.name || 'Hearthwright Visuals',
  gameVersion: capture.gameVersion,
  capturePluginVersion: capture.capturePluginVersion,
  recipeCapturePluginVersion: recipeCapture.capturePluginVersion,
  generatedAtUtc: new Date().toISOString(),
  legalStatus: args['legal-status'] === 'approved' ? 'approved' : 'local-only',
  pieces: bundlePieces,
}
fs.writeFileSync(path.join(outputDirectory, 'manifest.json'), JSON.stringify(bundle, null, 2) + '\n')
const orientationAudit = mappings.map(({ piece, record }) => {
  const captureWidth = Number(record.visualBounds?.width || 0)
  const captureDepth = Number(record.visualBounds?.depth || 0)
  const plannerAspect = piece.width && piece.depth ? piece.width / piece.depth : 0
  const captureAspect = captureWidth && captureDepth ? captureWidth / captureDepth : 0
  const plannerAxis = plannerAspect > 1.12 ? 'width' : plannerAspect < 0.89 ? 'depth' : 'square'
  const captureAxis = captureAspect > 1.12 ? 'width' : captureAspect < 0.89 ? 'depth' : 'square'
  return {
    pieceId: piece.id,
    name: piece.name,
    prefabName: record.prefabName,
    plannerWidth: piece.width,
    plannerDepth: piece.depth,
    captureWidth,
    captureDepth,
    plannerAxis,
    captureAxis,
    axisAligned: plannerAxis === 'square' || captureAxis === 'square' ? null : plannerAxis === captureAxis,
  }
})
const sizeAudit = mappings.map(({ piece, record }) => {
  const measured = bundlePieces[piece.id]?.measuredFootprint
  return {
    pieceId: piece.id,
    name: piece.name,
    category: piece.category,
    prefabName: record.prefabName,
    plannerWidth: piece.width,
    plannerDepth: piece.depth,
    measuredWidth: measured?.width || 0,
    measuredDepth: measured?.depth || 0,
  }
})
const axisMismatches = orientationAudit.filter((entry) => entry.axisAligned === false)
fs.writeFileSync(
  path.join(outputDirectory, 'mapping-report.json'),
  JSON.stringify(
    {
      capture: path.relative(projectRoot, capturePath).replace(/\\/g, '/'),
      metadataCapture: path.relative(projectRoot, metadataCapturePath).replace(/\\/g, '/'),
      recipeCapture: path.relative(projectRoot, recipeCapturePath).replace(/\\/g, '/'),
      catalogCount: catalog.length,
      mappedCount: mappings.length,
      bundledCount: copied.length,
      mapped: mappings.map(({ piece, record, overridden }) => ({
        pieceId: piece.id,
        name: piece.name,
        prefabName: record.prefabName,
        displayName: record.displayName,
        hasSprite: Boolean(record.sprite),
        overridden,
      })),
      unmatched,
      ambiguous,
      orientationAudit,
      sizeAudit,
      axisMismatches,
    },
    null,
    2,
  ) + '\n',
)

process.stdout.write(
  `Visual bundle: ${copied.length} sprites, ${mappings.length}/${catalog.length} catalog pieces mapped.\n`,
)
process.stdout.write(`Manifest: ${path.join(outputDirectory, 'manifest.json')}\n`)
process.stdout.write(`Capture list: ${prefabListPath}\n`)
if (ambiguous.length)
  process.stdout.write(`Review ${ambiguous.length} ambiguous mappings in mapping-report.json.\n`)
if (unmatched.length)
  process.stdout.write(`Review ${unmatched.length} unmatched catalog pieces in mapping-report.json.\n`)
if (axisMismatches.length)
  process.stdout.write(
    `${axisMismatches.length} long-axis mismatches will be quarter-turned by the renderer; review orientationAudit in mapping-report.json.\n`,
  )
