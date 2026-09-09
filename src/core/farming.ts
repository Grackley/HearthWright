import type { PlanAnnotation } from '../types'

export const CULTIVATOR_RADIUS_METERS = 3
export const CULTIVATED_SOIL_COLOR = '#1b1914'
export const CULTIVATED_SOIL_EDGE = '#71644d'

export const isCultivatorErase = (annotation: { kind: string; mode?: string; action?: string }) =>
  annotation.kind === 'farm' && annotation.mode === 'cultivator' && annotation.action === 'erase'

export const selectableAnnotationCount = (annotations: PlanAnnotation[]) =>
  annotations.filter((annotation) => !isCultivatorErase(annotation)).length

export const selectedAnnotationObjectCount = (ids: string[], annotations: PlanAnnotation[]) => {
  const selected = new Set(ids)
  return annotations.filter((annotation) => !isCultivatorErase(annotation) && selected.has(annotation.id))
    .length
}
