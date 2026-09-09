import type {
  PieceCraftingStationMap,
  PieceCraftingStationRequirement,
  PieceComfortMap,
  PieceResourceMap,
  PieceResourceRequirement,
  PieceRangeMap,
  PieceSnapPointMap,
  Point,
  VisualBundleManifest,
} from '../types'

export const comfortFromVisualBundle = (pieces: VisualBundleManifest['pieces']): PieceComfortMap =>
  Object.fromEntries(
    Object.entries(pieces).flatMap(([pieceId, entry]) =>
      Number.isInteger(entry.comfort) && entry.comfort! >= 0 ? [[pieceId, entry.comfort!]] : [],
    ),
  )

const validPoint = (value: unknown): value is Point => {
  if (!value || typeof value !== 'object') return false
  const point = value as Partial<Point>
  return Number.isFinite(point.x) && Number.isFinite(point.y)
}

export const rangesFromVisualBundle = (pieces: VisualBundleManifest['pieces']): PieceRangeMap =>
  Object.fromEntries(
    Object.entries(pieces).map(([pieceId, entry]) => [
      pieceId,
      {
        origin: validPoint(entry.rangeOrigin)
          ? { ...entry.rangeOrigin }
          : validPoint(entry.prefabOrigin)
            ? { ...entry.prefabOrigin }
            : { x: 0, y: 0 },
        effectAreas: (entry.effectAreas ?? []).filter(
          (area) =>
            typeof area.type === 'string' &&
            Number.isFinite(area.radius) &&
            area.radius > 0 &&
            validPoint(area.offset),
        ),
        craftingStations: (entry.craftingStationRanges ?? []).filter(
          (station) =>
            typeof station.nameToken === 'string' &&
            typeof station.displayName === 'string' &&
            Number.isFinite(station.rangeBuild) &&
            station.rangeBuild >= 0 &&
            Number.isFinite(station.extraRangePerLevel) &&
            station.extraRangePerLevel >= 0 &&
            validPoint(station.offset),
        ),
        stationExtensions: (entry.stationExtensions ?? []).filter(
          (extension) =>
            typeof extension.extensionNameToken === 'string' &&
            typeof extension.stationNameToken === 'string' &&
            Number.isFinite(extension.maxStationDistance) &&
            extension.maxStationDistance > 0 &&
            validPoint(extension.offset),
        ),
      },
    ]),
  )

export const snapPointsFromVisualBundle = (pieces: VisualBundleManifest['pieces']): PieceSnapPointMap =>
  Object.fromEntries(
    Object.entries(pieces).flatMap(([pieceId, entry]) =>
      Array.isArray(entry.snapPoints)
        ? [[pieceId, entry.snapPoints.filter(validPoint).map((point) => ({ ...point }))]]
        : [],
    ),
  )

const validResource = (value: unknown): value is PieceResourceRequirement => {
  if (!value || typeof value !== 'object') return false
  const resource = value as Partial<PieceResourceRequirement>
  return (
    typeof resource.prefabName === 'string' &&
    typeof resource.displayName === 'string' &&
    Number.isInteger(resource.amount) &&
    resource.amount! > 0 &&
    typeof resource.recover === 'boolean'
  )
}

export const resourcesFromVisualBundle = (pieces: VisualBundleManifest['pieces']): PieceResourceMap =>
  Object.fromEntries(
    Object.entries(pieces).flatMap(([pieceId, entry]) =>
      Array.isArray(entry.resources)
        ? [[pieceId, entry.resources.filter(validResource).map((resource) => ({ ...resource }))]]
        : [],
    ),
  )

const validCraftingStation = (value: unknown): value is PieceCraftingStationRequirement => {
  if (!value || typeof value !== 'object') return false
  const station = value as Partial<PieceCraftingStationRequirement>
  return typeof station.prefabName === 'string' && typeof station.displayName === 'string'
}

export const craftingStationsFromVisualBundle = (
  pieces: VisualBundleManifest['pieces'],
): PieceCraftingStationMap => {
  const result: Record<string, PieceCraftingStationRequirement | null> = {}
  for (const [pieceId, entry] of Object.entries(pieces)) {
    if (!Object.prototype.hasOwnProperty.call(entry, 'craftingStation')) continue
    if (entry.craftingStation === null) result[pieceId] = null
    else if (validCraftingStation(entry.craftingStation)) result[pieceId] = { ...entry.craftingStation }
  }
  return result
}
