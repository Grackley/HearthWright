import type {
  PieceCraftingStationRange,
  PieceRangeMetadata,
  PieceRangeMap,
  PieceStationExtension,
  PlacedPiece,
  Point,
} from '../types'

export const COMFORT_RADIUS_METERS = 10

const rotateOffset = (offset: Point, degrees: number): Point => {
  const radians = (degrees * Math.PI) / 180
  const cos = Math.cos(radians)
  const sin = Math.sin(radians)
  return { x: offset.x * cos - offset.y * sin, y: offset.x * sin + offset.y * cos }
}

export const rangeCenter = (piece: PlacedPiece, offset: Point): Point => {
  const rotated = rotateOffset(offset, piece.rotation)
  return { x: piece.x + rotated.x, y: piece.y + rotated.y }
}

export interface WorldRadius {
  center: Point
  radius: number
}

export const playerBaseRanges = (piece: PlacedPiece, metadata: PieceRangeMetadata): WorldRadius[] => {
  const candidates = metadata.effectAreas
    .filter((area) =>
      area.type
        .split(',')
        .map((type) => type.trim())
        .includes('PlayerBase'),
    )
    .map((area) => ({ center: rangeCenter(piece, area.offset), radius: area.radius }))
    .sort((first, second) => second.radius - first.radius)

  return candidates.filter(
    (candidate, index) =>
      !candidates
        .slice(0, index)
        .some(
          (larger) =>
            Math.hypot(candidate.center.x - larger.center.x, candidate.center.y - larger.center.y) +
              candidate.radius <=
            larger.radius,
        ),
  )
}

interface ConnectedExtension {
  piece: PlacedPiece
  extension: PieceStationExtension
}

export const connectedStationExtensions = (
  stationPiece: PlacedPiece,
  station: PieceCraftingStationRange,
  pieces: readonly PlacedPiece[],
  ranges: PieceRangeMap,
): ConnectedExtension[] => {
  const stationPoint = rangeCenter(stationPiece, station.offset)
  const connected: ConnectedExtension[] = []
  const uniqueNames = new Set<string>()

  for (const piece of pieces) {
    if (piece.id === stationPiece.id || (piece.level ?? 0) !== (stationPiece.level ?? 0)) continue
    for (const extension of ranges[piece.pieceId]?.stationExtensions ?? []) {
      if (extension.stationNameToken !== station.nameToken) continue
      const extensionPoint = rangeCenter(piece, extension.offset)
      if (
        Math.hypot(extensionPoint.x - stationPoint.x, extensionPoint.y - stationPoint.y) >=
        extension.maxStationDistance
      )
        continue
      if (!extension.stack && uniqueNames.has(extension.extensionNameToken)) continue
      connected.push({ piece, extension })
      if (!extension.stack) uniqueNames.add(extension.extensionNameToken)
    }
  }

  return connected
}

export const effectiveCraftingRange = (
  stationPiece: PlacedPiece,
  station: PieceCraftingStationRange,
  pieces: readonly PlacedPiece[],
  ranges: PieceRangeMap,
) => {
  const extensions = connectedStationExtensions(stationPiece, station, pieces, ranges)
  return {
    center: rangeCenter(stationPiece, station.offset),
    radius: station.rangeBuild + extensions.length * station.extraRangePerLevel,
    extensions,
  }
}
