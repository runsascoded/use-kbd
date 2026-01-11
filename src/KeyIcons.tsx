import { type CSSProperties } from 'react'

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

export type KeyIconType = 'arrowup' | 'arrowdown' | 'arrowleft' | 'arrowright' | 'enter' | 'backspace' | 'tab'

/** Get the icon component for a key, or null if no icon exists */
export function getKeyIcon(key: string): React.ComponentType<KeyIconProps> | null {
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
