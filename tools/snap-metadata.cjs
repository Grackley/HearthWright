const PRECISION = 10_000
const roundCoordinate = (value) => Math.round(value * PRECISION) / PRECISION

const projectionCenter = (snapPoints, axis, fallback) => {
  const coordinates = snapPoints.map((point) => Number(point?.[axis])).filter(Number.isFinite)
  if (!coordinates.length) return fallback
  const minimum = Math.min(...coordinates)
  const maximum = Math.max(...coordinates)
  return maximum - minimum > 0.01 ? (minimum + maximum) / 2 : fallback
}

const axisBounds = (sources, axis) => {
  const values = sources.map((point) => Number(point?.[axis])).filter(Number.isFinite)
  return values.length
    ? { minimum: Math.min(...values), maximum: Math.max(...values) }
    : { minimum: 0, maximum: 0 }
}

const projectSnapPoints = (snapPoints, visualBounds = {}, centerLine = false) => {
  const sources = Array.isArray(snapPoints) ? snapPoints : []
  // Renderer bounds sometimes include effects far outside the actual mesh. Use the
  // snap layout itself to center an axis whenever it spans both sides of a piece.
  let centerX = projectionCenter(sources, 'x', Number(visualBounds.centerX) || 0)
  let centerZ = projectionCenter(sources, 'z', Number(visualBounds.centerZ) || 0)
  if (centerLine && sources.length > 1) {
    const x = axisBounds(sources, 'x')
    const z = axisBounds(sources, 'z')
    const xSpan = x.maximum - x.minimum
    const zSpan = z.maximum - z.minimum
    if (xSpan > 0.01 && zSpan <= 0.01) centerZ = (z.minimum + z.maximum) / 2
    else if (zSpan > 0.01 && xSpan <= 0.01) centerX = (x.minimum + x.maximum) / 2
  }
  const projected = []
  for (const source of sources) {
    const x = Number(source?.x) - centerX
    const y = Number(source?.z) - centerZ
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue
    const point = { x: roundCoordinate(x), y: roundCoordinate(y) }
    if (projected.some((candidate) => candidate.x === point.x && candidate.y === point.y)) continue
    projected.push(point)
  }
  return projected
}

const projectPrefabOrigin = (visualBounds = {}) => ({
  x: roundCoordinate(-(Number(visualBounds.centerX) || 0)),
  y: roundCoordinate(-(Number(visualBounds.centerZ) || 0)),
})

const projectPrefabPoint = (point = {}, visualBounds = {}) => {
  const origin = projectPrefabOrigin(visualBounds)
  return {
    x: roundCoordinate((Number(point.x) || 0) + origin.x),
    y: roundCoordinate((Number(point.z) || 0) + origin.y),
  }
}

const selectRangeProjectionBounds = (visualBounds = {}, geometryBounds = {}) =>
  geometryBounds?.available ? geometryBounds : visualBounds

module.exports = {
  projectPrefabOrigin,
  projectPrefabPoint,
  projectSnapPoints,
  selectRangeProjectionBounds,
}
