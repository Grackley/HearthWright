import { describe, expect, it } from 'vitest'
import type { PlacedPiece } from '../types'
import {
  createRenderChunkGroupIndex,
  createRenderChunkIndex,
  RENDER_CHUNK_METERS,
  RENDER_GROUP_CHUNKS,
  renderChunkCoordinatesForPiece,
  renderGroupIntersectsBox,
  renderGroupIdleDelayRemaining,
  renderGroupKeyForChunk,
  shouldDeferRenderGroup,
  shouldRenderPiecesAtNativeDetail,
} from './renderChunks'

const floor = (id: string, x: number, y: number): PlacedPiece => ({
  id,
  pieceId: 'wood-floor-2x2',
  x,
  y,
  rotation: 0,
  level: 0,
})

describe('world-space render chunks', () => {
  it('switches to native pieces only above the cache native resolution', () => {
    expect(shouldRenderPiecesAtNativeDetail(11.99, 1, 12)).toBe(false)
    expect(shouldRenderPiecesAtNativeDetail(12, 1, 12)).toBe(false)
    expect(shouldRenderPiecesAtNativeDetail(12.01, 1, 12)).toBe(true)
    expect(shouldRenderPiecesAtNativeDetail(6, 2, 12)).toBe(false)
    expect(shouldRenderPiecesAtNativeDetail(6.01, 2, 12)).toBe(true)
    expect(shouldRenderPiecesAtNativeDetail(90, 1, 12)).toBe(true)
  })

  it('defers group promotion for the remaining idle window', () => {
    expect(renderGroupIdleDelayRemaining(1_000, 1_050, 180)).toBe(130)
    expect(renderGroupIdleDelayRemaining(1_000, 1_180, 180)).toBe(0)
    expect(renderGroupIdleDelayRemaining(1_000, 1_500, 180)).toBe(0)
  })

  it('does not extend the delay when clocks provide a negative elapsed interval', () => {
    expect(renderGroupIdleDelayRemaining(1_100, 1_000, 180)).toBe(180)
  })

  it('maps positive and negative chunks to stable render-group keys', () => {
    expect(renderGroupKeyForChunk(RENDER_GROUP_CHUNKS - 1, 0)).toBe('0:0')
    expect(renderGroupKeyForChunk(RENDER_GROUP_CHUNKS, 0)).toBe('1:0')
    expect(renderGroupKeyForChunk(-1, -1)).toBe('-1:-1')
    expect(renderGroupKeyForChunk(-RENDER_GROUP_CHUNKS - 1, 0)).toBe('-2:0')
  })

  it('keeps an edited render group hot throughout its cooldown even offscreen', () => {
    expect(
      shouldDeferRenderGroup({ x: 0, y: 0 }, 1_000, 30_999, 30_000, {
        left: 1_000,
        right: 1_100,
        top: 1_000,
        bottom: 1_100,
      }),
    ).toBe(true)
  })

  it('keeps an edited render group hot while the work area remains nearby', () => {
    const groupMeters = RENDER_CHUNK_METERS * RENDER_GROUP_CHUNKS
    expect(renderGroupIntersectsBox({ x: -1, y: 0 }, { left: 1, right: 20, top: 1, bottom: 20 }, 2)).toBe(
      true,
    )
    expect(
      shouldDeferRenderGroup(
        { x: 0, y: 0 },
        1_000,
        100_000,
        30_000,
        { left: groupMeters + 1, right: groupMeters + 20, top: 1, bottom: 20 },
        2,
      ),
    ).toBe(true)
  })

  it('allows regrouping only after both cooling down and moving away', () => {
    expect(
      shouldDeferRenderGroup({ x: 0, y: 0 }, 1_000, 31_000, 30_000, {
        left: 1_000,
        right: 1_100,
        top: 1_000,
        bottom: 1_100,
      }),
    ).toBe(false)
    expect(
      shouldDeferRenderGroup({ x: 0, y: 0 }, undefined, 1_000, 30_000, {
        left: 1,
        right: 20,
        top: 1,
        bottom: 20,
      }),
    ).toBe(false)
  })

  it('includes a piece crossing a four-way boundary in every touched chunk', () => {
    const keys = renderChunkCoordinatesForPiece(
      floor('crossing', RENDER_CHUNK_METERS, RENDER_CHUNK_METERS),
    ).map(({ key }) => key)
    expect(keys).toEqual(['0:0', '0:1', '1:0', '1:1'])
  })

  it('handles negative-world boundaries without losing either side', () => {
    const keys = renderChunkCoordinatesForPiece(floor('negative', 0, 0)).map(({ key }) => key)
    expect(keys).toEqual(['-1:-1', '-1:0', '0:-1', '0:0'])
  })

  it('retains source order independently in every crossed chunk', () => {
    const pieces = [
      floor('first', RENDER_CHUNK_METERS, RENDER_CHUNK_METERS),
      floor('second', RENDER_CHUNK_METERS + 0.5, RENDER_CHUNK_METERS + 0.5),
    ]
    const index = createRenderChunkIndex(pieces)
    expect(index.chunks.get('0:0')?.pieces.map(({ id }) => id)).toEqual(['first', 'second'])
    expect(index.chunks.get('1:1')?.pieces.map(({ id }) => id)).toEqual(['first', 'second'])
  })

  it('keeps signatures stable when immutable project objects are recreated', () => {
    const original = [floor('same', 12.5, -8.25)]
    const recreated = original.map((piece) => ({ ...piece }))
    expect(createRenderChunkIndex(original).chunks.get('0:-1')?.signature).toBe(
      createRenderChunkIndex(recreated).chunks.get('0:-1')?.signature,
    )
  })

  it('invalidates a crossed chunk when rotation or level changes', () => {
    const wall: PlacedPiece = {
      id: 'wall',
      pieceId: 'wood-wall-2x2',
      x: RENDER_CHUNK_METERS,
      y: 10,
      rotation: 0,
      level: 0,
    }
    const original = createRenderChunkIndex([wall]).chunks.get('0:0')?.signature
    const rotated = createRenderChunkIndex([{ ...wall, rotation: 90 }]).chunks.get('0:0')?.signature
    const raised = createRenderChunkIndex([{ ...wall, level: 1 }]).chunks.get('0:0')?.signature
    expect(rotated).not.toBe(original)
    expect(raised).not.toBe(original)
  })

  it('changes both old and new chunk signatures when a piece crosses a boundary', () => {
    const before = createRenderChunkIndex([
      floor('moving', RENDER_CHUNK_METERS - 1, 10),
      floor('stationary', 10, 10),
    ])
    const after = createRenderChunkIndex([
      floor('moving', RENDER_CHUNK_METERS * 2 + 1, 10),
      floor('stationary', 10, 10),
    ])
    expect(before.chunks.get('0:0')?.signature).not.toBe(after.chunks.get('0:0')?.signature)
    expect(after.chunks.has('2:0')).toBe(true)
    expect(before.chunks.has('2:0')).toBe(false)
  })

  it('queries occupied chunks without iterating an entire world-sized grid', () => {
    const index = createRenderChunkIndex([floor('near', 4, 4), floor('far', 10_000, 10_000)])
    expect([
      ...new Set(
        index
          .query({ left: -12_000, right: 12_000, top: -12_000, bottom: 12_000 })
          .flatMap(({ pieces }) => pieces.map(({ id }) => id)),
      ),
    ]).toEqual(['near', 'far'])
  })

  it('groups negative and positive chunks without merging across world zero', () => {
    const chunks = createRenderChunkIndex([floor('negative', -2, -2), floor('positive', 2, 2)])
    const groups = createRenderChunkGroupIndex(chunks)
    expect(
      groups.groups.get('-1:-1')?.chunks.some(({ pieces }) => pieces.some(({ id }) => id === 'negative')),
    ).toBe(true)
    expect(
      groups.groups.get('0:0')?.chunks.some(({ pieces }) => pieces.some(({ id }) => id === 'positive')),
    ).toBe(true)
  })

  it('represents an exact four-way world boundary in four distinct render groups', () => {
    const groups = createRenderChunkGroupIndex(createRenderChunkIndex([floor('origin', 0, 0)]))
    expect([...groups.groups.keys()].sort()).toEqual(['-1:-1', '-1:0', '0:-1', '0:0'])
  })

  it('keeps both sides of an exact render-group boundary', () => {
    const groupBoundary = RENDER_CHUNK_METERS * RENDER_GROUP_CHUNKS
    const groups = createRenderChunkGroupIndex(
      createRenderChunkIndex([floor('group-crossing', groupBoundary, 10)]),
    )
    expect([...groups.groups.keys()].sort()).toEqual(['0:0', '1:0'])
  })

  it('removes an emptied chunk and group instead of retaining a ghost entry', () => {
    const before = createRenderChunkGroupIndex(createRenderChunkIndex([floor('removed', 10, 10)]))
    const after = createRenderChunkGroupIndex(createRenderChunkIndex([]))
    expect(before.groups.has('0:0')).toBe(true)
    expect(after.groups.has('0:0')).toBe(false)
    expect(after.query({ left: -1_000, right: 1_000, top: -1_000, bottom: 1_000 })).toEqual([])
  })

  it('invalidates every group touched by an edited four-way boundary piece', () => {
    const before = createRenderChunkGroupIndex(createRenderChunkIndex([floor('boundary-edit', 0, 0)]))
    const after = createRenderChunkGroupIndex(createRenderChunkIndex([floor('boundary-edit', 0.5, 0.5)]))
    const changed = [...before.groups.keys()].filter(
      (key) => before.groups.get(key)?.signature !== after.groups.get(key)?.signature,
    )
    expect(changed.sort()).toEqual(['-1:-1', '-1:0', '0:-1', '0:0'])
  })

  it('invalidates only the render group containing an edited chunk', () => {
    const before = createRenderChunkGroupIndex(
      createRenderChunkIndex([
        floor('edited', 10, 10),
        floor('other-group', RENDER_CHUNK_METERS * (RENDER_GROUP_CHUNKS + 1), 10),
      ]),
    )
    const after = createRenderChunkGroupIndex(
      createRenderChunkIndex([
        floor('edited', 12, 10),
        floor('other-group', RENDER_CHUNK_METERS * (RENDER_GROUP_CHUNKS + 1), 10),
      ]),
    )
    expect(before.groups.get('0:0')?.signature).not.toBe(after.groups.get('0:0')?.signature)
    expect(before.groups.get('1:0')?.signature).toBe(after.groups.get('1:0')?.signature)
  })
})
