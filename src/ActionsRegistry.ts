import { createContext, useCallback, useMemo, useRef, useState } from 'react'
import type { ActionRegistry } from './types'
import type { ActionConfig } from './useAction'
import type { HotkeyMap } from './useHotkeys'

export interface RegisteredAction {
  config: ActionConfig
  registeredAt: number
}

export interface ActionsRegistryValue {
  /** Register an action. Called by useAction on mount. */
  register: (id: string, config: ActionConfig) => void
  /** Unregister an action. Called by useAction on unmount. */
  unregister: (id: string) => void
  /** Execute an action by ID */
  execute: (id: string) => void
  /** Currently registered actions */
  actions: Map<string, RegisteredAction>
  /** Computed keymap from registered actions + user overrides */
  keymap: HotkeyMap
  /** Action registry for omnibar search */
  actionRegistry: ActionRegistry
  /** Get all bindings for an action (defaults + overrides) */
  getBindingsForAction: (id: string) => string[]
  /** User's binding overrides */
  overrides: Record<string, string | string[]>
  /** Set a user override for a binding */
  setBinding: (actionId: string, key: string) => void
  /** Remove a binding */
  removeBinding: (key: string) => void
  /** Reset all overrides */
  resetOverrides: () => void
}

export const ActionsRegistryContext = createContext<ActionsRegistryValue | null>(null)

export interface UseActionsRegistryOptions {
  /** localStorage key for persisting user overrides */
  storageKey?: string
}

/**
 * Hook to create an actions registry.
 * Used internally by HotkeysProvider.
 */
export function useActionsRegistry(options: UseActionsRegistryOptions = {}): ActionsRegistryValue {
  const { storageKey } = options

  // Registered actions (mutable for perf, state for re-renders)
  const actionsRef = useRef<Map<string, RegisteredAction>>(new Map())
  const [actionsVersion, setActionsVersion] = useState(0)

  // User overrides (persisted)
  const [overrides, setOverrides] = useState<Record<string, string | string[]>>(() => {
    if (!storageKey || typeof window === 'undefined') return {}
    try {
      const stored = localStorage.getItem(storageKey)
      return stored ? JSON.parse(stored) : {}
    } catch {
      return {}
    }
  })

  // Persist overrides
  const updateOverrides = useCallback((newOverrides: Record<string, string | string[]>) => {
    setOverrides(newOverrides)
    if (storageKey && typeof window !== 'undefined') {
      try {
        if (Object.keys(newOverrides).length === 0) {
          localStorage.removeItem(storageKey)
        } else {
          localStorage.setItem(storageKey, JSON.stringify(newOverrides))
        }
      } catch {
        // Ignore storage errors
      }
    }
  }, [storageKey])

  const register = useCallback((id: string, config: ActionConfig) => {
    actionsRef.current.set(id, {
      config,
      registeredAt: Date.now(),
    })
    setActionsVersion(v => v + 1)
  }, [])

  const unregister = useCallback((id: string) => {
    actionsRef.current.delete(id)
    setActionsVersion(v => v + 1)
  }, [])

  const execute = useCallback((id: string) => {
    const action = actionsRef.current.get(id)
    if (action && (action.config.enabled ?? true)) {
      action.config.handler()
    }
  }, [])

  // Compute keymap from registered actions + overrides
  const keymap = useMemo(() => {
    const map: HotkeyMap = {}

    // First, add all default bindings from registered actions
    for (const [id, { config }] of actionsRef.current) {
      for (const binding of config.defaultBindings ?? []) {
        // Check if this binding has been overridden
        if (overrides[binding] !== undefined) continue

        const existing = map[binding]
        if (existing) {
          // Multiple actions on same key
          map[binding] = Array.isArray(existing) ? [...existing, id] : [existing, id]
        } else {
          map[binding] = id
        }
      }
    }

    // Then apply user overrides
    for (const [key, actionOrActions] of Object.entries(overrides)) {
      if (actionOrActions === '') {
        // Removed binding
        delete map[key]
      } else {
        map[key] = actionOrActions
      }
    }

    return map
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actionsVersion, overrides])

  // Build action registry for omnibar
  const actionRegistry = useMemo(() => {
    const registry: ActionRegistry = {}
    for (const [id, { config }] of actionsRef.current) {
      registry[id] = {
        label: config.label,
        category: config.group,
        keywords: config.keywords,
      }
    }
    return registry
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actionsVersion])

  const getBindingsForAction = useCallback((actionId: string) => {
    const bindings: string[] = []

    // Get from keymap (includes defaults and overrides)
    for (const [key, action] of Object.entries(keymap)) {
      const actions = Array.isArray(action) ? action : [action]
      if (actions.includes(actionId)) {
        bindings.push(key)
      }
    }

    return bindings
  }, [keymap])

  const setBinding = useCallback((actionId: string, key: string) => {
    updateOverrides({
      ...overrides,
      [key]: actionId,
    })
  }, [overrides, updateOverrides])

  const removeBinding = useCallback((key: string) => {
    const action = actionsRef.current.get(overrides[key] as string)
    const isDefault = action?.config.defaultBindings?.includes(key)

    if (isDefault) {
      // Mark as explicitly removed
      updateOverrides({ ...overrides, [key]: '' })
    } else {
      // Just remove the override
      const { [key]: _, ...rest } = overrides
      updateOverrides(rest)
    }
  }, [overrides, updateOverrides])

  const resetOverrides = useCallback(() => {
    updateOverrides({})
  }, [updateOverrides])

  // Create a snapshot of the map for consumers
  const actions = useMemo(() => {
    return new Map(actionsRef.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actionsVersion])

  // Memoize return object to minimize context changes
  return useMemo(() => ({
    register,
    unregister,
    execute,
    actions,
    keymap,
    actionRegistry,
    getBindingsForAction,
    overrides,
    setBinding,
    removeBinding,
    resetOverrides,
  }), [
    register,
    unregister,
    execute,
    actions,
    keymap,
    actionRegistry,
    getBindingsForAction,
    overrides,
    setBinding,
    removeBinding,
    resetOverrides,
  ])
}
