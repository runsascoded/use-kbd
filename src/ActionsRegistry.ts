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
  /** Execute an action by ID, optionally with captured digit values */
  execute: (id: string, captures?: number[]) => void
  /** Currently registered actions */
  actions: Map<string, RegisteredAction>
  /** Computed keymap from registered actions + user overrides */
  keymap: HotkeyMap
  /** Action registry for omnibar search */
  actionRegistry: ActionRegistry
  /** Get all bindings for an action (defaults + overrides) */
  getBindingsForAction: (id: string) => string[]
  /** Get the first binding for an action (convenience for display) */
  getFirstBindingForAction: (id: string) => string | undefined
  /** User's binding overrides */
  overrides: Record<string, string | string[]>
  /** Set a user override for a binding */
  setBinding: (actionId: string, key: string) => void
  /** Remove a binding for a specific action */
  removeBinding: (actionId: string, key: string) => void
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
  // Format: { bindings: { key: action }, removedDefaults: { action: [keys] } }
  const [overrides, setOverrides] = useState<Record<string, string | string[]>>(() => {
    if (!storageKey || typeof window === 'undefined') return {}
    try {
      const stored = localStorage.getItem(storageKey)
      return stored ? JSON.parse(stored) : {}
    } catch {
      return {}
    }
  })

  // Track which default bindings have been removed from specific actions
  const [removedDefaults, setRemovedDefaults] = useState<Record<string, string[]>>(() => {
    if (!storageKey || typeof window === 'undefined') return {}
    try {
      const stored = localStorage.getItem(`${storageKey}-removed`)
      return stored ? JSON.parse(stored) : {}
    } catch {
      return {}
    }
  })

  // Helper to check if a key→action matches a default binding
  const isDefaultBinding = useCallback((key: string, actionId: string): boolean => {
    const action = actionsRef.current.get(actionId)
    return action?.config.defaultBindings?.includes(key) ?? false
  }, [])

  // Filter overrides to remove redundant entries (entries that match defaults)
  const filterRedundantOverrides = useCallback((overrides: Record<string, string | string[]>): Record<string, string | string[]> => {
    const filtered: Record<string, string | string[]> = {}
    for (const [key, actionOrActions] of Object.entries(overrides)) {
      if (actionOrActions === '') {
        // Legacy empty marker - skip (now handled by removedDefaults)
      } else if (Array.isArray(actionOrActions)) {
        // For arrays, keep if any action is not default
        const nonDefaultActions = actionOrActions.filter(a => !isDefaultBinding(key, a))
        if (nonDefaultActions.length > 0) {
          filtered[key] = nonDefaultActions.length === 1 ? nonDefaultActions[0] : nonDefaultActions
        }
      } else {
        // Single action - keep if not default
        if (!isDefaultBinding(key, actionOrActions)) {
          filtered[key] = actionOrActions
        }
      }
    }
    return filtered
  }, [isDefaultBinding])

  // Persist overrides - accepts either a value or an updater function
  type OverridesUpdate = Record<string, string | string[]> | ((prev: Record<string, string | string[]>) => Record<string, string | string[]>)
  const updateOverrides = useCallback((update: OverridesUpdate) => {
    setOverrides((prev) => {
      const newOverrides = typeof update === 'function' ? update(prev) : update
      // Filter out redundant overrides before persisting
      const filteredOverrides = filterRedundantOverrides(newOverrides)
      if (storageKey && typeof window !== 'undefined') {
        try {
          if (Object.keys(filteredOverrides).length === 0) {
            localStorage.removeItem(storageKey)
          } else {
            localStorage.setItem(storageKey, JSON.stringify(filteredOverrides))
          }
        } catch {
          // Ignore storage errors
        }
      }
      return filteredOverrides
    })
  }, [storageKey, filterRedundantOverrides])

  // Persist removedDefaults
  type RemovedDefaultsUpdate = Record<string, string[]> | ((prev: Record<string, string[]>) => Record<string, string[]>)
  const updateRemovedDefaults = useCallback((update: RemovedDefaultsUpdate) => {
    setRemovedDefaults((prev) => {
      const newRemoved = typeof update === 'function' ? update(prev) : update
      // Filter out empty arrays
      const filtered: Record<string, string[]> = {}
      for (const [action, keys] of Object.entries(newRemoved)) {
        if (keys.length > 0) {
          filtered[action] = keys
        }
      }
      if (storageKey && typeof window !== 'undefined') {
        try {
          const key = `${storageKey}-removed`
          if (Object.keys(filtered).length === 0) {
            localStorage.removeItem(key)
          } else {
            localStorage.setItem(key, JSON.stringify(filtered))
          }
        } catch {
          // Ignore storage errors
        }
      }
      return filtered
    })
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

  const execute = useCallback((id: string, captures?: number[]) => {
    const action = actionsRef.current.get(id)
    if (action && (action.config.enabled ?? true)) {
      action.config.handler(undefined, captures)
    }
  }, [])

  // Compute keymap from registered actions + overrides
  const keymap = useMemo(() => {
    const map: HotkeyMap = {}

    // Helper to add an action to a key (merging with existing)
    const addToKey = (key: string, actionId: string) => {
      const existing = map[key]
      if (existing) {
        // Multiple actions on same key - creates a conflict
        const existingArray = Array.isArray(existing) ? existing : [existing]
        if (!existingArray.includes(actionId)) {
          map[key] = [...existingArray, actionId]
        }
      } else {
        map[key] = actionId
      }
    }

    // First, add all default bindings from registered actions
    // (but skip if explicitly removed for this action)
    for (const [id, { config }] of actionsRef.current) {
      for (const binding of config.defaultBindings ?? []) {
        // Check if this default was explicitly removed for this action
        const removedForAction = removedDefaults[id] ?? []
        if (removedForAction.includes(binding)) continue

        addToKey(binding, id)
      }
    }

    // Then apply user overrides (merge with defaults to create conflicts)
    for (const [key, actionOrActions] of Object.entries(overrides)) {
      if (actionOrActions === '') {
        // Legacy empty marker - skip
      } else {
        // Add the override binding (may merge with existing default)
        const actions = Array.isArray(actionOrActions) ? actionOrActions : [actionOrActions]
        for (const actionId of actions) {
          addToKey(key, actionId)
        }
      }
    }

    return map
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actionsVersion, overrides, removedDefaults])

  // Build action registry for omnibar
  const actionRegistry = useMemo(() => {
    const registry: ActionRegistry = {}
    for (const [id, { config }] of actionsRef.current) {
      registry[id] = {
        label: config.label,
        group: config.group,
        keywords: config.keywords,
        hideFromModal: config.hideFromModal,
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

  const getFirstBindingForAction = useCallback((actionId: string) => {
    return getBindingsForAction(actionId)[0]
  }, [getBindingsForAction])

  const setBinding = useCallback((actionId: string, key: string) => {
    // If this binding is a default for this action, just remove it from removedDefaults
    // (no need to store in overrides since it will come from defaults)
    if (isDefaultBinding(key, actionId)) {
      updateRemovedDefaults((prev) => {
        const existing = prev[actionId] ?? []
        if (existing.includes(key)) {
          const filtered = existing.filter(k => k !== key)
          if (filtered.length === 0) {
            const { [actionId]: _, ...rest } = prev
            return rest
          }
          return { ...prev, [actionId]: filtered }
        }
        return prev
      })
    } else {
      // Non-default binding - add to overrides
      updateOverrides((prev) => ({
        ...prev,
        [key]: actionId,
      }))
    }
  }, [updateOverrides, updateRemovedDefaults, isDefaultBinding])

  const removeBinding = useCallback((actionId: string, key: string) => {
    // Check if this is a default binding for this specific action
    const action = actionsRef.current.get(actionId)
    const isDefault = action?.config.defaultBindings?.includes(key)

    if (isDefault) {
      // Mark as removed for this specific action only
      updateRemovedDefaults((prev) => {
        const existing = prev[actionId] ?? []
        if (existing.includes(key)) return prev
        return { ...prev, [actionId]: [...existing, key] }
      })
    }

    // Also remove from overrides if this key was bound to this action
    updateOverrides((prev) => {
      const boundAction = prev[key]
      // Only remove if bound to this specific action (or array containing it)
      if (boundAction === actionId) {
        const { [key]: _, ...rest } = prev
        return rest
      }
      if (Array.isArray(boundAction) && boundAction.includes(actionId)) {
        const newActions = boundAction.filter(a => a !== actionId)
        if (newActions.length === 0) {
          const { [key]: _, ...rest } = prev
          return rest
        }
        return { ...prev, [key]: newActions.length === 1 ? newActions[0] : newActions }
      }
      return prev
    })
  }, [updateOverrides, updateRemovedDefaults])

  const resetOverrides = useCallback(() => {
    updateOverrides({})
    updateRemovedDefaults({})
  }, [updateOverrides, updateRemovedDefaults])

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
    getFirstBindingForAction,
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
    getFirstBindingForAction,
    overrides,
    setBinding,
    removeBinding,
    resetOverrides,
  ])
}
