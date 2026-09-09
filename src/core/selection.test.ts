import { describe, expect, it } from 'vitest'
import {
  annotationBounds,
  annotationsIntersectingBox,
  duplicateAnnotations,
  duplicateLayout,
  pointInAnnotation,
  pieceIntersectsBox,
  piecesIntersectingBox,
} from './selection'

describe('multi-selection and clipboard layouts', () => {
  const pieces = [
    { id: 'a', pieceId: 'wood-floor-2x2', x: 0, y: 0, rotation: 0, level: 0 },
    { id: 'b', pieceId: 'wood-floor-2x2', x: 4, y: 0, rotation: 90, level: 0 },
    { id: 'c', pieceId: 'wood-floor-2x2', x: 0, y: 0, rotation: 0, level: 1 },
  ]

  it('box-selects intersecting pieces on only the active level', () => {
    expect(piecesIntersectingBox(pieces, { x: -2, y: -2 }, { x: 5, y: 2 }, 0)).toEqual(['a', 'b'])
  })

  it('uses the visible oriented footprint instead of an enclosing selection circle', () => {
    const wall = { id: 'wall', pieceId: 'wood-wall-2x2', x: 0, y: 0, rotation: 0, level: 0 }
    expect(pieceIntersectsBox(wall, { left: -0.2, right: 0.2, top: 0.4, bottom: 0.6 })).toBe(false)
    expect(pieceIntersectsBox(wall, { left: -0.2, right: 0.2, top: -0.04, bottom: 0.04 })).toBe(true)
    expect(
      pieceIntersectsBox({ ...wall, rotation: 90 }, { left: 0.4, right: 0.6, top: -0.2, bottom: 0.2 }),
    ).toBe(false)
  })

  it('duplicates a selection without changing its internal layout', () => {
    let nextId = 0
    const copies = duplicateLayout(pieces.slice(0, 2), { x: 1, y: 1 }, () => `copy-${nextId++}`)
    expect(copies.map(({ x, y, rotation, level }) => ({ x, y, rotation, level }))).toEqual([
      { x: 1, y: 1, rotation: 0, level: 0 },
      { x: 5, y: 1, rotation: 90, level: 0 },
    ])
  })

  it('hit-tests text and pen annotations and box-selects both', () => {
    const annotations = [
      { id: 'text', kind: 'text' as const, x: 2, y: 3, text: 'Note', color: '#fff', size: 0.5, level: 0 },
      {
        id: 'pen',
        kind: 'pen' as const,
        points: [
          { x: 5, y: 5 },
          { x: 7, y: 5 },
        ],
        color: '#fff',
        width: 0.2,
        level: 0,
      },
    ]
    expect(pointInAnnotation({ x: 2.7, y: 2.8 }, annotations[0], 0.1)).toBe(true)
    expect(pointInAnnotation({ x: 6, y: 5.08 }, annotations[1], 0.02)).toBe(true)
    expect(annotationsIntersectingBox(annotations, { x: 1, y: 2 }, { x: 8, y: 6 }, 0)).toEqual([
      'text',
      'pen',
    ])
  })

  it('hit-tests and box-selects both farming footprint modes', () => {
    const annotations = [
      {
        id: 'cultivator',
        kind: 'farm' as const,
        mode: 'cultivator' as const,
        points: [
          { x: 0, y: 0 },
          { x: 4, y: 0 },
        ],
        radius: 3,
        level: 0,
      },
      {
        id: 'farm-area',
        kind: 'farm' as const,
        mode: 'area' as const,
        x: 20,
        y: 20,
        width: 10,
        height: 10,
        cornerRadius: 3,
        level: 0,
      },
    ]

    expect(annotationBounds(annotations[0])).toEqual({ left: -3, right: 7, top: -3, bottom: 3 })
    expect(annotationBounds(annotations[1])).toEqual({ left: 15, right: 25, top: 15, bottom: 25 })
    expect(pointInAnnotation({ x: 2, y: 2.9 }, annotations[0])).toBe(true)
    expect(pointInAnnotation({ x: 2, y: 3.1 }, annotations[0])).toBe(false)
    expect(pointInAnnotation({ x: 23, y: 24 }, annotations[1])).toBe(true)
    expect(pointInAnnotation({ x: 24.5, y: 24.5 }, annotations[1])).toBe(false)
    expect(annotationsIntersectingBox(annotations, { x: -4, y: -4 }, { x: 26, y: 26 }, 0)).toEqual([
      'cultivator',
      'farm-area',
    ])
  })

  it('keeps cultivator erase operations out of selection', () => {
    const eraser = {
      id: 'erase',
      kind: 'farm' as const,
      mode: 'cultivator' as const,
      action: 'erase' as const,
      points: [{ x: 0, y: 0 }],
      radius: 3,
      level: 0,
    }
    expect(pointInAnnotation({ x: 0, y: 0 }, eraser)).toBe(false)
    expect(annotationsIntersectingBox([eraser], { x: -4, y: -4 }, { x: 4, y: 4 }, 0)).toEqual([])
  })

  it('duplicates annotations while retaining their layout', () => {
    let nextId = 0
    const copies = duplicateAnnotations(
      [
        { id: 'text', kind: 'text', x: 1, y: 2, text: 'A', color: '#fff', size: 0.5 },
        {
          id: 'pen',
          kind: 'pen',
          points: [
            { x: 3, y: 4 },
            { x: 5, y: 6 },
          ],
          color: '#fff',
          width: 0.2,
        },
      ],
      { x: 2, y: -1 },
      () => `copy-${nextId++}`,
    )
    expect(copies[0]).toMatchObject({ id: 'copy-0', x: 3, y: 1 })
    expect(copies[1]).toMatchObject({
      id: 'copy-1',
      points: [
        { x: 5, y: 3 },
        { x: 7, y: 5 },
      ],
    })
  })

  it('duplicates farming footprints without changing their size or shape', () => {
    let nextId = 0
    const copies = duplicateAnnotations(
      [
        {
          id: 'cultivator',
          kind: 'farm',
          mode: 'cultivator',
          points: [
            { x: 1, y: 2 },
            { x: 3, y: 4 },
          ],
          radius: 3,
        },
        {
          id: 'area',
          kind: 'farm',
          mode: 'area',
          x: 10,
          y: 12,
          width: 16,
          height: 10,
          cornerRadius: 3,
        },
      ],
      { x: -2, y: 5 },
      () => `farm-copy-${nextId++}`,
    )

    expect(copies[0]).toMatchObject({
      id: 'farm-copy-0',
      radius: 3,
      points: [
        { x: -1, y: 7 },
        { x: 1, y: 9 },
      ],
    })
    expect(copies[1]).toMatchObject({
      id: 'farm-copy-1',
      x: 8,
      y: 17,
      width: 16,
      height: 10,
      cornerRadius: 3,
    })
  })
})
