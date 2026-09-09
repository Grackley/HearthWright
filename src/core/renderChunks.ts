import { pieceById } from '../data/pieces'
import type { PlacedPiece } from '../types'
import type { WorldBox } from './spatialIndex'

// Keep edit invalidation deliberately local. A changed wall should only make a
// small part of a dense build fall back to live rendering while its bitmap is
// refreshed. Eight of these tiles still combine into a useful overview group.
export const RENDER_CHUNK_METERS = 16
export const RENDER_GROUP_CHUNKS = 8

export const shouldRenderPiecesAtNativeDetail = (
  scale: number,
  devicePixelRatio: number,
  cachedPixelsPerMeter: number,
) => scale * devicePixelRatio > cachedPixelsPerMeter

export const renderGroupIdleDelayRemaining = (lastActivity: number, now: number, idleDelay: number) =>
  Math.max(0, idleDelay - Math.max(0, now - lastActivity))

export const renderGroupKeyForChunk = (chunkX: number, chunkY: number, groupChunks = RENDER_GROUP_CHUNKS) =>
  renderChunkKey(Math.floor(chunkX / groupChunks), Math.floor(chunkY / groupChunks))

export const renderGroupIntersectsBox = (
  group: Pick<RenderChunkGroup, 'x' | 'y'>,
  box: WorldBox,
  marginMeters = 0,
  groupChunks = RENDER_GROUP_CHUNKS,
  chunkMeters = RENDER_CHUNK_METERS,
) => {
  const groupMeters = groupChunks * chunkMeters
  const left = group.x * groupMeters
  const top = group.y * groupMeters
  return (
    left <= box.right + marginMeters &&
    left + groupMeters >= box.left - marginMeters &&
    top <= box.bottom + marginMeters &&
    top + groupMeters >= box.top - marginMeters
  )
}

export const shouldDeferRenderGroup = (
  group: Pick<RenderChunkGroup, 'x' | 'y'>,
  lastEditedAt: number | undefined,
  now: number,
  editCooldownMs: number,
  workArea: WorldBox,
  workAreaMarginMeters = 0,
) =>
  lastEditedAt !== undefined &&
  (renderGroupIdleDelayRemaining(lastEditedAt, now, editCooldownMs) > 0 ||
    renderGroupIntersectsBox(group, workArea, workAreaMarginMeters))

export type RenderChunk = {
  key: string
  x: number
  y: number
  pieces: PlacedPiece[]
  signature: string
}

export type RenderChunkIndex = {
  chunks: Map<string, RenderChunk>
  query: (box: WorldBox) => RenderChunk[]
}

export type RenderChunkGroup = {
  key: string
  x: number
  y: number
  chunks: RenderChunk[]
  signature: string
}

export type RenderChunkGroupIndex = {
  groups: Map<string, RenderChunkGroup>
  query: (box: WorldBox) => RenderChunkGroup[]
}

export const renderChunkKey = (x: number, y: number) => `${x}:${y}`

export const renderChunkCoordinatesForPiece = (piece: PlacedPiece, chunkMeters = RENDER_CHUNK_METERS) => {
  const definition = pieceById(piece.pieceId)
  // A rotation-independent radius is deliberately conservative. A piece that
  // merely touches a boundary is included on both sides so clipped tile
  // rendering can never lose an antialiased edge or rotated corner.
  const radius = Math.hypot(definition.width, definition.depth) / 2
  const firstX = Math.floor((piece.x - radius) / chunkMeters)
  const lastX = Math.floor((piece.x + radius) / chunkMeters)
  const firstY = Math.floor((piece.y - radius) / chunkMeters)
  const lastY = Math.floor((piece.y + radius) / chunkMeters)
  const coordinates: { x: number; y: number; key: string }[] = []
  for (let x = firstX; x <= lastX; x += 1) {
    for (let y = firstY; y <= lastY; y += 1) coordinates.push({ x, y, key: renderChunkKey(x, y) })
  }
  return coordinates
}

const pieceSignature = (piece: PlacedPiece) =>
  `${piece.id},${piece.pieceId},${piece.x},${piece.y},${piece.rotation},${piece.level ?? 0}`

export const createRenderChunkIndex = (
  pieces: PlacedPiece[],
  chunkMeters = RENDER_CHUNK_METERS,
): RenderChunkIndex => {
  const chunks = new Map<string, RenderChunk>()
  pieces.forEach((piece) => {
    renderChunkCoordinatesForPiece(piece, chunkMeters).forEach(({ x, y, key }) => {
      const chunk = chunks.get(key)
      if (chunk) chunk.pieces.push(piece)
      else chunks.set(key, { key, x, y, pieces: [piece], signature: '' })
    })
  })
  chunks.forEach((chunk) => {
    // Piece order is retained, so overlap/z-order remains identical whether a
    // piece is rendered live or baked into a chunk.
    chunk.signature = chunk.pieces.map(pieceSignature).join('|')
  })

  return {
    chunks,
    query: ({ left, right, top, bottom }) => {
      const firstX = Math.floor(left / chunkMeters)
      const lastX = Math.floor(right / chunkMeters)
      const firstY = Math.floor(top / chunkMeters)
      const lastY = Math.floor(bottom / chunkMeters)
      const cellCount = (lastX - firstX + 1) * (lastY - firstY + 1)

      if (cellCount > Math.max(4096, chunks.size * 2)) {
        return [...chunks.values()].filter(
          (chunk) =>
            (chunk.x + 1) * chunkMeters >= left &&
            chunk.x * chunkMeters <= right &&
            (chunk.y + 1) * chunkMeters >= top &&
            chunk.y * chunkMeters <= bottom,
        )
      }

      const found: RenderChunk[] = []
      for (let x = firstX; x <= lastX; x += 1) {
        for (let y = firstY; y <= lastY; y += 1) {
          const chunk = chunks.get(renderChunkKey(x, y))
          if (chunk) found.push(chunk)
        }
      }
      return found
    },
  }
}

export const createRenderChunkGroupIndex = (
  chunkIndex: RenderChunkIndex,
  groupChunks = RENDER_GROUP_CHUNKS,
  chunkMeters = RENDER_CHUNK_METERS,
): RenderChunkGroupIndex => {
  const groups = new Map<string, RenderChunkGroup>()
  chunkIndex.chunks.forEach((chunk) => {
    // Math.floor is intentional: negative chunks group symmetrically on the
    // other side of world zero instead of truncating toward zero.
    const x = Math.floor(chunk.x / groupChunks)
    const y = Math.floor(chunk.y / groupChunks)
    const key = renderGroupKeyForChunk(chunk.x, chunk.y, groupChunks)
    const group = groups.get(key)
    if (group) group.chunks.push(chunk)
    else groups.set(key, { key, x, y, chunks: [chunk], signature: '' })
  })
  groups.forEach((group) => {
    group.chunks.sort((first, second) => first.x - second.x || first.y - second.y)
    group.signature = group.chunks.map((chunk) => `${chunk.key}[${chunk.signature}]`).join(';')
  })

  const groupMeters = groupChunks * chunkMeters
  return {
    groups,
    query: ({ left, right, top, bottom }) =>
      [...groups.values()].filter(
        (group) =>
          (group.x + 1) * groupMeters >= left &&
          group.x * groupMeters <= right &&
          (group.y + 1) * groupMeters >= top &&
          group.y * groupMeters <= bottom,
      ),
  }
}
