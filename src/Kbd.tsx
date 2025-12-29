import { useMaybeHotkeysContext } from './HotkeysProvider'
import { formatBinding } from './utils'

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
 * Display the current binding(s) for an action.
 *
 * Automatically updates when users customize their bindings.
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

  const formatted = bindings.map(formatBinding)

  return <kbd className={className}>{formatted.join(separator)}</kbd>
}
