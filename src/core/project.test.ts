import { describe, expect, it } from 'vitest'
import { emptyProjectState, parseProjectFile, parseSavedProject, projectFileSlug } from './project'

describe('project persistence', () => {
  it('opens preview projects and drafts without dropping their placed roof pieces or levels', () => {
    const pieces = [
      { id: 'floor', pieceId: 'wood-floor-2x2', x: 0, y: 0, rotation: 0, level: 0 },
      {
        id: 'preview-piece',
        pieceId: 'buildable-wood-roof-ocorner-45',
        x: 3,
        y: 5,
        rotation: 22.5,
        level: 2,
        roof: { elevation: 2, kind: 'outer-corner', pitch: 45 },
      },
    ]
    const contents = JSON.stringify({ version: 1, name: 'Preview plan', pieces, activeLevel: 2 })
    for (const project of [parseProjectFile(contents), parseSavedProject(contents)]) {
      expect(project.pieces).toEqual(pieces)
      expect(project.activeLevel).toBe(2)
    }
  })

  it('rejects damaged objects before they can replace a working project', () => {
    const piece = { id: 'a', pieceId: 'wood-floor-2x2', x: 0, y: 0, rotation: 0 }
    for (const invalid of [
      null,
      {},
      { ...piece, x: '0' },
      { ...piece, x: 1e100 },
      { ...piece, pieceId: 'missing-piece' },
      { ...piece, level: 0.5 },
    ]) {
      expect(() => parseProjectFile(JSON.stringify({ version: 1, pieces: [invalid] }))).toThrow()
    }
    expect(() => parseProjectFile(JSON.stringify({ version: 1, pieces: [piece, piece] }))).toThrow(
      /duplicate/,
    )
    expect(() =>
      parseProjectFile(JSON.stringify({ version: 1, pieces: [], annotations: [{ id: 'bad', kind: 'pen' }] })),
    ).toThrow()
  })

  it('recovers usable draft items without allowing malformed geometry into the canvas', () => {
    const good = { id: 'a', pieceId: 'wood-floor-2x2', x: 0, y: 0, rotation: 0 }
    const result = parseSavedProject(
      JSON.stringify({
        pieces: [null, good, good],
        annotations: [{ id: 'bad', kind: 'pen' }],
        mapInfo: { width: 'bad' },
        activeLevel: 1e100,
      }),
    )
    expect(result.pieces).toEqual([good])
    expect(result.annotations).toEqual([])
    expect(result.activeLevel).toBe(0)
    expect(result.mapInfo).toBeUndefined()
  })

  it('rejects expired blob links and remote URLs in project map data', () => {
    for (const mapImage of ['blob:http://localhost/expired', 'https://example.com/map.png']) {
      expect(() => parseProjectFile(JSON.stringify({ version: 1, pieces: [], mapImage }))).toThrow(
        /embedded map/,
      )
    }
  })
  it('returns a fresh default for missing or malformed drafts', () => {
    expect(parseSavedProject(null)).toEqual(emptyProjectState())
    expect(parseSavedProject('{bad json')).toEqual(emptyProjectState())
    expect(parseSavedProject(null).pieces).not.toBe(parseSavedProject(null).pieces)
  })

  it('restores supported fields and filters invalid level modes', () => {
    const saved = parseSavedProject(
      JSON.stringify({
        name: 'Tower',
        seed: 'abc',
        pieces: [{ id: 'piece', pieceId: 'wood-floor-2x2', x: 0, y: 0, rotation: 0 }],
        annotations: [],
        activeLevel: 2,
        levelViewModes: { 0: 'actual', 1: 'invalid', 2: 'hidden' },
        localMapId: 'saved-map',
        mapImageName: 'Map_abc Large.png',
        mapInfo: { width: 8192, height: 8192, metersPerPixel: 2.9296875, resolution: 'high' },
      }),
    )

    expect(saved).toMatchObject({ name: 'Tower', seed: 'abc', activeLevel: 2 })
    expect(saved.levelViewModes).toEqual({ 0: 'actual', 2: 'hidden' })
    expect(saved).toMatchObject({ localMapId: 'saved-map', mapImageName: 'Map_abc Large.png' })
  })

  it('restores cultivated ground and migrates old circular areas to rounded boxes', () => {
    const annotations = [
      {
        id: 'cultivated',
        kind: 'farm' as const,
        mode: 'cultivator' as const,
        points: [{ x: 1, y: 2 }],
        radius: 3,
      },
      { id: 'field', kind: 'farm' as const, mode: 'circle' as const, x: 20, y: 30, radius: 8 },
    ]

    const saved = parseSavedProject(JSON.stringify({ annotations }))
    expect(saved.annotations[0]).toEqual(annotations[0])
    expect(saved.annotations[1]).toEqual({
      id: 'field',
      kind: 'farm',
      mode: 'area',
      x: 20,
      y: 30,
      width: 16,
      height: 16,
      cornerRadius: 3,
      level: undefined,
    })
  })

  it('rejects unsupported project files', () => {
    expect(() => parseProjectFile('{"version":2,"pieces":[]}')).toThrow('Unsupported Hearthwright project')
    expect(() => parseProjectFile('{"version":1}')).toThrow('Unsupported Hearthwright project')
  })

  it('creates filesystem-friendly project names', () => {
    expect(projectFileSlug(' Black Forest Keep! ')).toBe('black-forest-keep')
    expect(projectFileSlug('---')).toBe('valheim-plan')
  })
})
