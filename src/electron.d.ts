import type { LoadedLocalMap, LoadedVisualBundle, LocalMapSummary } from './types'

declare global {
  interface Window {
    valheimMaps?: {
      list: () => Promise<LocalMapSummary[]>
      load: (id: string) => Promise<LoadedLocalMap>
      import: (imageName: string, imageBytes: ArrayBuffer) => Promise<LocalMapSummary>
      remember: (id: string) => Promise<LocalMapSummary>
    }
    valheimVisuals?: {
      load: () => Promise<LoadedVisualBundle | undefined>
    }
    hearthwrightProjects?: {
      open: () => Promise<
        { canceled: true } | { canceled: false; filePath: string; fileName: string; contents: string }
      >
      save: (request: {
        filePath?: string
        suggestedName: string
        contents: string
        saveAs?: boolean
      }) => Promise<{ canceled: true } | { canceled: false; filePath: string; fileName: string }>
    }
    hearthwrightApp?: {
      openExternal: (url: string) => Promise<boolean>
    }
  }
}

export {}
