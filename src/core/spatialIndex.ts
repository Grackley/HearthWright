import { pieceById } from '../data/pieces'
import type { PlacedPiece } from '../types'

export type WorldBox = { left: number; right: number; top: number; bottom: number }

export type PieceSpatialIndex = {
  query: (box: WorldBox) => PlacedPiece[]
}

const DEFAULT_CELL_SIZE = 16

export const createPieceSpatialIndex = (
  pieces: PlacedPiece[],
  cellSize = DEFAULT_CELL_SIZE,
): PieceSpatialIndex => {
  const buckets = new Map<string, number[]>()
  const key = (x: number, y: number) => `${x}:${y}`

  pieces.forEach((piece, index) => {
    const definition = pieceById(piece.pieceId)
    const radius = Math.hypot(definition.width, definition.depth) / 2
    const left = Math.floor((piece.x - radius) / cellSize)
    const right = Math.floor((piece.x + radius) / cellSize)
    const top = Math.floor((piece.y - radius) / cellSize)
    const bottom = Math.floor((piece.y + radius) / cellSize)
    for (let cellX = left; cellX <= right; cellX += 1) {
      for (let cellY = top; cellY <= bottom; cellY += 1) {
        const bucketKey = key(cellX, cellY)
        const bucket = buckets.get(bucketKey)
        if (bucket) bucket.push(index)
        else buckets.set(bucketKey, [index])
      }
    }
  })

  return {
    query: ({ left, right, top, bottom }) => {
      const firstX = Math.floor(left / cellSize)
      const lastX = Math.floor(right / cellSize)
      const firstY = Math.floor(top / cellSize)
      const lastY = Math.floor(bottom / cellSize)
      const cellCount = (lastX - firstX + 1) * (lastY - firstY + 1)

      // Very wide overview queries are cheaper as a single sequential scan than
      // walking tens of thousands of empty grid cells.
      const candidates =
        cellCount > Math.max(4096, buckets.size * 2)
          ? pieces.map((_, index) => index)
          : (() => {
              const found = new Set<number>()
              for (let cellX = firstX; cellX <= lastX; cellX += 1) {
                for (let cellY = firstY; cellY <= lastY; cellY += 1) {
                  buckets.get(key(cellX, cellY))?.forEach((index) => found.add(index))
                }
              }
              return [...found].sort((a, b) => a - b)
            })()

      return candidates
        .map((index) => pieces[index])
        .filter((piece) => {
          const definition = pieceById(piece.pieceId)
          const radius = Math.hypot(definition.width, definition.depth) / 2
          return (
            piece.x + radius >= left &&
            piece.x - radius <= right &&
            piece.y + radius >= top &&
            piece.y - radius <= bottom
          )
        })
    },
  }
}
