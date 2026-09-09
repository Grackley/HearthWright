import type { ReactNode } from 'react'

interface ToolButtonProps {
  active?: boolean
  label: string
  shortcut?: string
  onClick: () => void
  children: ReactNode
}

export const ToolButton = ({ active, label, shortcut, onClick, children }: ToolButtonProps) => (
  <button
    className={`tool-button ${active ? 'active' : ''}`}
    onClick={onClick}
    title={`${label}${shortcut ? ` (${shortcut})` : ''}`}
  >
    {children}
    <span>{label}</span>
  </button>
)

interface ToggleRowProps {
  label: string
  detail?: string
  checked: boolean
  onChange: () => void
  icon: ReactNode
}

export const ToggleRow = ({ label, detail, checked, onChange, icon }: ToggleRowProps) => (
  <button className="toggle-row" onClick={onChange} role="switch" aria-checked={checked}>
    <span className="toggle-icon">{icon}</span>
    <span className="toggle-copy">
      <strong>{label}</strong>
      {detail && <small>{detail}</small>}
    </span>
    <span className={`switch ${checked ? 'on' : ''}`}>
      <i />
    </span>
  </button>
)
