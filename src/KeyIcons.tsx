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
export function ArrowUpIcon({ className, style }: KeyIconProps) {
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
export function ArrowDownIcon({ className, style }: KeyIconProps) {
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
export function ArrowLeftIcon({ className, style }: KeyIconProps) {
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
export function ArrowRightIcon({ className, style }: KeyIconProps) {
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
export function EnterIcon({ className, style }: KeyIconProps) {
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
export function BackspaceIcon({ className, style }: KeyIconProps) {
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

export type KeyIconType = 'arrowup' | 'arrowdown' | 'arrowleft' | 'arrowright' | 'enter' | 'backspace'

/** Get the icon component for a key, or null if no icon exists */
export function getKeyIcon(key: string): React.ComponentType<KeyIconProps> | null {
  switch (key.toLowerCase()) {
    case 'arrowup':
      return ArrowUpIcon
    case 'arrowdown':
      return ArrowDownIcon
    case 'arrowleft':
      return ArrowLeftIcon
    case 'arrowright':
      return ArrowRightIcon
    case 'enter':
      return EnterIcon
    case 'backspace':
      return BackspaceIcon
    default:
      return null
  }
}
