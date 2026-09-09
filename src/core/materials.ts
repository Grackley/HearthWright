import type { PieceDefinition, PieceResourceMap, PieceResourceRequirement, PlacedPiece } from '../types'

export interface MaterialTotal {
  prefabName: string
  displayName: string
  amount: number
}

export interface SelectedPieceMaterialGroup {
  pieceId: string
  count: number
  materials: MaterialTotal[]
}

export interface SelectedMaterialSummary {
  groups: SelectedPieceMaterialGroup[]
  totals: MaterialTotal[]
}

const titleCase = (value: string) => value.replace(/\b\w/g, (character) => character.toLocaleUpperCase())

const fallbackResources = (definition: PieceDefinition): PieceResourceRequirement[] =>
  definition.cost.split('·').flatMap((part) => {
    const match = /^\s*(\d+)\s+(.+?)\s*$/.exec(part)
    if (!match) return []
    const displayName = titleCase(match[2])
    return [
      {
        prefabName: displayName.replace(/[^a-z0-9]+/gi, ''),
        displayName,
        amount: Number(match[1]),
        recover: true,
      },
    ]
  })

export const resourcesForPiece = (definition: PieceDefinition, resources: PieceResourceMap) =>
  Object.prototype.hasOwnProperty.call(resources, definition.id)
    ? resources[definition.id].map((resource) => ({ ...resource }))
    : fallbackResources(definition)

const addMaterials = (totals: Map<string, MaterialTotal>, materials: MaterialTotal[]) => {
  for (const material of materials) {
    const key = material.prefabName.toLocaleLowerCase()
    const current = totals.get(key)
    if (current) current.amount += material.amount
    else totals.set(key, { ...material })
  }
}

const sortedMaterials = (materials: Iterable<MaterialTotal>) =>
  [...materials].sort((first, second) => first.displayName.localeCompare(second.displayName))

export const summarizeSelectedMaterials = (
  selectedPieces: PlacedPiece[],
  definitionById: (pieceId: string) => PieceDefinition,
  resources: PieceResourceMap,
): SelectedMaterialSummary => {
  const counts = new Map<string, number>()
  selectedPieces.forEach((piece) => counts.set(piece.pieceId, (counts.get(piece.pieceId) ?? 0) + 1))

  const totals = new Map<string, MaterialTotal>()
  const groups = [...counts].map(([pieceId, count]) => {
    const definition = definitionById(pieceId)
    const materials = resourcesForPiece(definition, resources).map((resource) => ({
      prefabName: resource.prefabName,
      displayName: resource.displayName,
      amount: resource.amount * count,
    }))
    addMaterials(totals, materials)
    return { pieceId, count, materials: sortedMaterials(materials) }
  })

  return { groups, totals: sortedMaterials(totals.values()) }
}
