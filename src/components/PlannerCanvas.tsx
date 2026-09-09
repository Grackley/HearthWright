import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react'
import type {
  Camera,
  FarmMode,
  LevelViewMode,
  PieceDefinition,
  PieceComfortMap,
  PieceRangeMap,
  PieceSnapPointMap,
  PlacedPiece,
  PlanAnnotation,
  Point,
  SnapMode,
  Tool,
} from '../types'
import {
  findMoveSnap,
  findSnap,
  formatDistance,
  pointInPiece,
  snapPointRadius,
  worldSnapPoints,
} from '../core/geometry'
import { isBuildingPiece, pieceById } from '../data/pieces'
import { placementSnapActive } from '../core/snapMode'
import { boxPlacementPositions, MAX_BOX_PIECES } from '../core/boxPlacement'
import { linePlacementPositions } from '../core/linePlacement'
import {
  COMFORT_RADIUS_METERS,
  effectiveCraftingRange,
  playerBaseRanges,
  rangeCenter,
} from '../core/rangeOverlays'
import { rotateMovingPieceGroup } from '../core/groupTransform'
import {
  annotationBounds,
  annotationsIntersectingBox,
  cloneAnnotation,
  piecesIntersectingBox,
  pointInAnnotation,
  translateAnnotation,
} from '../core/selection'
import { CULTIVATED_SOIL_COLOR, CULTIVATED_SOIL_EDGE, CULTIVATOR_RADIUS_METERS } from '../core/farming'
import {
  perfCount,
  perfEvent,
  perfFrameStart,
  perfGauge,
  perfInput,
  perfMeasure,
  perfRecord,
} from '../core/perfDiagnostics'
import { spriteLayout, type SpriteFit } from '../core/spriteLayout'
import { createPieceSpatialIndex, type WorldBox } from '../core/spatialIndex'
import { compareLevels, isLevelSnapTarget, renderedLevelViewMode } from '../core/levels'
import {
  mapOverviewDownsampleFactor,
  mapTileCoordinates,
  mapTileDownsampleFactor,
  type MapTileCoordinate,
} from '../core/mapImages'
import {
  createRenderChunkGroupIndex,
  createRenderChunkIndex,
  RENDER_CHUNK_METERS,
  RENDER_GROUP_CHUNKS,
  renderChunkCoordinatesForPiece,
  renderGroupIdleDelayRemaining,
  renderGroupKeyForChunk,
  shouldDeferRenderGroup,
  shouldRenderPiecesAtNativeDetail,
  type RenderChunk,
  type RenderChunkIndex,
} from '../core/renderChunks'

const MIN_SCALE = 0.018
const MAX_SCALE = 90

export interface CanvasHandle {
  showWorld: () => void
  focusAt: (point?: Point) => void
  exportPng: () => string | undefined
  rotateActiveMove: (amount: number) => boolean
}

interface PlannerCanvasProps {
  pieces: PlacedPiece[]
  annotations: PlanAnnotation[]
  selectedIds: string[]
  activePiece: PieceDefinition
  tool: Tool
  snapMode: SnapMode
  rotation: number
  mapImage: string
  mapImageWidth: number
  mapImageHeight: number
  mapCacheKey: string
  worldWidth: number
  showMap: boolean
  showGrid: boolean
  showAnchors: boolean
  activeLevel: number
  levelViewModes: Record<number, LevelViewMode>
  textDraft: string
  textSize: number
  paintColor: string
  penWidth: number
  farmMode: FarmMode
  pieceSprites: Record<string, string>
  preCroppedPieceSprites: Record<string, boolean>
  pieceSnapPoints: PieceSnapPointMap
  pieceComfort: PieceComfortMap
  pieceRanges: PieceRangeMap
  showComfortRanges: boolean
  showSuppressionRanges: boolean
  showCraftingRanges: boolean
  onPlace: (piece: PlacedPiece) => void
  onPlaceMany: (pieces: PlacedPiece[]) => void
  onSelect: (ids: string[]) => void
  onMoveMany: (updates: { id: string; x: number; y: number; rotation: number }[]) => void
  onMoveAnnotations: (annotations: PlanAnnotation[]) => void
  onMoveStart: () => void
  onMoveEnd: () => void
  onAddAnnotation: (annotation: PlanAnnotation) => void
  onCursorChange: (point: Point, scale: number) => void
}

type PreparedPieceSprite = {
  image: HTMLImageElement
  sourceX: number
  sourceY: number
  sourceWidth: number
  sourceHeight: number
}

type RenderCanvas = HTMLCanvasElement | OffscreenCanvas

type RenderChunkBitmap = {
  canvas: RenderCanvas
  source: CanvasImageSource
  bitmap?: ImageBitmap
  signature: string
  sceneRevision: number
  lastUsed: number
}

type RenderGroupBitmap = RenderChunkBitmap & {
  left: number
  top: number
  width: number
  height: number
}

type MapTileBitmap = MapTileCoordinate & {
  bitmap: ImageBitmap
  factor: number
  lastUsed: number
}

type MapTileWorkerResponse =
  | {
      type: 'tile'
      generation: number
      key: string
      request: MapTileCoordinate & { factor: number; overview: boolean }
      bitmap: ImageBitmap
      cached: boolean
      duration: number
    }
  | {
      type: 'tile-error' | 'tile-cancelled'
      generation: number
      key: string
      message?: string
    }

const RENDER_CHUNK_PIXELS_PER_METER = 12
const RENDER_CHUNK_GUTTER = 2
const MAX_CACHED_RENDER_CHUNKS = 256
const MAX_CACHED_RENDER_GROUPS = 4
const MAX_CACHED_MAP_TILES = 48
const RENDER_CHUNK_INTERACTION_IDLE_MS = 300
const RENDER_GROUP_GLOBAL_IDLE_MS = 5_000
const RENDER_GROUP_HOT_COOLDOWN_MS = 30_000
const RENDER_GROUP_WORK_MARGIN_METERS = 32
const RENDER_GROUP_RECHECK_MS = 5_000

const createRenderCanvas = (width: number, height: number, reusable?: RenderCanvas): RenderCanvas => {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(width, height)
  const canvas = reusable instanceof HTMLCanvasElement ? reusable : document.createElement('canvas')
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width
    canvas.height = height
  }
  return canvas
}

const renderCanvasContext = (canvas: RenderCanvas) =>
  canvas.getContext('2d', { alpha: true }) as unknown as CanvasRenderingContext2D

const transferRenderCanvas = (canvas: RenderCanvas) =>
  typeof OffscreenCanvas !== 'undefined' && canvas instanceof OffscreenCanvas
    ? canvas.transferToImageBitmap()
    : undefined

const preparePieceSprite = (image: HTMLImageElement): PreparedPieceSprite => {
  const canvas = document.createElement('canvas')
  canvas.width = image.naturalWidth
  canvas.height = image.naturalHeight
  const context = canvas.getContext('2d', { willReadFrequently: true })!
  context.drawImage(image, 0, 0)
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data
  let left = canvas.width
  let top = canvas.height
  let right = -1
  let bottom = -1
  for (let y = 0; y < canvas.height; y += 1) {
    for (let x = 0; x < canvas.width; x += 1) {
      if (pixels[(y * canvas.width + x) * 4 + 3] < 8) continue
      left = Math.min(left, x)
      top = Math.min(top, y)
      right = Math.max(right, x)
      bottom = Math.max(bottom, y)
    }
  }
  if (right < left || bottom < top)
    return { image, sourceX: 0, sourceY: 0, sourceWidth: canvas.width, sourceHeight: canvas.height }
  const padding = 2
  const sourceX = Math.max(0, left - padding)
  const sourceY = Math.max(0, top - padding)
  return {
    image,
    sourceX,
    sourceY,
    sourceWidth: Math.min(canvas.width - sourceX, right - left + 1 + padding * 2),
    sourceHeight: Math.min(canvas.height - sourceY, bottom - top + 1 + padding * 2),
  }
}

type Interaction =
  | { kind: 'pan'; start: Point; camera: Camera }
  | {
      kind: 'move'
      start: Point
      pieceOrigins: PlacedPiece[]
      annotationOrigins: PlanAnnotation[]
      piecePositions: PlacedPiece[]
      annotationPositions: PlanAnnotation[]
      snapTarget?: Point
    }
  | { kind: 'select'; start: Point; current: Point; additive: boolean }
  | { kind: 'pen'; points: Point[] }
  | { kind: 'farm-cultivator'; points: Point[]; action: 'paint' | 'erase' }
  | { kind: 'farm-area'; start: Point; current: Point }
  | { kind: 'box-fill'; start: Point; current: Point }
  | undefined

type RadiusOverlay = {
  key: string
  ownerId: string
  kind: 'comfort' | 'suppression' | 'crafting'
  center: Point
  radius: number
  label?: string
  connections?: Point[]
}

const screenToWorld = (screen: Point, camera: Camera, rect: DOMRect): Point => ({
  x: (screen.x - rect.left - rect.width / 2) / camera.scale + camera.x,
  y: (screen.y - rect.top - rect.height / 2) / camera.scale + camera.y,
})

const tracePiecePath = (context: CanvasRenderingContext2D, definition: PieceDefinition, depth: number) => {
  context.beginPath()
  if (definition.shape === 'circle') {
    context.arc(0, 0, definition.width / 2, 0, Math.PI * 2)
  } else if (definition.shape === 'quarterCircle') {
    const radius = Math.min(definition.width, depth)
    const right = definition.tags.includes('right')
    const centerX = right ? definition.width / 2 : -definition.width / 2
    const centerY = -depth / 2
    context.moveTo(centerX, centerY)
    context.lineTo(centerX + (right ? -radius : radius), centerY)
    context.arc(centerX, centerY, radius, right ? Math.PI : 0, Math.PI / 2, right)
    context.closePath()
  } else if (definition.shape === 'triangle') {
    context.moveTo(-definition.width / 2, -depth / 2)
    context.lineTo(definition.width / 2, depth / 2)
    context.lineTo(-definition.width / 2, depth / 2)
    context.closePath()
  } else {
    context.rect(-definition.width / 2, -depth / 2, definition.width, depth)
  }
}

const drawPieceDetails = (
  context: CanvasRenderingContext2D,
  definition: PieceDefinition,
  scale: number,
  depth: number,
) => {
  if (!definition.visual || scale < 1.2) return
  const width = definition.width
  const line = Math.max(0.7 / scale, 0.025)
  context.save()
  context.lineWidth = line
  context.strokeStyle = '#fff3d43d'
  context.fillStyle = '#17201940'
  context.setLineDash([])

  if (definition.visual === 'floor') {
    const isCage = definition.tags.includes('cage')
    const isWood =
      definition.material.includes('Wood') ||
      definition.material.includes('wood') ||
      definition.material === 'Ashwood'
    const interval = isCage ? 0.25 : isWood ? 0.5 : 1
    context.beginPath()
    for (let x = -width / 2 + interval; x < width / 2; x += interval) {
      context.moveTo(x, -depth / 2)
      context.lineTo(x, depth / 2)
    }
    for (let y = -depth / 2 + interval; y < depth / 2; y += interval) {
      context.moveTo(-width / 2, y)
      context.lineTo(width / 2, y)
    }
    context.strokeStyle = isCage ? '#d5e2df70' : isWood ? '#4b2d1f55' : '#ebe5d43d'
    context.stroke()
    if (definition.material === 'Black marble') {
      context.beginPath()
      context.moveTo(-width * 0.42, depth * 0.2)
      context.bezierCurveTo(
        -width * 0.1,
        -depth * 0.3,
        width * 0.08,
        depth * 0.32,
        width * 0.43,
        -depth * 0.12,
      )
      context.strokeStyle = '#b8adbf59'
      context.stroke()
    }
  } else if (definition.visual === 'wall') {
    context.strokeStyle = definition.tags.includes('thick') ? '#f2ead04d' : '#55321f66'
    context.beginPath()
    context.moveTo(-width / 2, -depth * 0.23)
    context.lineTo(width / 2, -depth * 0.23)
    context.moveTo(-width / 2, depth * 0.23)
    context.lineTo(width / 2, depth * 0.23)
    const divisions = Math.max(1, Math.round(width))
    for (let index = 1; index < divisions; index += 1) {
      const x = -width / 2 + (width * index) / divisions
      context.moveTo(x, -depth / 2)
      context.lineTo(x, depth / 2)
    }
    context.stroke()
    if (definition.tags.includes('cage')) {
      context.beginPath()
      const spacing = Math.max(0.2, width / Math.max(2, Math.round(width * 4)))
      for (let x = -width / 2 + spacing; x < width / 2; x += spacing) {
        context.moveTo(x, -depth / 2)
        context.lineTo(x, depth / 2)
      }
      context.strokeStyle = '#d8e4df80'
      context.stroke()
    }
  } else if (definition.visual === 'stairs') {
    if (definition.name.includes('Spiral')) {
      const right = definition.tags.includes('right')
      const centerX = right ? width / 2 : -width / 2
      const centerY = -depth / 2
      const radius = Math.min(width, depth)
      context.beginPath()
      for (const portion of [0.34, 0.58, 0.82]) {
        context.moveTo(centerX + (right ? -radius * portion : radius * portion), centerY)
        context.arc(centerX, centerY, radius * portion, right ? Math.PI : 0, Math.PI / 2, right)
      }
      context.moveTo(centerX, centerY)
      context.lineTo(centerX + (right ? -radius : radius), centerY)
      context.strokeStyle = '#f3e5c875'
      context.stroke()
      const arrowRadius = radius * 0.58
      const startAngle = Math.PI / 2
      const endAngle = right ? Math.PI : 0
      context.beginPath()
      context.arc(centerX, centerY, arrowRadius, startAngle, endAngle, !right)
      context.strokeStyle = '#fff0c7b5'
      context.stroke()

      const direction = right ? 1 : -1
      const endX = centerX + Math.cos(endAngle) * arrowRadius
      const endY = centerY + Math.sin(endAngle) * arrowRadius
      const tangentX = direction * -Math.sin(endAngle)
      const tangentY = direction * Math.cos(endAngle)
      const normalX = -tangentY
      const normalY = tangentX
      const headLength = radius * 0.16
      const headWidth = radius * 0.09
      const baseX = endX - tangentX * headLength
      const baseY = endY - tangentY * headLength
      context.beginPath()
      context.moveTo(baseX + normalX * headWidth, baseY + normalY * headWidth)
      context.lineTo(endX, endY)
      context.lineTo(baseX - normalX * headWidth, baseY - normalY * headWidth)
      context.stroke()
    } else {
      context.beginPath()
      for (let index = 1; index < 7; index += 1) {
        const y = -depth / 2 + (depth * index) / 7
        context.moveTo(-width / 2, y)
        context.lineTo(width / 2, y)
      }
      context.strokeStyle = '#3f332866'
      context.stroke()
      context.beginPath()
      context.moveTo(0, depth * 0.3)
      context.lineTo(0, -depth * 0.3)
      context.lineTo(-width * 0.1, -depth * 0.16)
      context.moveTo(0, -depth * 0.3)
      context.lineTo(width * 0.1, -depth * 0.16)
      context.strokeStyle = '#fff0c78c'
      context.stroke()
    }
  } else if (definition.visual === 'ladder') {
    context.beginPath()
    context.moveTo(-width * 0.28, -depth / 2)
    context.lineTo(-width * 0.28, depth / 2)
    context.moveTo(width * 0.28, -depth / 2)
    context.lineTo(width * 0.28, depth / 2)
    for (let y = -depth / 2 + 0.3; y < depth / 2; y += 0.35) {
      context.moveTo(-width * 0.28, y)
      context.lineTo(width * 0.28, y)
    }
    context.strokeStyle = '#4c302166'
    context.stroke()
    context.beginPath()
    context.moveTo(0, depth * 0.3)
    context.lineTo(0, -depth * 0.3)
    context.lineTo(-width * 0.12, -depth * 0.16)
    context.moveTo(0, -depth * 0.3)
    context.lineTo(width * 0.12, -depth * 0.16)
    context.strokeStyle = '#fff0c79c'
    context.stroke()
  } else if (definition.visual === 'bed') {
    context.strokeRect(-width * 0.42, -depth * 0.42, width * 0.84, depth * 0.84)
    context.fillStyle = '#eee0bf66'
    context.fillRect(-width * 0.36, -depth * 0.3, width * 0.2, depth * 0.6)
    context.beginPath()
    context.moveTo(width * 0.02, -depth * 0.4)
    context.lineTo(width * 0.02, depth * 0.4)
    context.stroke()
  } else if (definition.visual === 'seating') {
    context.strokeRect(-width * 0.34, -depth * 0.24, width * 0.68, depth * 0.56)
    context.fillRect(-width * 0.42, -depth * 0.43, width * 0.84, depth * 0.16)
    if (definition.name.includes('Throne')) {
      context.beginPath()
      context.moveTo(-width * 0.42, -depth * 0.3)
      context.lineTo(0, -depth * 0.48)
      context.lineTo(width * 0.42, -depth * 0.3)
      context.stroke()
    }
  } else if (definition.visual === 'table') {
    if (definition.shape === 'circle') {
      context.beginPath()
      context.arc(0, 0, width * 0.36, 0, Math.PI * 2)
      context.stroke()
    } else {
      context.strokeRect(-width * 0.4, -depth * 0.36, width * 0.8, depth * 0.72)
    }
    const legRadius = Math.min(width, depth) * 0.07
    for (const point of [
      [-0.3, -0.26],
      [0.3, -0.26],
      [-0.3, 0.26],
      [0.3, 0.26],
    ]) {
      context.beginPath()
      context.arc(point[0] * width, point[1] * depth, legRadius, 0, Math.PI * 2)
      context.fill()
    }
  } else if (definition.visual === 'storage') {
    context.strokeRect(-width * 0.42, -depth * 0.36, width * 0.84, depth * 0.72)
    context.beginPath()
    context.moveTo(-width * 0.4, 0)
    context.lineTo(width * 0.4, 0)
    context.moveTo(0, -depth * 0.12)
    context.lineTo(0, depth * 0.12)
    context.stroke()
  } else if (definition.visual === 'rug') {
    context.setLineDash([0.16, 0.1])
    context.strokeStyle = '#f4e6c276'
    context.strokeRect(-width * 0.43, -depth * 0.39, width * 0.86, depth * 0.78)
  } else if (definition.visual === 'banner') {
    context.fillStyle = '#f4e9cc55'
    context.fillRect(-width * 0.08, -depth / 2, width * 0.16, depth)
  } else if (definition.visual === 'fire') {
    context.beginPath()
    context.arc(0, 0, Math.min(width, depth) * 0.34, 0, Math.PI * 2)
    context.strokeStyle = '#39261f99'
    context.stroke()
    context.beginPath()
    context.moveTo(0, -depth * 0.32)
    context.bezierCurveTo(width * 0.24, -depth * 0.04, width * 0.2, depth * 0.25, 0, depth * 0.31)
    context.bezierCurveTo(-width * 0.22, depth * 0.2, -width * 0.18, -depth * 0.04, 0, -depth * 0.32)
    context.fillStyle = '#ffd077a8'
    context.fill()
  } else if (definition.visual === 'light') {
    const radius = Math.min(width, depth) * 0.28
    context.beginPath()
    context.arc(0, 0, radius, 0, Math.PI * 2)
    for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 4) {
      context.moveTo(Math.cos(angle) * radius * 1.4, Math.sin(angle) * radius * 1.4)
      context.lineTo(Math.cos(angle) * radius * 2, Math.sin(angle) * radius * 2)
    }
    context.strokeStyle = '#fff0aaad'
    context.stroke()
  } else if (definition.visual === 'station' || definition.visual === 'processing') {
    const radius = Math.min(width, depth) * 0.25
    context.beginPath()
    context.arc(0, 0, radius, 0, Math.PI * 2)
    for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 4) {
      context.moveTo(Math.cos(angle) * radius, Math.sin(angle) * radius)
      context.lineTo(Math.cos(angle) * radius * 1.5, Math.sin(angle) * radius * 1.5)
    }
    context.strokeStyle = '#e6eee099'
    context.stroke()
  } else if (definition.visual === 'upgrade') {
    context.beginPath()
    context.moveTo(-width * 0.3, depth * 0.3)
    context.lineTo(width * 0.3, -depth * 0.3)
    context.moveTo(width * 0.1, -depth * 0.34)
    context.lineTo(width * 0.38, -depth * 0.08)
    context.strokeStyle = '#f0dfb58c'
    context.stroke()
  } else if (definition.visual === 'cooking') {
    context.beginPath()
    context.arc(0, 0, Math.min(width, depth) * 0.28, 0, Math.PI * 2)
    context.arc(0, 0, Math.min(width, depth) * 0.12, 0, Math.PI * 2)
    context.strokeStyle = '#ffd0a08c'
    context.stroke()
  } else if (definition.visual === 'decor') {
    context.beginPath()
    context.moveTo(-width * 0.3, 0)
    context.lineTo(width * 0.3, 0)
    context.moveTo(0, -depth * 0.3)
    context.lineTo(0, depth * 0.3)
    context.strokeStyle = '#f0d98f8c'
    context.stroke()
  } else if (definition.visual === 'vehicle') {
    const isBoat = definition.group === 'Boats'
    context.beginPath()
    if (isBoat) {
      context.moveTo(0, -depth * 0.46)
      context.quadraticCurveTo(width * 0.46, -depth * 0.22, width * 0.34, depth * 0.33)
      context.quadraticCurveTo(0, depth * 0.48, -width * 0.34, depth * 0.33)
      context.quadraticCurveTo(-width * 0.46, -depth * 0.22, 0, -depth * 0.46)
    } else {
      context.rect(-width * 0.34, -depth * 0.38, width * 0.68, depth * 0.76)
      const wheelRadius = Math.min(width, depth) * 0.11
      for (const x of [-width * 0.39, width * 0.39]) {
        for (const y of [-depth * 0.25, depth * 0.25]) {
          context.moveTo(x + wheelRadius, y)
          context.arc(x, y, wheelRadius, 0, Math.PI * 2)
        }
      }
    }
    context.strokeStyle = '#f0dfb58c'
    context.stroke()
  }
  if (definition.symbol && definition.category === 'Crafting') {
    context.fillStyle = '#fff6d9d9'
    context.strokeStyle = '#111915cc'
    context.lineWidth = Math.max(1.8 / scale, 0.05)
    context.font = `800 ${Math.max(Math.min(width, depth) * 0.27, 0.22)}px Inter, system-ui`
    context.textAlign = 'center'
    context.textBaseline = 'middle'
    context.strokeText(definition.symbol, 0, 0)
    context.fillText(definition.symbol, 0, 0)
  }
  context.restore()
}

const drawPreparedSprite = (
  context: CanvasRenderingContext2D,
  sprite: PreparedPieceSprite,
  width: number,
  depth: number,
  fit: SpriteFit,
) => {
  const layout = spriteLayout(sprite.sourceWidth, sprite.sourceHeight, width, depth, fit)
  const destinationWidth = layout.width
  const destinationHeight = layout.height

  context.save()
  if (layout.rotateQuarterTurn) {
    context.rotate(Math.PI / 2)
    context.drawImage(
      sprite.image,
      sprite.sourceX,
      sprite.sourceY,
      sprite.sourceWidth,
      sprite.sourceHeight,
      -destinationHeight / 2,
      -destinationWidth / 2,
      destinationHeight,
      destinationWidth,
    )
  } else {
    context.drawImage(
      sprite.image,
      sprite.sourceX,
      sprite.sourceY,
      sprite.sourceWidth,
      sprite.sourceHeight,
      -destinationWidth / 2,
      -destinationHeight / 2,
      destinationWidth,
      destinationHeight,
    )
  }
  context.restore()
}

const drawDoorSwing = (context: CanvasRenderingContext2D, definition: PieceDefinition, scale: number) => {
  const width = definition.width
  const doubleLeaf = definition.tags.includes('gate') && !definition.tags.includes('single-leaf')
  context.save()
  context.beginPath()
  context.strokeStyle = '#f0b573c7'
  context.lineWidth = 1.2 / scale
  context.setLineDash([3 / scale, 2 / scale])
  if (doubleLeaf) {
    const leaf = width / 2
    context.moveTo(-width / 2, 0)
    context.arc(-width / 2, 0, leaf, 0, -Math.PI / 2, true)
    context.moveTo(width / 2, 0)
    context.arc(width / 2, 0, leaf, Math.PI, Math.PI * 1.5)
    context.moveTo(-width / 2, 0)
    context.lineTo(-width / 2, -leaf)
    context.moveTo(width / 2, 0)
    context.lineTo(width / 2, -leaf)
  } else if (definition.tags.includes('hinge-right')) {
    context.moveTo(width / 2, 0)
    context.arc(width / 2, 0, width, Math.PI, Math.PI * 1.5)
    context.moveTo(width / 2, 0)
    context.lineTo(width / 2, -width)
  } else {
    context.moveTo(-width / 2, 0)
    context.arc(-width / 2, 0, width, 0, -Math.PI / 2, true)
    context.moveTo(-width / 2, 0)
    context.lineTo(-width / 2, -width)
  }
  context.stroke()
  context.restore()
}

const drawPiece = (
  context: CanvasRenderingContext2D,
  placed: PlacedPiece,
  scale: number,
  selected = false,
  preview = false,
  ghost = false,
  sprite?: PreparedPieceSprite,
  drawDetails = true,
) => {
  const definition = pieceById(placed.pieceId)
  const isWindow = definition.tags.includes('window')
  context.save()
  context.translate(placed.x, placed.y)
  context.rotate((placed.rotation * Math.PI) / 180)
  context.fillStyle = ghost
    ? 'transparent'
    : isWindow
      ? '#bfeff0c7'
      : sprite
        ? preview
          ? `${definition.color}42`
          : 'transparent'
        : preview
          ? `${definition.color}99`
          : `${definition.color}d9`
  context.strokeStyle = ghost ? '#e8dfbd55' : selected ? '#f2cd72' : preview ? '#e8d59d' : '#191f1b'
  context.lineWidth = (selected ? 2.5 : ghost ? 1.6 : 1.2) / scale
  context.setLineDash(preview || ghost ? [5 / scale, 4 / scale] : [])

  const depth = definition.shape === 'line' ? Math.max(definition.depth, 3 / scale) : definition.depth
  tracePiecePath(context, definition, depth)
  if (!ghost) {
    context.fill()
    if (sprite) {
      context.save()
      tracePiecePath(context, definition, depth)
      context.clip()
      context.globalAlpha = preview ? 0.7 : 1
      drawPreparedSprite(
        context,
        sprite,
        definition.width,
        depth,
        isBuildingPiece(definition) ? 'stretch' : 'contain',
      )
      context.restore()
      tracePiecePath(context, definition, depth)
    }
  }
  if (!isWindow || selected || preview || ghost) context.stroke()
  if (!ghost && definition.tags.includes('door')) drawDoorSwing(context, definition, scale)
  if (
    drawDetails &&
    !ghost &&
    !isWindow &&
    (!sprite || definition.visual === 'stairs' || definition.visual === 'ladder')
  ) {
    drawPieceDetails(context, definition, scale, depth)
  }
  context.restore()
}

const drawPieceSelectionOutline = (context: CanvasRenderingContext2D, placed: PlacedPiece, scale: number) => {
  const definition = pieceById(placed.pieceId)
  const depth = definition.shape === 'line' ? Math.max(definition.depth, 3 / scale) : definition.depth
  context.save()
  context.translate(placed.x, placed.y)
  context.rotate((placed.rotation * Math.PI) / 180)
  tracePiecePath(context, definition, depth)
  context.strokeStyle = '#f2cd72'
  context.lineWidth = 2.5 / scale
  context.setLineDash([])
  context.stroke()
  context.restore()
}

const drawRadiusOverlay = (
  context: CanvasRenderingContext2D,
  overlay: RadiusOverlay,
  scale: number,
  highlighted: boolean,
) => {
  context.save()
  if (highlighted && overlay.connections?.length) {
    context.beginPath()
    overlay.connections.forEach((connection) => {
      context.moveTo(connection.x, connection.y)
      context.lineTo(overlay.center.x, overlay.center.y)
    })
    context.strokeStyle = '#9edcff'
    context.lineWidth = 2.2 / scale
    context.lineCap = 'round'
    context.shadowColor = '#65bdeccc'
    context.shadowBlur = 6 / scale
    context.stroke()
    context.shadowBlur = 0
    overlay.connections.forEach((connection) => {
      context.beginPath()
      context.arc(connection.x, connection.y, 2.5 / scale, 0, Math.PI * 2)
      context.fillStyle = '#bce8ff'
      context.fill()
    })
  }

  context.beginPath()
  context.arc(overlay.center.x, overlay.center.y, overlay.radius, 0, Math.PI * 2)
  context.strokeStyle = highlighted ? '#ffe58a' : '#d8bd62c7'
  context.lineWidth = (highlighted ? 2.8 : 1.5) / scale
  context.lineCap = 'round'
  context.setLineDash([(highlighted ? 1.2 : 0.8) / scale, (highlighted ? 4 : 5) / scale])
  if (highlighted) {
    context.shadowColor = '#f4d272cc'
    context.shadowBlur = 8 / scale
  }
  context.stroke()
  context.setLineDash([])

  if (overlay.label && scale > 1) {
    const x = overlay.center.x
    const y = overlay.center.y
    context.font = `650 ${10 / scale}px Inter, system-ui`
    context.textAlign = 'center'
    context.textBaseline = 'middle'
    const labelWidth = context.measureText(overlay.label).width
    const horizontalPadding = 5 / scale
    const verticalPadding = 3 / scale
    context.beginPath()
    context.roundRect(
      x - labelWidth / 2 - horizontalPadding,
      y - 5 / scale - verticalPadding,
      labelWidth + horizontalPadding * 2,
      10 / scale + verticalPadding * 2,
      3 / scale,
    )
    context.fillStyle = '#101713dc'
    context.fill()
    context.fillStyle = highlighted ? '#ffe58a' : '#d8bd62'
    context.fillText(overlay.label, x, y)
  }
  context.restore()
}

const drawRenderChunkContents = (
  context: CanvasRenderingContext2D,
  chunk: RenderChunk,
  activeLevel: number,
  levelViewModes: Record<number, LevelViewMode>,
  sprites: Map<string, PreparedPieceSprite>,
) => {
  const orderedPieces = [...chunk.pieces].sort(compareLevels)
  orderedPieces.forEach((piece) => {
    const mode = renderedLevelViewMode(piece.level ?? 0, activeLevel, levelViewModes)
    if (mode === 'hidden') return
    drawPiece(
      context,
      piece,
      RENDER_CHUNK_PIXELS_PER_METER,
      false,
      false,
      mode === 'outline',
      mode === 'actual' ? sprites.get(piece.pieceId) : undefined,
      true,
    )
  })
}

const drawPlanAnnotation = (
  context: CanvasRenderingContext2D,
  annotation: PlanAnnotation,
  scale: number,
  selected = false,
  preview = false,
  ghost = false,
) => {
  context.save()
  if (annotation.kind === 'farm') {
    if (annotation.mode === 'cultivator' && annotation.action === 'erase') {
      context.globalCompositeOperation = 'destination-out'
      context.globalAlpha = 1
      context.beginPath()
      if (annotation.points.length === 1) {
        context.arc(annotation.points[0].x, annotation.points[0].y, annotation.radius, 0, Math.PI * 2)
        context.fill()
      } else {
        context.moveTo(annotation.points[0].x, annotation.points[0].y)
        annotation.points.slice(1).forEach((point) => context.lineTo(point.x, point.y))
        context.lineCap = 'round'
        context.lineJoin = 'round'
        context.lineWidth = annotation.radius * 2
        context.stroke()
      }
      context.restore()
      return
    }
    const alpha = ghost ? 0.42 : preview ? 0.76 : 0.9
    context.globalAlpha = alpha
    if (annotation.mode === 'area') {
      const left = annotation.x - annotation.width / 2
      const top = annotation.y - annotation.height / 2
      const cornerRadius = Math.min(annotation.cornerRadius, annotation.width / 2, annotation.height / 2)
      context.beginPath()
      context.roundRect(left, top, annotation.width, annotation.height, cornerRadius)
      context.fillStyle = CULTIVATED_SOIL_COLOR
      context.fill()

      if (!ghost && Math.min(annotation.width, annotation.height) * scale > 18) {
        context.save()
        context.clip()
        const spacing = Math.max(0.8, 7 / scale, Math.max(annotation.width, annotation.height) / 80)
        context.beginPath()
        for (let offset = -annotation.height; offset <= annotation.height; offset += spacing) {
          context.moveTo(left - annotation.width * 0.1, annotation.y + offset)
          context.lineTo(left + annotation.width * 1.1, annotation.y + offset + annotation.height * 0.12)
        }
        context.strokeStyle = '#a18d6438'
        context.lineWidth = Math.max(0.09, 0.7 / scale)
        context.stroke()
        context.restore()
      }

      context.beginPath()
      context.roundRect(left, top, annotation.width, annotation.height, cornerRadius)
      context.strokeStyle = selected && !preview && !ghost ? '#f2cd72' : CULTIVATED_SOIL_EDGE
      context.lineWidth = (selected ? 2.6 : 1.4) / scale
      context.setLineDash(ghost ? [5 / scale, 4 / scale] : [])
      context.stroke()
    } else {
      if (annotation.points.length === 1) {
        context.beginPath()
        context.arc(annotation.points[0].x, annotation.points[0].y, annotation.radius, 0, Math.PI * 2)
        context.fillStyle = CULTIVATED_SOIL_COLOR
        context.fill()
        context.strokeStyle = selected && !preview && !ghost ? '#f2cd72' : CULTIVATED_SOIL_EDGE
        context.lineWidth = (selected ? 3.2 : 1.4) / scale
        context.stroke()
      } else {
        context.beginPath()
        context.moveTo(annotation.points[0].x, annotation.points[0].y)
        annotation.points.slice(1).forEach((point) => context.lineTo(point.x, point.y))
        context.lineCap = 'round'
        context.lineJoin = 'round'
        context.strokeStyle = selected && !preview && !ghost ? '#f2cd72' : CULTIVATED_SOIL_EDGE
        context.lineWidth = annotation.radius * 2 + (selected ? 3.2 : 1.4) / scale
        context.stroke()
        context.strokeStyle = CULTIVATED_SOIL_COLOR
        context.lineWidth = annotation.radius * 2
        context.stroke()
      }
    }
    context.globalAlpha = 1
    context.setLineDash([])
  } else if (annotation.kind === 'text') {
    context.font = `700 ${annotation.size}px Inter, system-ui`
    context.textAlign = 'left'
    context.textBaseline = 'alphabetic'
    context.lineWidth = Math.max(2 / scale, annotation.size * 0.06)
    context.strokeStyle = ghost ? '#e8dfbd88' : '#101713d9'
    context.fillStyle = annotation.color
    context.strokeText(annotation.text, annotation.x, annotation.y)
    if (!ghost) context.fillText(annotation.text, annotation.x, annotation.y)
  } else if (annotation.points.length > 1) {
    context.beginPath()
    context.moveTo(annotation.points[0].x, annotation.points[0].y)
    annotation.points.slice(1).forEach((point) => context.lineTo(point.x, point.y))
    context.strokeStyle = ghost ? '#e8dfbd88' : annotation.color
    context.globalAlpha = ghost ? 0.55 : preview ? 0.72 : 0.92
    context.lineWidth = ghost ? Math.max(annotation.width, 1.6 / scale) : annotation.width
    context.lineCap = 'round'
    context.lineJoin = 'round'
    context.setLineDash(ghost ? [5 / scale, 4 / scale] : [])
    context.stroke()
    context.globalAlpha = 1
  }
  if (selected && !preview && !ghost && annotation.kind !== 'farm') {
    const bounds = annotationBounds(annotation)
    const padding = 4 / scale
    context.beginPath()
    context.rect(
      bounds.left - padding,
      bounds.top - padding,
      bounds.right - bounds.left + padding * 2,
      bounds.bottom - bounds.top + padding * 2,
    )
    context.strokeStyle = '#f2cd72'
    context.lineWidth = 1.7 / scale
    context.setLineDash([5 / scale, 3 / scale])
    context.stroke()
    context.setLineDash([])
  }
  context.restore()
}

const PlannerCanvas = forwardRef<CanvasHandle, PlannerCanvasProps>((props, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const farmLayerCanvasRef = useRef<HTMLCanvasElement | undefined>(undefined)
  const frameRef = useRef<number>(0)
  const drawLatestRef = useRef<() => void>(() => {})
  const buildRenderChunkLatestRef = useRef<(key: string) => void>(() => {})
  const buildRenderGroupLatestRef = useRef<(key: string) => void>(() => {})
  const flushRenderChunksLatestRef = useRef<() => void>(() => {})
  const mapTileWorkerRef = useRef<Worker | undefined>(undefined)
  const mapTileCacheRef = useRef(new Map<string, MapTileBitmap>())
  const pendingMapTilesRef = useRef(new Set<string>())
  const mapTileGenerationRef = useRef(0)
  const mapTileViewRevisionRef = useRef(0)
  const mapTileViewKeyRef = useRef('')
  const mapTileUseCounterRef = useRef(0)
  const mapOverviewKeysRef = useRef(new Set<string>())
  const pieceImagesRef = useRef(new Map<string, PreparedPieceSprite>())
  const spritesPreparingRef = useRef(false)
  const renderChunkCacheRef = useRef(new Map<string, RenderChunkBitmap>())
  const renderGroupCacheRef = useRef(new Map<string, RenderGroupBitmap>())
  const pendingRenderChunksRef = useRef(new Set<string>())
  const pendingRenderGroupsRef = useRef(new Set<string>())
  const renderChunkBuildFrameRef = useRef(0)
  const renderGroupBuildTimerRef = useRef(0)
  const renderChunkUseCounterRef = useRef(0)
  const renderSceneRevisionRef = useRef(1)
  const lastRenderActivityRef = useRef(0)
  const previousRenderChunkIndexRef = useRef<RenderChunkIndex | undefined>(undefined)
  const hotRenderGroupsRef = useRef(new Map<string, number>())
  const renderWorkAreaRef = useRef<WorldBox>({ left: 0, right: 0, top: 0, bottom: 0 })
  const activeInteractionRef = useRef(false)
  const [camera, setCamera] = useState<Camera>({ x: 0, y: 0, scale: 0.03 })
  const cameraRef = useRef(camera)
  const cameraCommitFrameRef = useRef(0)
  const cameraCommitRequestedAtRef = useRef(0)
  const [cursor, setCursor] = useState<Point>({ x: 0, y: 0 })
  const [interaction, setInteraction] = useState<Interaction>()
  const interactionRef = useRef<Interaction>(undefined)
  const [spaceHeld, setSpaceHeld] = useState(false)
  const [shiftHeld, setShiftHeld] = useState(false)
  const [lineStart, setLineStart] = useState<Point>()
  const cursorRef = useRef(cursor)
  const cursorReportFrameRef = useRef(0)
  const pendingCursorReportRef = useRef<{ point: Point; scale: number } | undefined>(undefined)
  const selectedSet = useMemo(() => new Set(props.selectedIds), [props.selectedIds])
  const pieceIndex = useMemo(
    () => perfMeasure('index.pieces', () => createPieceSpatialIndex(props.pieces)),
    [props.pieces],
  )
  const renderChunkIndex = useMemo(
    () => perfMeasure('index.chunks', () => createRenderChunkIndex(props.pieces)),
    [props.pieces],
  )
  const renderGroupIndex = useMemo(
    () => perfMeasure('index.groups', () => createRenderChunkGroupIndex(renderChunkIndex)),
    [renderChunkIndex],
  )
  const selectedPieces = useMemo(
    () => props.pieces.filter((piece) => selectedSet.has(piece.id)),
    [props.pieces, selectedSet],
  )

  cursorRef.current = cursor
  interactionRef.current = interaction
  activeInteractionRef.current = interaction !== undefined

  const markRenderPiecesHot = useCallback((pieces: PlacedPiece[], now = performance.now()) => {
    if (!pieces.length) return
    pieces.forEach((piece) => {
      renderChunkCoordinatesForPiece(piece).forEach(({ x, y }) => {
        hotRenderGroupsRef.current.set(renderGroupKeyForChunk(x, y), now)
      })
    })
    lastRenderActivityRef.current = now
  }, [])

  const updateCamera = useCallback((updater: Camera | ((current: Camera) => Camera)) => {
    const next = typeof updater === 'function' ? updater(cameraRef.current) : updater
    const now = performance.now()
    lastRenderActivityRef.current = now
    cameraRef.current = next
    if (!cameraCommitFrameRef.current) {
      cameraCommitRequestedAtRef.current = now
      cameraCommitFrameRef.current = requestAnimationFrame(() => {
        cameraCommitFrameRef.current = 0
        perfRecord('camera.commit_wait', performance.now() - cameraCommitRequestedAtRef.current)
        setCamera(cameraRef.current)
      })
    }
  }, [])

  const reportCursor = useCallback(
    (point: Point, scale: number) => {
      pendingCursorReportRef.current = { point, scale }
      if (cursorReportFrameRef.current) return
      cursorReportFrameRef.current = requestAnimationFrame(() => {
        cursorReportFrameRef.current = 0
        const pending = pendingCursorReportRef.current
        if (pending) props.onCursorChange(pending.point, pending.scale)
      })
    },
    [props.onCursorChange],
  )

  const mapTileKey = useCallback(
    (factor: number, column: number, row: number) =>
      `${mapTileGenerationRef.current}:${factor}:${column}:${row}`,
    [],
  )

  const requestMapTiles = useCallback(
    (factor: number, coordinates: MapTileCoordinate[], overview = false) => {
      const worker = mapTileWorkerRef.current
      if (!worker) return
      const viewKey = `${factor}:${coordinates.map(({ column, row }) => `${column},${row}`).join(';')}`
      if (!overview && viewKey !== mapTileViewKeyRef.current) {
        mapTileViewKeyRef.current = viewKey
        mapTileViewRevisionRef.current += 1
      }
      const viewRevision = overview ? 0 : mapTileViewRevisionRef.current
      const requests = coordinates.flatMap((coordinate) => {
        const key = mapTileKey(factor, coordinate.column, coordinate.row)
        if (mapTileCacheRef.current.has(key) || pendingMapTilesRef.current.has(key)) return []
        pendingMapTilesRef.current.add(key)
        if (overview) mapOverviewKeysRef.current.add(key)
        perfCount('map.tile_request')
        return [{ ...coordinate, factor, key, overview, viewRevision }]
      })
      if (!requests.length) return
      worker.postMessage({
        type: 'request',
        generation: mapTileGenerationRef.current,
        viewRevision,
        requests,
      })
    },
    [mapTileKey],
  )

  useEffect(
    () => () => {
      cancelAnimationFrame(cursorReportFrameRef.current)
      cancelAnimationFrame(cameraCommitFrameRef.current)
      cancelAnimationFrame(renderChunkBuildFrameRef.current)
      window.clearTimeout(renderGroupBuildTimerRef.current)
      cursorReportFrameRef.current = 0
      cameraCommitFrameRef.current = 0
      renderChunkBuildFrameRef.current = 0
      renderGroupBuildTimerRef.current = 0
      renderChunkCacheRef.current.forEach(({ bitmap }) => bitmap?.close())
      renderGroupCacheRef.current.forEach(({ bitmap }) => bitmap?.close())
      mapTileCacheRef.current.forEach(({ bitmap }) => bitmap.close())
      mapTileWorkerRef.current?.terminate()
      mapTileWorkerRef.current = undefined
      renderChunkCacheRef.current.clear()
      renderGroupCacheRef.current.clear()
      mapTileCacheRef.current.clear()
      pendingMapTilesRef.current.clear()
    },
    [],
  )

  useEffect(() => {
    renderSceneRevisionRef.current += 1
    lastRenderActivityRef.current = performance.now()
  }, [props.activeLevel, props.levelViewModes])

  useEffect(() => {
    const previous = previousRenderChunkIndexRef.current
    previousRenderChunkIndexRef.current = renderChunkIndex
    if (!previous) return

    const now = performance.now()
    const chunkKeys = new Set([...previous.chunks.keys(), ...renderChunkIndex.chunks.keys()])
    let changed = false
    chunkKeys.forEach((key) => {
      const before = previous.chunks.get(key)
      const after = renderChunkIndex.chunks.get(key)
      if (before?.signature === after?.signature) return
      const chunk = after ?? before
      if (!chunk) return
      hotRenderGroupsRef.current.set(renderGroupKeyForChunk(chunk.x, chunk.y), now)
      changed = true
    })
    if (changed) lastRenderActivityRef.current = now
  }, [renderChunkIndex])

  useEffect(() => {
    markRenderPiecesHot(selectedPieces)
    drawLatestRef.current()
  }, [markRenderPiecesHot, selectedPieces])

  const maximumSnapRadius = useMemo(
    () =>
      Math.max(
        0,
        ...Object.values(props.pieceSnapPoints).flatMap((points) =>
          points.map((point) => Math.hypot(point.x, point.y)),
        ),
      ),
    [props.pieceSnapPoints],
  )

  const snap = useMemo(() => {
    if (!placementSnapActive(props.tool, props.snapMode, shiftHeld)) return { ...cursor, snapped: false }
    const tolerance = 16 / camera.scale
    const queryRadius =
      tolerance + Math.max(8, maximumSnapRadius) + snapPointRadius(props.activePiece, props.pieceSnapPoints)
    const snapPieces = pieceIndex
      .query({
        left: cursor.x - queryRadius,
        right: cursor.x + queryRadius,
        top: cursor.y - queryRadius,
        bottom: cursor.y + queryRadius,
      })
      .filter((piece) => {
        const level = piece.level ?? 0
        if (level === props.activeLevel) return true
        const definition = pieceById(piece.pieceId)
        return (
          isLevelSnapTarget(level, props.activeLevel, props.levelViewModes) && isBuildingPiece(definition)
        )
      })
      .sort(
        (a, b) => Math.abs((a.level ?? 0) - props.activeLevel) - Math.abs((b.level ?? 0) - props.activeLevel),
      )
    return findSnap(cursor, props.activePiece, props.rotation, snapPieces, tolerance, props.pieceSnapPoints)
  }, [
    camera.scale,
    cursor,
    maximumSnapRadius,
    pieceIndex,
    props.activeLevel,
    props.activePiece,
    props.levelViewModes,
    props.pieceSnapPoints,
    props.rotation,
    props.snapMode,
    props.tool,
    shiftHeld,
  ])

  const linePreview = useMemo(() => {
    if (props.tool !== 'line') return []
    const start = lineStart ?? { x: snap.x, y: snap.y }
    const end = lineStart ? { x: snap.x, y: snap.y } : start
    return linePlacementPositions(start, end, props.activePiece, props.rotation, props.pieceSnapPoints).map(
      (point, index) => ({
        id: `line-preview-${index}`,
        pieceId: props.activePiece.id,
        x: point.x,
        y: point.y,
        rotation: props.rotation,
        level: props.activeLevel,
      }),
    )
  }, [
    lineStart,
    props.activeLevel,
    props.activePiece,
    props.rotation,
    props.tool,
    props.pieceSnapPoints,
    snap.x,
    snap.y,
  ])

  const boxPreview = useMemo(() => {
    if (props.tool !== 'box') return []
    const start = interaction?.kind === 'box-fill' ? interaction.start : { x: snap.x, y: snap.y }
    const end = interaction?.kind === 'box-fill' ? interaction.current : start
    return boxPlacementPositions(start, end, props.activePiece, props.rotation, props.pieceSnapPoints).map(
      (piece) => ({
        ...piece,
        level: props.activeLevel,
      }),
    )
  }, [
    interaction,
    props.activeLevel,
    props.activePiece,
    props.rotation,
    props.tool,
    props.pieceSnapPoints,
    snap.x,
    snap.y,
  ])

  const radiusOverlays = useMemo(() => {
    if (!props.showComfortRanges && !props.showSuppressionRanges && !props.showCraftingRanges) return []

    const overlays: RadiusOverlay[] = []
    const activePieces = props.pieces.filter((piece) => (piece.level ?? 0) === props.activeLevel)
    for (const piece of activePieces) {
      const metadata = props.pieceRanges[piece.pieceId]
      if (props.showComfortRanges && (props.pieceComfort[piece.pieceId] ?? 0) > 0) {
        overlays.push({
          key: `comfort-${piece.id}`,
          ownerId: piece.id,
          kind: 'comfort',
          center: rangeCenter(piece, metadata?.origin ?? { x: 0, y: 0 }),
          radius: COMFORT_RADIUS_METERS,
        })
      }

      if (props.showSuppressionRanges && metadata) {
        playerBaseRanges(piece, metadata).forEach((range, index) =>
          overlays.push({
            key: `suppression-${piece.id}-${index}`,
            ownerId: piece.id,
            kind: 'suppression',
            center: range.center,
            radius: range.radius,
          }),
        )
      }

      if (props.showCraftingRanges && metadata) {
        metadata.craftingStations.forEach((station, stationIndex) => {
          const effective = effectiveCraftingRange(piece, station, activePieces, props.pieceRanges)
          const upgradeCount = effective.extensions.length
          overlays.push({
            key: `crafting-${piece.id}-${stationIndex}`,
            ownerId: piece.id,
            kind: 'crafting',
            center: effective.center,
            radius: effective.radius,
            label: `${station.displayName} ${effective.radius} m${upgradeCount ? ` · ${upgradeCount} upgrade${upgradeCount === 1 ? '' : 's'}` : ''}`,
            connections: effective.extensions.map(({ piece: extensionPiece, extension }) =>
              rangeCenter(extensionPiece, extension.offset),
            ),
          })
        })
      }
    }
    return overlays
  }, [
    props.activeLevel,
    props.pieceComfort,
    props.pieceRanges,
    props.pieces,
    props.showComfortRanges,
    props.showCraftingRanges,
    props.showSuppressionRanges,
  ])

  useEffect(
    () => setLineStart(undefined),
    [props.activeLevel, props.activePiece.id, props.rotation, props.tool],
  )

  useImperativeHandle(
    ref,
    () => ({
      showWorld: () => {
        perfEvent('camera_world')
        const rect = canvasRef.current?.getBoundingClientRect()
        const scale = rect ? (Math.min(rect.width, rect.height) / props.worldWidth) * 0.92 : 0.03
        updateCamera({ x: 0, y: 0, scale })
      },
      focusAt: (point = cursorRef.current) => {
        perfEvent('camera_focus', { x: point.x, y: point.y })
        updateCamera({ x: point.x, y: point.y, scale: 20 })
      },
      exportPng: () => {
        flushRenderChunksLatestRef.current()
        return canvasRef.current?.toDataURL('image/png')
      },
      rotateActiveMove: (amount) => {
        const active = interactionRef.current
        if (active?.kind !== 'move' || !active.piecePositions.length) return false
        const rebased = rotateMovingPieceGroup(active.piecePositions, cursorRef.current, amount)
        const rotated = rebased.pieces
        const next: Interaction = {
          ...active,
          start: rebased.start,
          pieceOrigins: rotated.map((piece) => ({ ...piece })),
          annotationOrigins: active.annotationPositions.map(cloneAnnotation),
          piecePositions: rotated,
          annotationPositions: active.annotationPositions,
          snapTarget: undefined,
        }
        interactionRef.current = next
        setInteraction(next)
        markRenderPiecesHot(rotated)
        props.onMoveMany(rotated.map(({ id, x, y, rotation }) => ({ id, x, y, rotation })))
        return true
      },
    }),
    [markRenderPiecesHot, props.onMoveMany, props.worldWidth, updateCamera],
  )

  useEffect(() => {
    mapTileGenerationRef.current += 1
    mapTileCacheRef.current.forEach(({ bitmap }) => bitmap.close())
    mapTileCacheRef.current.clear()
    pendingMapTilesRef.current.clear()
    mapOverviewKeysRef.current.clear()
    mapTileViewKeyRef.current = ''
    mapTileViewRevisionRef.current = 0
    mapTileWorkerRef.current?.terminate()
    mapTileWorkerRef.current = undefined
    if (!props.mapImage || !props.mapImageWidth || !props.mapImageHeight) return

    const generation = mapTileGenerationRef.current
    const worker = new Worker(new URL('../workers/mapTileWorker.ts', import.meta.url), { type: 'module' })
    mapTileWorkerRef.current = worker
    worker.onmessage = (event: MessageEvent<MapTileWorkerResponse>) => {
      const message = event.data
      if (message.generation !== mapTileGenerationRef.current) {
        if (message.type === 'tile') message.bitmap.close()
        return
      }
      pendingMapTilesRef.current.delete(message.key)
      if (message.type !== 'tile') {
        if (message.type === 'tile-error') perfCount('map.tile_error')
        return
      }

      mapTileUseCounterRef.current += 1
      const previous = mapTileCacheRef.current.get(message.key)
      previous?.bitmap.close()
      mapTileCacheRef.current.set(message.key, {
        ...message.request,
        bitmap: message.bitmap,
        lastUsed: mapTileUseCounterRef.current,
      })
      perfRecord(message.cached ? 'map.tile_ready_cached' : 'map.tile_ready_generated', message.duration)
      perfCount(message.cached ? 'map.tile_persistent_hit' : 'map.tile_persistent_miss')
      perfGauge('map.tile_entries', mapTileCacheRef.current.size)

      if (mapTileCacheRef.current.size > MAX_CACHED_MAP_TILES) {
        const oldest = [...mapTileCacheRef.current.entries()]
          .filter(([tileKey]) => !mapOverviewKeysRef.current.has(tileKey))
          .sort(([, first], [, second]) => first.lastUsed - second.lastUsed)
          .slice(0, mapTileCacheRef.current.size - MAX_CACHED_MAP_TILES)
        oldest.forEach(([tileKey, tile]) => {
          tile.bitmap.close()
          mapTileCacheRef.current.delete(tileKey)
        })
      }
      drawLatestRef.current()
    }
    worker.postMessage({
      type: 'initialize',
      generation,
      source: props.mapImage,
      cacheKey: props.mapCacheKey,
    })

    const overviewFactor = mapOverviewDownsampleFactor(props.mapImageWidth, props.mapImageHeight)
    const overviewTiles = mapTileCoordinates(props.mapImageWidth, props.mapImageHeight, overviewFactor, {
      left: 0,
      right: props.mapImageWidth,
      top: 0,
      bottom: props.mapImageHeight,
    })
    requestMapTiles(overviewFactor, overviewTiles, true)
    perfEvent('map.worker_ready', {
      width: props.mapImageWidth,
      height: props.mapImageHeight,
      overview_factor: overviewFactor,
      overview_tiles: overviewTiles.length,
    })
    updateCamera((current) => ({ ...current }))
    return () => {
      if (mapTileWorkerRef.current === worker) mapTileWorkerRef.current = undefined
      worker.terminate()
    }
  }, [
    props.mapCacheKey,
    props.mapImage,
    props.mapImageHeight,
    props.mapImageWidth,
    requestMapTiles,
    updateCamera,
  ])

  useEffect(() => {
    let disposed = false
    const started = performance.now()
    pieceImagesRef.current = new Map()
    renderSceneRevisionRef.current += 1
    const sources = Object.entries(props.pieceSprites)
    spritesPreparingRef.current = sources.length > 0
    perfEvent('sprite_prepare_start', { sprites: sources.length })
    let remaining = sources.length
    const finishImage = () => {
      remaining -= 1
      if (remaining > 0 || disposed) return
      spritesPreparingRef.current = false
      renderSceneRevisionRef.current += 1
      perfEvent('sprite_prepare_complete', {
        sprites: pieceImagesRef.current.size,
        duration_ms: Math.round((performance.now() - started) * 100) / 100,
      })
      updateCamera((current) => ({ ...current }))
    }
    for (const [pieceId, source] of sources) {
      const image = new Image()
      image.onload = () => {
        if (disposed) return
        if (props.preCroppedPieceSprites[pieceId]) {
          perfCount('startup.sprite_pre_cropped')
          pieceImagesRef.current.set(pieceId, {
            image,
            sourceX: 0,
            sourceY: 0,
            sourceWidth: image.naturalWidth,
            sourceHeight: image.naturalHeight,
          })
        } else {
          pieceImagesRef.current.set(
            pieceId,
            perfMeasure('startup.prepare_sprite', () => preparePieceSprite(image)),
          )
        }
        finishImage()
      }
      image.onerror = () => {
        perfCount('startup.sprite_error')
        finishImage()
      }
      image.src = source
    }
    if (!sources.length) {
      spritesPreparingRef.current = false
      perfEvent('sprite_prepare_complete', { sprites: 0, duration_ms: 0 })
      updateCamera((current) => ({ ...current }))
    }
    return () => {
      disposed = true
      spritesPreparingRef.current = false
    }
  }, [props.pieceSprites, props.preCroppedPieceSprites, updateCamera])

  useEffect(() => {
    const keyDown = (event: KeyboardEvent) => {
      if (
        event.defaultPrevented ||
        document.querySelector('[aria-modal="true"]') ||
        (event.target instanceof Element &&
          event.target.closest('input, textarea, select, [contenteditable="true"]'))
      )
        return
      if (event.code === 'Space') setSpaceHeld(true)
      if (event.key === 'Shift') setShiftHeld(true)
    }
    const keyUp = (event: KeyboardEvent) => {
      if (event.code === 'Space') setSpaceHeld(false)
      if (event.key === 'Shift') setShiftHeld(false)
    }
    const resetModifiers = () => {
      setSpaceHeld(false)
      setShiftHeld(false)
    }
    window.addEventListener('keydown', keyDown)
    window.addEventListener('keyup', keyUp)
    window.addEventListener('blur', resetModifiers)
    return () => {
      window.removeEventListener('keydown', keyDown)
      window.removeEventListener('keyup', keyUp)
      window.removeEventListener('blur', resetModifiers)
    }
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const buildRenderChunk = (key: string) =>
      perfMeasure('cache.build_chunk', () => {
        const chunk = renderChunkIndex.chunks.get(key)
        pendingRenderChunksRef.current.delete(key)
        if (!chunk) {
          perfCount('cache.chunk_removed')
          renderChunkCacheRef.current.delete(key)
          return
        }
        perfCount('cache.chunk_built')
        perfGauge('cache.last_chunk_piece_refs', chunk.pieces.length)

        const interiorPixels = RENDER_CHUNK_METERS * RENDER_CHUNK_PIXELS_PER_METER
        const bitmapPixels = interiorPixels + RENDER_CHUNK_GUTTER * 2
        const existing = renderChunkCacheRef.current.get(key)
        existing?.bitmap?.close()
        const chunkCanvas = createRenderCanvas(bitmapPixels, bitmapPixels, existing?.canvas)
        const chunkContext = renderCanvasContext(chunkCanvas)
        chunkContext.setTransform(1, 0, 0, 1, 0, 0)
        chunkContext.clearRect(0, 0, bitmapPixels, bitmapPixels)
        chunkContext.imageSmoothingEnabled = true
        chunkContext.imageSmoothingQuality = 'high'
        chunkContext.translate(RENDER_CHUNK_GUTTER, RENDER_CHUNK_GUTTER)
        chunkContext.scale(RENDER_CHUNK_PIXELS_PER_METER, RENDER_CHUNK_PIXELS_PER_METER)
        chunkContext.translate(-chunk.x * RENDER_CHUNK_METERS, -chunk.y * RENDER_CHUNK_METERS)
        drawRenderChunkContents(
          chunkContext,
          chunk,
          props.activeLevel,
          props.levelViewModes,
          pieceImagesRef.current,
        )

        renderChunkUseCounterRef.current += 1
        const transferredBitmap = transferRenderCanvas(chunkCanvas)
        const record: RenderChunkBitmap = {
          canvas: chunkCanvas,
          source: transferredBitmap ?? chunkCanvas,
          bitmap: transferredBitmap,
          signature: chunk.signature,
          sceneRevision: renderSceneRevisionRef.current,
          lastUsed: renderChunkUseCounterRef.current,
        }
        renderChunkCacheRef.current.set(key, record)

        if (!transferredBitmap && typeof createImageBitmap === 'function') {
          const signature = chunk.signature
          const sceneRevision = renderSceneRevisionRef.current
          void createImageBitmap(chunkCanvas)
            .then((bitmap) => {
              const current = renderChunkCacheRef.current.get(key)
              if (
                !current ||
                current !== record ||
                current.signature !== signature ||
                current.sceneRevision !== sceneRevision
              ) {
                bitmap.close()
                return
              }
              current.source = bitmap
              current.bitmap = bitmap
              // The immutable ImageBitmap now owns the texture. Release the
              // staging canvas allocation until this chunk actually changes.
              current.canvas.width = 1
              current.canvas.height = 1
              drawLatestRef.current()
            })
            .catch(() => {
              // Canvas remains a valid source when ImageBitmap promotion is not
              // available (older browsers or a transient GPU allocation failure).
            })
        }

        if (renderChunkCacheRef.current.size > MAX_CACHED_RENDER_CHUNKS) {
          const oldest = [...renderChunkCacheRef.current.entries()]
            .sort(([, first], [, second]) => first.lastUsed - second.lastUsed)
            .slice(0, renderChunkCacheRef.current.size - MAX_CACHED_RENDER_CHUNKS)
          oldest.forEach(([oldKey, oldBitmap]) => {
            oldBitmap.bitmap?.close()
            renderChunkCacheRef.current.delete(oldKey)
          })
        }
      })

    buildRenderChunkLatestRef.current = buildRenderChunk

    const buildRenderGroup = (key: string) =>
      perfMeasure('cache.build_group', () => {
        const group = renderGroupIndex.groups.get(key)
        pendingRenderGroupsRef.current.delete(key)
        if (!group) {
          perfCount('cache.group_removed')
          const removed = renderGroupCacheRef.current.get(key)
          removed?.bitmap?.close()
          renderGroupCacheRef.current.delete(key)
          return
        }

        const childBitmaps = group.chunks.map((chunk) => ({
          chunk,
          bitmap: renderChunkCacheRef.current.get(chunk.key),
        }))
        if (
          childBitmaps.some(
            ({ chunk, bitmap }) =>
              !bitmap ||
              bitmap.signature !== chunk.signature ||
              bitmap.sceneRevision !== renderSceneRevisionRef.current,
          )
        ) {
          perfCount('cache.group_blocked_missing_child')
          return
        }
        perfCount('cache.group_built')
        perfGauge('cache.last_group_chunks', group.chunks.length)

        const firstX = Math.min(...group.chunks.map(({ x }) => x))
        const lastX = Math.max(...group.chunks.map(({ x }) => x))
        const firstY = Math.min(...group.chunks.map(({ y }) => y))
        const lastY = Math.max(...group.chunks.map(({ y }) => y))
        const widthChunks = lastX - firstX + 1
        const heightChunks = lastY - firstY + 1
        const interiorPixels = RENDER_CHUNK_METERS * RENDER_CHUNK_PIXELS_PER_METER
        const groupPixelWidth = widthChunks * interiorPixels
        const groupPixelHeight = heightChunks * interiorPixels
        const existing = renderGroupCacheRef.current.get(key)
        existing?.bitmap?.close()
        const groupCanvas = createRenderCanvas(groupPixelWidth, groupPixelHeight, existing?.canvas)
        const groupContext = renderCanvasContext(groupCanvas)
        groupContext.setTransform(1, 0, 0, 1, 0, 0)
        groupContext.clearRect(0, 0, groupPixelWidth, groupPixelHeight)
        groupContext.imageSmoothingEnabled = true
        groupContext.imageSmoothingQuality = 'high'
        childBitmaps.forEach(({ chunk, bitmap }) => {
          groupContext.drawImage(
            bitmap!.source,
            RENDER_CHUNK_GUTTER,
            RENDER_CHUNK_GUTTER,
            interiorPixels,
            interiorPixels,
            (chunk.x - firstX) * interiorPixels,
            (chunk.y - firstY) * interiorPixels,
            interiorPixels,
            interiorPixels,
          )
        })

        renderChunkUseCounterRef.current += 1
        const transferredBitmap = transferRenderCanvas(groupCanvas)
        const record: RenderGroupBitmap = {
          canvas: groupCanvas,
          source: transferredBitmap ?? groupCanvas,
          bitmap: transferredBitmap,
          signature: group.signature,
          sceneRevision: renderSceneRevisionRef.current,
          lastUsed: renderChunkUseCounterRef.current,
          left: firstX * RENDER_CHUNK_METERS,
          top: firstY * RENDER_CHUNK_METERS,
          width: widthChunks * RENDER_CHUNK_METERS,
          height: heightChunks * RENDER_CHUNK_METERS,
        }
        renderGroupCacheRef.current.set(key, record)

        if (!transferredBitmap && typeof createImageBitmap === 'function') {
          const signature = group.signature
          const sceneRevision = renderSceneRevisionRef.current
          void createImageBitmap(groupCanvas)
            .then((bitmap) => {
              const current = renderGroupCacheRef.current.get(key)
              if (
                !current ||
                current !== record ||
                current.signature !== signature ||
                current.sceneRevision !== sceneRevision
              ) {
                bitmap.close()
                return
              }
              current.source = bitmap
              current.bitmap = bitmap
              current.canvas.width = 1
              current.canvas.height = 1
              drawLatestRef.current()
            })
            .catch(() => {})
        }

        if (renderGroupCacheRef.current.size > MAX_CACHED_RENDER_GROUPS) {
          const oldest = [...renderGroupCacheRef.current.entries()]
            .sort(([, first], [, second]) => first.lastUsed - second.lastUsed)
            .slice(0, renderGroupCacheRef.current.size - MAX_CACHED_RENDER_GROUPS)
          oldest.forEach(([oldKey, oldBitmap]) => {
            oldBitmap.bitmap?.close()
            renderGroupCacheRef.current.delete(oldKey)
          })
        }
      })

    buildRenderGroupLatestRef.current = buildRenderGroup

    const renderGroupDelayRemaining = (key: string, now: number) => {
      const globalDelay = renderGroupIdleDelayRemaining(
        lastRenderActivityRef.current,
        now,
        RENDER_GROUP_GLOBAL_IDLE_MS,
      )
      if (activeInteractionRef.current) return Math.max(globalDelay, RENDER_GROUP_RECHECK_MS)

      const group = renderGroupIndex.groups.get(key)
      if (!group) return globalDelay
      const lastEditedAt = hotRenderGroupsRef.current.get(key)
      if (
        !shouldDeferRenderGroup(
          group,
          lastEditedAt,
          now,
          RENDER_GROUP_HOT_COOLDOWN_MS,
          renderWorkAreaRef.current,
          RENDER_GROUP_WORK_MARGIN_METERS,
        )
      ) {
        if (lastEditedAt !== undefined) hotRenderGroupsRef.current.delete(key)
        return globalDelay
      }

      const editDelay =
        lastEditedAt === undefined
          ? 0
          : renderGroupIdleDelayRemaining(lastEditedAt, now, RENDER_GROUP_HOT_COOLDOWN_MS)
      // Once the edit cooldown expires, a nearby group is checked only at a
      // low frequency. Camera activity will naturally wake the scheduler too.
      return Math.max(globalDelay, editDelay || RENDER_GROUP_RECHECK_MS)
    }

    const scheduleRenderGroupAfterSettle = () => {
      if (renderGroupBuildTimerRef.current) window.clearTimeout(renderGroupBuildTimerRef.current)
      if (!pendingRenderGroupsRef.current.size) return
      const now = performance.now()
      const remaining = Math.min(
        ...[...pendingRenderGroupsRef.current].map((key) => renderGroupDelayRemaining(key, now)),
      )
      renderGroupBuildTimerRef.current = window.setTimeout(
        () => {
          renderGroupBuildTimerRef.current = 0
          scheduleRenderChunkWork()
        },
        Math.max(1, remaining),
      )
    }

    const scheduleRenderChunkWork = () => {
      if (renderChunkBuildFrameRef.current) return
      renderChunkBuildFrameRef.current = requestAnimationFrame(() => {
        renderChunkBuildFrameRef.current = 0
        const now = performance.now()
        if (
          spritesPreparingRef.current ||
          activeInteractionRef.current ||
          now - lastRenderActivityRef.current < RENDER_CHUNK_INTERACTION_IDLE_MS
        ) {
          if (pendingRenderChunksRef.current.size || pendingRenderGroupsRef.current.size)
            scheduleRenderChunkWork()
          return
        }
        const started = performance.now()
        let rendered = false
        let renderedGroup = false
        do {
          const chunkKey = pendingRenderChunksRef.current.values().next().value as string | undefined
          if (chunkKey) {
            pendingRenderChunksRef.current.delete(chunkKey)
            buildRenderChunkLatestRef.current(chunkKey)
            rendered = true
          } else {
            const now = performance.now()
            const groupKey = [...pendingRenderGroupsRef.current].find(
              (key) => renderGroupDelayRemaining(key, now) <= 0,
            )
            if (!groupKey) break
            pendingRenderGroupsRef.current.delete(groupKey)
            buildRenderGroupLatestRef.current(groupKey)
            rendered = true
            renderedGroup = true
          }
        } while (
          !renderedGroup &&
          (pendingRenderChunksRef.current.size || pendingRenderGroupsRef.current.size) &&
          performance.now() - started < 7
        )
        perfRecord('cache.scheduler_slice', performance.now() - started)
        perfGauge('cache.pending_chunks', pendingRenderChunksRef.current.size)
        perfGauge('cache.pending_groups', pendingRenderGroupsRef.current.size)
        perfGauge('cache.chunk_entries', renderChunkCacheRef.current.size)
        perfGauge('cache.group_entries', renderGroupCacheRef.current.size)
        if (rendered) drawLatestRef.current()
        if (pendingRenderChunksRef.current.size) scheduleRenderChunkWork()
        else if (pendingRenderGroupsRef.current.size) scheduleRenderGroupAfterSettle()
      })
    }

    const requestRenderChunk = (key: string) => {
      if (pendingRenderChunksRef.current.has(key)) return
      pendingRenderChunksRef.current.add(key)
      scheduleRenderChunkWork()
    }

    const requestRenderGroup = (key: string) => {
      if (pendingRenderGroupsRef.current.has(key)) return
      pendingRenderGroupsRef.current.add(key)
      scheduleRenderGroupAfterSettle()
    }

    flushRenderChunksLatestRef.current = () => {
      const rect = canvas.getBoundingClientRect()
      const current = cameraRef.current
      const visible = renderChunkIndex.query({
        left: current.x - rect.width / 2 / current.scale,
        right: current.x + rect.width / 2 / current.scale,
        top: current.y - rect.height / 2 / current.scale,
        bottom: current.y + rect.height / 2 / current.scale,
      })
      visible.forEach((chunk) => {
        const bitmap = renderChunkCacheRef.current.get(chunk.key)
        if (
          !bitmap ||
          bitmap.signature !== chunk.signature ||
          bitmap.sceneRevision !== renderSceneRevisionRef.current
        ) {
          buildRenderChunkLatestRef.current(chunk.key)
        }
      })
      renderGroupIndex
        .query({
          left: current.x - rect.width / 2 / current.scale,
          right: current.x + rect.width / 2 / current.scale,
          top: current.y - rect.height / 2 / current.scale,
          bottom: current.y + rect.height / 2 / current.scale,
        })
        .forEach((group) => {
          const bitmap = renderGroupCacheRef.current.get(group.key)
          if (
            !bitmap ||
            bitmap.signature !== group.signature ||
            bitmap.sceneRevision !== renderSceneRevisionRef.current
          ) {
            buildRenderGroupLatestRef.current(group.key)
          }
        })
      drawLatestRef.current()
    }

    const draw = () => {
      const drawStarted = performance.now()
      perfFrameStart(drawStarted)
      const rect = canvas.getBoundingClientRect()
      const ratio = window.devicePixelRatio || 1
      const width = Math.max(1, Math.round(rect.width * ratio))
      const height = Math.max(1, Math.round(rect.height * ratio))
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width
        canvas.height = height
      }
      const context = canvas.getContext('2d')!
      context.setTransform(ratio, 0, 0, ratio, 0, 0)
      context.fillStyle = '#15201c'
      context.fillRect(0, 0, rect.width, rect.height)
      context.save()
      context.translate(rect.width / 2, rect.height / 2)
      context.scale(camera.scale, camera.scale)
      context.translate(-camera.x, -camera.y)

      const viewLeft = camera.x - rect.width / 2 / camera.scale
      const viewRight = camera.x + rect.width / 2 / camera.scale
      const viewTop = camera.y - rect.height / 2 / camera.scale
      const viewBottom = camera.y + rect.height / 2 / camera.scale
      const workArea = { left: viewLeft, right: viewRight, top: viewTop, bottom: viewBottom }
      renderWorkAreaRef.current = workArea
      const nativeDetail = shouldRenderPiecesAtNativeDetail(
        camera.scale,
        ratio,
        RENDER_CHUNK_PIXELS_PER_METER,
      )
      if (nativeDetail && pendingRenderChunksRef.current.size) {
        pendingRenderChunksRef.current.clear()
        cancelAnimationFrame(renderChunkBuildFrameRef.current)
        renderChunkBuildFrameRef.current = 0
      }
      const indexedVisiblePieces =
        nativeDetail || (props.showAnchors && camera.scale > 2.5)
          ? pieceIndex.query({ left: viewLeft, right: viewRight, top: viewTop, bottom: viewBottom })
          : []
      const visiblePieces = props.showAnchors && camera.scale > 2.5 ? indexedVisiblePieces : []
      const visibleChunks = nativeDetail
        ? []
        : renderChunkIndex.query({ left: viewLeft, right: viewRight, top: viewTop, bottom: viewBottom })
      const cacheableChunkKeys = new Set(
        [...visibleChunks]
          .sort((first, second) => {
            const firstX = (first.x + 0.5) * RENDER_CHUNK_METERS - camera.x
            const firstY = (first.y + 0.5) * RENDER_CHUNK_METERS - camera.y
            const secondX = (second.x + 0.5) * RENDER_CHUNK_METERS - camera.x
            const secondY = (second.y + 0.5) * RENDER_CHUNK_METERS - camera.y
            return firstX * firstX + firstY * firstY - (secondX * secondX + secondY * secondY)
          })
          .slice(0, MAX_CACHED_RENDER_CHUNKS)
          .map(({ key }) => key),
      )
      const visibleChunkKeys = new Set(visibleChunks.map(({ key }) => key))
      const visibleGroups = nativeDetail
        ? []
        : renderGroupIndex.query({ left: viewLeft, right: viewRight, top: viewTop, bottom: viewBottom })
      const cacheableGroupKeys = new Set(
        [...visibleGroups]
          .sort((first, second) => {
            const groupMeters = RENDER_CHUNK_METERS * RENDER_GROUP_CHUNKS
            const firstX = (first.x + 0.5) * groupMeters - camera.x
            const firstY = (first.y + 0.5) * groupMeters - camera.y
            const secondX = (second.x + 0.5) * groupMeters - camera.x
            const secondY = (second.y + 0.5) * groupMeters - camera.y
            return firstX * firstX + firstY * firstY - (secondX * secondX + secondY * secondY)
          })
          .slice(0, MAX_CACHED_RENDER_GROUPS)
          .map(({ key }) => key),
      )

      perfRecord('draw.prepare', performance.now() - drawStarted)
      perfGauge('draw.scale', camera.scale)
      perfGauge('draw.visible_pieces', indexedVisiblePieces.length)
      perfGauge('draw.visible_chunks', visibleChunks.length)
      perfGauge('draw.visible_groups', visibleGroups.length)
      perfGauge('draw.native_detail', nativeDetail ? 1 : 0)
      const mapStarted = performance.now()

      if (props.showMap && props.mapImage && props.mapImageWidth > 0 && props.mapImageHeight > 0) {
        const imageWidth = props.mapImageWidth
        const imageHeight = props.mapImageHeight
        const worldLeft = -props.worldWidth / 2
        const worldTop = -props.worldWidth / 2
        const visibleLeft = Math.max(worldLeft, viewLeft)
        const visibleRight = Math.min(-worldLeft, viewRight)
        const visibleTop = Math.max(worldTop, viewTop)
        const visibleBottom = Math.min(-worldTop, viewBottom)
        context.fillStyle = '#1d2b25'
        context.fillRect(worldLeft, worldTop, props.worldWidth, props.worldWidth)
        context.globalAlpha = 0.94
        if (visibleRight > visibleLeft && visibleBottom > visibleTop) {
          const sourceX = ((visibleLeft - worldLeft) / props.worldWidth) * imageWidth
          const sourceY = ((visibleTop - worldTop) / props.worldWidth) * imageHeight
          const sourceWidth = ((visibleRight - visibleLeft) / props.worldWidth) * imageWidth
          const sourceHeight = ((visibleBottom - visibleTop) / props.worldWidth) * imageHeight
          const sourceBox = {
            left: sourceX,
            right: sourceX + sourceWidth,
            top: sourceY,
            bottom: sourceY + sourceHeight,
          }
          const overviewFactor = mapOverviewDownsampleFactor(imageWidth, imageHeight)
          const desiredFactor = mapTileDownsampleFactor(
            (camera.scale * props.worldWidth) / Math.max(1, imageWidth),
          )
          const overviewTiles = mapTileCoordinates(imageWidth, imageHeight, overviewFactor, sourceBox)
          const detailTiles =
            desiredFactor === overviewFactor
              ? overviewTiles
              : mapTileCoordinates(imageWidth, imageHeight, desiredFactor, sourceBox)
          requestMapTiles(overviewFactor, overviewTiles, true)
          if (desiredFactor !== overviewFactor) requestMapTiles(desiredFactor, detailTiles, false)

          const drawTiles = (factor: number, tiles: MapTileCoordinate[]) => {
            let drawn = 0
            tiles.forEach((coordinate) => {
              const key = mapTileKey(factor, coordinate.column, coordinate.row)
              const tile = mapTileCacheRef.current.get(key)
              if (!tile) {
                perfCount('map.tile_cache_miss')
                return
              }
              perfCount('map.tile_cache_hit')
              drawn += 1
              mapTileUseCounterRef.current += 1
              tile.lastUsed = mapTileUseCounterRef.current
              context.drawImage(
                tile.bitmap,
                worldLeft + (tile.sourceX / imageWidth) * props.worldWidth,
                worldTop + (tile.sourceY / imageHeight) * props.worldWidth,
                (tile.sourceWidth / imageWidth) * props.worldWidth,
                (tile.sourceHeight / imageHeight) * props.worldWidth,
              )
            })
            return drawn
          }

          perfGauge('map.desired_factor', desiredFactor)
          const allDetailReady = detailTiles.every((coordinate) =>
            mapTileCacheRef.current.has(mapTileKey(desiredFactor, coordinate.column, coordinate.row)),
          )
          const overviewTileCount =
            desiredFactor !== overviewFactor && !allDetailReady ? drawTiles(overviewFactor, overviewTiles) : 0
          const detailTileCount = drawTiles(desiredFactor, detailTiles)
          perfGauge('map.visible_tiles', overviewTileCount + detailTileCount)
        }
        context.globalAlpha = 1
      } else {
        context.fillStyle = '#1d2b25'
        context.fillRect(-props.worldWidth / 2, -props.worldWidth / 2, props.worldWidth, props.worldWidth)
      }
      perfRecord('draw.map', performance.now() - mapStarted)

      const worldBorderStarted = performance.now()
      context.beginPath()
      context.arc(0, 0, props.worldWidth / 2, 0, Math.PI * 2)
      context.strokeStyle = '#d7c18455'
      context.lineWidth = 2 / camera.scale
      context.stroke()
      perfRecord('draw.world_border_flush', performance.now() - worldBorderStarted)

      const gridStarted = performance.now()
      if (props.showGrid && camera.scale > 0.26) {
        const interval = camera.scale > 14 ? 0.5 : camera.scale > 2.2 ? 2 : camera.scale > 0.65 ? 10 : 50
        context.beginPath()
        for (let x = Math.floor(viewLeft / interval) * interval; x < viewRight; x += interval) {
          context.moveTo(x, viewTop)
          context.lineTo(x, viewBottom)
        }
        for (let y = Math.floor(viewTop / interval) * interval; y < viewBottom; y += interval) {
          context.moveTo(viewLeft, y)
          context.lineTo(viewRight, y)
        }
        context.strokeStyle = camera.scale > 4 ? '#eee2bc2a' : '#cdd8c51e'
        context.lineWidth = 1 / camera.scale
        context.stroke()
      }
      perfRecord('draw.grid', performance.now() - gridStarted)

      const farmStarted = performance.now()
      const farmPreview: PlanAnnotation | undefined =
        interaction?.kind === 'farm-cultivator'
          ? {
              id: 'farm-preview',
              kind: 'farm',
              mode: 'cultivator',
              points: interaction.points,
              radius: CULTIVATOR_RADIUS_METERS,
              action: interaction.action,
              level: props.activeLevel,
            }
          : interaction?.kind === 'farm-area'
            ? {
                id: 'farm-preview',
                kind: 'farm',
                mode: 'area',
                x: (interaction.start.x + interaction.current.x) / 2,
                y: (interaction.start.y + interaction.current.y) / 2,
                width: Math.abs(interaction.current.x - interaction.start.x),
                height: Math.abs(interaction.current.y - interaction.start.y),
                cornerRadius: CULTIVATOR_RADIUS_METERS,
                level: props.activeLevel,
              }
            : undefined
      const farmAnnotations = [
        ...props.annotations.filter((annotation) => annotation.kind === 'farm'),
        ...(farmPreview ? [farmPreview] : []),
      ]
      const farmLevels = [...new Set(farmAnnotations.map((annotation) => annotation.level ?? 0))].sort(
        (first, second) => first - second,
      )
      if (farmLevels.length && camera.scale > 0.18) {
        const farmCanvas = farmLayerCanvasRef.current ?? document.createElement('canvas')
        farmLayerCanvasRef.current = farmCanvas
        if (farmCanvas.width !== width || farmCanvas.height !== height) {
          farmCanvas.width = width
          farmCanvas.height = height
        }
        const farmContext = farmCanvas.getContext('2d')!

        farmLevels.forEach((level) => {
          const viewMode = renderedLevelViewMode(level, props.activeLevel, props.levelViewModes)
          if (viewMode === 'hidden') return
          farmContext.setTransform(1, 0, 0, 1, 0, 0)
          farmContext.clearRect(0, 0, width, height)
          farmContext.setTransform(ratio, 0, 0, ratio, 0, 0)
          farmContext.save()
          farmContext.translate(rect.width / 2, rect.height / 2)
          farmContext.scale(camera.scale, camera.scale)
          farmContext.translate(-camera.x, -camera.y)
          farmAnnotations
            .filter((annotation) => (annotation.level ?? 0) === level)
            .filter((annotation) => {
              const bounds = annotationBounds(annotation)
              return (
                bounds.right >= viewLeft &&
                bounds.left <= viewRight &&
                bounds.bottom >= viewTop &&
                bounds.top <= viewBottom
              )
            })
            .forEach((annotation) =>
              drawPlanAnnotation(
                farmContext,
                annotation,
                camera.scale,
                selectedSet.has(annotation.id),
                annotation.id === 'farm-preview',
                viewMode === 'outline',
              ),
            )
          farmContext.restore()

          context.save()
          context.setTransform(1, 0, 0, 1, 0, 0)
          context.drawImage(farmCanvas, 0, 0)
          context.restore()
        })
      }
      perfRecord('draw.farm', performance.now() - farmStarted)

      const piecesStarted = performance.now()
      context.imageSmoothingEnabled = true
      context.imageSmoothingQuality = 'high'
      if (nativeDetail) {
        perfCount('draw.native_frames')
        // Above the cache's native pixel density, render the small visible set
        // directly from source sprites. This preserves maximum-zoom detail
        // without rebuilding any cache as the camera changes.
        const orderedVisiblePieces = [...indexedVisiblePieces].sort(compareLevels)
        orderedVisiblePieces.forEach((piece) => {
          const mode = renderedLevelViewMode(piece.level ?? 0, props.activeLevel, props.levelViewModes)
          if (mode === 'hidden') return
          drawPiece(
            context,
            piece,
            camera.scale,
            false,
            false,
            mode === 'outline',
            mode === 'actual' ? pieceImagesRef.current.get(piece.pieceId) : undefined,
            true,
          )
        })
      } else {
        const drawBaseChunk = (chunk: RenderChunk, groupCacheable: boolean) => {
          const bitmap = renderChunkCacheRef.current.get(chunk.key)
          const valid =
            bitmap &&
            bitmap.signature === chunk.signature &&
            bitmap.sceneRevision === renderSceneRevisionRef.current
          const chunkLeft = chunk.x * RENDER_CHUNK_METERS
          const chunkTop = chunk.y * RENDER_CHUNK_METERS

          if (valid) {
            perfCount('draw.chunk_cache_hit')
            renderChunkUseCounterRef.current += 1
            bitmap.lastUsed = renderChunkUseCounterRef.current
            const interiorPixels = RENDER_CHUNK_METERS * RENDER_CHUNK_PIXELS_PER_METER
            context.drawImage(
              bitmap.source,
              RENDER_CHUNK_GUTTER,
              RENDER_CHUNK_GUTTER,
              interiorPixels,
              interiorPixels,
              chunkLeft,
              chunkTop,
              RENDER_CHUNK_METERS,
              RENDER_CHUNK_METERS,
            )
            return true
          }
          perfCount('draw.chunk_cache_miss')

          // Preserve immediate correctness for an edited chunk. A cold chunk
          // is allowed to appear when its bitmap is ready; repeatedly drawing
          // every uncached piece made startup frames progressively slower.
          if (bitmap?.sceneRevision === renderSceneRevisionRef.current) {
            context.save()
            context.beginPath()
            context.rect(chunkLeft, chunkTop, RENDER_CHUNK_METERS, RENDER_CHUNK_METERS)
            context.clip()
            drawRenderChunkContents(
              context,
              chunk,
              props.activeLevel,
              props.levelViewModes,
              pieceImagesRef.current,
            )
            context.restore()
          }
          if (interaction?.kind !== 'move' && (groupCacheable || cacheableChunkKeys.has(chunk.key)))
            requestRenderChunk(chunk.key)
          return false
        }

        visibleGroups.forEach((group) => {
          const bitmap = renderGroupCacheRef.current.get(group.key)
          const valid =
            bitmap &&
            bitmap.signature === group.signature &&
            bitmap.sceneRevision === renderSceneRevisionRef.current
          const hot = shouldDeferRenderGroup(
            group,
            hotRenderGroupsRef.current.get(group.key),
            performance.now(),
            RENDER_GROUP_HOT_COOLDOWN_MS,
            workArea,
            RENDER_GROUP_WORK_MARGIN_METERS,
          )
          if (valid && !hot) {
            perfCount('draw.group_cache_hit')
            renderChunkUseCounterRef.current += 1
            bitmap.lastUsed = renderChunkUseCounterRef.current
            context.drawImage(bitmap.source, bitmap.left, bitmap.top, bitmap.width, bitmap.height)
            return
          }
          if (valid) perfCount('draw.group_deferred_hot')
          else perfCount('draw.group_cache_miss')

          const groupCacheable = cacheableGroupKeys.has(group.key)
          group.chunks
            .filter((chunk) => visibleChunkKeys.has(chunk.key))
            .forEach((chunk) => drawBaseChunk(chunk, groupCacheable))

          const childrenCurrent = group.chunks.every((chunk) => {
            const child = renderChunkCacheRef.current.get(chunk.key)
            const current =
              child &&
              child.signature === chunk.signature &&
              child.sceneRevision === renderSceneRevisionRef.current
            if (!current && interaction?.kind !== 'move' && groupCacheable) requestRenderChunk(chunk.key)
            return current
          })
          if (childrenCurrent && interaction?.kind !== 'move' && groupCacheable) requestRenderGroup(group.key)
        })
      }
      perfRecord(
        nativeDetail ? 'draw.pieces_native' : 'draw.pieces_cached',
        performance.now() - piecesStarted,
      )
      const overlaysStarted = performance.now()

      selectedPieces
        .filter((piece) => {
          const definition = pieceById(piece.pieceId)
          const radius = Math.hypot(definition.width, definition.depth) / 2
          return (
            renderedLevelViewMode(piece.level ?? 0, props.activeLevel, props.levelViewModes) !== 'hidden' &&
            piece.x + radius >= viewLeft &&
            piece.x - radius <= viewRight &&
            piece.y + radius >= viewTop &&
            piece.y - radius <= viewBottom
          )
        })
        .forEach((piece) => drawPieceSelectionOutline(context, piece, camera.scale))

      if (interaction?.kind === 'move' && interaction.snapTarget) {
        context.beginPath()
        context.arc(interaction.snapTarget.x, interaction.snapTarget.y, 7 / camera.scale, 0, Math.PI * 2)
        context.fillStyle = '#f3d2724d'
        context.fill()
        context.strokeStyle = '#f3d272'
        context.lineWidth = 2 / camera.scale
        context.stroke()
      }

      if (camera.scale > 0.18) {
        const orderedAnnotations = props.annotations
          .filter((annotation) => annotation.kind !== 'farm')
          .sort(compareLevels)
        orderedAnnotations
          .filter(
            (annotation) =>
              renderedLevelViewMode(annotation.level ?? 0, props.activeLevel, props.levelViewModes) !==
              'hidden',
          )
          .filter((annotation) => {
            const bounds = annotationBounds(annotation)
            return (
              bounds.right >= viewLeft &&
              bounds.left <= viewRight &&
              bounds.bottom >= viewTop &&
              bounds.top <= viewBottom
            )
          })
          .forEach((annotation) =>
            drawPlanAnnotation(
              context,
              annotation,
              camera.scale,
              selectedSet.has(annotation.id),
              false,
              renderedLevelViewMode(annotation.level ?? 0, props.activeLevel, props.levelViewModes) ===
                'outline',
            ),
          )
        if (interaction?.kind === 'pen')
          drawPlanAnnotation(
            context,
            {
              id: 'pen-preview',
              kind: 'pen',
              points: interaction.points,
              color: props.paintColor,
              width: props.penWidth,
              level: props.activeLevel,
            },
            camera.scale,
            false,
            true,
          )
        if (interaction?.kind === 'farm-area') {
          const width = Math.abs(interaction.current.x - interaction.start.x)
          const height = Math.abs(interaction.current.y - interaction.start.y)
          if (width > 0 && height > 0) {
            const label = `${width.toFixed(1)} × ${height.toFixed(1)} m`
            context.font = `600 ${11 / camera.scale}px Inter, system-ui`
            context.fillStyle = '#f4d57f'
            context.strokeStyle = '#101713dd'
            context.lineWidth = 3 / camera.scale
            context.strokeText(
              label,
              Math.max(interaction.start.x, interaction.current.x) + 8 / camera.scale,
              (interaction.start.y + interaction.current.y) / 2,
            )
            context.fillText(
              label,
              Math.max(interaction.start.x, interaction.current.x) + 8 / camera.scale,
              (interaction.start.y + interaction.current.y) / 2,
            )
          }
        }
      }

      // Radius guides are deliberately drawn after every saved plan item so
      // their dotted boundaries cannot disappear beneath structures or notes.
      const rangesStarted = performance.now()
      radiusOverlays
        .filter(
          (overlay) =>
            overlay.center.x + overlay.radius >= viewLeft &&
            overlay.center.x - overlay.radius <= viewRight &&
            overlay.center.y + overlay.radius >= viewTop &&
            overlay.center.y - overlay.radius <= viewBottom,
        )
        .sort(
          (first, second) => Number(selectedSet.has(first.ownerId)) - Number(selectedSet.has(second.ownerId)),
        )
        .forEach((overlay) =>
          drawRadiusOverlay(context, overlay, camera.scale, selectedSet.has(overlay.ownerId)),
        )
      perfRecord('draw.ranges', performance.now() - rangesStarted)

      if (props.showAnchors && camera.scale > 2.5) {
        visiblePieces
          .filter((piece) => {
            const level = piece.level ?? 0
            if (level === props.activeLevel) return true
            const definition = pieceById(piece.pieceId)
            return (
              isLevelSnapTarget(level, props.activeLevel, props.levelViewModes) && isBuildingPiece(definition)
            )
          })
          .forEach((piece) => {
            worldSnapPoints(piece, props.pieceSnapPoints).forEach((point) => {
              context.beginPath()
              context.arc(point.x, point.y, 3.5 / camera.scale, 0, Math.PI * 2)
              context.fillStyle = selectedSet.has(piece.id)
                ? '#f5d47e'
                : (piece.level ?? 0) === props.activeLevel
                  ? '#b9d7bd'
                  : '#83a9ca'
              context.fill()
              context.strokeStyle = '#17221d'
              context.lineWidth = 1 / camera.scale
              context.stroke()
            })
          })
      }

      if (props.tool === 'place' && camera.scale > 0.32) {
        drawPiece(
          context,
          {
            id: 'preview',
            pieceId: props.activePiece.id,
            x: snap.x,
            y: snap.y,
            rotation: props.rotation,
            level: props.activeLevel,
          },
          camera.scale,
          false,
          true,
          false,
          pieceImagesRef.current.get(props.activePiece.id),
        )
        if (snap.snapped && snap.target) {
          context.beginPath()
          context.arc(snap.target.x, snap.target.y, 7 / camera.scale, 0, Math.PI * 2)
          context.fillStyle = '#f3d2724d'
          context.fill()
          context.strokeStyle = '#f3d272'
          context.lineWidth = 2 / camera.scale
          context.stroke()
        }
      }
      if (props.tool === 'line' && camera.scale > 0.32) {
        linePreview.forEach((piece) =>
          drawPiece(
            context,
            piece,
            camera.scale,
            false,
            true,
            false,
            pieceImagesRef.current.get(piece.pieceId),
          ),
        )
        if (lineStart && linePreview.length) {
          const endpoint = linePreview.at(-1)!
          context.font = `600 ${11 / camera.scale}px Inter, system-ui`
          context.fillStyle = '#f4d57f'
          context.strokeStyle = '#101713dd'
          context.lineWidth = 3 / camera.scale
          const label = `${linePreview.length} pieces`
          context.strokeText(label, endpoint.x + 10 / camera.scale, endpoint.y - 10 / camera.scale)
          context.fillText(label, endpoint.x + 10 / camera.scale, endpoint.y - 10 / camera.scale)
        }
        if (snap.snapped && snap.target) {
          context.beginPath()
          context.arc(snap.target.x, snap.target.y, 7 / camera.scale, 0, Math.PI * 2)
          context.fillStyle = '#f3d2724d'
          context.fill()
          context.strokeStyle = '#f3d272'
          context.lineWidth = 2 / camera.scale
          context.stroke()
        }
      }
      if (props.tool === 'box' && camera.scale > 0.32) {
        boxPreview.forEach((piece) =>
          drawPiece(
            context,
            piece,
            camera.scale,
            false,
            true,
            false,
            pieceImagesRef.current.get(piece.pieceId),
          ),
        )
        const endpoint = boxPreview.at(-1)
        if (endpoint) {
          const capped = boxPreview.length === MAX_BOX_PIECES
          const label = `${boxPreview.length} piece${boxPreview.length === 1 ? '' : 's'}${capped ? ' · limit' : ''}`
          context.font = `600 ${11 / camera.scale}px Inter, system-ui`
          context.fillStyle = capped ? '#e8a080' : '#f4d57f'
          context.strokeStyle = '#101713dd'
          context.lineWidth = 3 / camera.scale
          context.strokeText(label, endpoint.x + 10 / camera.scale, endpoint.y - 10 / camera.scale)
          context.fillText(label, endpoint.x + 10 / camera.scale, endpoint.y - 10 / camera.scale)
        }
        if (!interaction && snap.snapped && snap.target) {
          context.beginPath()
          context.arc(snap.target.x, snap.target.y, 7 / camera.scale, 0, Math.PI * 2)
          context.fillStyle = '#f3d2724d'
          context.fill()
          context.strokeStyle = '#f3d272'
          context.lineWidth = 2 / camera.scale
          context.stroke()
        }
      }
      if (props.tool === 'text' && props.textDraft.trim() && camera.scale > 0.32) {
        context.font = `700 ${props.textSize}px Inter, system-ui`
        context.fillStyle = `${props.paintColor}99`
        context.strokeStyle = '#10171399'
        context.lineWidth = 2 / camera.scale
        context.strokeText(props.textDraft, cursor.x, cursor.y)
        context.fillText(props.textDraft, cursor.x, cursor.y)
      }
      if (props.tool === 'farm' && props.farmMode === 'cultivator' && !interaction && camera.scale > 0.32) {
        context.beginPath()
        context.arc(cursor.x, cursor.y, CULTIVATOR_RADIUS_METERS, 0, Math.PI * 2)
        context.fillStyle = '#1b191433'
        context.fill()
        context.strokeStyle = '#d6bf78'
        context.lineWidth = 1.5 / camera.scale
        context.setLineDash([4 / camera.scale, 3 / camera.scale])
        context.stroke()
        context.setLineDash([])
      }
      if (interaction?.kind === 'farm-cultivator' && camera.scale > 0.32) {
        const brush = interaction.points.at(-1)!
        context.beginPath()
        context.arc(brush.x, brush.y, CULTIVATOR_RADIUS_METERS, 0, Math.PI * 2)
        context.strokeStyle = interaction.action === 'erase' ? '#df8f7e' : '#d6bf78'
        context.lineWidth = 1.8 / camera.scale
        context.setLineDash([4 / camera.scale, 3 / camera.scale])
        context.stroke()
        context.setLineDash([])
      }
      if (interaction?.kind === 'select') {
        const left = Math.min(interaction.start.x, interaction.current.x)
        const top = Math.min(interaction.start.y, interaction.current.y)
        const width = Math.abs(interaction.current.x - interaction.start.x)
        const height = Math.abs(interaction.current.y - interaction.start.y)
        context.fillStyle = '#d8c4771f'
        context.strokeStyle = '#f0d273'
        context.lineWidth = 1.5 / camera.scale
        context.setLineDash([6 / camera.scale, 4 / camera.scale])
        context.fillRect(left, top, width, height)
        context.strokeRect(left, top, width, height)
        context.setLineDash([])
      }
      context.restore()

      const barMeters =
        camera.scale > 9
          ? 5
          : camera.scale > 2
            ? 20
            : camera.scale > 0.4
              ? 100
              : camera.scale > 0.08
                ? 500
                : 2000
      const barWidth = barMeters * camera.scale
      context.fillStyle = '#101815b8'
      context.fillRect(18, rect.height - 54, barWidth + 28, 34)
      context.fillStyle = '#e8ddbc'
      context.fillRect(30, rect.height - 35, barWidth, 2)
      context.fillRect(30, rect.height - 41, 1, 8)
      context.fillRect(30 + barWidth, rect.height - 41, 1, 8)
      context.font = '11px Inter, system-ui'
      context.fillText(formatDistance(barMeters), 30, rect.height - 43)

      context.fillStyle = '#101815a8'
      context.beginPath()
      context.roundRect(rect.width - 60, 18, 42, 58, 10)
      context.fill()
      context.fillStyle = '#ebd390'
      context.font = '600 11px Inter, system-ui'
      context.textAlign = 'center'
      context.fillText('N', rect.width - 39, 34)
      context.beginPath()
      context.moveTo(rect.width - 39, 41)
      context.lineTo(rect.width - 44, 58)
      context.lineTo(rect.width - 39, 54)
      context.lineTo(rect.width - 34, 58)
      context.closePath()
      context.fill()
      context.textAlign = 'left'

      const modeLabel =
        camera.scale < 0.18 ? 'WORLD OVERVIEW' : camera.scale < 1.2 ? 'SITE APPROACH' : 'BUILD DETAIL'
      context.fillStyle = '#10181590'
      context.fillRect(18, 18, 112, 26)
      context.fillStyle = '#b8c9ba'
      context.font = '600 10px Inter, system-ui'
      context.fillText(modeLabel, 30, 35)
      perfRecord('draw.overlays', performance.now() - overlaysStarted)
      perfRecord('draw.total', performance.now() - drawStarted)
    }

    drawLatestRef.current = draw
    if (!frameRef.current) {
      frameRef.current = requestAnimationFrame(() => {
        frameRef.current = 0
        drawLatestRef.current()
      })
    }
  }, [
    camera,
    cursor.x,
    cursor.y,
    interaction,
    mapTileKey,
    pieceIndex,
    props.activeLevel,
    props.activePiece,
    props.annotations,
    props.farmMode,
    props.levelViewModes,
    props.mapImage,
    props.mapImageHeight,
    props.mapImageWidth,
    props.paintColor,
    props.penWidth,
    props.pieceSnapPoints,
    props.pieceSprites,
    props.pieces,
    props.rotation,
    props.showAnchors,
    props.showComfortRanges,
    props.showCraftingRanges,
    props.showGrid,
    props.showMap,
    props.showSuppressionRanges,
    props.textDraft,
    props.textSize,
    props.tool,
    props.worldWidth,
    renderChunkIndex,
    renderGroupIndex,
    requestMapTiles,
    selectedPieces,
    selectedSet,
    snap,
    linePreview,
    lineStart,
    boxPreview,
    radiusOverlays,
  ])

  useEffect(
    () => () => {
      cancelAnimationFrame(frameRef.current)
      frameRef.current = 0
    },
    [],
  )

  const locate = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()
    return screenToWorld({ x: event.clientX, y: event.clientY }, cameraRef.current, rect)
  }

  const handlePointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (event.button === 2) {
      event.preventDefault()
      if (props.tool === 'line' || props.tool === 'box') {
        setLineStart(undefined)
        if (interaction?.kind === 'box-fill') setInteraction(undefined)
        return
      }
      if (props.tool === 'farm' && props.farmMode === 'cultivator' && cameraRef.current.scale > 0.32) {
        perfInput('farm_erase')
        lastRenderActivityRef.current = performance.now()
        event.currentTarget.setPointerCapture(event.pointerId)
        setInteraction({ kind: 'farm-cultivator', points: [locate(event)], action: 'erase' })
      }
      return
    }
    perfInput('pointerdown')
    lastRenderActivityRef.current = performance.now()
    event.currentTarget.setPointerCapture(event.pointerId)
    const world = locate(event)
    if (props.tool === 'pan' || spaceHeld || event.button === 1) {
      setInteraction({
        kind: 'pan',
        start: { x: event.clientX, y: event.clientY },
        camera: cameraRef.current,
      })
      return
    }
    if (props.tool === 'text') {
      if (cameraRef.current.scale <= 0.32) {
        updateCamera({ x: world.x, y: world.y, scale: 8 })
      } else if (props.textDraft.trim()) {
        props.onAddAnnotation({
          id: crypto.randomUUID(),
          kind: 'text',
          x: world.x,
          y: world.y,
          text: props.textDraft.trim(),
          color: props.paintColor,
          size: props.textSize,
          level: props.activeLevel,
        })
      }
      return
    }
    if (props.tool === 'pen') {
      if (cameraRef.current.scale <= 0.32) {
        updateCamera({ x: world.x, y: world.y, scale: 8 })
      } else {
        setInteraction({ kind: 'pen', points: [world] })
      }
      return
    }
    if (props.tool === 'farm') {
      if (cameraRef.current.scale <= 0.32) {
        updateCamera({ x: world.x, y: world.y, scale: 8 })
      } else if (props.farmMode === 'cultivator') {
        setInteraction({ kind: 'farm-cultivator', points: [world], action: 'paint' })
      } else {
        setInteraction({ kind: 'farm-area', start: world, current: world })
      }
      return
    }
    if (props.tool === 'place' || props.tool === 'line' || props.tool === 'box') {
      if (cameraRef.current.scale <= 0.32) {
        setCursor(world)
        updateCamera({ x: world.x, y: world.y, scale: 8 })
        reportCursor(world, 8)
        return
      }
      if (props.tool === 'box') {
        const start = { x: snap.x, y: snap.y }
        setInteraction({ kind: 'box-fill', start, current: start })
      } else if (props.tool === 'line') {
        if (!lineStart) {
          setLineStart({ x: snap.x, y: snap.y })
        } else {
          props.onPlaceMany(linePreview.map((piece) => ({ ...piece, id: crypto.randomUUID() })))
          setLineStart(undefined)
        }
      } else {
        props.onPlace({
          id: crypto.randomUUID(),
          pieceId: props.activePiece.id,
          x: snap.x,
          y: snap.y,
          rotation: props.rotation,
          level: props.activeLevel,
        })
      }
      return
    }
    const annotationHit = [...props.annotations]
      .reverse()
      .find(
        (annotation) =>
          (annotation.level ?? 0) === props.activeLevel &&
          pointInAnnotation(world, annotation, 7 / cameraRef.current.scale),
      )
    const pieceHit = annotationHit
      ? undefined
      : pieceIndex
          .query({
            left: world.x,
            right: world.x,
            top: world.y,
            bottom: world.y,
          })
          .reverse()
          .find((piece) => (piece.level ?? 0) === props.activeLevel && pointInPiece(world, piece))
    const hitId = annotationHit?.id ?? pieceHit?.id
    if (hitId) {
      const additive = event.shiftKey || event.ctrlKey || event.metaKey
      let nextIds: string[]
      if (additive && selectedSet.has(hitId)) {
        nextIds = props.selectedIds.filter((id) => id !== hitId)
        props.onSelect(nextIds)
        return
      }
      nextIds = additive
        ? [...props.selectedIds, hitId]
        : selectedSet.has(hitId)
          ? props.selectedIds
          : [hitId]
      const moving = new Set(nextIds)
      markRenderPiecesHot(props.pieces.filter((piece) => moving.has(piece.id)))
      props.onSelect(nextIds)
      props.onMoveStart()
      const pieceOrigins = props.pieces.filter((piece) => moving.has(piece.id)).map((piece) => ({ ...piece }))
      const annotationOrigins = props.annotations
        .filter((annotation) => moving.has(annotation.id))
        .map(cloneAnnotation)
      const nextInteraction: Interaction = {
        kind: 'move',
        start: world,
        pieceOrigins,
        annotationOrigins,
        piecePositions: pieceOrigins,
        annotationPositions: annotationOrigins,
      }
      interactionRef.current = nextInteraction
      setInteraction(nextInteraction)
      return
    }
    const additive = event.shiftKey || event.ctrlKey || event.metaKey
    if (!additive) props.onSelect([])
    setInteraction({ kind: 'select', start: world, current: world, additive })
  }

  const handlePointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const world = locate(event)
    cursorRef.current = world
    reportCursor(world, cameraRef.current.scale)
    if (interaction?.kind === 'pan') {
      perfInput('pan')
      updateCamera({
        ...interaction.camera,
        x: interaction.camera.x - (event.clientX - interaction.start.x) / interaction.camera.scale,
        y: interaction.camera.y - (event.clientY - interaction.start.y) / interaction.camera.scale,
      })
      return
    }
    setCursor(world)
    const movingInteraction = interactionRef.current?.kind === 'move' ? interactionRef.current : undefined
    if (movingInteraction) {
      perfInput('move')
      const rawDx = world.x - movingInteraction.start.x
      const rawDy = world.y - movingInteraction.start.y
      const rawMovingPieces = movingInteraction.pieceOrigins.map((piece) => ({
        ...piece,
        x: piece.x + rawDx,
        y: piece.y + rawDy,
      }))
      let snapOffsetX = 0
      let snapOffsetY = 0
      let snapTarget: Point | undefined

      if (props.snapMode === 'piece' && !event.shiftKey && rawMovingPieces.length) {
        const threshold = 16 / cameraRef.current.scale
        const bounds = rawMovingPieces.reduce(
          (box, piece) => {
            const definition = pieceById(piece.pieceId)
            const radius =
              Math.max(
                Math.hypot(definition.width, definition.depth) / 2,
                snapPointRadius(definition, props.pieceSnapPoints),
              ) + maximumSnapRadius
            return {
              left: Math.min(box.left, piece.x - radius - threshold),
              right: Math.max(box.right, piece.x + radius + threshold),
              top: Math.min(box.top, piece.y - radius - threshold),
              bottom: Math.max(box.bottom, piece.y + radius + threshold),
            }
          },
          { left: Infinity, right: -Infinity, top: Infinity, bottom: -Infinity },
        )
        const targets = pieceIndex.query(bounds).filter((piece) => {
          const level = piece.level ?? 0
          if (level === props.activeLevel) return true
          const definition = pieceById(piece.pieceId)
          return (
            isLevelSnapTarget(level, props.activeLevel, props.levelViewModes) && isBuildingPiece(definition)
          )
        })
        const moveSnap = findMoveSnap(rawMovingPieces, targets, threshold, props.pieceSnapPoints)
        if (moveSnap.snapped) {
          snapOffsetX = moveSnap.offsetX
          snapOffsetY = moveSnap.offsetY
          snapTarget = moveSnap.target
        }
      }

      const dx = rawDx + snapOffsetX
      const dy = rawDy + snapOffsetY
      const piecePositions = movingInteraction.pieceOrigins.map((piece) => ({
        ...piece,
        x: piece.x + dx,
        y: piece.y + dy,
      }))
      const annotationPositions = movingInteraction.annotationOrigins.map((annotation) =>
        translateAnnotation(annotation, { x: dx, y: dy }),
      )
      const nextInteraction: Interaction = {
        ...movingInteraction,
        piecePositions,
        annotationPositions,
        snapTarget,
      }
      interactionRef.current = nextInteraction
      setInteraction(nextInteraction)
      props.onMoveMany(piecePositions.map(({ id, x, y, rotation }) => ({ id, x, y, rotation })))
      props.onMoveAnnotations(annotationPositions)
    } else if (interaction?.kind === 'select') {
      perfInput('select')
      setInteraction({ ...interaction, current: world })
    } else if (interaction?.kind === 'pen') {
      perfInput('pen')
      const last = interaction.points.at(-1)!
      if (Math.hypot(world.x - last.x, world.y - last.y) > Math.max(0.02, props.penWidth * 0.15)) {
        setInteraction({ kind: 'pen', points: [...interaction.points, world] })
      }
    } else if (interaction?.kind === 'farm-cultivator') {
      perfInput('farm')
      const last = interaction.points.at(-1)!
      if (Math.hypot(world.x - last.x, world.y - last.y) > 0.35) {
        setInteraction({ ...interaction, points: [...interaction.points, world] })
      }
    } else if (interaction?.kind === 'farm-area') {
      perfInput('farm')
      setInteraction({ ...interaction, current: world })
    } else if (interaction?.kind === 'box-fill') {
      perfInput('box_fill')
      setInteraction({ ...interaction, current: world })
    }
  }

  const handleWheel = (event: React.WheelEvent<HTMLCanvasElement>) => {
    event.preventDefault()
    perfInput('wheel')
    const rect = event.currentTarget.getBoundingClientRect()
    const current = cameraRef.current
    const before = screenToWorld({ x: event.clientX, y: event.clientY }, current, rect)
    const deltaPixels =
      event.deltaMode === WheelEvent.DOM_DELTA_LINE
        ? event.deltaY * 16
        : event.deltaMode === WheelEvent.DOM_DELTA_PAGE
          ? event.deltaY * rect.height
          : event.deltaY
    const boundedDelta = Math.max(-120, Math.min(120, deltaPixels))
    const factor = Math.exp(-boundedDelta * 0.0012)
    const nextScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, current.scale * factor))
    const x = before.x - (event.clientX - rect.left - rect.width / 2) / nextScale
    const y = before.y - (event.clientY - rect.top - rect.height / 2) / nextScale
    updateCamera({ x, y, scale: nextScale })
    reportCursor(before, nextScale)
  }

  const handleDoubleClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (props.tool !== 'select' && props.tool !== 'pan') return
    event.preventDefault()
    perfInput('doubleclick')
    const rect = event.currentTarget.getBoundingClientRect()
    const current = cameraRef.current
    const world = screenToWorld({ x: event.clientX, y: event.clientY }, current, rect)
    const nextScale = Math.min(MAX_SCALE, Math.max(current.scale, current.scale * 2))
    updateCamera({ x: world.x, y: world.y, scale: nextScale })
    reportCursor(world, nextScale)
  }

  const finishInteraction = () => {
    if (interaction) perfEvent('interaction_end', { kind: interaction.kind })
    if (interaction?.kind === 'move') props.onMoveEnd()
    if (interaction?.kind === 'select') {
      const selected = [
        ...piecesIntersectingBox(props.pieces, interaction.start, interaction.current, props.activeLevel),
        ...annotationsIntersectingBox(
          props.annotations,
          interaction.start,
          interaction.current,
          props.activeLevel,
        ),
      ]
      props.onSelect(interaction.additive ? [...new Set([...props.selectedIds, ...selected])] : selected)
    }
    if (interaction?.kind === 'pen' && interaction.points.length > 1) {
      props.onAddAnnotation({
        id: crypto.randomUUID(),
        kind: 'pen',
        points: interaction.points,
        color: props.paintColor,
        width: props.penWidth,
        level: props.activeLevel,
      })
    }
    if (interaction?.kind === 'farm-cultivator') {
      props.onAddAnnotation({
        id: crypto.randomUUID(),
        kind: 'farm',
        mode: 'cultivator',
        points: interaction.points,
        radius: CULTIVATOR_RADIUS_METERS,
        action: interaction.action,
        level: props.activeLevel,
      })
    }
    if (interaction?.kind === 'farm-area') {
      const width = Math.abs(interaction.current.x - interaction.start.x)
      const height = Math.abs(interaction.current.y - interaction.start.y)
      if (width >= 0.25 && height >= 0.25)
        props.onAddAnnotation({
          id: crypto.randomUUID(),
          kind: 'farm',
          mode: 'area',
          x: (interaction.start.x + interaction.current.x) / 2,
          y: (interaction.start.y + interaction.current.y) / 2,
          width,
          height,
          cornerRadius: CULTIVATOR_RADIUS_METERS,
          level: props.activeLevel,
        })
    }
    if (interaction?.kind === 'box-fill' && boxPreview.length) {
      props.onPlaceMany(boxPreview.map((piece) => ({ ...piece, id: crypto.randomUUID() })))
    }
    interactionRef.current = undefined
    setInteraction(undefined)
  }

  const handleContextMenu = (event: React.MouseEvent<HTMLCanvasElement>) => {
    event.preventDefault()
  }

  const cursorStyle =
    interaction?.kind === 'pan'
      ? 'grabbing'
      : props.tool === 'pan' || spaceHeld
        ? 'grab'
        : ['place', 'line', 'box', 'text', 'pen', 'farm'].includes(props.tool)
          ? 'crosshair'
          : 'default'

  return (
    <canvas
      ref={canvasRef}
      className="planner-canvas"
      style={{ cursor: cursorStyle }}
      onContextMenu={handleContextMenu}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={finishInteraction}
      onPointerCancel={finishInteraction}
      onWheel={handleWheel}
      onDoubleClick={handleDoubleClick}
    />
  )
})

PlannerCanvas.displayName = 'PlannerCanvas'

export default PlannerCanvas
