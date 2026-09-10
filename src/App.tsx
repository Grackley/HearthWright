import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowDown,
  ArrowUp,
  Box,
  CircleHelp,
  ClipboardPaste,
  Copy,
  Crosshair,
  Eye,
  EyeOff,
  ExternalLink,
  Focus,
  Grid3X3,
  Grid2X2Plus,
  Hammer,
  Hand,
  Heart,
  ImagePlus,
  Layers3,
  LocateFixed,
  Map,
  MapPinned,
  Minus,
  MousePointer2,
  PanelLeftClose,
  Pencil,
  Plus,
  Redo2,
  RotateCcw,
  RotateCw,
  Route,
  Ruler,
  Save,
  SaveAll,
  Scissors,
  ShieldCheck,
  SquareDashed,
  Sprout,
  Trash2,
  Type,
  Undo2,
  Upload,
  ZoomIn,
} from 'lucide-react'
import hearthwrightIcon from '../resources/hearthwright-icon.svg'
import PlannerCanvas, { type CanvasHandle } from './components/PlannerCanvas'
import { BuildPanel } from './components/BuildPanel'
import { Modal } from './components/Modal'
import { Walkthrough, WALKTHROUGH_KEY } from './components/Walkthrough'
import { ToggleRow, ToolButton } from './components/PlannerControls'
import { isBuildingCategory, pieceById } from './data/pieces'
import {
  mapImageResolution,
  mapMetersPerPixel,
  mapSeedFromFilename,
  VALHEIM_WORLD_WIDTH_METERS,
} from './core/mapImages'
import { findSavedMap } from './core/mapLibrary'
import { rotatePieceGroup } from './core/groupTransform'
import { perfRecord } from './core/perfDiagnostics'
import {
  levelLabel,
  readLevelViewModes,
  listBuildingLevels,
  moveBuildingLevel,
  type LevelLayout,
} from './core/levels'
import { isCultivatorErase, selectableAnnotationCount, selectedAnnotationObjectCount } from './core/farming'
import type { LayerOrderCommand } from './core/layerOrder'
import { summarizeSelectedMaterials } from './core/materials'
import { parseProjectFile, parseSavedProject, projectFileSlug, PROJECT_STORAGE_KEY } from './core/project'
import { usePlanHistory } from './hooks/usePlanHistory'
import { usePieceSprites } from './hooks/usePieceSprites'
import { useDraftAutosave } from './hooks/useDraftAutosave'
import { readLocalSetting, writeLocalSetting } from './core/storage'
import { searchCatalog } from './core/catalog'
import type {
  LevelViewMode,
  LocalMapSummary,
  FarmMode,
  PieceCategory,
  PlacedPiece,
  PlanAnnotation,
  PlannerProject,
  Point,
  SnapMode,
  Tool,
} from './types'

type MapChangeRequest = { kind: 'local'; id: string } | { kind: 'file'; file: File }
type ProjectImportRequest = { project: PlannerProject; fileName: string; filePath?: string }
type SavedPlan = Pick<
  PlannerProject,
  'name' | 'seed' | 'pieces' | 'annotations' | 'mapImageName' | 'levelViewModes'
>

const MAP_GENERATOR_URL = 'https://valheim-map.world/'
const REPOSITORY_URL = 'https://github.com/Grackley/HearthWright'
const GETTING_STARTED_KEY = 'hearthwright:getting-started:v1'
const PROJECT_PATH_STORAGE_KEY = 'hearthwright:project-path:v1'

export const toolUsesBuildPreview = (tool: Tool) => tool === 'place' || tool === 'line' || tool === 'box'

const readSavedProject = () => {
  const started = performance.now()
  try {
    return parseSavedProject(readLocalSetting(PROJECT_STORAGE_KEY))
  } finally {
    perfRecord('startup.read_project', performance.now() - started)
  }
}

function App() {
  const initial = useMemo(readSavedProject, [])
  const [projectName, setProjectName] = useState(initial.name)
  const [seed, setSeed] = useState(initial.seed)
  const {
    pieces,
    annotations,
    piecesRef,
    annotationsRef,
    canUndo,
    canRedo,
    clipboardCount,
    commitPlan,
    commitPieces,
    commitAnnotations,
    setPiecesLive,
    setAnnotationsLive,
    undo: undoPlan,
    redo: redoPlan,
    clear: clearPlanItems,
    replace: replacePlan,
    remove: removeFromPlan,
    reorder: reorderPlanPieces,
    copy: copyFromPlan,
    cut: cutFromPlan,
    paste: pasteIntoPlan,
    beginMove: beginPlanMove,
    finishMove: finishPlanMove,
  } = usePlanHistory(initial)
  const [mapImage, setMapImage] = useState('')
  const [mapStatus, setMapStatus] = useState<'empty' | 'loaded' | 'imported'>('empty')
  const [mapInfo, setMapInfo] = useState({
    width: initial.mapInfo?.width ?? 0,
    height: initial.mapInfo?.height ?? 0,
    metersPerPixel: initial.mapInfo?.metersPerPixel ?? 0,
    resolution: initial.mapInfo?.resolution ?? ('custom' as LocalMapSummary['resolution']),
    imageName: initial.mapImageName ?? '',
  })
  const [localMaps, setLocalMaps] = useState<LocalMapSummary[]>([])
  const [localMapId, setLocalMapId] = useState('')
  const [mapInitializationComplete, setMapInitializationComplete] = useState(false)
  const worldWidth = VALHEIM_WORLD_WIDTH_METERS
  const [tool, setTool] = useState<Tool>('select')
  const [snapMode, setSnapMode] = useState<SnapMode>('piece')
  const [rotation, setRotation] = useState(0)
  const [activePieceId, setActivePieceId] = useState('wood-floor-2x2')
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [category, setCategory] = useState<PieceCategory>('Wood')
  const [search, setSearch] = useState('')
  const [showMap, setShowMap] = useState(true)
  const [showGrid, setShowGrid] = useState(false)
  const [showAnchors, setShowAnchors] = useState(false)
  const [showComfortRanges, setShowComfortRanges] = useState(false)
  const [showSuppressionRanges, setShowSuppressionRanges] = useState(false)
  const [showCraftingRanges, setShowCraftingRanges] = useState(false)
  const [activeLevel, setActiveLevel] = useState(initial.activeLevel)
  const [levelViewModes, setLevelViewModes] = useState<Record<number, LevelViewMode>>(initial.levelViewModes)
  const [leftOpen, setLeftOpen] = useState(true)
  const [rightOpen, setRightOpen] = useState(true)
  const [cursor, setCursor] = useState<Point>({ x: 0, y: 0 })
  const [scale, setScale] = useState(0.03)
  const [notice, setNotice] = useState('Local draft restored')
  const [textDraft, setTextDraft] = useState('Build note')
  const [textSize, setTextSize] = useState(0.5)
  const [paintColor, setPaintColor] = useState('#f4d57f')
  const [penWidth, setPenWidth] = useState(0.25)
  const [farmMode, setFarmMode] = useState<FarmMode>('cultivator')
  const [pendingMapChange, setPendingMapChange] = useState<MapChangeRequest>()
  const [pendingProjectImport, setPendingProjectImport] = useState<ProjectImportRequest>()
  const [projectBusy, setProjectBusy] = useState(false)
  const [saveBusy, setSaveBusy] = useState(false)
  const [promptError, setPromptError] = useState('')
  const savedPlanRef = useRef<SavedPlan | undefined>(undefined)
  const saveBusyRef = useRef(false)
  const [currentProjectPath, setCurrentProjectPath] = useState<string | undefined>(
    () => readLocalSetting(PROJECT_PATH_STORAGE_KEY) || undefined,
  )
  const [showHelp, setShowHelp] = useState(false)
  const [showWalkthrough, setShowWalkthrough] = useState(() => readLocalSetting(WALKTHROUGH_KEY) !== 'seen')
  const tourPanelsRef = useRef({ left: true, right: true })
  const {
    sprites: visualSprites,
    preCroppedSprites: preCroppedVisualSprites,
    snapPoints: extractedPieceSnapPoints,
    resources: extractedPieceResources,
    craftingStations: extractedCraftingStations,
    comfort: extractedPieceComfort,
    ranges: extractedPieceRanges,
  } = usePieceSprites()
  const canvasRef = useRef<CanvasHandle>(null)
  const saveProjectRef = useRef<(saveAs?: boolean) => Promise<boolean>>(async () => false)
  const mapInputRef = useRef<HTMLInputElement>(null)
  const projectInputRef = useRef<HTMLInputElement>(null)
  const mapObjectUrlRef = useRef<string | undefined>(undefined)

  const selectedId = selectedIds.at(-1)
  const activePiece = pieceById(activePieceId)
  const selectedPiece = pieces.find((piece) => piece.id === selectedId)
  const selectedAnnotation = annotations.find((annotation) => annotation.id === selectedId)
  const selectedDefinition = selectedPiece ? pieceById(selectedPiece.pieceId) : undefined
  const selectedPieces = useMemo(() => {
    const selected = new Set(selectedIds)
    return pieces.filter((piece) => selected.has(piece.id))
  }, [pieces, selectedIds])
  const visibleAnnotationCount = useMemo(() => selectableAnnotationCount(annotations), [annotations])
  const selectedPlanItemCount = useMemo(
    () => selectedPieces.length + selectedAnnotationObjectCount(selectedIds, annotations),
    [annotations, selectedPieces, selectedIds],
  )

  const undo = useCallback(() => {
    if (!undoPlan()) return
    setSelectedIds([])
    setNotice('Undid last edit')
  }, [undoPlan])

  const redo = useCallback(() => {
    if (!redoPlan()) return
    setSelectedIds([])
    setNotice('Redid last edit')
  }, [redoPlan])

  const replaceMapImage = useCallback((image: string, isObjectUrl = false) => {
    if (mapObjectUrlRef.current) URL.revokeObjectURL(mapObjectUrlRef.current)
    mapObjectUrlRef.current = isObjectUrl ? image : undefined
    setMapImage(image)
  }, [])

  const clearPlan = useCallback(() => {
    clearPlanItems()
    setSelectedIds([])
    setActiveLevel(0)
    setLevelViewModes({})
  }, [clearPlanItems])

  const rememberProjectPath = useCallback((filePath?: string) => {
    if (filePath?.toLowerCase().endsWith('.hearthwright')) {
      writeLocalSetting(PROJECT_PATH_STORAGE_KEY, filePath)
      setCurrentProjectPath(filePath)
      return
    }
    writeLocalSetting(PROJECT_PATH_STORAGE_KEY)
    setCurrentProjectPath(undefined)
  }, [])

  const loadLocalMap = useCallback(
    async (id: string, clearExistingPlan = false) => {
      try {
        const loaded = await window.valheimMaps?.load(id)
        if (!loaded) return false
        const bytes = new Uint8Array(loaded.imageBytes)
        const imageUrl = URL.createObjectURL(new Blob([bytes.buffer as ArrayBuffer], { type: 'image/png' }))
        let rememberedId = id
        if (window.valheimMaps?.remember) {
          try {
            const remembered = await window.valheimMaps.remember(id)
            rememberedId = remembered.id
            if (remembered.id !== id) setLocalMaps(await window.valheimMaps.list())
          } catch (error) {
            console.warn('Could not copy map into the managed library', error)
          }
        }
        if (clearExistingPlan) clearPlan()
        replaceMapImage(imageUrl, true)
        setLocalMapId(rememberedId)
        setSeed(loaded.seed)
        setMapInfo({
          width: loaded.imageWidth,
          height: loaded.imageHeight,
          metersPerPixel: loaded.metersPerPixel,
          resolution: loaded.resolution,
          imageName: loaded.imageName,
        })
        setMapStatus('loaded')
        setNotice(`${loaded.imageName} loaded · ${loaded.metersPerPixel.toFixed(6)} m/px`)
        requestAnimationFrame(() => canvasRef.current?.showWorld())
        return true
      } catch (error) {
        console.error('Could not load local PNG map', error)
        setNotice('Could not load that PNG map')
        return false
      }
    },
    [clearPlan, replaceMapImage],
  )

  useEffect(() => {
    let disposed = false
    const initializeMap = async () => {
      try {
        const maps = await window.valheimMaps?.list()
        if (disposed) return
        setLocalMaps(maps ?? [])
        const availableMaps = maps ?? []
        const savedMap = findSavedMap(availableMaps, initial)
        if (savedMap) {
          await loadLocalMap(savedMap.id)
        } else {
          setMapStatus('empty')
          setNotice(
            initial.pieces.length || initial.annotations.length
              ? initial.mapImageName
                ? `Draft restored · ${initial.mapImageName} is not in the map library`
                : 'Draft restored · choose the PNG map that belongs to this plan once'
              : 'Choose a piece to start building, or import your world PNG',
          )
        }
      } catch (error) {
        console.error('Could not load local PNG map', error)
        if (!disposed) {
          setMapStatus('empty')
          setNotice('Could not restore the saved PNG map')
        }
      } finally {
        if (!disposed) setMapInitializationComplete(true)
      }
    }
    void initializeMap()
    return () => {
      disposed = true
    }
  }, [loadLocalMap])

  useEffect(
    () => () => {
      if (mapObjectUrlRef.current) URL.revokeObjectURL(mapObjectUrlRef.current)
    },
    [],
  )

  const draftProject = useMemo<PlannerProject>(
    () => ({
      version: 1,
      name: projectName,
      seed,
      pieces,
      annotations,
      activeLevel,
      levelViewModes,
      localMapId: mapStatus === 'loaded' ? localMapId : undefined,
      mapImageName: mapInfo.imageName || undefined,
      mapInfo: !mapInfo.width
        ? undefined
        : {
            width: mapInfo.width,
            height: mapInfo.height,
            metersPerPixel: mapInfo.metersPerPixel,
            resolution: mapInfo.resolution,
          },
    }),
    [activeLevel, annotations, levelViewModes, localMapId, mapInfo, mapStatus, pieces, projectName, seed],
  )
  const draftSaveFailed = useDraftAutosave(draftProject, mapInitializationComplete && !projectBusy)

  const rotate = useCallback(
    (amount: number) => {
      if (toolUsesBuildPreview(tool)) {
        setRotation((current) => (current + amount + 360) % 360)
        return
      }
      if (canvasRef.current?.rotateActiveMove(amount)) return
      const selected = new Set(selectedIds)
      const selectedPieceCount = piecesRef.current.filter((piece) => selected.has(piece.id)).length
      if (selectedPieceCount) {
        commitPieces((current) => rotatePieceGroup(current, selectedIds, amount))
      } else if (!selectedIds.length) {
        setRotation((current) => (current + amount + 360) % 360)
      }
    },
    [commitPieces, selectedIds, tool],
  )

  const activateTool = useCallback((nextTool: Tool) => {
    if (nextTool === 'place' || nextTool === 'line' || nextTool === 'box') setSelectedIds([])
    setTool(nextTool)
  }, [])

  const deleteSelected = useCallback(() => {
    const removed = removeFromPlan(selectedIds)
    if (!removed) return
    setSelectedIds([])
    setNotice(`${removed} ${removed === 1 ? 'item' : 'items'} removed · Ctrl+Z to restore`)
  }, [removeFromPlan, selectedIds])

  const copySelected = useCallback(() => {
    const count = copyFromPlan(selectedIds, activeLevel)
    if (count) setNotice(`${count} ${count === 1 ? 'item' : 'items'} copied`)
  }, [activeLevel, copyFromPlan, selectedIds])

  const cutSelected = useCallback(() => {
    const count = cutFromPlan(selectedIds, activeLevel)
    if (!count) return
    setSelectedIds([])
    setNotice(`${count} ${count === 1 ? 'item' : 'items'} cut · Ctrl+Z to restore`)
  }, [activeLevel, cutFromPlan, selectedIds])

  const pasteCopied = useCallback(() => {
    const pastedIds = pasteIntoPlan(activeLevel)
    if (!pastedIds.length) return
    setSelectedIds(pastedIds)
    const count = pastedIds.length
    setNotice(
      `${count} ${count === 1 ? 'item' : 'items'} pasted on ${levelLabel(activeLevel)} in the same layout`,
    )
  }, [activeLevel, pasteIntoPlan])

  const reorderSelected = useCallback(
    (command: LayerOrderCommand) => {
      const pieceIds = selectedIds.filter((id) => piecesRef.current.some((piece) => piece.id === id))
      if (!reorderPlanPieces(pieceIds, command)) return
      const labels: Record<LayerOrderCommand, string> = {
        back: 'sent to back',
        backward: 'moved backward',
        forward: 'moved forward',
        front: 'brought to front',
      }
      setNotice(
        `${pieceIds.length === 1 ? 'Piece' : `${pieceIds.length} pieces`} ${labels[command]} on this level`,
      )
    },
    [piecesRef, reorderPlanPieces, selectedIds],
  )

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || document.querySelector('[aria-modal="true"]')) return
      const target = event.target
      if (target instanceof Element && target.closest('input, textarea, select, [contenteditable="true"]'))
        return
      if (event.key === 'Escape' && pendingMapChange) {
        setPendingMapChange(undefined)
        return
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
        event.preventDefault()
        void saveProjectRef.current(event.shiftKey)
        return
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
        event.preventDefault()
        if (event.shiftKey) redo()
        else undo()
        return
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'y') {
        event.preventDefault()
        redo()
        return
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'c') {
        event.preventDefault()
        copySelected()
        return
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'x') {
        event.preventDefault()
        cutSelected()
        return
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'v') {
        event.preventDefault()
        pasteCopied()
        return
      }
      if (event.key.toLowerCase() === 'v') activateTool('select')
      if (event.key.toLowerCase() === 'b') activateTool('place')
      if (event.key.toLowerCase() === 'l') activateTool('line')
      if (event.key.toLowerCase() === 'x') activateTool('box')
      if (event.key.toLowerCase() === 't') activateTool('text')
      if (event.key.toLowerCase() === 'p') activateTool('pen')
      if (event.key.toLowerCase() === 'f') activateTool('farm')
      if (event.key.toLowerCase() === 'h') activateTool('pan')
      if (event.key.toLowerCase() === 's') setSnapMode((current) => (current === 'piece' ? 'free' : 'piece'))
      if (event.key.toLowerCase() === 'q') rotate(-22.5)
      if (event.key.toLowerCase() === 'e') rotate(22.5)
      if (event.key === 'Delete' || event.key === 'Backspace') deleteSelected()
      if (event.key === 'Escape') {
        setTool('select')
        setSelectedIds([])
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [
    activateTool,
    copySelected,
    cutSelected,
    deleteSelected,
    pasteCopied,
    pendingMapChange,
    redo,
    rotate,
    undo,
  ])

  const filteredPieces = useMemo(() => searchCatalog(category, search), [category, search])

  const groupedPieces = useMemo(() => {
    const groups = new globalThis.Map<string, typeof filteredPieces>()
    filteredPieces.forEach((piece) => {
      const group = search.trim()
        ? `${piece.category} · ${piece.group ?? piece.category}`
        : (piece.group ?? category)
      groups.set(group, [...(groups.get(group) ?? []), piece])
    })
    const entries = [...groups.entries()]
    if (search.trim() || !isBuildingCategory(category)) return entries
    const groupOrder = [
      'Blocks & structures',
      'Floors',
      'Floors & walls',
      'Walls & openings',
      'Scalewood walls',
      'Walls & defenses',
      'Beams & poles',
      'Beams & supports',
      'Beams & pillars',
      'Roofs',
      'Shingle roofs',
      'Drawbridges',
      'Fences',
      'Blocks',
      'Stairs',
      'Stairs & ladders',
      'Doors & gates',
      'Architectural pieces',
      'Structures',
    ]
    const rank = (group: string) => {
      const index = groupOrder.indexOf(group)
      return index < 0 ? groupOrder.length : index
    }
    return entries.sort(([first], [second]) => rank(first) - rank(second))
  }, [category, filteredPieces, search])

  const occupiedLevels = useMemo(
    () => listBuildingLevels({ pieces, annotations, activeLevel, levelViewModes }),
    [activeLevel, annotations, pieces, levelViewModes],
  )

  const commitLevelLayout = (next: LevelLayout) => {
    const previous = { activeLevel, levelViewModes }
    commitPlan(next.pieces, next.annotations, {
      undo: () => {
        setActiveLevel(previous.activeLevel)
        setLevelViewModes(previous.levelViewModes)
      },
      redo: () => {
        setActiveLevel(next.activeLevel)
        setLevelViewModes(next.levelViewModes)
      },
    })
    setSelectedIds([])
  }

  const selectLevel = (level: number) => {
    setActiveLevel(level)
    setLevelViewModes((current) => ({
      ...current,
      [level]: current[level] === 'hidden' ? 'outline' : (current[level] ?? 'outline'),
    }))
    setSelectedIds([])
  }

  const addLevel = () => {
    const level = Math.max(0, ...occupiedLevels) + 1
    commitLevelLayout({
      pieces: piecesRef.current,
      annotations: annotationsRef.current,
      activeLevel: level,
      levelViewModes: { ...levelViewModes, [level]: 'outline' },
    })
    setNotice(`${levelLabel(level)} added · use Move up to fit it between existing levels`)
  }

  const moveLevel = (direction: -1 | 1) => {
    const current = {
      pieces: piecesRef.current,
      annotations: annotationsRef.current,
      activeLevel,
      levelViewModes,
    }
    const next = moveBuildingLevel(current, activeLevel, direction)
    if (next === current) return
    commitLevelLayout(next)
    setNotice(
      `${levelLabel(activeLevel)} moved ${direction === -1 ? 'up' : 'down'} in the list to ${levelLabel(next.activeLevel)}`,
    )
  }

  const materialSummary = useMemo(() => {
    return summarizeSelectedMaterials(pieces, pieceById, extractedPieceResources)
      .totals.sort((first, second) => second.amount - first.amount)
      .slice(0, 4)
  }, [extractedPieceResources, pieces])

  const selectCatalogPiece = (id: string) => {
    setActivePieceId(id)
    setSelectedIds([])
    setTool((current) => (current === 'line' || current === 'box' ? current : 'place'))
  }

  const handleMapImport = async (file?: File, clearExistingPlan = false) => {
    if (!file) return false
    if (file.type !== 'image/png' && !file.name.toLowerCase().endsWith('.png')) {
      setNotice('Choose a PNG map image')
      return false
    }
    const previewUrl = URL.createObjectURL(file)
    const image = new Image()
    image.src = previewUrl
    try {
      await image.decode()
      if (image.naturalWidth !== image.naturalHeight) {
        URL.revokeObjectURL(previewUrl)
        setNotice('Valheim map PNGs must be square')
        return false
      }
      if (window.valheimMaps?.import) {
        setNotice(`Adding ${file.name} to the local map library…`)
        const imported = await window.valheimMaps.import(file.name, await file.arrayBuffer())
        URL.revokeObjectURL(previewUrl)
        const maps = await window.valheimMaps.list()
        setLocalMaps(maps)
        return await loadLocalMap(imported.id, clearExistingPlan)
      }

      const resolution = mapImageResolution(image.naturalWidth)
      const metersPerPixel = mapMetersPerPixel(image.naturalWidth)
      if (clearExistingPlan) clearPlan()
      replaceMapImage(previewUrl, true)
      setSeed(mapSeedFromFilename(file.name))
      setLocalMapId('')
      setMapInfo({
        width: image.naturalWidth,
        height: image.naturalHeight,
        metersPerPixel,
        resolution,
        imageName: file.name,
      })
      setMapStatus('imported')
      setNotice(`${file.name} calibrated · ${metersPerPixel.toFixed(6)} m/px`)
      requestAnimationFrame(() => canvasRef.current?.showWorld())
      return true
    } catch (error) {
      URL.revokeObjectURL(previewUrl)
      console.error('Could not import PNG map', error)
      setNotice('Could not import that PNG map')
      return false
    }
  }

  const performMapChange = async (change: MapChangeRequest, clearExistingPlan = true) => {
    setPendingMapChange(undefined)
    setProjectBusy(true)
    try {
      const loaded =
        change.kind === 'local'
          ? await loadLocalMap(change.id, clearExistingPlan)
          : await handleMapImport(change.file, clearExistingPlan)
      if (loaded && clearExistingPlan) {
        rememberProjectPath()
        savedPlanRef.current = undefined
      }
    } finally {
      setProjectBusy(false)
    }
  }

  const requestMapChange = (change: MapChangeRequest) => {
    setPromptError('')
    // Attaching a missing map must preserve a restored/imported plan.
    if (mapStatus === 'empty') {
      void performMapChange(change, false)
      return
    }
    if (piecesRef.current.length || annotationsRef.current.length) {
      setPendingMapChange(change)
      return
    }
    void performMapChange(change)
  }

  const projectSlug = projectFileSlug(projectName)

  const currentSaveState = (): SavedPlan => ({
    name: projectName,
    seed,
    pieces: piecesRef.current,
    annotations: annotationsRef.current,
    mapImageName: mapInfo.imageName || undefined,
    levelViewModes,
  })

  const hasUnsavedPlan = () => {
    const current = currentSaveState()
    if (savedPlanRef.current) return JSON.stringify(current) !== JSON.stringify(savedPlanRef.current)
    return Boolean(
      current.pieces.length ||
      current.annotations?.length ||
      current.mapImageName ||
      Object.keys(levelViewModes).some((level) => Number(level) !== 0) ||
      seed ||
      projectName !== 'New build plan',
    )
  }

  const serializeProject = async () => {
    const project = { ...draftProject }
    if (mapStatus === 'imported' && mapImage) {
      // Blob URLs expire with the session. A saved file needs the image bytes.
      const blob = await (await fetch(mapImage)).blob()
      project.mapImage = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(String(reader.result))
        reader.onerror = () => reject(new Error('Could not embed the map image'))
        reader.readAsDataURL(blob)
      })
    }
    return JSON.stringify(project)
  }

  const saveProject = async (saveAs = false) => {
    if (saveBusyRef.current) return false
    saveBusyRef.current = true
    setSaveBusy(true)
    setPromptError('')
    const savedState = currentSaveState()
    try {
      const contents = await serializeProject()
      if (window.hearthwrightProjects) {
        const result = await window.hearthwrightProjects.save({
          filePath: saveAs ? undefined : currentProjectPath,
          suggestedName: `${projectSlug}.hearthwright`,
          contents,
          saveAs,
        })
        if (result.canceled) return false
        rememberProjectPath(result.filePath)
        setNotice(`${result.fileName} saved`)
      } else {
        const url = URL.createObjectURL(new Blob([contents], { type: 'application/json' }))
        const anchor = document.createElement('a')
        anchor.href = url
        anchor.download = `${projectSlug}.hearthwright`
        anchor.click()
        window.setTimeout(() => URL.revokeObjectURL(url), 1000)
        setNotice('Editable Hearthwright project exported')
      }
      savedPlanRef.current = savedState
      return true
    } catch (error) {
      console.error('Could not save Hearthwright project', error)
      setNotice('Could not save the project')
      setPromptError('Saving failed. Your current plan is still open. Try Save As or cancel to keep working.')
      return false
    } finally {
      saveBusyRef.current = false
      setSaveBusy(false)
    }
  }
  saveProjectRef.current = saveProject

  const exportPng = () => {
    const url = canvasRef.current?.exportPng()
    if (!url) return
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `${projectSlug}.png`
    anchor.click()
    setNotice('Visible plan exported as PNG')
  }

  const applyImportedProject = async ({ project, fileName, filePath }: ProjectImportRequest) => {
    setProjectBusy(true)
    setPromptError('')
    try {
      let imageUrl = ''
      let nextMapId = ''
      let nextMapStatus: 'empty' | 'loaded' | 'imported' = 'empty'
      let nextMapInfo: typeof mapInfo = {
        width: project.mapInfo?.width ?? 0,
        height: project.mapInfo?.height ?? 0,
        metersPerPixel: project.mapInfo?.metersPerPixel ?? 0,
        resolution: project.mapInfo?.resolution ?? 'custom',
        imageName: project.mapImageName ?? '',
      }
      let maps = localMaps
      let matchingMap = findSavedMap(maps, project)
      if (project.mapImage) {
        const embedded = new Image()
        embedded.src = project.mapImage
        await embedded.decode()
        if (embedded.naturalWidth !== embedded.naturalHeight || !embedded.naturalWidth)
          throw new Error('The embedded map must be square')
        nextMapInfo = {
          width: embedded.naturalWidth,
          height: embedded.naturalHeight,
          metersPerPixel: mapMetersPerPixel(embedded.naturalWidth),
          resolution: mapImageResolution(embedded.naturalWidth),
          imageName: project.mapImageName || 'Embedded project map.png',
        }
        if (window.valheimMaps?.import) {
          const bytes = await (await fetch(project.mapImage)).arrayBuffer()
          const imported = await window.valheimMaps.import(nextMapInfo.imageName, bytes)
          maps = await window.valheimMaps.list()
          matchingMap = maps.find((map) => map.id === imported.id)
        } else {
          imageUrl = project.mapImage
          nextMapStatus = 'imported'
        }
      }
      if (matchingMap && window.valheimMaps) {
        const loaded = await window.valheimMaps.load(matchingMap.id)
        const bytes = new Uint8Array(loaded.imageBytes)
        imageUrl = URL.createObjectURL(new Blob([bytes.buffer as ArrayBuffer], { type: 'image/png' }))
        nextMapId = matchingMap.id
        nextMapStatus = 'loaded'
        nextMapInfo = {
          width: loaded.imageWidth,
          height: loaded.imageHeight,
          metersPerPixel: loaded.metersPerPixel,
          resolution: loaded.resolution,
          imageName: loaded.imageName,
        }
      }
      // Prepare the entire next document before replacing live state.
      const nextAnnotations = project.annotations ?? []
      const name = project.name || 'Imported build plan'
      const nextSeed = project.seed || ''
      setProjectName(name)
      setSeed(nextSeed)
      replacePlan({ pieces: project.pieces, annotations: nextAnnotations })
      setActiveLevel(project.activeLevel ?? 0)
      setLevelViewModes(readLevelViewModes(project.levelViewModes))
      setSelectedIds([])
      replaceMapImage(imageUrl, imageUrl.startsWith('blob:'))
      setLocalMapId(nextMapId)
      setMapStatus(nextMapStatus)
      setMapInfo(nextMapInfo)
      setLocalMaps(maps)
      rememberProjectPath(filePath)
      savedPlanRef.current = {
        name,
        seed: nextSeed,
        pieces: project.pieces,
        annotations: nextAnnotations,
        mapImageName: nextMapInfo.imageName || undefined,
        levelViewModes: readLevelViewModes(project.levelViewModes),
      }
      setPendingProjectImport(undefined)
      setNotice(
        nextMapStatus === 'empty' && project.mapImageName
          ? `${fileName} opened · import ${project.mapImageName} to attach its map; your pieces will be kept`
          : `${fileName} opened`,
      )
      const firstPiece = project.pieces[0]
      requestAnimationFrame(() =>
        firstPiece ? canvasRef.current?.focusAt(firstPiece) : canvasRef.current?.showWorld(),
      )
    } catch (error) {
      console.error('Could not prepare Hearthwright project', error)
      setNotice('Could not open that project. Your current plan is unchanged.')
      setPromptError('Could not load the project or its map. Your current plan is unchanged.')
    } finally {
      setProjectBusy(false)
    }
  }

  const requestProjectImport = async (contents: string, fileName: string, filePath?: string) => {
    try {
      const request = { project: parseProjectFile(contents), fileName, filePath }
      setPromptError('')
      if (hasUnsavedPlan()) setPendingProjectImport(request)
      else await applyImportedProject(request)
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'Invalid project'
      setNotice(`Could not open ${fileName}: ${reason}. Current plan kept.`)
    }
  }

  const importProject = async (file?: File) => {
    if (!file) return
    try {
      await requestProjectImport(await file.text(), file.name)
    } catch {
      setNotice('Could not read that project file. Current plan kept.')
    }
  }

  const openProject = async () => {
    if (!window.hearthwrightProjects) {
      projectInputRef.current?.click()
      return
    }
    try {
      const result = await window.hearthwrightProjects.open()
      if (!result.canceled) await requestProjectImport(result.contents, result.fileName, result.filePath)
    } catch (error) {
      console.error('Could not open Hearthwright project', error)
      setNotice('Could not open that project')
    }
  }

  const updateSelected = (patch: Partial<PlacedPiece>) => {
    if (!selectedId) return
    commitPieces((current) =>
      current.map((piece) => (piece.id === selectedId ? { ...piece, ...patch } : piece)),
    )
  }

  const updateSelectedAnnotation = (patch: Partial<PlanAnnotation>) => {
    if (!selectedAnnotation) return
    commitAnnotations((current) =>
      current.map((annotation) =>
        annotation.id === selectedAnnotation.id
          ? ({ ...annotation, ...patch } as PlanAnnotation)
          : annotation,
      ),
    )
  }

  const closeHelp = () => {
    writeLocalSetting(GETTING_STARTED_KEY, 'seen')
    setShowHelp(false)
  }

  const startWalkthrough = () => {
    tourPanelsRef.current = { left: leftOpen, right: rightOpen }
    setLeftOpen(true)
    setRightOpen(true)
    setShowHelp(false)
    setShowWalkthrough(true)
  }

  const finishWalkthrough = () => {
    writeLocalSetting(WALKTHROUGH_KEY, 'seen')
    setShowWalkthrough(false)
    setLeftOpen(tourPanelsRef.current.left)
    setRightOpen(tourPanelsRef.current.right)
  }

  const openExternal = (url: string) => {
    if (window.hearthwrightApp) {
      void window.hearthwrightApp.openExternal(url)
      return
    }
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  return (
    <div className={`app-shell ${leftOpen ? '' : 'left-collapsed'} ${rightOpen ? '' : 'right-collapsed'}`}>
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark">
            <img src={hearthwrightIcon} alt="" />
          </div>
          <div>
            <strong>HEARTHWRIGHT</strong>
            <span>VALHEIM BUILD PLANNER · v{__APP_VERSION__}</span>
          </div>
        </div>

        <div className="project-heading">
          <span className="eyebrow">PROJECT</span>
          <input
            value={projectName}
            onChange={(event) => setProjectName(event.target.value)}
            aria-label="Project name"
          />
        </div>

        <div className="header-actions" data-tour="save">
          <button className="icon-button" title="Getting started" onClick={() => setShowHelp(true)}>
            <CircleHelp size={17} />
          </button>
          <button
            className="icon-button"
            title="Open project"
            disabled={saveBusy}
            onClick={() => void openProject()}
          >
            <Upload size={17} />
          </button>
          <button className="icon-button" title="Export visible plan as PNG" onClick={exportPng}>
            <ImagePlus size={17} />
          </button>
          <button
            className="icon-button"
            title="Save project as"
            disabled={saveBusy}
            onClick={() => void saveProject(true)}
          >
            <SaveAll size={17} />
          </button>
          <button className="primary-button" disabled={saveBusy} onClick={() => void saveProject()}>
            <Save size={16} /> Save project
          </button>
          <input
            ref={projectInputRef}
            hidden
            type="file"
            accept=".hearthwright,.json,.vbp.json"
            onChange={(event) => {
              const file = event.target.files?.[0]
              event.currentTarget.value = ''
              void importProject(file)
            }}
          />
        </div>
      </header>

      <aside className="left-panel panel">
        <div className="panel-scroll">
          <section className="panel-section seed-section" data-tour="map">
            <div className="section-title">
              <div>
                <span className="section-kicker">WORLD</span>
                <h2>PNG map</h2>
              </div>
              <MapPinned size={19} />
            </div>
            {localMaps.length > 0 && (
              <>
                <label className="field-label" htmlFor="map-select">
                  Maps folder
                </label>
                <select
                  id="map-select"
                  className="map-select"
                  value={localMapId}
                  onChange={(event) => requestMapChange({ kind: 'local', id: event.target.value })}
                >
                  {localMaps.map((map) => (
                    <option key={map.id} value={map.id}>
                      {map.imageName} · {map.resolution}
                    </option>
                  ))}
                </select>
              </>
            )}
            <div className={`source-status ${mapStatus}`}>
              <span />
              <div>
                <strong>{mapStatus === 'empty' ? 'No map selected' : 'PNG world map'}</strong>
                <small>
                  {mapStatus === 'empty'
                    ? 'Optional · build here or import your world'
                    : `${mapInfo.width} × ${mapInfo.height}px · ${mapInfo.metersPerPixel.toFixed(6)} m/px · ${worldWidth / 1000} km map${seed ? ` · ${seed}` : ''}`}
                </small>
              </div>
            </div>
            <button className="text-button" onClick={() => mapInputRef.current?.click()}>
              <ImagePlus size={15} /> Import PNG map
            </button>
            <button className="text-button subdued" onClick={() => setShowHelp(true)}>
              <CircleHelp size={15} /> How to get a map
            </button>
            <input
              ref={mapInputRef}
              hidden
              type="file"
              accept="image/png,.png"
              onChange={(event) => {
                const file = event.target.files?.[0]
                event.currentTarget.value = ''
                if (file) requestMapChange({ kind: 'file', file })
              }}
            />
          </section>

          <section className="panel-section">
            <div className="section-heading-row">
              <h3>View layers</h3>
              <Layers3 size={16} />
            </div>
            <ToggleRow
              label="World map"
              detail="Terrain and biomes"
              checked={showMap}
              onChange={() => setShowMap((value) => !value)}
              icon={showMap ? <Eye size={16} /> : <EyeOff size={16} />}
            />
            <ToggleRow
              label="Build grid"
              detail={scale > 14 ? '0.5 m spacing' : scale > 2.2 ? '2 m spacing' : 'Adaptive spacing'}
              checked={showGrid}
              onChange={() => setShowGrid((value) => !value)}
              icon={<Grid3X3 size={16} />}
            />
            <ToggleRow
              label="Snap anchors"
              detail="Valid connection points"
              checked={showAnchors}
              onChange={() => setShowAnchors((value) => !value)}
              icon={<Crosshair size={16} />}
            />
          </section>

          <section className="panel-section level-section" data-tour="levels">
            <div className="section-heading-row">
              <h3>Building levels</h3>
              <Layers3 size={16} />
            </div>
            <div className="level-list">
              {occupiedLevels.map((level) => {
                const count =
                  pieces.filter((piece) => (piece.level ?? 0) === level).length +
                  annotations.filter(
                    (annotation) => (annotation.level ?? 0) === level && !isCultivatorErase(annotation),
                  ).length
                const viewMode: LevelViewMode =
                  level === activeLevel ? 'actual' : (levelViewModes[level] ?? 'outline')
                const active = activeLevel === level
                return (
                  <div key={level} className={`level-row ${active ? 'active' : ''}`}>
                    <button className="level-select" onClick={() => selectLevel(level)}>
                      <span>{levelLabel(level)}</span>
                      <small>
                        {count} {count === 1 ? 'item' : 'items'}
                      </small>
                    </button>
                    <div
                      className="level-view-modes"
                      role="group"
                      aria-label={`${levelLabel(level)} visibility`}
                    >
                      <button
                        className={viewMode === 'hidden' ? 'active' : ''}
                        title={
                          active ? 'The active level is always shown actual' : `Hide ${levelLabel(level)}`
                        }
                        aria-label={`None — hide ${levelLabel(level)}`}
                        aria-pressed={viewMode === 'hidden'}
                        disabled={active}
                        onClick={() => setLevelViewModes((current) => ({ ...current, [level]: 'hidden' }))}
                      >
                        <EyeOff size={11} />
                        <span>None</span>
                      </button>
                      <button
                        className={viewMode === 'outline' ? 'active' : ''}
                        title={
                          active
                            ? 'The active level is always shown actual'
                            : `Show ${levelLabel(level)} as dotted outlines`
                        }
                        aria-label={`Dotted outlines — ${levelLabel(level)}`}
                        aria-pressed={viewMode === 'outline'}
                        disabled={active}
                        onClick={() => setLevelViewModes((current) => ({ ...current, [level]: 'outline' }))}
                      >
                        <SquareDashed size={11} />
                        <span>Dots</span>
                      </button>
                      <button
                        className={viewMode === 'actual' ? 'active' : ''}
                        title={
                          active
                            ? 'Active level — actual rendering'
                            : `Show actual ${levelLabel(level)} pieces`
                        }
                        aria-label={`Actual rendering — ${levelLabel(level)}`}
                        aria-pressed={viewMode === 'actual'}
                        disabled={active}
                        onClick={() => setLevelViewModes((current) => ({ ...current, [level]: 'actual' }))}
                      >
                        <Eye size={11} />
                        <span>Real</span>
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
            <div className="level-reorder-controls" role="group" aria-label="Reorder selected level">
              <button
                onClick={() => moveLevel(-1)}
                disabled={occupiedLevels[0] === activeLevel}
                title={`Move ${levelLabel(activeLevel)} up in the list`}
              >
                <ArrowUp size={14} /> Move up
              </button>
              <button
                onClick={() => moveLevel(1)}
                disabled={occupiedLevels.at(-1) === activeLevel}
                title={`Move ${levelLabel(activeLevel)} down in the list`}
              >
                <ArrowDown size={14} /> Move down
              </button>
            </div>
            <p className="level-reorder-hint">
              Moves the selected level with its pieces and notes. Undo restores its place.
            </p>
            <button className="add-level-button" onClick={addLevel}>
              <Plus size={14} /> Add upper level
            </button>
          </section>

          <section className="panel-section" data-tour="navigator">
            <div className="section-heading-row">
              <h3>Navigator</h3>
              <LocateFixed size={16} />
            </div>
            <div className="navigator-grid">
              <button onClick={() => canvasRef.current?.showWorld()}>
                <Map size={17} />
                <span>
                  <strong>World</strong>
                  <small>{worldWidth / 1000} km overview</small>
                </span>
              </button>
              <button onClick={() => canvasRef.current?.focusAt()}>
                <Focus size={17} />
                <span>
                  <strong>Focus here</strong>
                  <small>Build detail</small>
                </span>
              </button>
            </div>
          </section>

          <section className="panel-section plan-summary" data-tour="summary">
            <div className="section-heading-row">
              <h3>Plan summary</h3>
              <Box size={16} />
            </div>
            <div className="summary-count">
              <strong>{pieces.length + visibleAnnotationCount}</strong>
              <span>plan items</span>
            </div>
            {pieces.length === 0 && visibleAnnotationCount === 0 ? (
              <p className="empty-copy">Choose a build piece, zoom into a site, and click to begin.</p>
            ) : materialSummary.length ? (
              <div className="plan-material-summary">
                <small>TOP BUILD MATERIALS</small>
                <div className="material-list">
                  {materialSummary.map((material) => (
                    <div key={material.prefabName}>
                      <span>{material.displayName}</span>
                      <strong>{material.amount.toLocaleString()}</strong>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="empty-copy">
                {visibleAnnotationCount} {visibleAnnotationCount === 1 ? 'annotation' : 'annotations'} on this
                plan.
              </p>
            )}
          </section>
        </div>
      </aside>

      <main className="workspace">
        <div className="canvas-toolbar">
          <button
            className="collapse-button left"
            onClick={() => setLeftOpen((value) => !value)}
            title="Toggle world panel"
          >
            <PanelLeftClose size={16} />
          </button>
          <div className="toolbar-group" data-tour="tools">
            <ToolButton
              label="Select"
              shortcut="V"
              active={tool === 'select'}
              onClick={() => activateTool('select')}
            >
              <MousePointer2 size={16} />
            </ToolButton>
            <ToolButton
              label="Build"
              shortcut="B"
              active={tool === 'place'}
              onClick={() => activateTool('place')}
            >
              <Hammer size={16} />
            </ToolButton>
            <ToolButton
              label="Line"
              shortcut="L"
              active={tool === 'line'}
              onClick={() => activateTool('line')}
            >
              <Route size={16} />
            </ToolButton>
            <ToolButton label="Box" shortcut="X" active={tool === 'box'} onClick={() => activateTool('box')}>
              <Grid2X2Plus size={16} />
            </ToolButton>
            <ToolButton
              label="Text"
              shortcut="T"
              active={tool === 'text'}
              onClick={() => activateTool('text')}
            >
              <Type size={16} />
            </ToolButton>
            <ToolButton label="Pen" shortcut="P" active={tool === 'pen'} onClick={() => activateTool('pen')}>
              <Pencil size={16} />
            </ToolButton>
            <ToolButton
              label="Farm"
              shortcut="F"
              active={tool === 'farm'}
              onClick={() => activateTool('farm')}
            >
              <Sprout size={16} />
            </ToolButton>
            <ToolButton label="Pan" shortcut="H" active={tool === 'pan'} onClick={() => activateTool('pan')}>
              <Hand size={16} />
            </ToolButton>
          </div>
          <div className="range-control" data-tour="ranges">
            <span>RANGES</span>
            <button
              className={showComfortRanges ? 'active comfort' : 'comfort'}
              onClick={() => setShowComfortRanges((value) => !value)}
              title="Show the 10 m comfort detection range"
              aria-pressed={showComfortRanges}
            >
              <Heart size={13} /> Comfort
            </button>
            <button
              className={showSuppressionRanges ? 'active suppression' : 'suppression'}
              onClick={() => setShowSuppressionRanges((value) => !value)}
              title="Show exact enemy-spawn blocking ranges from PlayerBase effect areas"
              aria-pressed={showSuppressionRanges}
            >
              <ShieldCheck size={13} /> Spawn block
            </button>
            <button
              className={showCraftingRanges ? 'active crafting' : 'crafting'}
              onClick={() => setShowCraftingRanges((value) => !value)}
              title="Show effective crafting build radii; select a station to see its connected upgrades"
              aria-pressed={showCraftingRanges}
            >
              <Ruler size={13} /> Craft
            </button>
          </div>
          {(tool === 'text' || tool === 'pen') && (
            <div className="paint-controls">
              {tool === 'text' && (
                <input
                  className="paint-text"
                  value={textDraft}
                  onChange={(event) => setTextDraft(event.target.value)}
                  aria-label="Text annotation"
                />
              )}
              <label>
                <input
                  type="color"
                  value={paintColor}
                  onChange={(event) => setPaintColor(event.target.value)}
                />
                <span>COLOR</span>
              </label>
              <label>
                <input
                  type="number"
                  min="0.1"
                  max="20"
                  step="0.1"
                  value={tool === 'text' ? textSize : penWidth}
                  onChange={(event) =>
                    tool === 'text'
                      ? setTextSize(Number(event.target.value))
                      : setPenWidth(Number(event.target.value))
                  }
                />
                <span>{tool === 'text' ? 'TEXT M' : 'PEN M'}</span>
              </label>
            </div>
          )}
          {tool === 'farm' && (
            <div className="snap-control farm-control">
              <span>FARM</span>
              <button
                className={farmMode === 'cultivator' ? 'active' : ''}
                onClick={() => setFarmMode('cultivator')}
                title="Paint with Valheim's 3 m Cultivate radius"
              >
                <Sprout size={14} /> Tiller 3 m
              </button>
              <button
                className={farmMode === 'area' ? 'active' : ''}
                onClick={() => setFarmMode('area')}
                title="Drag opposite corners to mark a cultivated area with 3 m rounded corners"
              >
                <SquareDashed size={14} /> Area box
              </button>
            </div>
          )}
          <div className="toolbar-divider" />
          <div className="placement-controls" data-tour="placement">
            <div className="snap-control">
              <span>SNAP</span>
              <button className={snapMode === 'piece' ? 'active' : ''} onClick={() => setSnapMode('piece')}>
                <Crosshair size={14} /> Piece
              </button>
              <button className={snapMode === 'free' ? 'active' : ''} onClick={() => setSnapMode('free')}>
                Free
              </button>
            </div>
            <div className="toolbar-divider" />
            <div className="rotation-control">
              <button onClick={() => rotate(-22.5)} title="Rotate left (Q)">
                <RotateCcw size={15} />
              </button>
              <span>{selectedPiece && !toolUsesBuildPreview(tool) ? selectedPiece.rotation : rotation}°</span>
              <button onClick={() => rotate(22.5)} title="Rotate right (E)">
                <RotateCw size={15} />
              </button>
            </div>
            <div className="toolbar-divider" />
          </div>
          <div className="editing-controls" data-tour="editing">
            <div className="history-control">
              <button disabled={!canUndo} onClick={undo} title="Undo (Ctrl+Z)">
                <Undo2 size={15} />
              </button>
              <button disabled={!canRedo} onClick={redo} title="Redo (Ctrl+Y)">
                <Redo2 size={15} />
              </button>
            </div>
            <div className="history-control selection-actions">
              <button disabled={!selectedIds.length} onClick={cutSelected} title="Cut selection (Ctrl+X)">
                <Scissors size={14} />
              </button>
              <button disabled={!selectedIds.length} onClick={copySelected} title="Copy selection (Ctrl+C)">
                <Copy size={14} />
              </button>
              <button disabled={!clipboardCount} onClick={pasteCopied} title="Paste selection (Ctrl+V)">
                <ClipboardPaste size={14} />
              </button>
              <button
                disabled={!selectedIds.length}
                onClick={deleteSelected}
                title="Delete selection (Delete or Alt+Delete)"
              >
                <Trash2 size={15} />
              </button>
            </div>
          </div>
          <div className="level-control">
            <button onClick={() => selectLevel(activeLevel - 1)} title="Previous level">
              <Minus size={14} />
            </button>
            <span>
              <small>LEVEL</small>
              {activeLevel === 0 ? 'Ground' : activeLevel > 0 ? activeLevel + 1 : `B${Math.abs(activeLevel)}`}
            </span>
            <button onClick={addLevel} title="Add upper level">
              <Plus size={14} />
            </button>
          </div>
          <div className="toolbar-spacer" />
          <button className="compact-button" onClick={() => canvasRef.current?.focusAt()}>
            <ZoomIn size={15} /> Focus site
          </button>
          <button
            className="collapse-button right"
            onClick={() => setRightOpen((value) => !value)}
            title="Toggle piece catalog"
          >
            <PanelLeftClose size={16} />
          </button>
        </div>

        <div className="canvas-wrap">
          <PlannerCanvas
            ref={canvasRef}
            pieces={pieces}
            annotations={annotations}
            selectedIds={selectedIds}
            activePiece={activePiece}
            tool={tool}
            snapMode={snapMode}
            rotation={rotation}
            mapImage={mapImage}
            mapImageWidth={mapInfo.width}
            mapImageHeight={mapInfo.height}
            mapCacheKey={
              localMapId
                ? `local:${localMapId}`
                : `embedded:${mapInfo.imageName}:${mapInfo.width}x${mapInfo.height}:${mapImage.length}`
            }
            worldWidth={worldWidth}
            showMap={showMap}
            showGrid={showGrid}
            showAnchors={showAnchors}
            activeLevel={activeLevel}
            levelViewModes={levelViewModes}
            textDraft={textDraft}
            textSize={textSize}
            paintColor={paintColor}
            penWidth={penWidth}
            farmMode={farmMode}
            pieceSprites={visualSprites}
            preCroppedPieceSprites={preCroppedVisualSprites}
            pieceSnapPoints={extractedPieceSnapPoints}
            pieceComfort={extractedPieceComfort}
            pieceRanges={extractedPieceRanges}
            showComfortRanges={showComfortRanges}
            showSuppressionRanges={showSuppressionRanges}
            showCraftingRanges={showCraftingRanges}
            onPlace={(piece) => {
              commitPieces((current) => [...current, piece])
              setNotice(`${pieceById(piece.pieceId).name} placed`)
            }}
            onPlaceMany={(nextPieces) => {
              if (!nextPieces.length) return
              commitPieces((current) => [...current, ...nextPieces])
              setNotice(
                `${nextPieces.length} × ${pieceById(nextPieces[0].pieceId).name} placed · Ctrl+Z removes the placement`,
              )
            }}
            onSelect={setSelectedIds}
            onMoveMany={(updates) => {
              const nextPositions = new globalThis.Map(updates.map((update) => [update.id, update]))
              setPiecesLive((current) =>
                current.map((piece) => {
                  const update = nextPositions.get(piece.id)
                  return update ? { ...piece, x: update.x, y: update.y, rotation: update.rotation } : piece
                }),
              )
            }}
            onMoveAnnotations={(updates) => {
              if (!updates.length) return
              const nextAnnotations = new globalThis.Map(
                updates.map((annotation) => [annotation.id, annotation]),
              )
              setAnnotationsLive((current) =>
                current.map((annotation) => nextAnnotations.get(annotation.id) ?? annotation),
              )
            }}
            onMoveStart={beginPlanMove}
            onMoveEnd={finishPlanMove}
            onAddAnnotation={(annotation) => {
              commitAnnotations((current) => [...current, annotation])
              setNotice(
                annotation.kind === 'text'
                  ? 'Text annotation placed'
                  : annotation.kind === 'pen'
                    ? 'Pen stroke added'
                    : annotation.mode === 'cultivator'
                      ? annotation.action === 'erase'
                        ? 'Cultivated ground erased with the 3 m in-game radius'
                        : 'Cultivated ground painted with the 3 m in-game radius'
                      : `Farm area marked · ${annotation.width.toFixed(1)} × ${annotation.height.toFixed(1)} m`,
              )
            }}
            onCursorChange={(point, nextScale) => {
              setCursor(point)
              setScale(nextScale)
            }}
          />
        </div>

        <footer className="statusbar">
          <div
            role="status"
            title={
              draftSaveFailed ? 'Automatic draft saving failed. Save project to keep your work.' : notice
            }
          >
            <span className="status-dot" />
            {draftSaveFailed ? 'Draft saving unavailable — use Save project to keep your work' : notice}
          </div>
          <div className="status-center">
            <span>X {cursor.x.toFixed(1)}</span>
            <span>Z {(-cursor.y).toFixed(1)}</span>
            <span>{Math.round(scale * 100)}%</span>
          </div>
          <div>
            {tool === 'line' ? (
              <>
                <kbd>Click</kbd> start / finish line <kbd>Right-click</kbd> cancel
              </>
            ) : tool === 'box' ? (
              <>
                <kbd>Drag</kbd> fill box <kbd>Shift</kbd> ignore snap <kbd>Right-click</kbd> cancel
              </>
            ) : tool === 'pen' ? (
              <>
                <kbd>Drag</kbd> draw <kbd>Ctrl Z</kbd> undo
              </>
            ) : tool === 'text' ? (
              <>
                <kbd>Click</kbd> place text <kbd>Ctrl Z</kbd> undo
              </>
            ) : tool === 'farm' ? (
              farmMode === 'cultivator' ? (
                <>
                  <kbd>Left-click / drag</kbd> cultivate <kbd>Right-click / drag</kbd> erase
                </>
              ) : (
                <>
                  <kbd>Drag</kbd> mark rounded farm area <kbd>Ctrl Z</kbd> undo
                </>
              )
            ) : (
              <>
                <kbd>Drag</kbd> select <kbd>Ctrl C / V</kbd> copy / paste <kbd>Del</kbd> delete
              </>
            )}
          </div>
        </footer>
      </main>

      <BuildPanel
        selectedIds={selectedIds}
        selectedCount={selectedPlanItemCount}
        selectedPieces={selectedPieces}
        selectedPiece={selectedPiece}
        selectedAnnotation={selectedAnnotation}
        selectedDefinition={selectedDefinition}
        activePiece={activePiece}
        activePieceId={activePieceId}
        tool={tool}
        search={search}
        category={category}
        groupedPieces={groupedPieces}
        filteredCount={filteredPieces.length}
        sprites={visualSprites}
        snapPoints={extractedPieceSnapPoints}
        pieceResources={extractedPieceResources}
        craftingStations={extractedCraftingStations}
        pieceComfort={extractedPieceComfort}
        onClearSelection={() => setSelectedIds([])}
        onUpdatePiece={updateSelected}
        onUpdateAnnotation={updateSelectedAnnotation}
        onDelete={deleteSelected}
        onReorder={reorderSelected}
        onPlaceAnother={(pieceId, nextRotation) => {
          setActivePieceId(pieceId)
          setRotation(nextRotation)
          setSelectedIds([])
          setTool('place')
        }}
        onSearchChange={setSearch}
        onCategoryChange={setCategory}
        onSelectPiece={selectCatalogPiece}
        onActivatePlace={() => activateTool('place')}
      />

      {showHelp && (
        <Modal className="getting-started" labelledBy="getting-started-title" onClose={closeHelp}>
          <div className="getting-started-header">
            <div>
              <span className="section-kicker">QUICK START</span>
              <h2 id="getting-started-title">Plan a build in three steps</h2>
            </div>
            <button className="icon-button" onClick={closeHelp} aria-label="Close getting started">
              ×
            </button>
          </div>

          <button className="primary-button walkthrough-restart" onClick={startWalkthrough}>
            <Focus size={17} /> Start guided walkthrough
          </button>

          <ol className="getting-started-steps">
            <li>
              <strong>Download your world map</strong>
              <p>
                Open the unofficial Valheim World Generator, choose the version that matches your world, enter
                its seed, and select <b>Go</b>. Older or migrated worlds may require uploading the world file
                instead.
              </p>
              <p>
                Choose <b>Full Terrain</b>, turn off every <b>Visible Location</b> marker, then use{' '}
                <b>Download Map → Image Only → 8192 × 8192 → Download Image</b>.
              </p>
              <button className="secondary-button help-link" onClick={() => openExternal(MAP_GENERATOR_URL)}>
                Open map generator <ExternalLink size={14} />
              </button>
            </li>
            <li>
              <strong>Import and find the build site</strong>
              <p>
                Select <b>Import PNG map</b>, zoom to the area you want, and use <b>Focus here</b> to move
                from the world overview into build detail.
              </p>
              <p>
                While placing a piece or line, hold <b>Shift</b> to temporarily ignore snap points.
              </p>
            </li>
            <li>
              <strong>Build, then save the editable plan</strong>
              <p>
                Pick a catalog piece and use <b>Build</b>, <b>Line</b>, or drag with <b>Box</b> to fill an
                interior. The three Range toggles show comfort, spawn suppression, and crafting/upgrade reach
                on the active level. Use <b>Farm</b> for a true-size 3 m Cultivate brush or a rounded area
                box. Toggle Piece/Free snapping, rotate with Q/E, and add levels from the left panel. Select a
                level and use <b>Move up</b> or <b>Move down</b> to fit it between other floors. Save as a{' '}
                <b>.hearthwright</b> project; PNG export is for sharing a static view.
              </p>
            </li>
          </ol>

          <div className="quick-controls" aria-label="Essential controls">
            <span>
              <kbd>V</kbd> select
            </span>
            <span>
              <kbd>B</kbd> build
            </span>
            <span>
              <kbd>L</kbd> line
            </span>
            <span>
              <kbd>X</kbd> box fill
            </span>
            <span>
              <kbd>F</kbd> farm
            </span>
            <span>
              <kbd>Q / E</kbd> rotate
            </span>
            <span>
              <kbd>S</kbd> snap
            </span>
            <span>
              <kbd>Ctrl Z</kbd> undo
            </span>
          </div>

          <div className="modal-actions getting-started-actions">
            <button className="secondary-button" onClick={() => openExternal(REPOSITORY_URL)}>
              Full guide on GitHub <ExternalLink size={14} />
            </button>
            <button className="primary-button" onClick={closeHelp}>
              Got it
            </button>
          </div>

          <p className="fan-tool-note">
            The map generator is an independent fan-made service. Hearthwright is not affiliated with it, Iron
            Gate AB, or Coffee Stain Publishing.
          </p>
        </Modal>
      )}

      {showWalkthrough && mapInitializationComplete && <Walkthrough onFinish={finishWalkthrough} />}

      {projectBusy && (
        <Modal labelledBy="project-loading-title" onClose={() => {}}>
          <h2 id="project-loading-title">Opening your plan…</h2>
          <p>Preparing the project and its map.</p>
        </Modal>
      )}

      {pendingProjectImport && !projectBusy && (
        <Modal
          labelledBy="project-save-title"
          onClose={() => {
            if (!saveBusy) setPendingProjectImport(undefined)
          }}
        >
          <div className="save-prompt-icon">
            <Save size={22} />
          </div>
          <span className="section-kicker">UNSAVED CHANGES</span>
          <h2 id="project-save-title">Save before opening another plan?</h2>
          <p>
            Opening {pendingProjectImport.fileName} replaces “{projectName}” and its undo history. Save your
            current work first to keep it.
          </p>
          {promptError && (
            <p className="prompt-error" role="alert">
              {promptError}
            </p>
          )}
          <div className="modal-actions">
            <button
              className="primary-button"
              disabled={saveBusy}
              onClick={async () => {
                if (await saveProject()) await applyImportedProject(pendingProjectImport)
              }}
            >
              <Save size={15} /> {saveBusy ? 'Saving…' : 'Save & open'}
            </button>
            <button
              className="danger-button"
              disabled={saveBusy}
              onClick={() => void applyImportedProject(pendingProjectImport)}
            >
              Open without saving
            </button>
            <button
              className="secondary-button"
              disabled={saveBusy}
              onClick={() => setPendingProjectImport(undefined)}
            >
              Cancel
            </button>
          </div>
        </Modal>
      )}

      {pendingMapChange && (
        <Modal
          labelledBy="save-prompt-title"
          onClose={() => {
            if (!saveBusy) setPendingMapChange(undefined)
          }}
        >
          <div className="save-prompt-icon">
            <Save size={22} />
          </div>
          <span className="section-kicker">UNSAVED PLAN</span>
          <h2 id="save-prompt-title">Save before changing maps?</h2>
          <p>
            This plan contains {pieces.length} {pieces.length === 1 ? 'structure' : 'structures'}
            {visibleAnnotationCount
              ? ` and ${visibleAnnotationCount} ${visibleAnnotationCount === 1 ? 'annotation' : 'annotations'}`
              : ''}
            . Changing maps starts with an empty plan.
          </p>
          {promptError && (
            <p className="prompt-error" role="alert">
              {promptError}
            </p>
          )}
          <div className="modal-actions">
            <button
              className="primary-button"
              disabled={saveBusy}
              onClick={async () => {
                if (await saveProject()) await performMapChange(pendingMapChange)
              }}
            >
              <Save size={15} /> Save project & continue
            </button>
            <button
              className="danger-button"
              disabled={saveBusy}
              onClick={() => void performMapChange(pendingMapChange)}
            >
              Continue without saving
            </button>
            <button
              className="secondary-button"
              disabled={saveBusy}
              onClick={() => setPendingMapChange(undefined)}
            >
              Cancel
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}

export default App
