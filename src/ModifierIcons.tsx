import { type CSSProperties, type ComponentType } from 'react'

export interface ModifierIconProps {
  className?: string
  style?: CSSProperties
}

const baseStyle: CSSProperties = {
  width: '1.2em',
  height: '1.2em',
  marginRight: '2px',
  verticalAlign: 'middle',
}

const wideStyle: CSSProperties = {
  ...baseStyle,
  width: '1.4em',
}

/** Command/Meta key icon (⌘) */
export function CommandIcon({ className, style }: ModifierIconProps) {
  return (
    <svg
      className={className}
      style={{ ...baseStyle, ...style }}
      viewBox="0 0 24 24"
      fill="currentColor"
    >
      <path d="M6 4a2 2 0 0 0-2 2v2a2 2 0 0 0 2 2h2v4H6a2 2 0 0 0-2 2v2a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2v-2h4v2a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2v-2a2 2 0 0 0-2-2h-2v-4h2a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v2h-4V6a2 2 0 0 0-2-2H6zm4 6h4v4h-4v-4z"/>
    </svg>
  )
}

/** Control key icon (^) - chevron/caret */
export function CtrlIcon({ className, style }: ModifierIconProps) {
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
      <path d="M6 15l6-6 6 6"/>
    </svg>
  )
}

/** Shift key icon (⇧) - hollow arrow */
export function ShiftIcon({ className, style }: ModifierIconProps) {
  return (
    <svg
      className={className}
      style={{ ...wideStyle, ...style }}
      viewBox="0 0 28 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinejoin="round"
    >
      <path d="M14 3L3 14h6v7h10v-7h6L14 3z"/>
    </svg>
  )
}

/** Option key icon (⌥) - macOS style */
export function OptIcon({ className, style }: ModifierIconProps) {
  return (
    <svg
      className={className}
      style={{ ...baseStyle, ...style }}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 6h6l8 12h6M14 6h6"/>
    </svg>
  )
}

/** Alt key icon (⎇) - Windows style, though "Alt" text is more common on Windows */
export function AltIcon({ className, style }: ModifierIconProps) {
  return (
    <svg
      className={className}
      style={{ ...baseStyle, ...style }}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* ⎇ - branching path representing "alternative" */}
      <path d="M4 18h8M12 18l4-6M12 18l4 0M16 12l4-6h-8"/>
    </svg>
  )
}

export type ModifierType = 'meta' | 'ctrl' | 'shift' | 'alt' | 'opt'

/** Detect if running on macOS */
export const isMac = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform)

/** Get the appropriate icon component for a modifier key */
export function getModifierIcon(modifier: ModifierType): ComponentType<ModifierIconProps> {
  switch (modifier) {
    case 'meta':
      return CommandIcon
    case 'ctrl':
      return CtrlIcon
    case 'shift':
      return ShiftIcon
    case 'opt':
      return OptIcon
    case 'alt':
      // On Mac, Alt is Option (⌥). On Windows, Alt is ⎇ (though text "Alt" is more common)
      return isMac ? OptIcon : AltIcon
  }
}

/** Render a modifier icon by name */
export function ModifierIcon({ modifier, ...props }: ModifierIconProps & { modifier: ModifierType }) {
  const Icon = getModifierIcon(modifier)
  return <Icon {...props} />
}
