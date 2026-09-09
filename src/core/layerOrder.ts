import type { PlacedPiece } from '../types'

export type LayerOrderCommand = 'back' | 'backward' | 'forward' | 'front'

const reorderLevel = (
  pieces: PlacedPiece[],
  selectedIds: ReadonlySet<string>,
  command: LayerOrderCommand,
) => {
  const reordered = [...pieces]

  if (command === 'back') {
    return [
      ...reordered.filter((piece) => selectedIds.has(piece.id)),
      ...reordered.filter((piece) => !selectedIds.has(piece.id)),
    ]
  }
  if (command === 'front') {
    return [
      ...reordered.filter((piece) => !selectedIds.has(piece.id)),
      ...reordered.filter((piece) => selectedIds.has(piece.id)),
    ]
  }
  if (command === 'backward') {
    for (let index = 1; index < reordered.length; index += 1) {
      if (selectedIds.has(reordered[index].id) && !selectedIds.has(reordered[index - 1].id)) {
        ;[reordered[index - 1], reordered[index]] = [reordered[index], reordered[index - 1]]
      }
    }
    return reordered
  }

  for (let index = reordered.length - 2; index >= 0; index -= 1) {
    if (selectedIds.has(reordered[index].id) && !selectedIds.has(reordered[index + 1].id)) {
      ;[reordered[index], reordered[index + 1]] = [reordered[index + 1], reordered[index]]
    }
  }
  return reordered
}

export const reorderPiecesWithinLevels = (
  pieces: PlacedPiece[],
  selected: Iterable<string>,
  command: LayerOrderCommand,
) => {
  const selectedIds = new Set(selected)
  if (!selectedIds.size) return pieces

  const byLevel = new Map<number, PlacedPiece[]>()
  pieces.forEach((piece) => {
    const level = piece.level ?? 0
    byLevel.set(level, [...(byLevel.get(level) ?? []), piece])
  })

  const reorderedByLevel = new Map<number, PlacedPiece[]>()
  let changed = false
  byLevel.forEach((levelPieces, level) => {
    const reordered = reorderLevel(levelPieces, selectedIds, command)
    reorderedByLevel.set(level, reordered)
    if (reordered.some((piece, index) => piece !== levelPieces[index])) changed = true
  })
  if (!changed) return pieces

  const nextIndexByLevel = new Map<number, number>()
  return pieces.map((piece) => {
    const level = piece.level ?? 0
    const index = nextIndexByLevel.get(level) ?? 0
    nextIndexByLevel.set(level, index + 1)
    return reorderedByLevel.get(level)![index]
  })
}
