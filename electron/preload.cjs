const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('valheimMaps', {
  list: () => ipcRenderer.invoke('maps:list'),
  load: (id) => ipcRenderer.invoke('maps:load', id),
  import: (imageName, imageBytes) => ipcRenderer.invoke('maps:import', imageName, imageBytes),
  remember: (id) => ipcRenderer.invoke('maps:remember', id),
})

contextBridge.exposeInMainWorld('valheimVisuals', {
  load: () => ipcRenderer.invoke('visuals:load'),
})

contextBridge.exposeInMainWorld('hearthwrightProjects', {
  open: () => ipcRenderer.invoke('projects:open'),
  save: (request) => ipcRenderer.invoke('projects:save', request),
})

contextBridge.exposeInMainWorld('hearthwrightApp', {
  openExternal: (url) => ipcRenderer.invoke('app:open-external', url),
})
