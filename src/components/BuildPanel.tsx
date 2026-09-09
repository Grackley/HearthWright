import { useState, type CSSProperties } from 'react'
import {
  ChevronDown,
  ChevronUp,
  ChevronsDown,
  ChevronsUp,
  CircleHelp,
  Hammer,
  PackageOpen,
  Pencil,
  Search,
  Sprout,
  Trash2,
  Type,
  X,
} from 'lucide-react'
import { CULTIVATED_SOIL_COLOR } from '../core/farming'
import { resourcesForPiece, summarizeSelectedMaterials, type MaterialTotal } from '../core/materials'
import { CATEGORIES, isBuildingCategory, pieceById } from '../data/pieces'
import { levelLabel } from '../core/levels'
import type { LayerOrderCommand } from '../core/layerOrder'
import type {
  PieceCategory,
  PieceComfortMap,
  PieceCraftingStationMap,
  PieceDefinition,
  PieceResourceMap,
  PieceSnapPointMap,
  PlacedPiece,
  PlanAnnotation,
  Tool,
} from '../types'
import { PieceGlyph } from './PieceGlyph'

interface BuildPanelProps {
  selectedIds: string[]
  selectedCount: number
  selectedPieces: PlacedPiece[]
  selectedPiece?: PlacedPiece
  selectedAnnotation?: PlanAnnotation
  selectedDefinition?: PieceDefinition
  activePiece: PieceDefinition
  activePieceId: string
  tool: Tool
  search: string
  category: PieceCategory
  groupedPieces: [string, PieceDefinition[]][]
  filteredCount: number
  sprites: Record<string, string>
  snapPoints: PieceSnapPointMap
  pieceResources: PieceResourceMap
  craftingStations: PieceCraftingStationMap
  pieceComfort: PieceComfortMap
  onClearSelection: () => void
  onUpdatePiece: (patch: Partial<PlacedPiece>) => void
  onUpdateAnnotation: (patch: Partial<PlanAnnotation>) => void
  onDelete: () => void
  onReorder: (command: LayerOrderCommand) => void
  onPlaceAnother: (pieceId: string, rotation: number) => void
  onSearchChange: (value: string) => void
  onCategoryChange: (category: PieceCategory) => void
  onSelectPiece: (pieceId: string) => void
  onActivatePlace: () => void
}

const panelTitle = ({
  selectedCount,
  selectedPiece,
  selectedAnnotation,
}: Pick<BuildPanelProps, 'selectedCount' | 'selectedPiece' | 'selectedAnnotation'>) => {
  if (selectedCount > 1) return `${selectedCount} selected`
  if (selectedPiece) return 'Inspector'
  if (selectedAnnotation) return 'Annotation'
  return 'Piece catalog'
}

export const BuildPanel = (props: BuildPanelProps) => (
  <aside className="right-panel panel" data-tour="catalog">
    <div className="catalog-header">
      <div>
        <span className="section-kicker">BUILD</span>
        <h2>{panelTitle(props)}</h2>
      </div>
      {props.selectedIds.length ? (
        <button
          className="icon-button small"
          onClick={props.onClearSelection}
          aria-label="Clear selection and show catalog"
        >
          <X size={16} />
        </button>
      ) : (
        <PackageOpen size={19} />
      )}
    </div>

    {props.selectedPieces.length > 1 || (props.selectedPieces.length > 0 && props.selectedIds.length > 1) ? (
      <SelectionMaterials
        selectedPieces={props.selectedPieces}
        resources={props.pieceResources}
        sprites={props.sprites}
        craftingStations={props.craftingStations}
        onDelete={props.onDelete}
        onReorder={props.onReorder}
      />
    ) : props.selectedPiece && props.selectedDefinition ? (
      <PieceInspector
        selectedIds={props.selectedIds}
        piece={props.selectedPiece}
        definition={props.selectedDefinition}
        snapPointCount={props.snapPoints[props.selectedDefinition.id]?.length}
        sprite={props.sprites[props.selectedDefinition.id]}
        resources={props.pieceResources}
        craftingStations={props.craftingStations}
        onUpdate={props.onUpdatePiece}
        onDelete={props.onDelete}
        onReorder={props.onReorder}
        onPlaceAnother={props.onPlaceAnother}
      />
    ) : props.selectedAnnotation ? (
      <AnnotationInspector
        annotation={props.selectedAnnotation}
        onUpdate={props.onUpdateAnnotation}
        onDelete={props.onDelete}
      />
    ) : (
      <PieceCatalog {...props} />
    )}
  </aside>
)

interface PieceInspectorProps {
  selectedIds: string[]
  piece: PlacedPiece
  definition: PieceDefinition
  snapPointCount?: number
  sprite?: string
  resources: PieceResourceMap
  craftingStations: PieceCraftingStationMap
  onUpdate: (patch: Partial<PlacedPiece>) => void
  onDelete: () => void
  onReorder: (command: LayerOrderCommand) => void
  onPlaceAnother: (pieceId: string, rotation: number) => void
}

const PieceInspector = ({
  selectedIds,
  piece,
  definition,
  snapPointCount,
  sprite,
  resources,
  craftingStations,
  onUpdate,
  onDelete,
  onReorder,
  onPlaceAnother,
}: PieceInspectorProps) => (
  <div className="inspector">
    <div className="selected-preview" style={{ '--piece-color': definition.color } as CSSProperties}>
      <PieceGlyph piece={definition} sprite={sprite} />
      <div>
        <strong>{definition.name}</strong>
        <small>
          {definition.category} · {definition.material}
        </small>
      </div>
    </div>
    <div className="inspector-section material-section">
      <label>Build requirements</label>
      <StationRequirement station={craftingStations[definition.id]} />
      <MaterialList
        materials={resourcesForPiece(definition, resources)}
        emptyLabel="No build cost recorded"
      />
    </div>
    <div className="inspector-section">
      <label>Position</label>
      <div className="coordinate-inputs">
        <span>
          X
          <input
            type="number"
            step="0.1"
            value={Number(piece.x.toFixed(2))}
            onChange={(event) => onUpdate({ x: Number(event.target.value) })}
          />
        </span>
        <span>
          Z
          <input
            type="number"
            step="0.1"
            value={Number((-piece.y).toFixed(2))}
            onChange={(event) => onUpdate({ y: -Number(event.target.value) })}
          />
        </span>
      </div>
    </div>
    <div className="inspector-section">
      <label>Rotation</label>
      <div className="rotation-field">
        <input
          type="range"
          min="0"
          max="337.5"
          step="22.5"
          value={piece.rotation}
          onChange={(event) => onUpdate({ rotation: Number(event.target.value) })}
        />
        <strong>{piece.rotation}°</strong>
      </div>
    </div>
    <div className="metrics-grid">
      <div>
        <span>WIDTH</span>
        <strong>{definition.width} m</strong>
      </div>
      <div>
        <span>{definition.shape === 'line' ? 'THICK' : 'DEPTH'}</span>
        <strong>{definition.depth} m</strong>
      </div>
      <div>
        <span>SNAPS</span>
        <strong>{snapPointCount ?? definition.snapPoints.length}</strong>
      </div>
      <div>
        <span>LEVEL</span>
        <strong>{levelLabel(piece.level ?? 0)}</strong>
      </div>
    </div>
    <div className="inspector-section">
      <label>Draw order · this level</label>
      <LayerOrderControls onReorder={onReorder} />
      <small className="inspector-help">Building levels always retain their vertical order.</small>
    </div>
    <button className="danger-button" onClick={onDelete}>
      <Trash2 size={15} /> Remove {selectedIds.length > 1 ? `${selectedIds.length} pieces` : 'piece'}
    </button>
    <button className="secondary-button full" onClick={() => onPlaceAnother(definition.id, piece.rotation)}>
      <Hammer size={15} /> Place another
    </button>
  </div>
)

interface SelectionMaterialsProps {
  selectedPieces: PlacedPiece[]
  resources: PieceResourceMap
  sprites: Record<string, string>
  craftingStations: PieceCraftingStationMap
  onDelete: () => void
  onReorder: (command: LayerOrderCommand) => void
}

const SelectionMaterials = ({
  selectedPieces,
  resources,
  sprites,
  craftingStations,
  onDelete,
  onReorder,
}: SelectionMaterialsProps) => {
  const summary = summarizeSelectedMaterials(selectedPieces, pieceById, resources)
  return (
    <div className="inspector selection-materials">
      <div className="selection-material-intro">
        <strong>{selectedPieces.length} build pieces</strong>
        <small>{summary.groups.length} object types · selected placement totals</small>
      </div>
      <div className="selected-piece-groups">
        {summary.groups.map((group) => {
          const definition = pieceById(group.pieceId)
          return (
            <section className="selected-piece-material" key={group.pieceId}>
              <div className="selected-piece-material-heading">
                <PieceGlyph piece={definition} sprite={sprites[definition.id]} />
                <span>
                  <strong>{definition.name}</strong>
                  <small>× {group.count}</small>
                </span>
              </div>
              <StationRequirement station={craftingStations[definition.id]} />
              <MaterialList materials={group.materials} emptyLabel="Planning marker · no materials" />
            </section>
          )
        })}
      </div>
      <section className="combined-materials">
        <div>
          <span className="section-kicker">COLLECTION LIST</span>
          <strong>Combined materials</strong>
        </div>
        <MaterialList materials={summary.totals} emptyLabel="No build materials in this selection" />
      </section>
      <div className="inspector-section selection-layer-order">
        <label>Draw order · each level</label>
        <LayerOrderControls onReorder={onReorder} />
        <small className="inspector-help">
          Selected pieces retain their internal order and never cross levels.
        </small>
      </div>
      <button className="danger-button" onClick={onDelete}>
        <Trash2 size={15} /> Remove selection
      </button>
    </div>
  )
}

const LayerOrderControls = ({ onReorder }: { onReorder: (command: LayerOrderCommand) => void }) => (
  <div className="layer-order-controls">
    <button onClick={() => onReorder('back')} title="Send selection to the back of each level">
      <ChevronsDown size={14} /> Back
    </button>
    <button onClick={() => onReorder('backward')} title="Move selection backward one position">
      <ChevronDown size={14} /> Lower
    </button>
    <button onClick={() => onReorder('forward')} title="Move selection forward one position">
      <ChevronUp size={14} /> Raise
    </button>
    <button onClick={() => onReorder('front')} title="Bring selection to the front of each level">
      <ChevronsUp size={14} /> Front
    </button>
  </div>
)

const StationRequirement = ({ station }: { station: PieceCraftingStationMap[string] | undefined }) => (
  <div className="station-requirement">
    <span>Required station</span>
    <strong>
      {station === undefined ? 'Not recorded' : station === null ? 'None' : station.displayName}
    </strong>
  </div>
)

const MaterialList = ({
  materials,
  emptyLabel,
}: {
  materials: readonly Pick<MaterialTotal, 'prefabName' | 'displayName' | 'amount'>[]
  emptyLabel: string
}) =>
  materials.length ? (
    <div className="material-list">
      {materials.map((material) => (
        <div className="material-row" key={material.prefabName}>
          <span>{material.displayName}</span>
          <strong>{material.amount.toLocaleString()}</strong>
        </div>
      ))}
    </div>
  ) : (
    <small className="material-empty">{emptyLabel}</small>
  )

interface AnnotationInspectorProps {
  annotation: PlanAnnotation
  onUpdate: (patch: Partial<PlanAnnotation>) => void
  onDelete: () => void
}

const AnnotationInspector = ({ annotation, onUpdate, onDelete }: AnnotationInspectorProps) => (
  <div className="inspector">
    <div className="selected-preview annotation-preview">
      {annotation.kind === 'text' ? (
        <Type size={25} />
      ) : annotation.kind === 'pen' ? (
        <Pencil size={25} />
      ) : (
        <Sprout size={25} />
      )}
      <div>
        <strong>
          {annotation.kind === 'text'
            ? 'Text annotation'
            : annotation.kind === 'pen'
              ? 'Pen stroke'
              : annotation.mode === 'cultivator'
                ? 'Cultivated ground'
                : 'Rounded farm area'}
        </strong>
        <small>{levelLabel(annotation.level ?? 0)}</small>
      </div>
    </div>
    {annotation.kind === 'text' && (
      <div className="inspector-section">
        <label>Text</label>
        <input
          className="inspector-text-input"
          value={annotation.text}
          onChange={(event) => onUpdate({ text: event.target.value } as Partial<PlanAnnotation>)}
        />
      </div>
    )}
    {annotation.kind === 'farm' ? (
      <div className="inspector-section">
        <label>Farm footprint</label>
        <div className="farm-metrics">
          <span className="farm-color" style={{ background: CULTIVATED_SOIL_COLOR }} />
          {annotation.mode === 'cultivator' ? (
            <span>
              <strong>{annotation.radius} m radius</strong>
              <small>{annotation.radius * 2} m diameter · Valheim Cultivate</small>
            </span>
          ) : (
            <span>
              <strong>
                {annotation.width.toFixed(1)} × {annotation.height.toFixed(1)} m
              </strong>
              <small>{annotation.cornerRadius} m cultivated-radius corners</small>
            </span>
          )}
        </div>
      </div>
    ) : (
      <div className="inspector-section">
        <label>Appearance</label>
        <div className="coordinate-inputs annotation-inputs">
          <span>
            COLOR
            <input
              type="color"
              value={annotation.color}
              onChange={(event) => onUpdate({ color: event.target.value })}
            />
          </span>
          <span>
            {annotation.kind === 'text' ? 'SIZE' : 'WIDTH'}
            <input
              type="number"
              min="0.1"
              max="20"
              step="0.1"
              value={annotation.kind === 'text' ? annotation.size : annotation.width}
              onChange={(event) =>
                annotation.kind === 'text'
                  ? onUpdate({ size: Number(event.target.value) } as Partial<PlanAnnotation>)
                  : onUpdate({ width: Number(event.target.value) } as Partial<PlanAnnotation>)
              }
            />
          </span>
        </div>
      </div>
    )}
    <button className="danger-button" onClick={onDelete}>
      <Trash2 size={14} /> Delete annotation
    </button>
  </div>
)

const PieceCatalog = (props: BuildPanelProps) => {
  const [expandedPieceId, setExpandedPieceId] = useState<string>()
  const categoryButton = (category: PieceCategory) => (
    <button
      key={category}
      className={!props.search.trim() && props.category === category ? 'active' : ''}
      aria-pressed={!props.search.trim() && props.category === category}
      onClick={() => {
        props.onSearchChange('')
        props.onCategoryChange(category)
      }}
    >
      {category}
    </button>
  )
  return (
    <>
      <div className="catalog-search">
        <Search size={15} />
        <input
          placeholder="Search all pieces…"
          aria-label="Search all pieces"
          value={props.search}
          onChange={(event) => props.onSearchChange(event.target.value)}
        />
      </div>
      <div className="category-tabs">
        {CATEGORIES.filter(isBuildingCategory).map(categoryButton)}
        <div className="object-category-tabs">
          {CATEGORIES.filter((category) => !isBuildingCategory(category)).map(categoryButton)}
        </div>
      </div>
      {props.search.trim() && (
        <p className="catalog-search-summary">{props.filteredCount} results across all categories</p>
      )}
      <div className="piece-list">
        {props.groupedPieces.map(([group, pieces]) => (
          <section className="catalog-group" key={group}>
            <div className="catalog-group-title">
              <span>{group}</span>
              <strong>{pieces.length}</strong>
            </div>
            {pieces.map((piece) => {
              const expanded = expandedPieceId === piece.id
              const comfort = props.pieceComfort[piece.id] ?? piece.comfort ?? 0
              return (
                <div className={`piece-card-shell ${expanded ? 'expanded' : ''}`} key={piece.id}>
                  <button
                    className={`piece-card ${props.activePieceId === piece.id ? 'active' : ''}`}
                    onClick={() => {
                      props.onSelectPiece(piece.id)
                      setExpandedPieceId((current) => (current === piece.id ? undefined : piece.id))
                    }}
                    style={{ '--piece-color': piece.color } as CSSProperties}
                    aria-expanded={expanded}
                    title={piece.name}
                  >
                    <PieceGlyph piece={piece} sprite={props.sprites[piece.id]} />
                    <span className="piece-copy">
                      <strong>{piece.name}</strong>
                      <small>{piece.material}</small>
                      <em>
                        {piece.width} × {piece.depth} m
                      </em>
                    </span>
                    <ChevronDown className="piece-card-chevron" size={15} />
                  </button>
                  {expanded && (
                    <div className="piece-card-requirements">
                      <div className="station-requirement comfort-requirement">
                        <span>Comfort</span>
                        <strong>{comfort > 0 ? `+${comfort}` : 'None'}</strong>
                      </div>
                      <StationRequirement station={props.craftingStations[piece.id]} />
                      <MaterialList
                        materials={resourcesForPiece(piece, props.pieceResources)}
                        emptyLabel="No build cost recorded"
                      />
                    </div>
                  )}
                </div>
              )
            })}
          </section>
        ))}
        {props.filteredCount === 0 && (
          <div className="no-results">
            <CircleHelp size={22} />
            <strong>No pieces found</strong>
            <span>Try a different name or material.</span>
          </div>
        )}
      </div>
      <div className="active-piece-footer">
        <PieceGlyph piece={props.activePiece} sprite={props.sprites[props.activePiece.id]} />
        <div>
          <small>ACTIVE PIECE</small>
          <strong>{props.activePiece.name}</strong>
        </div>
        <button
          onClick={props.onActivatePlace}
          className={props.tool === 'place' ? 'active' : ''}
          aria-label="Build with active piece"
        >
          <Hammer size={16} />
        </button>
      </div>
    </>
  )
}
