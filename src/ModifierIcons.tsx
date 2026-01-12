import { forwardRef, type CSSProperties, type SVGProps } from 'react'
import { isMac } from './utils'

export interface ModifierIconProps extends SVGProps<SVGSVGElement> {
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
export const Command = forwardRef<SVGSVGElement, ModifierIconProps>(
  ({ className, style, ...props }, ref) => (
    <svg
      ref={ref}
      className={className}
      style={{ ...baseStyle, ...style }}
      viewBox="0 0 24 24"
      fill="currentColor"
      {...props}
    >
      <path d="M6 4a2 2 0 0 0-2 2v2a2 2 0 0 0 2 2h2v4H6a2 2 0 0 0-2 2v2a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2v-2h4v2a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2v-2a2 2 0 0 0-2-2h-2v-4h2a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v2h-4V6a2 2 0 0 0-2-2H6zm4 6h4v4h-4v-4z"/>
    </svg>
  )
)
Command.displayName = 'Command'

/** Control key icon (^) - chevron/caret */
export const Ctrl = forwardRef<SVGSVGElement, ModifierIconProps>(
  ({ className, style, ...props }, ref) => (
    <svg
      ref={ref}
      className={className}
      style={{ ...baseStyle, ...style }}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M6 15l6-6 6 6"/>
    </svg>
  )
)
Ctrl.displayName = 'Ctrl'

/** Shift key icon (⇧) - hollow arrow */
export const Shift = forwardRef<SVGSVGElement, ModifierIconProps>(
  ({ className, style, ...props }, ref) => (
    <svg
      ref={ref}
      className={className}
      style={{ ...wideStyle, ...style }}
      viewBox="0 0 28 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M14 3L3 14h6v7h10v-7h6L14 3z"/>
    </svg>
  )
)
Shift.displayName = 'Shift'

/** Option key icon (⌥) - macOS style */
export const Option = forwardRef<SVGSVGElement, ModifierIconProps>(
  ({ className, style, ...props }, ref) => (
    <svg
      ref={ref}
      className={className}
      style={{ ...baseStyle, ...style }}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M4 6h6l8 12h6M14 6h6"/>
    </svg>
  )
)
Option.displayName = 'Option'

/** Alt key icon (⎇) - Windows style, though "Alt" text is more common on Windows */
export const Alt = forwardRef<SVGSVGElement, ModifierIconProps>(
  ({ className, style, ...props }, ref) => (
    <svg
      ref={ref}
      className={className}
      style={{ ...baseStyle, ...style }}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      {/* ⎇ - branching path representing "alternative" */}
      <path d="M4 18h8M12 18l4-6M12 18l4 0M16 12l4-6h-8"/>
    </svg>
  )
)
Alt.displayName = 'Alt'

export type ModifierType = 'meta' | 'ctrl' | 'shift' | 'alt' | 'opt'

/** Get the appropriate icon component for a modifier key */
export function getModifierIcon(modifier: ModifierType): typeof Command {
  switch (modifier) {
    case 'meta':
      return Command
    case 'ctrl':
      return Ctrl
    case 'shift':
      return Shift
    case 'opt':
      return Option
    case 'alt':
      // On Mac, Alt is Option (⌥). On Windows, Alt is ⎇ (though text "Alt" is more common)
      return isMac() ? Option : Alt
  }
}

/** Render a modifier icon by name */
export const ModifierIcon = forwardRef<SVGSVGElement, ModifierIconProps & { modifier: ModifierType }>(
  ({ modifier, ...props }, ref) => {
    const Icon = getModifierIcon(modifier)
    return <Icon ref={ref} {...props} />
  }
)
ModifierIcon.displayName = 'ModifierIcon'
