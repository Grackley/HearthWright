const path = require('path')
const { app, BrowserWindow, dialog, ipcMain, shell } = require('electron')
const { registerMapIpc } = require('./maps.cjs')
const { createSmokeHarness } = require('./smoke.cjs')
const { registerVisualIpc } = require('./visuals.cjs')
const { registerProjectIpc } = require('./projects.cjs')

const smoke = createSmokeHarness(app)

registerMapIpc(app, ipcMain)
registerVisualIpc(app, ipcMain)
registerProjectIpc(app, ipcMain, dialog)

const externalHosts = new Set(['github.com', 'valheim-map.world'])

ipcMain.handle('app:open-external', async (_event, value) => {
  try {
    const url = new URL(value)
    if (url.protocol !== 'https:' || !externalHosts.has(url.hostname)) return false
    await shell.openExternal(url.href)
    return true
  } catch {
    return false
  }
})

const createWindow = () => {
  const window = new BrowserWindow({
    width: 1560,
    height: 980,
    minWidth: 1100,
    minHeight: 720,
    backgroundColor: '#101815',
    show: !smoke.enabled || smoke.preview,
    title: 'Hearthwright',
    titleBarStyle: 'hiddenInset',
    autoHideMenuBar: true,
    webPreferences: {
      backgroundThrottling: !smoke.enabled,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: path.join(__dirname, 'preload.cjs'),
    },
  })

  smoke.attach(window)
  void window.loadFile(path.join(__dirname, '..', 'build', 'index.html'))
}

app.whenReady().then(() => {
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
