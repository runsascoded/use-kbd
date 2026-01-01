import { Fragment, ReactNode, useEffect, useRef } from 'react'
import { ACTION_LOOKUP, ACTION_MODAL, ACTION_OMNIBAR } from './constants'
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
  /** Make the kbd clickable to trigger the action */
  clickable?: boolean
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
 * Display the current binding(s) for an action (clickable by default).
 *
 * Automatically updates when users customize their bindings.
 * Uses SVG icons for modifiers (⌘, ⌥, ⇧, ⌃) and special keys (arrows, enter, etc.)
 *
 * @example
 * ```tsx
 * // Clickable kbd that triggers the action (default)
 * <p>Press <Kbd action="help" /> to see shortcuts</p>
 *
 * // Non-clickable for pure display (use Key alias or clickable={false})
 * <p>Navigate with <Key action="next" /> to go to next item</p>
 *
 * // Show only the first binding
 * <p>Press <Kbd action="next" first /> to go to next item</p>
 *
 * // Custom separator for multiple bindings
 * <p>Navigate with <Key action="next" separator=" or " /></p>
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
  clickable = true,
}: KbdProps) {
  const ctx = useMaybeHotkeysContext()
  const warnedRef = useRef(false)

  const bindings = ctx
    ? (first
      ? [ctx.registry.getFirstBindingForAction(action)].filter(Boolean) as string[]
      : ctx.registry.getBindingsForAction(action))
    : []

  // Warn about missing actions after mount (to allow time for registration)
  useEffect(() => {
    if (!ctx) return
    if (warnedRef.current) return

    const timer = setTimeout(() => {
      if (!ctx.registry.actions.has(action)) {
        console.warn(`Kbd: Action "${action}" not found in registry`)
        warnedRef.current = true
      }
    }, 100)

    return () => clearTimeout(timer)
  }, [ctx, action])

  if (!ctx) {
    return null
  }

  if (bindings.length === 0) {
    return <>{fallback}</>
  }

  const content = bindings.map((binding, i) => (
    <Fragment key={binding}>
      {i > 0 && separator}
      <BindingDisplay binding={binding} />
    </Fragment>
  ))

  if (clickable) {
    return (
      <kbd
        className={`${className || ''} kbd-clickable`.trim()}
        onClick={() => ctx.executeAction(action)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            ctx.executeAction(action)
          }
        }}
      >
        {content}
      </kbd>
    )
  }

  return <kbd className={className}>{content}</kbd>
}

/**
 * Non-clickable variant of Kbd for pure display/documentation purposes.
 * Alias for `<Kbd clickable={false} ... />`
 */
export function Key(props: Omit<KbdProps, 'clickable'>) {
  return <Kbd {...props} clickable={false} />
}

type BuiltinKbdProps = Omit<KbdProps, 'action'>

/**
 * Kbd for the ShortcutsModal trigger (default: `?`).
 * @example <KbdModal /> // Shows "?" or user's custom binding
 */
export function KbdModal(props: BuiltinKbdProps) {
  return <Kbd {...props} action={ACTION_MODAL} />
}

/**
 * Kbd for the Omnibar trigger (default: `⌘K`).
 * @example <KbdOmnibar /> // Shows "⌘K" or user's custom binding
 */
export function KbdOmnibar(props: BuiltinKbdProps) {
  return <Kbd {...props} action={ACTION_OMNIBAR} />
}

/**
 * Kbd for the LookupModal trigger (default: `⌘⇧K`).
 * @example <KbdLookup /> // Shows "⌘⇧K" or user's custom binding
 */
export function KbdLookup(props: BuiltinKbdProps) {
  return <Kbd {...props} action={ACTION_LOOKUP} />
}
