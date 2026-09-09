import type { Point } from '../types'

export interface WorldMapPoint {
  x: number
  z: number
}

export const metersPerPixel = (worldWidth: number, imageWidth: number) => worldWidth / imageWidth

/** Converts Valheim X/Z coordinates into a north-up image pixel. */
export const worldToImagePixel = (
  point: WorldMapPoint,
  worldWidth: number,
  imageWidth: number,
  imageHeight: number,
): Point => ({
  x: ((point.x + worldWidth / 2) / worldWidth) * imageWidth,
  y: ((worldWidth / 2 - point.z) / worldWidth) * imageHeight,
})

/** Converts a north-up image pixel back into Valheim X/Z coordinates. */
export const imagePixelToWorld = (
  pixel: Point,
  worldWidth: number,
  imageWidth: number,
  imageHeight: number,
): WorldMapPoint => ({
  x: (pixel.x / imageWidth) * worldWidth - worldWidth / 2,
  z: worldWidth / 2 - (pixel.y / imageHeight) * worldWidth,
})
