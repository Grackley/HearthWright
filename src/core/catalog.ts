import { PIECES } from '../data/pieces'
import type { PieceCategory } from '../types'

export const searchCatalog = (category: PieceCategory, search: string) => {
  const words = search.trim().toLowerCase().split(/\s+/).filter(Boolean)
  return PIECES.filter((piece) => {
    if (!words.length) return piece.category === category
    const text =
      `${piece.name} ${piece.category} ${piece.group ?? ''} ${piece.material} ${piece.tags.join(' ')}`.toLowerCase()
    return words.every((word) => text.includes(word))
  })
}
