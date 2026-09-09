import type { LevelViewMode, PlacedPiece, PlanAnnotation } from '../types'

export interface LevelLayout {
  pieces: PlacedPiece[]
  annotations: PlanAnnotation[]
  activeLevel: number
  levelViewModes: Record<number, LevelViewMode>
}

export const listBuildingLevels = ({ pieces, annotations, activeLevel, levelViewModes }: LevelLayout) => {
  const levels = new Set<number>([0, activeLevel, ...Object.keys(levelViewModes).map(Number)])
  pieces.forEach((piece) => levels.add(piece.level ?? 0))
  annotations.forEach((annotation) => levels.add(annotation.level ?? 0))
  return [...levels].sort((a, b) => a - b)
}

// Swap adjacent floor slots, including empty ones, without changing in-floor geometry or draw order.
export const moveBuildingLevel = (layout: LevelLayout, level: number, direction: -1 | 1): LevelLayout => {
  const levels = listBuildingLevels(layout)
  const index = levels.indexOf(level)
  const neighbor = levels[index + direction]
  if (index < 0 || neighbor === undefined) return layout
  const remap = (value: number) => (value === level ? neighbor : value === neighbor ? level : value)
  const move = <T extends { level?: number }>(item: T): T => {
    const next = remap(item.level ?? 0)
    return next === (item.level ?? 0) ? item : { ...item, level: next }
  }
  const levelViewModes = { ...layout.levelViewModes }
  levelViewModes[neighbor] = layout.levelViewModes[level] ?? 'outline'
  levelViewModes[level] = layout.levelViewModes[neighbor] ?? 'outline'
  return {
    pieces: layout.pieces.map(move),
    annotations: layout.annotations.map(move),
    activeLevel: remap(layout.activeLevel),
    levelViewModes,
  }
}

export const levelLabel = (level: number) =>
  level === 0 ? 'Ground floor' : level > 0 ? `Level ${level + 1}` : `Basement ${Math.abs(level)}`

export const inactiveLevelViewMode = (level: number, modes: Record<number, LevelViewMode>): LevelViewMode =>
  modes[level] ?? 'outline'

export const renderedLevelViewMode = (
  level: number,
  activeLevel: number,
  modes: Record<number, LevelViewMode>,
): LevelViewMode => (level === activeLevel ? 'actual' : inactiveLevelViewMode(level, modes))

export const isLevelSnapTarget = (level: number, activeLevel: number, modes: Record<number, LevelViewMode>) =>
  renderedLevelViewMode(level, activeLevel, modes) !== 'hidden'

export const compareLevels = (first: { level?: number }, second: { level?: number }) =>
  (first.level ?? 0) - (second.level ?? 0)

export const readLevelViewModes = (value: unknown): Record<number, LevelViewMode> => {
  if (!value || typeof value !== 'object') return {}
  return Object.fromEntries(
    Object.entries(value).flatMap(([level, mode]) => {
      const numericLevel = Number(level)
      return Number.isInteger(numericLevel) && (mode === 'hidden' || mode === 'outline' || mode === 'actual')
        ? [[numericLevel, mode] as const]
        : []
    }),
  )
}
