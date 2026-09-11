import { useLayoutEffect, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, Compass } from 'lucide-react'
import { Modal } from './Modal'

export const WALKTHROUGH_KEY = 'hearthwright:walkthrough:v1'

const steps = [
  {
    title: 'Make room for your next build',
    target: '',
    text: 'Take a quick tour of Hearthwright. You can design on a blank canvas or add your world map later. This tour only explains the controls; your plan stays as it is.',
    hint: 'Skip at any time. Open Help to run the walkthrough again.',
  },
  {
    title: 'Choose your world — or start without one',
    target: 'map',
    text: 'Import a square PNG from the Valheim World Generator to plan at a real location. The map card shows its resolution and scale. “How to get a map” opens the download instructions.',
    hint: 'A map is optional. You can start building right away.',
  },
  {
    title: 'Find a site and move around',
    target: 'navigator',
    text: 'World shows the full map. Focus here zooms into the last canvas position you pointed at. Scroll to zoom; use Pan, middle-drag, or hold Space and drag to move around.',
    hint: 'Double-click the canvas in Select or Pan to zoom closer.',
  },
  {
    title: 'Find pieces and inspect your selection',
    target: 'catalog',
    text: 'Browse by material, or search all categories by name. Choose a piece to see its materials and required station. Selecting placed pieces turns this panel into an inspector with positions and a combined collection list.',
    hint: 'Selected build pieces rotate together around a shared center (Q / E). The inspector shows their combined material totals. Escape returns to the catalog.',
  },
  {
    title: 'Build a piece, a line, or a whole floor',
    target: 'tools',
    text: 'Build places one piece per click. Line uses a start and end click. Box fills an area as you drag. Text and Pen add notes; Farm paints or erases cultivated ground.',
    hint: 'B: Build · L: Line · X: Box · T: Text · P: Pen · F: Farm. Right-click cancels a line or box.',
  },
  {
    title: 'Connect and rotate',
    target: 'placement',
    text: 'Piece snapping connects the game’s build anchors. Free lets you position freely. Hold Shift for a temporary Free override. Rotate the active piece or your selection with the arrow buttons.',
    hint: 'Q / E rotate by 22.5°. S switches Piece and Free.',
  },
  {
    title: 'Select, copy, and recover an edit',
    target: 'editing',
    text: 'Use Select, then click a piece or drag a box around a group. Shift or Ctrl adds to the selection. Move the group by dragging a selected piece. Undo and Redo let you try ideas and step back.',
    hint: 'V: Select · Ctrl+C / V: copy / paste · Delete: remove · Ctrl+Z: undo.',
  },
  {
    title: 'Keep each floor readable',
    target: 'levels',
    text: 'Add upper levels for a multistory build. Select a level and use Move up or Move down to fit it between other floors. Its pieces, notes, and visibility settings move together.',
    hint: 'Reordering and adding levels can be undone. Other floors can be hidden, outlined, or shown with their actual pieces.',
  },
  {
    title: 'Check reach before you build',
    target: 'ranges',
    text: 'Comfort, Spawn block, and Craft show their reach on the active level. Select a crafting station to see links to the upgrades contributing to its range.',
    hint: 'These overlays help with layout. Roof, shelter, terrain, and vertical distance still need checking in game.',
  },
  {
    title: 'Read your plan at a glance',
    target: 'summary',
    text: 'The summary counts your plan items and lists the largest material totals. Select a group for its full collection list in the inspector. The bottom bar reports your cursor’s world coordinates, zoom, and recent actions.',
    hint: 'A local draft is kept as you edit. Save a project file to keep a named copy.',
  },
  {
    title: 'Save your build and keep exploring',
    target: 'save',
    text: 'New project starts a blank canvas and offers to save your current work. Save project keeps an editable .hearthwright file. Save As makes a copy. Open project loads a saved plan; Export PNG shares the current view.',
    hint: 'Ctrl+S saves · Ctrl+Shift+S saves a copy. The ? button reopens Help and this walkthrough.',
  },
]

type Highlight = { left: number; top: number; width: number; height: number }

export function Walkthrough({ onFinish }: { onFinish: () => void }) {
  const [index, setIndex] = useState(0)
  const [highlight, setHighlight] = useState<Highlight>()
  const copyRef = useRef<HTMLDivElement>(null)
  const step = steps[index]

  useLayoutEffect(() => {
    const scrollAreas = [...document.querySelectorAll<HTMLElement>('.panel-scroll, .piece-list')].map(
      (element) => ({ element, top: element.scrollTop }),
    )
    return () =>
      scrollAreas.forEach(({ element, top }) => {
        element.scrollTop = top
      })
  }, [])

  useLayoutEffect(() => {
    if (copyRef.current) copyRef.current.scrollTop = 0
    const target = step.target ? document.querySelector<HTMLElement>(`[data-tour="${step.target}"]`) : null
    target?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'instant' })
    const update = () => {
      const bounds = target?.getBoundingClientRect()
      const h = bounds
        ? {
            left: Math.max(6, bounds.left - 5),
            top: Math.max(6, bounds.top - 5),
            width: Math.max(0, Math.min(innerWidth - 6, bounds.right + 5) - Math.max(6, bounds.left - 5)),
            height: Math.max(0, Math.min(innerHeight - 6, bounds.bottom + 5) - Math.max(6, bounds.top - 5)),
          }
        : undefined
      setHighlight(h)
    }
    update()
    const observer = new ResizeObserver(update)
    if (target) observer.observe(target)
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, true)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update, true)
    }
  }, [step])

  return (
    <Modal
      labelledBy="walkthrough-title"
      onClose={onFinish}
      className="walkthrough-card"
      backdropClassName={highlight ? 'walkthrough-backdrop has-highlight' : 'walkthrough-backdrop'}
      decoration={highlight && <div className="walkthrough-highlight" aria-hidden="true" style={highlight} />}
    >
      <div className="walkthrough-layout">
        <div className="walkthrough-heading">
          <Compass size={22} />
          <span>GET TO KNOW HEARTHWRIGHT</span>
          <span>
            {index + 1} / {steps.length}
          </span>
        </div>
        <div ref={copyRef} className="walkthrough-copy" aria-live="polite" aria-atomic="true" tabIndex={0}>
          <h2 id="walkthrough-title">{step.title}</h2>
          <p>{step.text}</p>
          <div className="walkthrough-hint">{step.hint}</div>
        </div>
        <div className="walkthrough-progress" aria-hidden="true">
          {steps.map((s, i) => (
            <span key={s.title} className={i <= index ? 'complete' : ''} />
          ))}
        </div>
        <div className="walkthrough-actions">
          <button className="text-button" onClick={onFinish}>
            Skip tour
          </button>
          <div>
            <button className="secondary-button" disabled={index === 0} onClick={() => setIndex(index - 1)}>
              <ArrowLeft size={14} /> Back
            </button>
            <button
              className="primary-button"
              onClick={() => (index === steps.length - 1 ? onFinish() : setIndex(index + 1))}
            >
              {index === steps.length - 1 ? 'Start building' : 'Next'} <ArrowRight size={14} />
            </button>
          </div>
        </div>
      </div>
    </Modal>
  )
}
