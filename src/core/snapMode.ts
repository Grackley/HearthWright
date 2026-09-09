import type { SnapMode, Tool } from '../types'

export const placementSnapActive = (tool: Tool, snapMode: SnapMode, shiftHeld: boolean) =>
  (tool === 'place' || tool === 'line' || tool === 'box') && snapMode === 'piece' && !shiftHeld
