export type SpriteFit = 'stretch' | 'contain'

export interface SpriteLayout {
  rotateQuarterTurn: boolean
  width: number
  height: number
}

export const spriteLayout = (
  sourceWidth: number,
  sourceHeight: number,
  footprintWidth: number,
  footprintDepth: number,
  fit: SpriteFit,
): SpriteLayout => {
  const sourceAspect = sourceWidth / Math.max(1, sourceHeight)
  const targetAspect = footprintWidth / Math.max(0.001, footprintDepth)
  const rotateQuarterTurn =
    (sourceAspect > 1.12 && targetAspect < 0.89) || (sourceAspect < 0.89 && targetAspect > 1.12)
  const orientedAspect = rotateQuarterTurn ? 1 / sourceAspect : sourceAspect
  let width = footprintWidth
  let height = footprintDepth
  if (fit === 'contain') {
    height = width / orientedAspect
    if (height > footprintDepth) {
      height = footprintDepth
      width = height * orientedAspect
    }
  }
  return { rotateQuarterTurn, width, height }
}
