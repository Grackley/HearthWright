/// <reference lib="webworker" />

import type { MapTileCoordinate } from '../core/mapImages'

type TileRequest = MapTileCoordinate & {
  factor: number
  key: string
  overview: boolean
  viewRevision: number
}

type InitializeMessage = {
  type: 'initialize'
  generation: number
  source: string
  cacheKey: string
}

type RequestMessage = {
  type: 'request'
  generation: number
  viewRevision: number
  requests: TileRequest[]
}

type WorkerMessage = InitializeMessage | RequestMessage

type CachedTile = {
  key: string
  blob: Blob
  usedAt: number
}

const workerScope = self as unknown as DedicatedWorkerGlobalScope
const DATABASE_NAME = 'hearthwright-map-tiles-v1'
const TILE_STORE = 'tiles'
const MAX_PERSISTED_TILES = 512

let generation = 0
let source = ''
let cacheKey = ''
let sourceBitmapPromise: Promise<ImageBitmap> | undefined
let latestViewRevision = 0
let processing = false
let writesSincePrune = 0
const queue = new Map<string, TileRequest>()

const openTileDatabase = () =>
  new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, 1)
    request.onupgradeneeded = () => {
      const database = request.result
      const store = database.createObjectStore(TILE_STORE, { keyPath: 'key' })
      store.createIndex('usedAt', 'usedAt')
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })

const databasePromise = openTileDatabase().catch(() => undefined)

const readCachedTile = async (key: string) => {
  const database = await databasePromise
  if (!database) return undefined
  return new Promise<Blob | undefined>((resolve) => {
    const transaction = database.transaction(TILE_STORE, 'readonly')
    const request = transaction.objectStore(TILE_STORE).get(key)
    request.onsuccess = () => resolve((request.result as CachedTile | undefined)?.blob)
    request.onerror = () => resolve(undefined)
  })
}

const pruneTileCache = async (database: IDBDatabase) => {
  const count = await new Promise<number>((resolve) => {
    const transaction = database.transaction(TILE_STORE, 'readonly')
    const request = transaction.objectStore(TILE_STORE).count()
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => resolve(0)
  })
  let remaining = count - MAX_PERSISTED_TILES
  if (remaining <= 0) return
  await new Promise<void>((resolve) => {
    const transaction = database.transaction(TILE_STORE, 'readwrite')
    const request = transaction.objectStore(TILE_STORE).index('usedAt').openCursor()
    request.onsuccess = () => {
      const cursor = request.result
      if (!cursor || remaining <= 0) return
      cursor.delete()
      remaining -= 1
      cursor.continue()
    }
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => resolve()
  })
}

const writeCachedTile = async (key: string, blob: Blob) => {
  const database = await databasePromise
  if (!database) return
  await new Promise<void>((resolve) => {
    const transaction = database.transaction(TILE_STORE, 'readwrite')
    transaction.objectStore(TILE_STORE).put({ key, blob, usedAt: Date.now() } satisfies CachedTile)
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => resolve()
  })
  writesSincePrune += 1
  if (writesSincePrune >= 32) {
    writesSincePrune = 0
    await pruneTileCache(database)
  }
}

const getSourceBitmap = () => {
  if (!sourceBitmapPromise) {
    sourceBitmapPromise = fetch(source)
      .then((response) => {
        if (!response.ok) throw new Error(`Map source returned ${response.status}`)
        return response.blob()
      })
      .then((blob) => createImageBitmap(blob))
  }
  return sourceBitmapPromise
}

const tileCacheKey = (request: TileRequest) =>
  `${cacheKey}:${request.factor}:${request.column}:${request.row}:${request.sourceWidth}x${request.sourceHeight}`

const buildTileBlob = async (request: TileRequest) => {
  const bitmap = await getSourceBitmap()
  const width = Math.max(1, Math.ceil(request.sourceWidth / request.factor))
  const height = Math.max(1, Math.ceil(request.sourceHeight / request.factor))
  const canvas = new OffscreenCanvas(width, height)
  const context = canvas.getContext('2d', { alpha: false })!
  context.imageSmoothingEnabled = true
  context.imageSmoothingQuality = 'high'
  context.drawImage(
    bitmap,
    request.sourceX,
    request.sourceY,
    request.sourceWidth,
    request.sourceHeight,
    0,
    0,
    width,
    height,
  )
  return canvas.convertToBlob({ type: 'image/png' })
}

const processQueue = async () => {
  if (processing) return
  processing = true
  while (queue.size) {
    const [key, request] = queue.entries().next().value as [string, TileRequest]
    queue.delete(key)
    const requestGeneration = generation
    const started = performance.now()
    try {
      const persistentKey = tileCacheKey(request)
      let blob = await readCachedTile(persistentKey)
      const cached = Boolean(blob)
      if (!blob) {
        blob = await buildTileBlob(request)
        void writeCachedTile(persistentKey, blob)
      }
      const bitmap = await createImageBitmap(blob)
      if (
        requestGeneration !== generation ||
        (!request.overview && request.viewRevision < latestViewRevision)
      ) {
        bitmap.close()
        workerScope.postMessage({ type: 'tile-cancelled', generation: requestGeneration, key: request.key })
        continue
      }
      workerScope.postMessage(
        {
          type: 'tile',
          generation,
          key: request.key,
          request,
          bitmap,
          cached,
          duration: performance.now() - started,
        },
        [bitmap],
      )
    } catch (error) {
      workerScope.postMessage({
        type: 'tile-error',
        generation,
        key: request.key,
        message: error instanceof Error ? error.message : String(error),
      })
    }
  }
  processing = false
}

workerScope.onmessage = (event: MessageEvent<WorkerMessage>) => {
  const message = event.data
  if (message.type === 'initialize') {
    generation = message.generation
    source = message.source
    cacheKey = message.cacheKey
    latestViewRevision = 0
    queue.clear()
    if (sourceBitmapPromise) void sourceBitmapPromise.then((bitmap) => bitmap.close()).catch(() => {})
    sourceBitmapPromise = undefined
    return
  }

  if (message.generation !== generation) return
  latestViewRevision = Math.max(latestViewRevision, message.viewRevision)
  for (const [key, request] of queue) {
    if (!request.overview && request.viewRevision < latestViewRevision) {
      queue.delete(key)
      workerScope.postMessage({ type: 'tile-cancelled', generation, key })
    }
  }
  message.requests.forEach((request) => queue.set(request.key, request))
  void processQueue()
}
