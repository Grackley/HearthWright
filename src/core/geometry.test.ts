import { describe, expect, it } from 'vitest'
import { findMoveSnap, findSnap, pointInPiece, rotatePoint, worldSnapPoints } from './geometry'
import { pieceById } from '../data/pieces'
import { createRenderChunkGroupIndex, createRenderChunkIndex } from './renderChunks'
import { createPieceSpatialIndex } from './spatialIndex'

describe('planner geometry', () => {
  it('finds the same closest anchors as a full search across negative cells and rotated groups', () => {
    const targets = Array.from({ length: 70 }, (_, i) => ({
      id: `target-${i}`,
      pieceId: 'wood-floor-2x2',
      x: ((i % 10) - 5) * 2.1,
      y: (Math.floor(i / 10) - 3) * 2,
      rotation: (i % 4) * 45,
    }))
    for (const delta of [0.03, 0.28, 0.79, 1.81]) {
      const moving = targets
        .slice(0, 20)
        .map((piece) => ({ ...piece, id: `moving-${piece.id}`, x: piece.x + delta, y: piece.y - 0.08 }))
      const sources = moving.flatMap((piece) => worldSnapPoints(piece))
      const anchors = targets.flatMap((piece) => worldSnapPoints(piece))
      let distance = 0.8
      let offset: { offsetX: number; offsetY: number; snapped: boolean } = {
        offsetX: 0,
        offsetY: 0,
        snapped: false,
      }
      for (const source of sources)
        for (const anchor of anchors) {
          const candidate = Math.hypot(anchor.x - source.x, anchor.y - source.y)
          if (candidate < distance) {
            distance = candidate
            offset = { offsetX: anchor.x - source.x, offsetY: anchor.y - source.y, snapped: true }
          }
        }
      const result = findMoveSnap(moving, [...targets, ...moving], 0.8)
      expect(result.snapped).toBe(offset.snapped)
      expect(result.offsetX).toBeCloseTo(offset.offsetX)
      expect(result.offsetY).toBeCloseTo(offset.offsetY)
    }
  })

  it('preserves target order when equal-distance anchors lie in different hash cells', () => {
    const extracted = { 'wood-floor-2x2': [{ x: 0, y: 0 }] }
    const source = { id: 'source', pieceId: 'wood-floor-2x2', x: 0, y: 0, rotation: 0 }
    const right = { ...source, id: 'right', x: 0.5 }
    const left = { ...source, id: 'left', x: -0.5 }
    expect(findMoveSnap([source], [right, left], 1, extracted).offsetX).toBe(0.5)
    expect(findMoveSnap([source], [left, right], 1, extracted).offsetX).toBe(-0.5)
  })

  it('rotates points around the piece center', () => {
    const result = rotatePoint({ x: 2, y: 0 }, 90)
    expect(result.x).toBeCloseTo(0)
    expect(result.y).toBeCloseTo(2)
  })

  it('exposes only the definition snap points', () => {
    const points = worldSnapPoints({ id: 'a', pieceId: 'wood-wall-2x2', x: 5, y: 4, rotation: 0 })
    expect(points).toHaveLength(3)
    expect(points).toContainEqual({ x: 4, y: 4 })
    expect(points).toContainEqual({ x: 6, y: 4 })
  })

  it('uses extracted Wood Door corners and end centers instead of generic anchors', () => {
    const extracted = {
      'wood-door-1m': [
        { x: 1, y: 0 },
        { x: -1, y: 0 },
        { x: 1, y: 0.264 },
        { x: -1, y: 0.264 },
        { x: 1, y: -0.264 },
        { x: -1, y: -0.264 },
      ],
    }
    const points = worldSnapPoints(
      { id: 'door', pieceId: 'wood-door-1m', x: 5, y: 4, rotation: 0 },
      extracted,
    )

    expect(points).toHaveLength(6)
    expect(
      points
        .map((point) => ({ x: Number(point.x.toFixed(3)), y: Number(point.y.toFixed(3)) }))
        .sort((left, right) => left.x - right.x || left.y - right.y),
    ).toEqual([
      { x: 4, y: 3.736 },
      { x: 4, y: 4 },
      { x: 4, y: 4.264 },
      { x: 6, y: 3.736 },
      { x: 6, y: 4 },
      { x: 6, y: 4.264 },
    ])
  })

  it('keeps different extracted door layouts independent, including a verified empty set', () => {
    const extracted = {
      'ashwood-door': [
        { x: -2, y: 0 },
        { x: 0, y: 0 },
      ],
      'hexagonal-gate': [{ x: 0, y: 0 }],
      'wood-wall-2x2': [],
    }

    expect(
      worldSnapPoints({ id: 'ash', pieceId: 'ashwood-door', x: 0, y: 0, rotation: 0 }, extracted),
    ).toEqual([
      { x: -2, y: 0 },
      { x: 0, y: 0 },
    ])
    expect(
      worldSnapPoints({ id: 'hex', pieceId: 'hexagonal-gate', x: 0, y: 0, rotation: 0 }, extracted),
    ).toEqual([{ x: 0, y: 0 }])
    expect(
      worldSnapPoints({ id: 'wall', pieceId: 'wood-wall-2x2', x: 0, y: 0, rotation: 0 }, extracted),
    ).toEqual([])
  })

  it('aligns a new floor corner with an existing compatible point', () => {
    const placed = [{ id: 'a', pieceId: 'wood-floor-2x2', x: 0, y: 0, rotation: 0 }]
    const result = findSnap({ x: 2.08, y: 0 }, pieceById('wood-floor-2x2'), 0, placed, 0.2)
    expect(result.snapped).toBe(true)
    expect(result.x).toBeCloseTo(2)
    expect(result.y).toBeCloseTo(0)
  })

  it('joins one- and two-meter Wood Beams and Walls on one continuous centerline', () => {
    const extracted = {
      'buildable-wood-beam-1': [
        { x: -0.5, y: 0 },
        { x: 0.5, y: 0 },
      ],
      'buildable-wood-beam': [
        { x: -1, y: 0 },
        { x: 1, y: 0 },
      ],
      'wood-wall-1x1': [
        { x: -0.5, y: 0 },
        { x: 0.5, y: 0 },
      ],
      'wood-wall-2x2': [
        { x: -1, y: 0 },
        { x: 1, y: 0 },
      ],
    }

    const beam = findSnap(
      { x: 1.54, y: 0.03 },
      pieceById('buildable-wood-beam-1'),
      0,
      [{ id: 'beam', pieceId: 'buildable-wood-beam', x: 0, y: 0, rotation: 0 }],
      0.1,
      extracted,
    )
    const wall = findSnap(
      { x: 1.54, y: -0.03 },
      pieceById('wood-wall-1x1'),
      0,
      [{ id: 'wall', pieceId: 'wood-wall-2x2', x: 0, y: 0, rotation: 0 }],
      0.1,
      extracted,
    )

    expect(beam).toMatchObject({ snapped: true, x: expect.closeTo(1.5), y: expect.closeTo(0) })
    expect(wall).toMatchObject({ snapped: true, x: expect.closeTo(1.5), y: expect.closeTo(0) })
  })

  it('keeps a cache-grouped wall available as a placement snap target', () => {
    const placed = [{ id: 'grouped', pieceId: 'wood-wall-2x2', x: 0, y: 0, rotation: 0, level: 0 }]
    createRenderChunkGroupIndex(createRenderChunkIndex(placed))
    const candidates = createPieceSpatialIndex(placed).query({ left: -4, right: 4, top: -4, bottom: 4 })
    const result = findSnap({ x: 2.08, y: 0 }, pieceById('wood-wall-2x2'), 0, candidates, 0.2)
    expect(result.snapped).toBe(true)
    expect(result.x).toBeCloseTo(2)
    expect(result.y).toBeCloseTo(0)
  })

  it('snaps a moved wall back to a grouped wall without snapping to itself', () => {
    const grouped = { id: 'grouped', pieceId: 'wood-wall-2x2', x: 0, y: 0, rotation: 0, level: 0 }
    const moving = { id: 'moving', pieceId: 'wood-wall-2x2', x: 2.08, y: 0, rotation: 0, level: 0 }
    createRenderChunkGroupIndex(createRenderChunkIndex([grouped, moving]))
    const result = findMoveSnap([moving], [grouped, moving], 0.2)
    expect(result.snapped).toBe(true)
    expect(result.offsetX).toBeCloseTo(-0.08)
    expect(result.offsetY).toBeCloseTo(0)
  })

  it('does not let a moved piece snap to its own prior indexed entry', () => {
    const moving = { id: 'moving', pieceId: 'wood-wall-2x2', x: 2.08, y: 0, rotation: 0, level: 0 }
    expect(findMoveSnap([moving], [moving], 2)).toEqual({ offsetX: 0, offsetY: 0, snapped: false })
  })

  it('does not snap a moved piece outside the screen-derived threshold', () => {
    const target = { id: 'target', pieceId: 'wood-wall-2x2', x: 0, y: 0, rotation: 0, level: 0 }
    const moving = { id: 'moving', pieceId: 'wood-wall-2x2', x: 2.21, y: 0, rotation: 0, level: 0 }
    expect(findMoveSnap([moving], [target], 0.2).snapped).toBe(false)
  })

  it('applies one snap offset to a multi-piece selection', () => {
    const target = { id: 'target', pieceId: 'wood-wall-2x2', x: 0, y: 0, rotation: 0, level: 0 }
    const moving = [
      { id: 'first', pieceId: 'wood-wall-2x2', x: 2.08, y: 0, rotation: 0, level: 0 },
      { id: 'second', pieceId: 'wood-wall-2x2', x: 4.08, y: 0, rotation: 0, level: 0 },
    ]
    const result = findMoveSnap(moving, [target, ...moving], 0.2)
    expect(result).toMatchObject({
      snapped: true,
      offsetX: expect.closeTo(-0.08),
      offsetY: expect.closeTo(0),
    })
  })

  it('hit-tests rotated rectangles', () => {
    const placed = { id: 'a', pieceId: 'bed', x: 0, y: 0, rotation: 90 }
    expect(pointInPiece({ x: 0.4, y: 0.8 }, placed)).toBe(true)
    expect(pointInPiece({ x: 1.2, y: 0 }, placed)).toBe(false)
  })

  it('does not give thin walls a large invisible click target', () => {
    const wall = { id: 'wall', pieceId: 'wood-wall-2x2', x: 0, y: 0, rotation: 0 }
    expect(pointInPiece({ x: 0, y: 0.19 }, wall)).toBe(true)
    expect(pointInPiece({ x: 0, y: 0.25 }, wall)).toBe(false)
  })
})
