import { readLevelViewModes } from './levels'
import { mapMetersPerPixel } from './mapImages'
import { PIECES } from '../data/pieces'
import type { LevelViewMode, PlacedPiece, PlanAnnotation, PlannerProject } from '../types'

export const PROJECT_STORAGE_KEY = 'hearthwright-project-v1'

export interface ProjectState {
  name: string
  seed: string
  pieces: PlacedPiece[]
  annotations: PlanAnnotation[]
  activeLevel: number
  levelViewModes: Record<number, LevelViewMode>
  localMapId?: string
  mapImageName?: string
  mapInfo?: PlannerProject['mapInfo']
}

export const emptyProjectState = (): ProjectState => ({
  name: 'New build plan',
  seed: '',
  pieces: [],
  annotations: [],
  activeLevel: 0,
  levelViewModes: {},
})

const record = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
const coordinate = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= 1_000_000
const positive = (value: unknown): value is number => coordinate(value) && value > 0
const validLevel = (value: unknown) => value === undefined || (coordinate(value) && Number.isInteger(value))
const validMapInfo = (info: unknown): info is NonNullable<PlannerProject['mapInfo']> =>
  record(info) &&
  positive(info.width) &&
  Number.isInteger(info.width) &&
  info.width === info.height &&
  positive(info.metersPerPixel) &&
  typeof info.resolution === 'string' &&
  ['small', 'medium', 'high', 'custom'].includes(info.resolution)
const knownPieces = new Set(PIECES.map((piece) => piece.id))
const validIdentity = (value: Record<string, unknown>) =>
  typeof value.id === 'string' && value.id.length > 0 && validLevel(value.level)
const validPiece = (value: unknown): value is PlacedPiece =>
  record(value) &&
  validIdentity(value) &&
  typeof value.pieceId === 'string' &&
  knownPieces.has(value.pieceId) &&
  coordinate(value.x) &&
  coordinate(value.y) &&
  coordinate(value.rotation)
const validPoints = (value: unknown) =>
  Array.isArray(value) &&
  value.length > 0 &&
  value.every((point) => record(point) && coordinate(point.x) && coordinate(point.y))
const validAnnotation = (value: unknown): value is PlanAnnotation => {
  if (!record(value) || !validIdentity(value)) return false
  if (value.kind === 'text')
    return (
      coordinate(value.x) &&
      coordinate(value.y) &&
      typeof value.text === 'string' &&
      typeof value.color === 'string' &&
      positive(value.size)
    )
  if (value.kind === 'pen')
    return validPoints(value.points) && typeof value.color === 'string' && positive(value.width)
  if (value.kind !== 'farm') return false
  if (value.mode === 'cultivator')
    return (
      validPoints(value.points) &&
      positive(value.radius) &&
      (value.action === undefined || value.action === 'paint' || value.action === 'erase')
    )
  return (
    value.mode === 'area' &&
    coordinate(value.x) &&
    coordinate(value.y) &&
    positive(value.width) &&
    positive(value.height) &&
    coordinate(value.cornerRadius) &&
    value.cornerRadius >= 0
  )
}

const readAnnotations = (value: unknown, strict = false): PlanAnnotation[] => {
  if (value === undefined) return []
  if (!Array.isArray(value) && strict) throw new Error('Invalid project annotations')
  if (!Array.isArray(value)) return []
  const annotations: PlanAnnotation[] = []
  for (const annotation of value) {
    if (!record(annotation)) {
      if (strict) throw new Error('Invalid project annotation')
      continue
    }
    const candidate = annotation as Record<string, unknown>
    if (candidate.kind === 'farm' && candidate.mode === 'circle') {
      if (
        !validIdentity(candidate) ||
        !coordinate(candidate.x) ||
        !coordinate(candidate.y) ||
        !positive(candidate.radius)
      ) {
        if (strict) throw new Error('Invalid legacy farm area')
        continue
      }
      const radius = Math.max(0.25, Number(candidate.radius) || 0.25)
      annotations.push({
        id: String(candidate.id),
        kind: 'farm',
        mode: 'area',
        x: Number(candidate.x) || 0,
        y: Number(candidate.y) || 0,
        width: radius * 2,
        height: radius * 2,
        cornerRadius: Math.min(3, radius),
        level: Number.isInteger(candidate.level) ? Number(candidate.level) : undefined,
      })
    } else if (validAnnotation(annotation)) {
      annotations.push(annotation as PlanAnnotation)
    } else if (strict) {
      throw new Error('Invalid project annotation')
    }
  }
  return annotations
}

export const parseSavedProject = (value: string | null): ProjectState => {
  const fallback = emptyProjectState()
  if (!value) return fallback

  try {
    const project = JSON.parse(value) as Partial<PlannerProject>
    if (!record(project)) return fallback
    const seen = new Set<string>()
    const unique = (item: { id: string }) => {
      if (seen.has(item.id)) return false
      seen.add(item.id)
      return true
    }
    return {
      name: typeof project.name === 'string' ? project.name : fallback.name,
      seed: typeof project.seed === 'string' ? project.seed : fallback.seed,
      pieces: Array.isArray(project.pieces) ? project.pieces.filter(validPiece).filter(unique) : [],
      annotations: readAnnotations(project.annotations).filter(unique),
      activeLevel: validLevel(project.activeLevel) ? (project.activeLevel ?? 0) : 0,
      levelViewModes: readLevelViewModes(project.levelViewModes),
      localMapId: typeof project.localMapId === 'string' ? project.localMapId : undefined,
      mapImageName: typeof project.mapImageName === 'string' ? project.mapImageName : undefined,
      mapInfo: validMapInfo(project.mapInfo)
        ? { ...project.mapInfo, metersPerPixel: mapMetersPerPixel(project.mapInfo.width) }
        : undefined,
    }
  } catch {
    return fallback
  }
}

export const parseProjectFile = (value: string): PlannerProject => {
  const project = JSON.parse(value) as PlannerProject
  if (!record(project) || project.version !== 1 || !Array.isArray(project.pieces)) {
    throw new Error('Unsupported Hearthwright project')
  }
  if (!project.pieces.every(validPiece)) throw new Error('Project contains an invalid or unknown build piece')
  if (
    (project.name !== undefined && typeof project.name !== 'string') ||
    (project.seed !== undefined && typeof project.seed !== 'string') ||
    !validLevel(project.activeLevel)
  )
    throw new Error('Invalid project details')
  for (const key of ['mapImageName', 'localMapId'] as const) {
    if (project[key] !== undefined && typeof project[key] !== 'string')
      throw new Error('Invalid project map reference')
  }
  if (
    project.mapImage !== undefined &&
    (typeof project.mapImage !== 'string' ||
      !/^data:image\/png;base64,[a-z0-9+/=\s]+$/i.test(project.mapImage))
  ) {
    throw new Error('The embedded map must be a PNG image; import its original PNG separately')
  }
  if (project.mapInfo !== undefined && !validMapInfo(project.mapInfo))
    throw new Error('Invalid project map dimensions')
  const annotations = readAnnotations(project.annotations, true)
  const ids = [...project.pieces, ...annotations].map((item) => item.id)
  if (new Set(ids).size !== ids.length) throw new Error('Project contains duplicate item IDs')
  return {
    ...project,
    annotations,
    mapInfo: project.mapInfo
      ? { ...project.mapInfo, metersPerPixel: mapMetersPerPixel(project.mapInfo.width) }
      : undefined,
  }
}

export const projectFileSlug = (name: string) =>
  name
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase() || 'valheim-plan'
