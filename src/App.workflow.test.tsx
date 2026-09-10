import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { forwardRef, useImperativeHandle, type ComponentProps } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import type PlannerCanvas from './components/PlannerCanvas'
import { WALKTHROUGH_KEY } from './components/Walkthrough'
import { PROJECT_STORAGE_KEY } from './core/project'
import { CATEGORIES } from './data/pieces'

vi.mock('./hooks/usePieceSprites', () => ({
  usePieceSprites: () => ({
    sprites: {},
    preCroppedSprites: {},
    snapPoints: {},
    resources: {},
    craftingStations: {},
    comfort: {},
    ranges: {},
  }),
}))
vi.mock('./components/PlannerCanvas', () => ({
  default: forwardRef(function TestCanvas(props: ComponentProps<typeof PlannerCanvas>, ref) {
    useImperativeHandle(ref, () => ({ showWorld: vi.fn(), focusAt: vi.fn() }))
    return (
      <div>
        <div aria-label="Placed IDs">{props.pieces.map((piece) => piece.id).join(',')}</div>
        <div aria-label="Map width">{props.worldWidth}</div>
        <div aria-label="Level layout">
          {JSON.stringify({
            pieces: props.pieces,
            annotations: props.annotations,
            activeLevel: props.activeLevel,
            levelViewModes: props.levelViewModes,
          })}
        </div>
        <button onClick={() => props.onSelect(props.pieces.map((piece) => piece.id))}>
          Select test pieces
        </button>
        <button
          onClick={() => props.onPlace({ id: 'added', pieceId: 'wood-floor-2x2', x: 2, y: 0, rotation: 0 })}
        >
          Place test floor
        </button>
      </div>
    )
  }),
}))

const incoming = {
  version: 1,
  name: 'Other hall',
  seed: '',
  pieces: [{ id: 'incoming', pieceId: 'wood-floor-2x2', x: 8, y: 0, rotation: 0 }],
}
const original = { ...incoming, name: 'My hall', pieces: [{ ...incoming.pieces[0], id: 'original' }] }
const open = vi.fn<NonNullable<Window['hearthwrightProjects']>['open']>()
const save = vi.fn<NonNullable<Window['hearthwrightProjects']>['save']>()

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem(WALKTHROUGH_KEY, 'seen')
  localStorage.setItem(PROJECT_STORAGE_KEY, JSON.stringify(original))
  window.hearthwrightProjects = { open, save }
  open.mockResolvedValue({
    canceled: false,
    contents: JSON.stringify(incoming),
    fileName: 'other.hearthwright',
    filePath: 'C:\\Plans\\other.hearthwright',
  })
  save.mockResolvedValue({ canceled: true })
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      disconnect() {}
    },
  )
  HTMLElement.prototype.scrollIntoView = vi.fn()
})
afterEach(() => {
  cleanup()
  delete window.hearthwrightProjects
  delete window.valheimMaps
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

async function renderReady() {
  render(<App />)
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
}
const placedIds = () => screen.getByLabelText('Placed IDs').textContent
const levelLayout = () => JSON.parse(screen.getByLabelText('Level layout').textContent!)

describe('map calibration upgrade', () => {
  const map = {
    id: 'test-map',
    seed: 'test',
    imageName: 'Map_test.png',
    imageWidth: 8192,
    imageHeight: 8192,
    metersPerPixel: 3,
    resolution: 'high' as const,
  }
  beforeEach(() => {
    vi.stubGlobal(
      'URL',
      class extends URL {
        static createObjectURL = vi.fn(() => 'blob:test-map')
        static revokeObjectURL = vi.fn()
      },
    )
    window.valheimMaps = {
      list: vi.fn().mockResolvedValue([map]),
      load: vi.fn().mockResolvedValue({ ...map, imageBytes: new Uint8Array([137, 80, 78, 71]) }),
      import: vi.fn().mockResolvedValue(map),
      remember: vi.fn().mockResolvedValue(map),
    }
  })

  it('uses the corrected scale for a newly attached map', async () => {
    localStorage.removeItem(PROJECT_STORAGE_KEY)
    await renderReady()
    fireEvent.change(await screen.findByLabelText('Maps folder'), { target: { value: map.id } })
    await screen.findByText(/3.000000 m\/px · 24.576 km map/)
    expect(screen.getByLabelText('Map width').textContent).toBe('24576')
  })

  it('retains a legacy draft, corrects only its background, saves and reopens the choice', async () => {
    const annotations = [
      { id: 'note', kind: 'text', text: 'Keep this here', x: 10, y: 20, size: 1, color: '#fff' },
    ]
    const legacy = {
      ...original,
      annotations,
      localMapId: map.id,
      mapImageName: map.imageName,
      mapInfo: { width: 8192, height: 8192, metersPerPixel: 2.9296875, resolution: 'high' },
    }
    localStorage.setItem(PROJECT_STORAGE_KEY, JSON.stringify(legacy))
    await renderReady()
    await screen.findByText(/2.929688 m\/px · 24 km map/)
    expect(screen.getByLabelText('Map width').textContent).toBe('24000')
    fireEvent.click(screen.getByRole('button', { name: 'Earlier map scale · review' }))
    fireEvent.click(screen.getByRole('button', { name: 'Keep current scale' }))
    expect(screen.getByLabelText('Map width').textContent).toBe('24000')
    fireEvent.click(screen.getByRole('button', { name: 'Earlier map scale · review' }))
    fireEvent.click(screen.getByRole('button', { name: 'Use corrected scale' }))
    await screen.findByText(/3.000000 m\/px · 24.576 km map/)
    expect(levelLayout()).toMatchObject({ pieces: legacy.pieces, annotations })
    save.mockResolvedValue({
      canceled: false,
      filePath: 'C:\\Plans\\corrected.hearthwright',
      fileName: 'corrected.hearthwright',
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save project' }))
    await waitFor(() => expect(save).toHaveBeenCalledTimes(1))
    const saved = JSON.parse(save.mock.calls[0][0].contents)
    expect(saved).toMatchObject({
      mapWorldWidthMeters: 24576,
      mapInfo: { metersPerPixel: 3 },
      pieces: legacy.pieces,
      annotations,
    })
    cleanup()
    localStorage.setItem(PROJECT_STORAGE_KEY, JSON.stringify(saved))
    await renderReady()
    await screen.findByText(/3.000000 m\/px · 24.576 km map/)
    fireEvent.click(screen.getByRole('button', { name: 'Map scale' }))
    fireEvent.click(screen.getByRole('button', { name: 'Restore earlier scale' }))
    expect(screen.getByLabelText('Map width').textContent).toBe('24000')
    expect(levelLayout()).toMatchObject({ pieces: legacy.pieces, annotations })
  })

  it('keeps a legacy project scale when opening its local map despite updated library metadata', async () => {
    localStorage.removeItem(PROJECT_STORAGE_KEY)
    open.mockResolvedValue({
      canceled: false,
      fileName: 'legacy.hearthwright',
      filePath: 'C:\\Plans\\legacy.hearthwright',
      contents: JSON.stringify({
        ...incoming,
        mapImageName: map.imageName,
        localMapId: map.id,
      }),
    })
    await renderReady()
    fireEvent.click(screen.getByRole('button', { name: 'Open project' }))
    await screen.findByText(/2.929688 m\/px · 24 km map/)
    expect(placedIds()).toBe('incoming')
    expect(screen.getByLabelText('Map width').textContent).toBe('24000')
  })
})

describe('level ordering', () => {
  it('inserts a new floor between occupied levels, restores it with undo/redo, and saves the result', async () => {
    const upper = { ...original.pieces[0], id: 'upper', level: 1 }
    const note = {
      id: 'note',
      kind: 'text',
      text: 'Upper hall',
      x: 2,
      y: 3,
      size: 1,
      color: '#fff',
      level: 1,
    }
    localStorage.setItem(
      PROJECT_STORAGE_KEY,
      JSON.stringify({
        ...original,
        pieces: [...original.pieces, upper],
        annotations: [note],
        activeLevel: 1,
        levelViewModes: { 0: 'hidden', 1: 'actual' },
      }),
    )
    await renderReady()
    fireEvent.click(screen.getByText('Add upper level'))
    expect(levelLayout().activeLevel).toBe(2)
    fireEvent.click(screen.getByRole('button', { name: 'Move up' }))
    expect(levelLayout()).toMatchObject({
      activeLevel: 1,
      pieces: [...original.pieces, { ...upper, level: 2 }],
      annotations: [{ ...note, level: 2 }],
      levelViewModes: { 0: 'hidden', 1: 'outline', 2: 'actual' },
    })
    fireEvent.keyDown(window, { key: 'z', ctrlKey: true })
    expect(levelLayout()).toMatchObject({
      activeLevel: 2,
      pieces: [...original.pieces, upper],
      annotations: [note],
    })
    fireEvent.keyDown(window, { key: 'y', ctrlKey: true })
    expect(levelLayout().activeLevel).toBe(1)
    save.mockResolvedValue({
      canceled: false,
      filePath: 'C:\\Plans\\ordered.hearthwright',
      fileName: 'ordered.hearthwright',
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save project' }))
    await waitFor(() => expect(save).toHaveBeenCalledTimes(1))
    const saved = JSON.parse(save.mock.calls[0][0].contents)
    expect(saved).toMatchObject(levelLayout())
    expect(saved.levelViewModes).toEqual({ 0: 'hidden', 1: 'outline', 2: 'actual' })
    cleanup()
    localStorage.setItem(PROJECT_STORAGE_KEY, JSON.stringify(saved))
    await renderReady()
    expect(levelLayout()).toMatchObject({
      activeLevel: 1,
      pieces: saved.pieces,
      annotations: saved.annotations,
      levelViewModes: saved.levelViewModes,
    })
  })

  it('undoes and redoes empty-level changes in order without leaving phantom levels', async () => {
    await renderReady()
    fireEvent.click(screen.getByText('Add upper level'))
    fireEvent.click(screen.getByText('Add upper level'))
    fireEvent.click(screen.getByRole('button', { name: 'Move up' }))
    expect(levelLayout().activeLevel).toBe(1)
    fireEvent.keyDown(window, { key: 'z', ctrlKey: true })
    expect(levelLayout().activeLevel).toBe(2)
    fireEvent.keyDown(window, { key: 'z', ctrlKey: true })
    expect(levelLayout()).toMatchObject({ activeLevel: 1, levelViewModes: { 1: 'outline' } })
    expect(screen.queryByText('Level 3')).toBeNull()
    fireEvent.keyDown(window, { key: 'z', ctrlKey: true })
    expect(levelLayout()).toMatchObject({ activeLevel: 0, levelViewModes: {} })
    expect(screen.queryByText('Level 2')).toBeNull()
    fireEvent.keyDown(window, { key: 'y', ctrlKey: true })
    expect(levelLayout().activeLevel).toBe(1)
    expect(placedIds()).toBe('original')
  })

  it('protects an unsaved empty level when opening another project', async () => {
    localStorage.setItem(
      PROJECT_STORAGE_KEY,
      JSON.stringify({ ...original, name: 'New build plan', pieces: [] }),
    )
    await renderReady()
    save.mockResolvedValue({
      canceled: false,
      filePath: 'C:\\Plans\\empty.hearthwright',
      fileName: 'empty.hearthwright',
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save project' }))
    await waitFor(() => expect(save).toHaveBeenCalledTimes(1))
    fireEvent.click(screen.getByText('Add upper level'))
    fireEvent.click(screen.getByRole('button', { name: 'Open project' }))
    await screen.findByRole('button', { name: 'Save & open' })
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(levelLayout().activeLevel).toBe(1)
    expect(placedIds()).toBe('')
  })
})

it('ignores preview discovery preferences and restores the draft with every catalog section available', async () => {
  localStorage.setItem(
    'hearthwright:preferences:v1',
    JSON.stringify({ showAllPieces: false, enabledSections: [], advanced: true }),
  )
  await renderReady()
  for (const category of CATEGORIES) {
    expect(screen.getByRole('button', { name: category })).toBeTruthy()
  }
  expect(screen.getByRole('textbox', { name: 'Search all pieces' })).toBeTruthy()
  expect(screen.queryByRole('button', { name: /roof assistant|Planner settings/i })).toBeNull()
  expect(placedIds()).toBe('original')
})

describe('project replacement safeguards', () => {
  it('keeps the draft and undo history when opening is cancelled and blocks edits behind the prompt', async () => {
    await renderReady()
    fireEvent.click(screen.getByText('Place test floor'))
    fireEvent.click(screen.getByText('Select test pieces'))
    fireEvent.click(screen.getByRole('button', { name: 'Open project' }))
    await screen.findByRole('dialog')
    fireEvent.keyDown(window, { key: 'Delete' })
    fireEvent.keyDown(window, { key: 'z', ctrlKey: true })
    expect(placedIds()).toBe('original,added')
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(placedIds()).toBe('original,added')
    fireEvent.keyDown(window, { key: 'z', ctrlKey: true })
    expect(placedIds()).toBe('original')
  })

  it('keeps the old plan when Save As is cancelled, then saves before opening on success', async () => {
    await renderReady()
    fireEvent.click(screen.getByRole('button', { name: 'Open project' }))
    await screen.findByRole('dialog')
    fireEvent.click(screen.getByRole('button', { name: 'Save & open' }))
    await waitFor(() => expect(save).toHaveBeenCalledTimes(1))
    await waitFor(() =>
      expect((screen.getByRole('button', { name: 'Save & open' }) as HTMLButtonElement).disabled).toBe(false),
    )
    expect(placedIds()).toBe('original')
    save.mockResolvedValue({
      canceled: false,
      filePath: 'C:\\Plans\\mine.hearthwright',
      fileName: 'mine.hearthwright',
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save & open' }))
    await waitFor(() => expect(placedIds()).toBe('incoming'))
    expect(JSON.parse(save.mock.calls[1][0].contents)).toMatchObject(original)
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('keeps the current plan when saving fails or the incoming file is malformed', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    save.mockRejectedValue(new Error('Disk full'))
    await renderReady()
    fireEvent.click(screen.getByRole('button', { name: 'Open project' }))
    await screen.findByRole('dialog')
    fireEvent.click(screen.getByRole('button', { name: 'Save & open' }))
    await screen.findByText(/Saving failed/)
    expect(placedIds()).toBe('original')
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    open.mockResolvedValue({
      canceled: false,
      contents: '{"version":1,"pieces":[null]}',
      fileName: 'broken.hearthwright',
      filePath: 'C:\\Plans\\broken.hearthwright',
    })
    fireEvent.click(screen.getByRole('button', { name: 'Open project' }))
    await waitFor(() => expect(screen.getByRole('status').textContent).toContain('Current plan kept'))
    expect(placedIds()).toBe('original')
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('opens without saving only after the explicit choice and clears the old undo history', async () => {
    await renderReady()
    fireEvent.click(screen.getByText('Place test floor'))
    fireEvent.click(screen.getByRole('button', { name: 'Open project' }))
    await screen.findByRole('dialog')
    fireEvent.click(screen.getByRole('button', { name: 'Open without saving' }))
    await waitFor(() => expect(placedIds()).toBe('incoming'))
    fireEvent.keyDown(window, { key: 'z', ctrlKey: true })
    expect(placedIds()).toBe('incoming')
    expect(save).not.toHaveBeenCalled()
  })
})

describe('guided walkthrough', () => {
  it('appears on first use, can be skipped, and restarts from Help without changing the plan', async () => {
    localStorage.removeItem(WALKTHROUGH_KEY)
    render(<App />)
    const first = await screen.findByRole('dialog')
    const title = first.getAttribute('aria-labelledby')!
    const welcome = document.getElementById(title)!.textContent
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    expect(document.getElementById(title)!.textContent).not.toBe(welcome)
    fireEvent.click(screen.getByRole('button', { name: 'Skip tour' }))
    expect(localStorage.getItem(WALKTHROUGH_KEY)).toBe('seen')
    expect(placedIds()).toBe('original')
    fireEvent.click(screen.getByRole('button', { name: 'Getting started' }))
    fireEvent.click(screen.getByRole('button', { name: 'Start guided walkthrough' }))
    expect(document.getElementById(title)!.textContent).toBe(welcome)
    fireEvent.keyDown(window, { key: 'Delete' })
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(placedIds()).toBe('original')
  })
})
