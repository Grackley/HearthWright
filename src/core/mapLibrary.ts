import type { LocalMapSummary } from '../types'

interface SavedMapReference {
  localMapId?: string
  mapImageName?: string
  seed?: string
}

export const findSavedMap = (maps: LocalMapSummary[], reference: SavedMapReference) => {
  const exactMap =
    maps.find((map) => map.id === reference.localMapId) ??
    maps.find((map) => map.imageName === reference.mapImageName)
  if (exactMap) return exactMap
  if (reference.mapImageName || !reference.seed) return undefined

  const seedMatches = maps.filter((map) => map.seed === reference.seed)
  return seedMatches.length === 1 ? seedMatches[0] : undefined
}
