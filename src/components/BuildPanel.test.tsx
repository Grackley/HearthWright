import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { pieceById } from '../data/pieces'
import { BuildPanel } from './BuildPanel'

describe('piece catalog requirements', () => {
  it('reveals a piece station and materials only while its card is expanded', () => {
    const piece = pieceById('furniture-armor-stand')
    const onSelectPiece = vi.fn()

    render(
      <BuildPanel
        selectedIds={[]}
        selectedCount={0}
        selectedPieces={[]}
        activePiece={piece}
        activePieceId={piece.id}
        tool="place"
        search=""
        category="Furniture"
        groupedPieces={[[piece.group ?? 'Decor & utility', [piece]]]}
        filteredCount={1}
        sprites={{}}
        snapPoints={{}}
        pieceResources={{
          [piece.id]: [
            { prefabName: 'FineWood', displayName: 'Finewood', amount: 8, recover: true },
            { prefabName: 'IronNails', displayName: 'Iron Nails', amount: 4, recover: true },
          ],
        }}
        craftingStations={{
          [piece.id]: { prefabName: 'piece_workbench', displayName: 'Workbench' },
        }}
        pieceComfort={{ [piece.id]: 1 }}
        onClearSelection={vi.fn()}
        onUpdatePiece={vi.fn()}
        onUpdateAnnotation={vi.fn()}
        onDelete={vi.fn()}
        onReorder={vi.fn()}
        onPlaceAnother={vi.fn()}
        onSearchChange={vi.fn()}
        onCategoryChange={vi.fn()}
        onSelectPiece={onSelectPiece}
        onActivatePlace={vi.fn()}
      />,
    )

    const card = screen.getByRole('button', { name: /Armour Stand/i })
    expect(screen.queryByText('Required station')).toBeNull()

    fireEvent.click(card)
    expect(onSelectPiece).toHaveBeenCalledWith(piece.id)
    expect(screen.getByText('Required station')).toBeTruthy()
    expect(screen.getByText('Comfort')).toBeTruthy()
    expect(screen.getByText('+1')).toBeTruthy()
    expect(screen.getByText('Workbench')).toBeTruthy()
    expect(screen.getByText('Finewood')).toBeTruthy()
    expect(screen.getByText('8')).toBeTruthy()

    fireEvent.click(card)
    expect(screen.queryByText('Required station')).toBeNull()
  })
})
