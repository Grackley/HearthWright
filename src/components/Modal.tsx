import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

interface ModalProps {
  children: ReactNode
  labelledBy: string
  onClose: () => void
  className?: string
  backdropClassName?: string
  decoration?: ReactNode
  style?: CSSProperties
}

export function Modal({
  children,
  labelledBy,
  onClose,
  className = 'save-prompt',
  backdropClassName = '',
  decoration,
  style,
}: ModalProps) {
  const dialogRef = useRef<HTMLElement>(null)
  const closeRef = useRef(onClose)
  closeRef.current = onClose

  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null
    const root = document.getElementById('root')
    const wasInert = root?.inert ?? false
    if (root) root.inert = true
    const dialog = dialogRef.current!
    dialog.focus()
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopPropagation()
        closeRef.current()
      }
      if (event.key !== 'Tab') return
      const buttons = [
        ...dialog.querySelectorAll<HTMLElement>(
          'button:not(:disabled), a[href], input:not(:disabled):not([hidden]), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]',
        ),
      ]
      const first = buttons[0]
      const last = buttons.at(-1)
      if (!first) {
        event.preventDefault()
        dialog.focus()
      } else if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog)) {
        event.preventDefault()
        last?.focus()
      } else if (!event.shiftKey && (document.activeElement === last || document.activeElement === dialog)) {
        event.preventDefault()
        first.focus()
      }
    }
    window.addEventListener('keydown', handleKey, true)
    return () => {
      window.removeEventListener('keydown', handleKey, true)
      if (root) root.inert = wasInert
      if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true })
    }
  }, [])

  return createPortal(
    <div className={`modal-backdrop ${backdropClassName}`}>
      {decoration}
      <section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        tabIndex={-1}
        className={className}
        style={style}
      >
        {children}
      </section>
    </div>,
    document.body,
  )
}
