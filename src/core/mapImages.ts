export const VALHEIM_WORLD_WIDTH_METERS = 24000

export const MAP_TILE_PIXELS = 512
export const MAP_TILE_DOWNSAMPLE_FACTORS = [1, 2, 4, 8, 16] as const

export type MapTileCoordinate = {
  column: number
  row: number
  sourceX: number
  sourceY: number
  sourceWidth: number
  sourceHeight: number
}

export type MapImageResolution = 'small' | 'medium' | 'high' | 'custom'

export const mapImageResolution = (width: number): MapImageResolution => {
  if (width === 4096) return 'small'
  if (width === 6144) return 'medium'
  if (width === 8192) return 'high'
  return 'custom'
}

export const mapMetersPerPixel = (width: number) => VALHEIM_WORLD_WIDTH_METERS / width

/**
 * Selects a stable power-of-two map mip. The chosen bitmap pixel is never
 * much smaller than a screen pixel, so zoomed-out views do not upload the
 * full-resolution world texture merely to immediately downsample it.
 */
export const mapTileDownsampleFactor = (screenPixelsPerSourcePixel: number) => {
  const safeScale = Number.isFinite(screenPixelsPerSourcePixel) ? Math.max(0, screenPixelsPerSourcePixel) : 1
  return (
    MAP_TILE_DOWNSAMPLE_FACTORS.find((factor) => safeScale * factor >= 0.75) ??
    MAP_TILE_DOWNSAMPLE_FACTORS.at(-1)!
  )
}

export const mapOverviewDownsampleFactor = (imageWidth: number, imageHeight: number) => {
  const largestDimension = Math.max(1, imageWidth, imageHeight)
  return (
    MAP_TILE_DOWNSAMPLE_FACTORS.find((factor) => largestDimension / factor <= MAP_TILE_PIXELS) ??
    MAP_TILE_DOWNSAMPLE_FACTORS.at(-1)!
  )
}

export const mapTileCoordinates = (
  imageWidth: number,
  imageHeight: number,
  factor: number,
  sourceBox: { left: number; right: number; top: number; bottom: number },
): MapTileCoordinate[] => {
  if (imageWidth <= 0 || imageHeight <= 0 || factor <= 0) return []
  const left = Math.max(0, Math.min(imageWidth, sourceBox.left))
  const right = Math.max(left, Math.min(imageWidth, sourceBox.right))
  const top = Math.max(0, Math.min(imageHeight, sourceBox.top))
  const bottom = Math.max(top, Math.min(imageHeight, sourceBox.bottom))
  if (right <= left || bottom <= top) return []

  const sourceTileSize = MAP_TILE_PIXELS * factor
  const firstColumn = Math.floor(left / sourceTileSize)
  const lastColumn = Math.max(firstColumn, Math.ceil(right / sourceTileSize) - 1)
  const firstRow = Math.floor(top / sourceTileSize)
  const lastRow = Math.max(firstRow, Math.ceil(bottom / sourceTileSize) - 1)
  const coordinates: MapTileCoordinate[] = []
  for (let row = firstRow; row <= lastRow; row += 1) {
    for (let column = firstColumn; column <= lastColumn; column += 1) {
      const sourceX = column * sourceTileSize
      const sourceY = row * sourceTileSize
      coordinates.push({
        column,
        row,
        sourceX,
        sourceY,
        sourceWidth: Math.min(sourceTileSize, imageWidth - sourceX),
        sourceHeight: Math.min(sourceTileSize, imageHeight - sourceY),
      })
    }
  }
  return coordinates
}

export const mapSeedFromFilename = (filename: string) =>
  filename
    .replace(/\.png$/i, '')
    .replace(/^Map_/i, '')
    .replace(/[ _-]+(?:small|low|med|medium|high)$/i, '')
