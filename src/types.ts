export type Point = { x: number; y: number }
export type PieceSnapPointMap = Readonly<Record<string, readonly Point[]>>

export interface PieceResourceRequirement {
  prefabName: string
  displayName: string
  amount: number
  recover: boolean
}

export type PieceResourceMap = Readonly<Record<string, readonly PieceResourceRequirement[]>>

export interface PieceCraftingStationRequirement {
  prefabName: string
  displayName: string
}

export type PieceCraftingStationMap = Readonly<Record<string, PieceCraftingStationRequirement | null>>
export type PieceComfortMap = Readonly<Record<string, number>>

export interface PieceEffectArea {
  type: string
  radius: number
  offset: Point
}

export interface PieceCraftingStationRange {
  nameToken: string
  displayName: string
  rangeBuild: number
  extraRangePerLevel: number
  offset: Point
}

export interface PieceStationExtension {
  extensionNameToken: string
  extensionName: string
  stationNameToken: string
  stationName: string
  maxStationDistance: number
  stack: boolean
  offset: Point
}

export interface PieceRangeMetadata {
  origin: Point
  effectAreas: readonly PieceEffectArea[]
  craftingStations: readonly PieceCraftingStationRange[]
  stationExtensions: readonly PieceStationExtension[]
}

export type PieceRangeMap = Readonly<Record<string, PieceRangeMetadata>>

export type PieceCategory =
  | 'Wood'
  | 'Corewood'
  | 'Darkwood'
  | 'Ashwood'
  | 'Timberwood'
  | 'Ice'
  | 'Stone'
  | 'Black Marble'
  | 'Grausten'
  | 'Metal'
  | 'Dvergr'
  | 'Furniture'
  | 'Crafting'
  | 'Utility'
  | 'Vehicles'
  // Legacy source categories are normalized before the catalog is exported.
  | 'Structure'
  | 'Walls'
export type PieceShape = 'rect' | 'line' | 'circle' | 'triangle' | 'quarterCircle'
export type PieceVisual =
  | 'floor'
  | 'wall'
  | 'stairs'
  | 'ladder'
  | 'bed'
  | 'seating'
  | 'table'
  | 'storage'
  | 'rug'
  | 'banner'
  | 'decor'
  | 'fire'
  | 'light'
  | 'station'
  | 'upgrade'
  | 'cooking'
  | 'processing'
  | 'vehicle'
export type SnapPointName = 'nw' | 'ne' | 'se' | 'sw' | 'n' | 'e' | 's' | 'w' | 'center'

export interface PieceDefinition {
  id: string
  name: string
  category: PieceCategory
  shape: PieceShape
  width: number
  depth: number
  color: string
  material: string
  cost: string
  snapPoints: SnapPointName[]
  tags: string[]
  group?: string
  visual?: PieceVisual
  symbol?: string
  comfort?: number
}

export interface PlacedPiece {
  id: string
  pieceId: string
  x: number
  y: number
  rotation: number
  level?: number
}

export type Tool = 'select' | 'place' | 'line' | 'box' | 'text' | 'pen' | 'farm' | 'pan'
export type SnapMode = 'piece' | 'free'
export type LevelViewMode = 'hidden' | 'outline' | 'actual'
export type FarmMode = 'cultivator' | 'area'

export interface TextAnnotation {
  id: string
  kind: 'text'
  x: number
  y: number
  text: string
  color: string
  size: number
  level?: number
}

export interface PenAnnotation {
  id: string
  kind: 'pen'
  points: Point[]
  color: string
  width: number
  level?: number
}

export interface CultivatorAnnotation {
  id: string
  kind: 'farm'
  mode: 'cultivator'
  points: Point[]
  radius: number
  action?: 'paint' | 'erase'
  level?: number
}

export interface FarmAreaAnnotation {
  id: string
  kind: 'farm'
  mode: 'area'
  x: number
  y: number
  width: number
  height: number
  cornerRadius: number
  level?: number
}

export type FarmAnnotation = CultivatorAnnotation | FarmAreaAnnotation
export type PlanAnnotation = TextAnnotation | PenAnnotation | FarmAnnotation

export interface LocalMapSummary {
  id: string
  seed: string
  imageName: string
  imageWidth: number
  imageHeight: number
  metersPerPixel: number
  resolution: 'small' | 'medium' | 'high' | 'custom'
}

export interface LoadedLocalMap {
  seed: string
  imageName: string
  imageBytes: Uint8Array
  imageWidth: number
  imageHeight: number
  metersPerPixel: number
  resolution: LocalMapSummary['resolution']
}

export interface VisualBundleManifest {
  schemaVersion: 1
  id: string
  name: string
  gameVersion: string
  legalStatus: 'local-only' | 'approved'
  pieces: Record<
    string,
    {
      sprite: string
      spriteBounds?: { preCropped: boolean; width: number; height: number }
      prefabName: string
      displayName: string
      visualBounds?: {
        available: boolean
        width: number
        height: number
        depth: number
        centerX?: number
        centerY?: number
        centerZ?: number
      }
      geometryBounds?: {
        available: boolean
        width: number
        height: number
        depth: number
        centerX?: number
        centerY?: number
        centerZ?: number
      }
      measuredFootprint?: { width: number; depth: number }
      prefabOrigin?: Point
      rangeOrigin?: Point
      snapPoints?: Point[]
      resources?: PieceResourceRequirement[]
      craftingStation?: PieceCraftingStationRequirement | null
      comfort?: number
      comfortGroup?: string
      effectAreas?: PieceEffectArea[]
      craftingStationRanges?: PieceCraftingStationRange[]
      stationExtensions?: PieceStationExtension[]
    }
  >
}

export interface LoadedVisualBundle {
  manifest: VisualBundleManifest
  sprites: { pieceId: string; imageBytes: Uint8Array }[]
}

export interface Camera {
  x: number
  y: number
  scale: number
}

export interface PlannerProject {
  mapWorldWidthMeters?: number
  version: 1
  name: string
  seed: string
  pieces: PlacedPiece[]
  annotations?: PlanAnnotation[]
  activeLevel?: number
  levelViewModes?: Record<number, LevelViewMode>
  localMapId?: string
  mapImage?: string
  mapImageName?: string
  mapInfo?: {
    width: number
    height: number
    metersPerPixel: number
    resolution: LocalMapSummary['resolution']
  }
}

export interface SnapResult {
  x: number
  y: number
  target?: Point
  source?: Point
  snapped: boolean
}
