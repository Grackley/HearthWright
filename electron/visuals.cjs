const fs = require('fs')
const path = require('path')

const candidateVisualDirectories = (app) => {
  const candidates = app.isPackaged
    ? [path.join(process.resourcesPath, 'Visuals')]
    : [
        path.join(process.cwd(), 'visual-assets', 'bundles', 'current'),
        path.join(app.getAppPath(), 'visual-assets', 'bundles', 'current'),
      ]

  return [...new Set(candidates.map((candidate) => path.resolve(candidate)))]
}

const readBundle = (directory) => {
  const manifestPath = path.join(directory, 'manifest.json')
  if (!fs.existsSync(manifestPath)) return undefined

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
  if (manifest?.schemaVersion !== 1 || !manifest?.pieces || typeof manifest.pieces !== 'object') {
    return undefined
  }

  const sprites = []
  for (const [pieceId, entry] of Object.entries(manifest.pieces)) {
    if (!entry || typeof entry.sprite !== 'string') continue
    const imagePath = path.resolve(directory, entry.sprite)
    const relativePath = path.relative(directory, imagePath)
    if (relativePath.startsWith('..') || path.isAbsolute(relativePath) || !fs.existsSync(imagePath)) continue
    sprites.push({ pieceId, imageBytes: fs.readFileSync(imagePath) })
  }

  return { manifest, sprites }
}

const loadVisualBundle = (app) => {
  for (const directory of candidateVisualDirectories(app)) {
    try {
      const bundle = readBundle(directory)
      if (bundle) return bundle
    } catch {
      // A malformed local bundle should not prevent the planner from opening.
    }
  }
  return undefined
}

const registerVisualIpc = (app, ipcMain) => {
  ipcMain.handle('visuals:load', () => loadVisualBundle(app))
}

module.exports = { registerVisualIpc }
