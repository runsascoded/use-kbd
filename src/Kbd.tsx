import { Fragment, useEffect, useRef } from 'react'
import { ACTION_LOOKUP, ACTION_MODAL, ACTION_OMNIBAR } from './constants'
import { useMaybeHotkeysContext } from './HotkeysProvider'
import { renderModifierIcons, renderKeyContent } from './KeyElements'
import { parseKeySeq } from './utils'
import type { KeyCombination, SeqElem } from './types'

export interface KbdProps {
  /** Action ID to display binding(s) for */
  action: string
  /** Separator between multiple bindings (default: " / ") */
  separator?: string
  /** Show all bindings instead of just the first (default: false, shows only first) */
  all?: boolean
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
  return (
    <>
      {renderModifierIcons(combo.modifiers)}
      {renderKeyContent(combo.key)}
    </>
  )
}

/**
 * Render a single sequence element (key, digit placeholder, or digits placeholder)
 */
function SeqElemDisplay({ elem }: { elem: SeqElem }) {
  if (elem.type === 'digit') {
    return <span className="kbd-placeholder" title="Any single digit (0-9)">#</span>
  }
  if (elem.type === 'digits') {
    return <span className="kbd-placeholder" title="One or more digits (0-9)">##</span>
  }
  // Regular key
  return <KeyCombo combo={{ key: elem.key, modifiers: elem.modifiers }} />
}

/**
 * Render a binding string (possibly a sequence) with icons
 */
function BindingDisplay({ binding }: { binding: string }) {
  const sequence = parseKeySeq(binding)

  return (
    <>
      {sequence.map((elem, i) => (
        <Fragment key={i}>
          {i > 0 && <span className="kbd-sequence-sep"> </span>}
          <SeqElemDisplay elem={elem} />
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
 * // Show all bindings (not just the first)
 * <p>Navigate with <Kbd action="next" all separator=" or " /></p>
 *
 * // With fallback when no binding exists
 * <Kbd action="customAction" fallback="(unbound)" />
 * ```
 */
export function Kbd({
  action,
  separator = ' / ',
  all = false,
  fallback = null,
  className,
  clickable = true,
}: KbdProps) {
  const ctx = useMaybeHotkeysContext()
  const warnedRef = useRef(false)

  const bindings = ctx
    ? (all
      ? ctx.registry.getBindingsForAction(action)
      : [ctx.registry.getFirstBindingForAction(action)].filter(Boolean) as string[])
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

/**
 * Display all bindings for an action (shows multiple if they exist).
 * Alias for `<Kbd all ... />`
 *
 * @example
 * ```tsx
 * <p>Navigate with <Kbds action="next" separator=" or " /></p>
 * ```
 */
export function Kbds(props: Omit<KbdProps, 'all'>) {
  return <Kbd {...props} all />
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
