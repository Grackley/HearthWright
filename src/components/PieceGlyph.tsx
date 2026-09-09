import type { CSSProperties } from 'react'
import type { PieceDefinition } from '../types'

interface PieceGlyphProps {
  piece: PieceDefinition
  sprite?: string
}

const pieceClassName = (piece: PieceDefinition, hasSprite: boolean) =>
  [
    'piece-glyph',
    hasSprite && 'has-sprite',
    piece.shape,
    `visual-${piece.visual ?? 'plain'}`,
    piece.tags.includes('window') && 'window-pane',
    piece.tags.includes('right') && 'spiral-right',
    piece.tags.includes('cage') && 'cage-piece',
    piece.tags.includes('door') && 'door-piece',
    piece.tags.includes('gate') && 'gate-piece',
  ]
    .filter(Boolean)
    .join(' ')

export const PieceGlyph = ({ piece, sprite }: PieceGlyphProps) => (
  <span
    className={pieceClassName(piece, Boolean(sprite))}
    style={{ '--piece-color': piece.color } as CSSProperties}
  >
    {sprite ? <img src={sprite} alt="" /> : piece.symbol && <b>{piece.symbol}</b>}
    {sprite && piece.shape === 'quarterCircle' && (
      <svg
        className={`glyph-spiral-arrow ${piece.tags.includes('right') ? 'right' : ''}`}
        viewBox="0 0 40 40"
        aria-hidden="true"
      >
        <path d="M8 32 A24 24 0 0 0 32 8" />
        <path d="M26 13 L32 8 L36 14" />
      </svg>
    )}
    {sprite &&
      piece.shape !== 'quarterCircle' &&
      (piece.visual === 'stairs' || piece.visual === 'ladder') && (
        <i className="glyph-direction" aria-hidden="true">
          ↑
        </i>
      )}
  </span>
)
