import { useContext, useEffect, useRef } from 'react'
import { ActionsRegistryApiContext } from './ActionsRegistry'
import type { ActionHref, ActionPairMeta, ActionTripletMeta, Direction } from './types'
import { resolveHref } from './omnibarNavigation'

/**
 * Handler function for actions.
 * Optionally receives captured values from digit placeholders in bindings.
 *
 * @example
 * ```tsx
 * // Simple handler (no captures)
 * handler: () => setPage(1)
 *
 * // Handler with captures (e.g., for binding "\d+ j")
 * handler: (e, captures) => {
 *   const n = captures?.[0] ?? 1
 *   setRow(row + n)
 * }
 * ```
 */
export type ActionHandler = (e?: KeyboardEvent, captures?: number[]) => void

export interface ActionConfig {
  /** Handler, optional when `href` is supplied. Provide at least one of the two. */
  handler?: ActionHandler
  /** Navigation target, resolved again when the action executes. */
  href?: ActionHref
  /** Human-readable label for omnibar/modal */
  label: string
  /** Longer description (shown in tooltips, omnibar) */
  description?: string
  /** Group name for organizing in modal */
  group?: string
  /** Mode ID this action belongs to (only active when mode is active) */
  mode?: string
  /** Default key bindings (user can override) */
  defaultBindings?: string[]
  /** Search keywords for omnibar */
  keywords?: string[]
  /** Whether action is currently enabled (default: true) */
  enabled?: boolean
  /** Priority for conflict resolution (higher wins, default: 0) */
  priority?: number
  /** Hide from ShortcutsModal (still searchable in omnibar) */
  hideFromModal?: boolean
  /** Protect bindings from removal (user can still add more, but not remove existing) */
  protected?: boolean
  /** Arrow group metadata (set by useArrowGroup) */
  arrowGroup?: { groupId: string; direction: Direction }
  /** Action pair metadata (set by useActionPair, or pass manually) */
  actionPair?: ActionPairMeta
  /** Action triplet metadata (set by useActionTriplet, or pass manually) */
  actionTriplet?: ActionTripletMeta
  /** Sort order within group in ShortcutsModal (default: 0, lower = earlier; registration order breaks ties) */
  sortOrder?: number
}

/**
 * Register an action with the hotkeys system.
 *
 * Actions are automatically unregistered when the component unmounts,
 * making this ideal for colocating actions with their handlers.
 *
 * @example
 * ```tsx
 * function DataTable() {
 *   const { prevPage, nextPage } = usePagination()
 *
 *   useAction('table:prev-page', {
 *     label: 'Previous page',
 *     group: 'Table Navigation',
 *     defaultBindings: [','],
 *     handler: prevPage,
 *   })
 *
 *   useAction('table:next-page', {
 *     label: 'Next page',
 *     group: 'Table Navigation',
 *     defaultBindings: ['.'],
 *     handler: nextPage,
 *   })
 * }
 * ```
 */
// The required-handler overload preserves contextual typing for generic calls
// such as `handler: useCallback((event, captures) => ..., [])`.
export function useAction(id: string, config: ActionConfig & { handler: ActionHandler }): void
export function useAction(id: string, config: ActionConfig): void
export function useAction(id: string, config: ActionConfig): void {
  // Consume the stable API context (not the full registry): registering an
  // action must not re-render every other useAction/useActions caller.
  const registry = useContext(ActionsRegistryApiContext)
  if (!registry) {
    throw new Error('useAction must be used within a HotkeysProvider')
  }

  // Keep registry in a ref to avoid re-running effect when registry object changes
  const registryRef = useRef(registry)
  registryRef.current = registry

  // Read current handlers and URL closures without re-registering on renders.
  const configRef = useRef(config)
  configRef.current = config

  // Keep enabled state in ref too
  const enabledRef = useRef(config.enabled ?? true)
  enabledRef.current = config.enabled ?? true

  useEffect(() => {
    registryRef.current.register(id, {
      ...config,
      get href() { return configRef.current.href },
      handler: (e, captures) => {
        if (enabledRef.current) {
          const current = configRef.current
          if (current.handler) current.handler(e, captures)
          else {
            const href = resolveHref(current.href)
            if (href) window.location.assign(href)
          }
        }
      },
    })

    return () => {
      registryRef.current.unregister(id)
    }
  }, [
    id,
    config.label,
    config.description,
    config.group,
    config.mode,
    // Compare bindings by value
    JSON.stringify(config.defaultBindings),
    JSON.stringify(config.keywords),
    config.priority,
    config.hideFromModal,
    config.protected,
    JSON.stringify(config.arrowGroup),
    JSON.stringify(config.actionPair),
    JSON.stringify(config.actionTriplet),
    config.sortOrder,
  ])

  // Sync live enabled state out-of-band: toggling `enabled` must not re-register
  // (which would bump the registry version and re-render every consumer). The
  // keydown path reads this via `isActionEnabled` before consuming a key.
  useEffect(() => {
    registryRef.current.setActionEnabled(id, config.enabled ?? true)
  }, [id, config.enabled])
}

/**
 * Register multiple actions at once.
 * Useful when you have several related actions in one component.
 *
 * @example
 * ```tsx
 * useActions({
 *   'left:temp': { label: 'Temperature', defaultBindings: ['t'], handler: () => setMetric('temp') },
 *   'left:co2': { label: 'CO₂', defaultBindings: ['c'], handler: () => setMetric('co2') },
 * })
 * ```
 */
export function useActions(actions: Record<string, ActionConfig & { handler: ActionHandler }>): void
export function useActions(actions: Record<string, ActionConfig>): void
export function useActions(actions: Record<string, ActionConfig>): void {
  // Consume the stable API context (see useAction): registering must not
  // re-render every other useAction/useActions caller on the registry version.
  const registry = useContext(ActionsRegistryApiContext)
  if (!registry) {
    throw new Error('useActions must be used within a HotkeysProvider')
  }

  // Keep registry in a ref to avoid re-running effect when registry object changes
  const registryRef = useRef(registry)
  registryRef.current = registry

  // Read current handlers and URL closures without re-registering on renders.
  const configsRef = useRef(actions)
  configsRef.current = actions
  const enabledRef = useRef<Record<string, boolean>>({})

  for (const [id, config] of Object.entries(actions)) {
    enabledRef.current[id] = config.enabled ?? true
  }

  useEffect(() => {
    for (const [id, config] of Object.entries(actions)) {
      registryRef.current.register(id, {
        ...config,
        get href() { return configsRef.current[id]?.href },
        handler: (e, captures) => {
          if (enabledRef.current[id]) {
            const current = configsRef.current[id]
            if (current?.handler) current.handler(e, captures)
            else {
              const href = resolveHref(current?.href)
              if (href) window.location.assign(href)
            }
          }
        },
      })
    }

    return () => {
      for (const id of Object.keys(actions)) {
        registryRef.current.unregister(id)
      }
    }
  }, [
    // Re-register if action set changes
    JSON.stringify(
      Object.entries(actions).map(([id, c]) => [
        id,
        c.label,
        c.group,
        c.mode,
        c.defaultBindings,
        c.keywords,
        c.priority,
        c.hideFromModal,
        c.protected,
        c.arrowGroup,
        c.actionPair,
        c.actionTriplet,
        c.sortOrder,
      ])
    ),
  ])

  // Sync live enabled state out-of-band (no re-register / no version bump).
  const enabledKey = JSON.stringify(
    Object.entries(actions).map(([id, c]) => [id, c.enabled ?? true])
  )
  useEffect(() => {
    for (const [id, config] of Object.entries(actions)) {
      registryRef.current.setActionEnabled(id, config.enabled ?? true)
    }
    // actions read through a stable key; deliberately keyed on enabledKey only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabledKey])
}
