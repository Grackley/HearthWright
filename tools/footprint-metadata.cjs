const measuredFootprint = (piece, bounds, spriteBounds) => {
  if (!bounds?.available || bounds.width <= 0 || bounds.depth <= 0) return undefined
  const frameSpan = Math.max(bounds.width, bounds.depth)
  const visibleWidth = Math.min(bounds.width, (Math.max(1, spriteBounds.width - 4) / 512) * frameSpan * 1.1)
  const visibleDepth = Math.min(bounds.depth, (Math.max(1, spriteBounds.height - 4) / 512) * frameSpan * 1.1)
  const round = (value) => Math.max(0.1, Math.round(value * 10) / 10)
  if (piece.shape === 'circle') {
    const diameter = round(Math.max(visibleWidth, visibleDepth))
    return { width: diameter, depth: diameter }
  }

  let width = round(visibleWidth)
  let depth = round(visibleDepth)
  if (piece.width > piece.depth && width < depth) [width, depth] = [depth, width]
  else if (piece.width < piece.depth && width > depth) [width, depth] = [depth, width]
  return { width, depth }
}

module.exports = { measuredFootprint }
