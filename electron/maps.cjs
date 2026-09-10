const fs = require('fs')
const path = require('path')

// Image Only PNG span; All Data exports use a different extent. See docs/map-scale.md.
const WORLD_WIDTH_METERS = 24_576

const readPngBufferSize = (buffer) => {
  if (buffer.length < 24 || buffer.toString('ascii', 1, 4) !== 'PNG') {
    throw new Error('Not a PNG image')
  }
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) }
}

const readPngSize = (imagePath) => {
  const handle = fs.openSync(imagePath, 'r')
  try {
    const header = Buffer.alloc(24)
    const bytesRead = fs.readSync(handle, header, 0, header.length, 0)
    if (bytesRead !== header.length || header.toString('ascii', 1, 4) !== 'PNG') {
      throw new Error('Not a PNG image')
    }
    return { width: header.readUInt32BE(16), height: header.readUInt32BE(20) }
  } finally {
    fs.closeSync(handle)
  }
}

const imageResolution = (width) => {
  if (width === 4096) return 'small'
  if (width === 6144) return 'medium'
  if (width === 8192) return 'high'
  return 'custom'
}

const seedFromImageName = (imageName) =>
  imageName
    .replace(/\.png$/i, '')
    .replace(/^Map_/i, '')
    .replace(/[ _-]+(?:small|low|med|medium|high)$/i, '')

const managedMapDirectory = (app) => path.resolve(app.getPath('documents'), 'Hearthwright', 'Maps')

const candidateMapDirectories = (app) => {
  const executableDirectory = path.dirname(process.execPath)
  const portableDirectory = process.env.PORTABLE_EXECUTABLE_DIR
  const candidates = [
    managedMapDirectory(app),
    path.join(app.getPath('userData'), 'Maps'),
    path.join(process.cwd(), 'Maps'),
    path.join(process.cwd(), 'release', 'Maps'),
    path.join(app.getAppPath(), 'Maps'),
    path.join(executableDirectory, 'Maps'),
    path.resolve(executableDirectory, '..', 'Maps'),
    ...(portableDirectory
      ? [path.join(portableDirectory, 'Maps'), path.resolve(portableDirectory, '..', 'Maps')]
      : []),
  ]

  return [...new Set(candidates.map((candidate) => path.resolve(candidate)))].filter(
    (candidate) => fs.existsSync(candidate) && fs.statSync(candidate).isDirectory(),
  )
}

const createMapLibrary = (app) => {
  let knownMaps = new Map()

  const summary = (record) => ({
    id: record.id,
    seed: record.seed,
    imageName: record.imageName,
    imageWidth: record.imageWidth,
    imageHeight: record.imageHeight,
    metersPerPixel: record.metersPerPixel,
    resolution: record.resolution,
  })

  const scan = () => {
    knownMaps = new Map()
    const seenImages = new Set()
    const managedDirectory = managedMapDirectory(app)

    for (const directory of candidateMapDirectories(app)) {
      for (const imageName of fs.readdirSync(directory).filter((name) => /\.png$/i.test(name))) {
        const imagePath = path.join(directory, imageName)
        let size
        try {
          size = readPngSize(imagePath)
        } catch {
          continue
        }

        const imageKey = `${imageName.toLowerCase()}:${size.width}x${size.height}`
        if (seenImages.has(imageKey)) continue
        seenImages.add(imageKey)

        const stats = fs.statSync(imagePath)
        const idSource = `${imagePath}\0${stats.size}\0${Math.floor(stats.mtimeMs)}`
        const id = Buffer.from(idSource, 'utf8').toString('base64url')
        knownMaps.set(id, {
          id,
          seed: seedFromImageName(imageName),
          imageName,
          imagePath,
          managed: path.dirname(imagePath) === managedDirectory,
          imageWidth: size.width,
          imageHeight: size.height,
          metersPerPixel: WORLD_WIDTH_METERS / size.width,
          resolution: imageResolution(size.width),
        })
      }
    }

    return [...knownMaps.values()]
      .map(summary)
      .sort(
        (first, second) =>
          second.imageWidth - first.imageWidth || first.imageName.localeCompare(second.imageName),
      )
  }

  const load = (id) => {
    if (!knownMaps.has(id)) scan()
    const record = knownMaps.get(id)
    if (!record) throw new Error('Map is no longer available')

    return {
      seed: record.seed,
      imageName: record.imageName,
      imageBytes: fs.readFileSync(record.imagePath),
      imageWidth: record.imageWidth,
      imageHeight: record.imageHeight,
      metersPerPixel: record.metersPerPixel,
      resolution: record.resolution,
    }
  }

  const importImage = (imageName, imageBytes) => {
    const bytes = Buffer.from(imageBytes)
    const size = readPngBufferSize(bytes)
    if (size.width !== size.height) throw new Error('Valheim map PNGs must be square')

    const directory = managedMapDirectory(app)
    fs.mkdirSync(directory, { recursive: true })
    const originalName = path.basename(String(imageName || 'Imported map.png'))
    const safeName = originalName
      .replace(/[^\x20-\x7e]/g, '-')
      .replace(/[<>:"/\\|?*]/g, '-')
      .replace(/\.png$/i, '')
      .trim()
    const baseName = safeName || 'Imported map'
    let targetPath = path.join(directory, `${baseName}.png`)
    let suffix = 2
    while (fs.existsSync(targetPath)) {
      const existing = fs.readFileSync(targetPath)
      if (existing.equals(bytes)) break
      targetPath = path.join(directory, `${baseName} (${suffix}).png`)
      suffix += 1
    }

    if (!fs.existsSync(targetPath)) {
      const temporaryPath = `${targetPath}.importing-${process.pid}-${Date.now()}`
      try {
        fs.writeFileSync(temporaryPath, bytes, { flag: 'wx' })
        fs.renameSync(temporaryPath, targetPath)
      } finally {
        if (fs.existsSync(temporaryPath)) fs.unlinkSync(temporaryPath)
      }
    }

    scan()
    const record = [...knownMaps.values()].find((candidate) => candidate.imagePath === targetPath)
    if (!record) throw new Error('Imported map could not be added to the library')
    return summary(record)
  }

  const remember = (id) => {
    if (!knownMaps.has(id)) scan()
    const record = knownMaps.get(id)
    if (!record) throw new Error('Map is no longer available')
    if (record.managed) return summary(record)
    return importImage(record.imageName, fs.readFileSync(record.imagePath))
  }

  return { scan, load, importImage, remember }
}

const registerMapIpc = (app, ipcMain) => {
  const library = createMapLibrary(app)
  ipcMain.handle('maps:list', () => library.scan())
  ipcMain.handle('maps:load', (_event, id) => library.load(id))
  ipcMain.handle('maps:import', (_event, imageName, imageBytes) => library.importImage(imageName, imageBytes))
  ipcMain.handle('maps:remember', (_event, id) => library.remember(id))
}

module.exports = { registerMapIpc }
