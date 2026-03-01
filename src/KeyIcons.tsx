import { ComponentType, type CSSProperties } from 'react'

export interface KeyIconProps {
  className?: string
  style?: CSSProperties
}

const baseStyle: CSSProperties = {
  width: '1em',
  height: '1em',
  verticalAlign: 'middle',
}

/** Arrow Up icon (↑) */
export function Up({ className, style }: KeyIconProps) {
  return (
    <svg
      className={className}
      style={{ ...baseStyle, ...style }}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 19V5M5 12l7-7 7 7"/>
    </svg>
  )
}

/** Arrow Down icon (↓) */
export function Down({ className, style }: KeyIconProps) {
  return (
    <svg
      className={className}
      style={{ ...baseStyle, ...style }}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 5v14M5 12l7 7 7-7"/>
    </svg>
  )
}

/** Arrow Left icon (←) */
export function Left({ className, style }: KeyIconProps) {
  return (
    <svg
      className={className}
      style={{ ...baseStyle, ...style }}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M19 12H5M12 5l-7 7 7 7"/>
    </svg>
  )
}

/** Arrow Right icon (→) */
export function Right({ className, style }: KeyIconProps) {
  return (
    <svg
      className={className}
      style={{ ...baseStyle, ...style }}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M5 12h14M12 5l7 7-7 7"/>
    </svg>
  )
}

/** Enter/Return icon (↵) */
export function Enter({ className, style }: KeyIconProps) {
  return (
    <svg
      className={className}
      style={{ ...baseStyle, ...style }}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M9 10l-4 4 4 4"/>
      <path d="M19 6v8a2 2 0 01-2 2H5"/>
    </svg>
  )
}

/** Backspace icon (⌫) */
export function Backspace({ className, style }: KeyIconProps) {
  return (
    <svg
      className={className}
      style={{ ...baseStyle, ...style }}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 4H8l-7 8 7 8h13a2 2 0 002-2V6a2 2 0 00-2-2z"/>
      <line x1="18" y1="9" x2="12" y2="15"/>
      <line x1="12" y1="9" x2="18" y2="15"/>
    </svg>
  )
}

/** Tab icon (⇥) - rightward arrow to bar */
export function Tab({ className, style }: KeyIconProps) {
  return (
    <svg
      className={className}
      style={{ ...baseStyle, ...style }}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="4" y1="12" x2="16" y2="12"/>
      <polyline points="12 8 16 12 12 16"/>
      <line x1="20" y1="6" x2="20" y2="18"/>
    </svg>
  )
}

const compactStyle: CSSProperties = {
  width: '1.4em',
  height: '1.4em',
  verticalAlign: 'middle',
}

/** Compact 4-way move icon (cross shape with arrow points) */
export function ArrowsMove({ className, style }: KeyIconProps) {
  return (
    <svg
      className={className}
      style={{ ...compactStyle, ...style }}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* Horizontal line with arrow points */}
      <line x1="3" y1="12" x2="21" y2="12"/>
      <polyline points="18 9 21 12 18 15"/>
      <polyline points="6 9 3 12 6 15"/>
      {/* Vertical line with arrow points */}
      <line x1="12" y1="3" x2="12" y2="21"/>
      <polyline points="9 6 12 3 15 6"/>
      <polyline points="9 18 12 21 15 18"/>
    </svg>
  )
}

/** Compact D-pad icon (four filled triangular arrowheads) */
export function ArrowsDpad({ className, style }: KeyIconProps) {
  return (
    <svg
      className={className}
      style={{ ...compactStyle, ...style }}
      viewBox="0 0 24 24"
      fill="currentColor"
      stroke="none"
    >
      {/* Up */}
      <polygon points="12,2 8,9 16,9"/>
      {/* Down */}
      <polygon points="12,22 8,15 16,15"/>
      {/* Left */}
      <polygon points="2,12 9,8 9,16"/>
      {/* Right */}
      <polygon points="22,12 15,8 15,16"/>
    </svg>
  )
}

/** Compact double-headed arrows icon (horizontal + vertical) */
export function ArrowsDouble({ className, style }: KeyIconProps) {
  return (
    <svg
      className={className}
      style={{ ...compactStyle, ...style }}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* Horizontal double arrow */}
      <line x1="3" y1="12" x2="21" y2="12"/>
      <polyline points="18 9 21 12 18 15"/>
      <polyline points="6 9 3 12 6 15"/>
      {/* Vertical double arrow */}
      <line x1="12" y1="3" x2="12" y2="21"/>
      <polyline points="9 6 12 3 15 6"/>
      <polyline points="9 18 12 21 15 18"/>
    </svg>
  )
}

export type KeyIconType = 'arrowup' | 'arrowdown' | 'arrowleft' | 'arrowright' | 'enter' | 'backspace' | 'tab'

/** Get the icon component for a key, or null if no icon exists */
export function getKeyIcon(key: string): ComponentType<KeyIconProps> | null {
  switch (key.toLowerCase()) {
    case 'arrowup':
      return Up
    case 'arrowdown':
      return Down
    case 'arrowleft':
      return Left
    case 'arrowright':
      return Right
    case 'enter':
      return Enter
    case 'backspace':
      return Backspace
    case 'tab':
      return Tab
    default:
      return null
  }
}
