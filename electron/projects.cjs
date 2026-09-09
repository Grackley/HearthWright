const fs = require('fs')
const path = require('path')
const { randomUUID } = require('crypto')

const PROJECT_EXTENSION = '.hearthwright'

const safeProjectName = (value) => {
  const name = String(value || 'Hearthwright project')
    .replace(/[<>:"/\\|?*]/g, '-')
    .split('')
    .map((character) => (character.charCodeAt(0) < 32 ? '-' : character))
    .join('')
    .replace(/\.+$/g, '')
    .trim()
  return name || 'Hearthwright project'
}

const isProjectPath = (value) =>
  typeof value === 'string' && path.isAbsolute(value) && value.toLowerCase().endsWith(PROJECT_EXTENSION)

const registerProjectIpc = (app, ipcMain, dialog) => {
  const projectDirectory = () => path.join(app.getPath('documents'), 'Hearthwright', 'Projects')

  ipcMain.handle('projects:open', async () => {
    const result = await dialog.showOpenDialog({
      title: 'Open Hearthwright project',
      defaultPath: projectDirectory(),
      properties: ['openFile'],
      filters: [
        { name: 'Hearthwright projects', extensions: ['hearthwright'] },
        { name: 'Legacy planner projects', extensions: ['json'] },
      ],
    })
    if (result.canceled || !result.filePaths[0]) return { canceled: true }
    const filePath = path.resolve(result.filePaths[0])
    return {
      canceled: false,
      filePath,
      fileName: path.basename(filePath),
      contents: await fs.promises.readFile(filePath, 'utf8'),
    }
  })

  ipcMain.handle('projects:save', async (_event, request) => {
    const contents = typeof request?.contents === 'string' ? request.contents : undefined
    if (contents === undefined) throw new Error('Project contents are required')

    let filePath = request.saveAs ? undefined : request.filePath
    if (filePath !== undefined && !isProjectPath(filePath))
      throw new Error('Invalid Hearthwright project path')

    if (!filePath) {
      const directory = projectDirectory()
      await fs.promises.mkdir(directory, { recursive: true })
      const suggestedName = safeProjectName(request.suggestedName).replace(/\.hearthwright$/i, '')
      const result = await dialog.showSaveDialog({
        title: request.saveAs ? 'Save Hearthwright project as' : 'Save Hearthwright project',
        defaultPath: path.join(directory, `${suggestedName}${PROJECT_EXTENSION}`),
        filters: [{ name: 'Hearthwright projects', extensions: ['hearthwright'] }],
      })
      if (result.canceled || !result.filePath) return { canceled: true }
      filePath = result.filePath.toLowerCase().endsWith(PROJECT_EXTENSION)
        ? result.filePath
        : `${result.filePath}${PROJECT_EXTENSION}`
    }

    const resolvedPath = path.resolve(filePath)
    await fs.promises.mkdir(path.dirname(resolvedPath), { recursive: true })
    const temporaryPath = `${resolvedPath}.saving-${randomUUID()}`
    try {
      await fs.promises.writeFile(temporaryPath, contents, { encoding: 'utf8', flag: 'wx', flush: true })
      await fs.promises.rename(temporaryPath, resolvedPath)
    } finally {
      await fs.promises.unlink(temporaryPath).catch(() => {})
    }
    return { canceled: false, filePath: resolvedPath, fileName: path.basename(resolvedPath) }
  })
}

module.exports = { isProjectPath, registerProjectIpc, safeProjectName }
