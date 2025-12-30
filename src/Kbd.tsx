import { Fragment, ReactNode } from 'react'
import { useMaybeHotkeysContext } from './HotkeysProvider'
import { getKeyIcon } from './KeyIcons'
import { ModifierIcon } from './ModifierIcons'
import { formatKeyForDisplay, parseHotkeyString } from './utils'
import type { KeyCombination } from './types'

export interface KbdProps {
  /** Action ID to display binding(s) for */
  action: string
  /** Separator between multiple bindings (default: " / ") */
  separator?: string
  /** Only show the first binding */
  first?: boolean
  /** Fallback content when no bindings exist */
  fallback?: React.ReactNode
  /** Additional className */
  className?: string
}

/**
 * Render a single key combination with SVG icons for modifiers and special keys
 */
function KeyCombo({ combo }: { combo: KeyCombination }) {
  const { key, modifiers } = combo
  const parts: ReactNode[] = []

  if (modifiers.meta) {
    parts.push(<ModifierIcon key="meta" modifier="meta" className="kbd-modifier-icon" />)
  }
  if (modifiers.ctrl) {
    parts.push(<ModifierIcon key="ctrl" modifier="ctrl" className="kbd-modifier-icon" />)
  }
  if (modifiers.alt) {
    parts.push(<ModifierIcon key="alt" modifier="alt" className="kbd-modifier-icon" />)
  }
  if (modifiers.shift) {
    parts.push(<ModifierIcon key="shift" modifier="shift" className="kbd-modifier-icon" />)
  }

  // Use SVG icon if available, otherwise formatted text
  const KeyIcon = getKeyIcon(key)
  if (KeyIcon) {
    parts.push(<KeyIcon key="key" className="kbd-key-icon" />)
  } else {
    parts.push(<span key="key">{formatKeyForDisplay(key)}</span>)
  }

  return <>{parts}</>
}

/**
 * Render a binding string (possibly a sequence) with icons
 */
function BindingDisplay({ binding }: { binding: string }) {
  const sequence = parseHotkeyString(binding)

  return (
    <>
      {sequence.map((combo, i) => (
        <Fragment key={i}>
          {i > 0 && <span className="kbd-sequence-sep"> </span>}
          <KeyCombo combo={combo} />
        </Fragment>
      ))}
    </>
  )
}

/**
 * Display the current binding(s) for an action.
 *
 * Automatically updates when users customize their bindings.
 * Uses SVG icons for modifiers (⌘, ⌥, ⇧, ⌃) and special keys (arrows, enter, etc.)
 *
 * @example
 * ```tsx
 * // Show all bindings for an action
 * <p>Press <Kbd action="help" /> to see shortcuts</p>
 *
 * // Show only the first binding
 * <p>Press <Kbd action="next" first /> to go to next item</p>
 *
 * // Custom separator for multiple bindings
 * <p>Navigate with <Kbd action="next" separator=" or " /></p>
 *
 * // With fallback when no binding exists
 * <Kbd action="customAction" fallback="(unbound)" />
 * ```
 */
export function Kbd({
  action,
  separator = ' / ',
  first = false,
  fallback = null,
  className,
}: KbdProps) {
  const ctx = useMaybeHotkeysContext()

  if (!ctx) {
    console.warn('Kbd: No HotkeysProvider found in component tree')
    return null
  }

  const bindings = first
    ? [ctx.registry.getFirstBindingForAction(action)].filter(Boolean) as string[]
    : ctx.registry.getBindingsForAction(action)

  if (bindings.length === 0) {
    return <>{fallback}</>
  }

  return (
    <kbd className={className}>
      {bindings.map((binding, i) => (
        <Fragment key={binding}>
          {i > 0 && separator}
          <BindingDisplay binding={binding} />
        </Fragment>
      ))}
    </kbd>
  )
}
