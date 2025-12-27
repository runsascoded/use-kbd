import { useContext, useEffect, useRef } from 'react'
import { ActionsRegistryContext } from './ActionsRegistry'

export interface ActionConfig {
  /** Human-readable label for omnibar/modal */
  label: string
  /** Group name for organizing in modal */
  group?: string
  /** Default key bindings (user can override) */
  defaultBindings?: string[]
  /** Search keywords for omnibar */
  keywords?: string[]
  /** The action handler */
  handler: () => void
  /** Whether action is currently enabled (default: true) */
  enabled?: boolean
  /** Priority for conflict resolution (higher wins, default: 0) */
  priority?: number
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
export function useAction(id: string, config: ActionConfig): void {
  const registry = useContext(ActionsRegistryContext)
  if (!registry) {
    throw new Error('useAction must be used within a HotkeysProvider')
  }

  // Keep registry in a ref to avoid re-running effect when registry object changes
  const registryRef = useRef(registry)
  registryRef.current = registry

  // Keep handler in a ref so we don't re-register on every render
  const handlerRef = useRef(config.handler)
  handlerRef.current = config.handler

  // Keep enabled state in ref too
  const enabledRef = useRef(config.enabled ?? true)
  enabledRef.current = config.enabled ?? true

  useEffect(() => {
    registryRef.current.register(id, {
      ...config,
      handler: () => {
        if (enabledRef.current) {
          handlerRef.current()
        }
      },
    })

    return () => {
      registryRef.current.unregister(id)
    }
  }, [
    id,
    config.label,
    config.group,
    // Compare bindings by value
    JSON.stringify(config.defaultBindings),
    JSON.stringify(config.keywords),
    config.priority,
  ])
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
export function useActions(actions: Record<string, ActionConfig>): void {
  const registry = useContext(ActionsRegistryContext)
  if (!registry) {
    throw new Error('useActions must be used within a HotkeysProvider')
  }

  // Keep registry in a ref to avoid re-running effect when registry object changes
  const registryRef = useRef(registry)
  registryRef.current = registry

  // Keep handlers in refs
  const handlersRef = useRef<Record<string, () => void>>({})
  const enabledRef = useRef<Record<string, boolean>>({})

  for (const [id, config] of Object.entries(actions)) {
    handlersRef.current[id] = config.handler
    enabledRef.current[id] = config.enabled ?? true
  }

  useEffect(() => {
    for (const [id, config] of Object.entries(actions)) {
      registryRef.current.register(id, {
        ...config,
        handler: () => {
          if (enabledRef.current[id]) {
            handlersRef.current[id]?.()
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
        c.defaultBindings,
        c.keywords,
        c.priority,
      ])
    ),
  ])
}
