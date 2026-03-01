import { createContext, useCallback, useMemo, useRef, useState } from 'react'
import { dbg } from './debug'
import type { ActionRegistry, BindingsExport, ModeCustomizations } from './types'
import { EMPTY_MODE_CUSTOMIZATIONS } from './types'
import type { ActionConfig } from './useAction'
import type { HotkeyMap } from './useHotkeys'

/** Current version for export format */
const EXPORT_VERSION = '0.8.0'

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
  /** Check if an action is enabled (defaults to true if not set or not found) */
  isActionEnabled: (id: string) => boolean
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
  /** Default bindings that have been removed (per action) */
  removedDefaults: Record<string, string[]>
  /** Set a user override for a binding */
  setBinding: (actionId: string, key: string) => void
  /** Remove a binding for a specific action */
  removeBinding: (actionId: string, key: string) => void
  /** Reset all overrides */
  resetOverrides: () => void
  /** Export current binding customizations as JSON */
  exportBindings: () => BindingsExport
  /** Import binding customizations from JSON (replaces current customizations) */
  importBindings: (data: BindingsExport) => void
  /** Mode customizations (user edits to mode membership) */
  modeCustomizations: ModeCustomizations
  /** Set mode customizations (persisted) */
  setModeCustomizations: (update: ModeCustomizations | ((prev: ModeCustomizations) => ModeCustomizations)) => void
  /** Get the effective mode for an action (considering customizations) */
  getEffectiveMode: (actionId: string) => string | undefined
  /** Add an action to a mode */
  addActionToMode: (actionId: string, modeId: string) => void
  /** Remove an action from its mode */
  removeActionFromMode: (actionId: string, modeId: string) => void
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

  // Mode customizations (persisted)
  const [modeCustomizations, setModeCustomizationsRaw] = useState<ModeCustomizations>(() => {
    if (!storageKey || typeof window === 'undefined') return EMPTY_MODE_CUSTOMIZATIONS
    try {
      const stored = localStorage.getItem(`${storageKey}-modes`)
      return stored ? JSON.parse(stored) : EMPTY_MODE_CUSTOMIZATIONS
    } catch {
      return EMPTY_MODE_CUSTOMIZATIONS
    }
  })

  const setModeCustomizations = useCallback((update: ModeCustomizations | ((prev: ModeCustomizations) => ModeCustomizations)) => {
    setModeCustomizationsRaw(prev => {
      const next = typeof update === 'function' ? update(prev) : update
      if (storageKey && typeof window !== 'undefined') {
        try {
          const key = `${storageKey}-modes`
          const isEmpty = Object.keys(next.additions).length === 0 &&
            Object.keys(next.removals).length === 0 &&
            Object.keys(next.userModes).length === 0
          if (isEmpty) {
            localStorage.removeItem(key)
          } else {
            localStorage.setItem(key, JSON.stringify(next))
          }
        } catch {
          // Ignore storage errors
        }
      }
      return next
    })
  }, [storageKey])

  // Get the effective mode for an action (considering customizations)
  const getEffectiveMode = useCallback((actionId: string): string | undefined => {
    // 1. Check removals: if removed from its default mode, it's global
    for (const [modeId, actionIds] of Object.entries(modeCustomizations.removals)) {
      if (actionIds.includes(actionId)) return undefined
    }
    // 2. Check additions: user moved into a mode
    for (const [modeId, actionIds] of Object.entries(modeCustomizations.additions)) {
      if (actionIds.includes(actionId)) return modeId
    }
    // 3. Check user-created modes
    for (const [modeId, config] of Object.entries(modeCustomizations.userModes)) {
      if (config.actions.includes(actionId)) return modeId
    }
    // 4. Fall back to developer-defined mode
    const action = actionsRef.current.get(actionId)
    return action?.config.mode
  }, [modeCustomizations])

  // Add an action to a mode (handles arrow groups and action pairs atomically)
  const addActionToMode = useCallback((actionId: string, modeId: string) => {
    // Collect all action IDs to move (arrow group = all 4, action pair = both)
    const action = actionsRef.current.get(actionId)
    const groupId = action?.config.arrowGroup?.groupId
    const pairId = action?.config.actionPair?.pairId
    const actionIds = groupId
      ? Array.from(actionsRef.current.entries())
          .filter(([, a]) => a.config.arrowGroup?.groupId === groupId)
          .map(([id]) => id)
      : pairId
      ? Array.from(actionsRef.current.entries())
          .filter(([, a]) => a.config.actionPair?.pairId === pairId)
          .map(([id]) => id)
      : [actionId]

    setModeCustomizations(prev => {
      const next = { ...prev, additions: { ...prev.additions }, removals: { ...prev.removals }, userModes: { ...prev.userModes } }

      for (const id of actionIds) {
        const defaultMode = actionsRef.current.get(id)?.config.mode

        // Remove from any other mode's additions
        for (const [mid, ids] of Object.entries(next.additions)) {
          if (mid !== modeId && ids.includes(id)) {
            next.additions[mid] = ids.filter(a => a !== id)
            if (next.additions[mid].length === 0) delete next.additions[mid]
          }
        }
        // Remove from any user mode's actions
        for (const [mid, config] of Object.entries(next.userModes)) {
          if (mid !== modeId && config.actions.includes(id)) {
            next.userModes[mid] = { ...config, actions: config.actions.filter(a => a !== id) }
          }
        }

        if (modeId === defaultMode) {
          // Moving back to default mode — remove from removals
          const removals = next.removals[modeId]
          if (removals?.includes(id)) {
            next.removals[modeId] = removals.filter(a => a !== id)
            if (next.removals[modeId].length === 0) delete next.removals[modeId]
          }
        } else if (next.userModes[modeId]) {
          // Adding to a user-created mode
          if (!next.userModes[modeId].actions.includes(id)) {
            next.userModes[modeId] = { ...next.userModes[modeId], actions: [...next.userModes[modeId].actions, id] }
          }
          // If removing from its default mode, record that
          if (defaultMode) {
            next.removals[defaultMode] = [...(next.removals[defaultMode] ?? []), id]
          }
        } else {
          // Adding to a developer-defined mode (not the default)
          if (!next.additions[modeId]?.includes(id)) {
            next.additions[modeId] = [...(next.additions[modeId] ?? []), id]
          }
          // If removing from its default mode, record that
          if (defaultMode && defaultMode !== modeId) {
            next.removals[defaultMode] = [...(next.removals[defaultMode] ?? []), id]
          }
        }
      }
      return next
    })
  }, [setModeCustomizations])

  // Remove an action from its mode (handles arrow groups and action pairs atomically)
  const removeActionFromMode = useCallback((actionId: string, modeId: string) => {
    const action = actionsRef.current.get(actionId)
    const groupId = action?.config.arrowGroup?.groupId
    const pairId = action?.config.actionPair?.pairId
    const actionIds = groupId
      ? Array.from(actionsRef.current.entries())
          .filter(([, a]) => a.config.arrowGroup?.groupId === groupId)
          .map(([id]) => id)
      : pairId
      ? Array.from(actionsRef.current.entries())
          .filter(([, a]) => a.config.actionPair?.pairId === pairId)
          .map(([id]) => id)
      : [actionId]

    setModeCustomizations(prev => {
      const next = { ...prev, additions: { ...prev.additions }, removals: { ...prev.removals }, userModes: { ...prev.userModes } }

      for (const id of actionIds) {
        const defaultMode = actionsRef.current.get(id)?.config.mode

        if (defaultMode === modeId) {
          // Removing from default mode → record in removals
          if (!next.removals[modeId]?.includes(id)) {
            next.removals[modeId] = [...(next.removals[modeId] ?? []), id]
          }
        } else if (next.additions[modeId]?.includes(id)) {
          // Removing from a user-added assignment
          next.additions[modeId] = next.additions[modeId].filter(a => a !== id)
          if (next.additions[modeId].length === 0) delete next.additions[modeId]
        } else if (next.userModes[modeId]?.actions.includes(id)) {
          // Removing from a user-created mode
          next.userModes[modeId] = { ...next.userModes[modeId], actions: next.userModes[modeId].actions.filter(a => a !== id) }
        }
      }
      return next
    })
  }, [setModeCustomizations])

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
    dbg.registry('register: %s (bindings: %o, group: %s)', id, config.defaultBindings, config.group)
    actionsRef.current.set(id, {
      config,
      registeredAt: Date.now(),
    })
    setActionsVersion(v => v + 1)
  }, [])

  const unregister = useCallback((id: string) => {
    dbg.registry('unregister: %s', id)
    actionsRef.current.delete(id)
    setActionsVersion(v => v + 1)
  }, [])

  const execute = useCallback((id: string, captures?: number[]) => {
    const action = actionsRef.current.get(id)
    if (action && (action.config.enabled ?? true)) {
      dbg.registry('execute: %s (captures: %o)', id, captures)
      action.config.handler(undefined, captures)
    }
  }, [])

  const isActionEnabled = useCallback((id: string) => {
    const action = actionsRef.current.get(id)
    return action?.config.enabled !== false
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

    dbg.registry('keymap recomputed: %d bindings, %d actions', Object.keys(map).length, actionsRef.current.size)
    return map
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actionsVersion, overrides, removedDefaults])

  // Build action registry for omnibar
  const actionRegistry = useMemo(() => {
    const registry: ActionRegistry = {}
    for (const [id, { config }] of actionsRef.current) {
      registry[id] = {
        label: config.label,
        description: config.description,
        group: config.group,
        mode: config.mode,
        keywords: config.keywords,
        hideFromModal: config.hideFromModal,
        enabled: config.enabled,
        protected: config.protected,
        arrowGroup: config.arrowGroup,
        actionPair: config.actionPair,
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
    dbg.registry('setBinding: %s → %s', key, actionId)
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
    dbg.registry('removeBinding: %s from %s', key, actionId)
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
    setModeCustomizations(EMPTY_MODE_CUSTOMIZATIONS)
  }, [updateOverrides, updateRemovedDefaults, setModeCustomizations])

  const exportBindings = useCallback((): BindingsExport => {
    const hasModeCusts = Object.keys(modeCustomizations.additions).length > 0 ||
      Object.keys(modeCustomizations.removals).length > 0 ||
      Object.keys(modeCustomizations.userModes).length > 0
    return {
      version: EXPORT_VERSION,
      exportedAt: new Date().toISOString(),
      origin: typeof window !== 'undefined' ? window.location.origin : undefined,
      overrides,
      removedDefaults,
      ...(hasModeCusts ? { modeCustomizations } : {}),
    }
  }, [overrides, removedDefaults, modeCustomizations])

  const importBindings = useCallback((data: BindingsExport) => {
    // Validate basic structure
    if (!data || typeof data !== 'object') {
      throw new Error('Invalid import data: expected an object')
    }
    if (typeof data.overrides !== 'object' || data.overrides === null) {
      throw new Error('Invalid import data: missing or invalid overrides')
    }
    if (typeof data.removedDefaults !== 'object' || data.removedDefaults === null) {
      throw new Error('Invalid import data: missing or invalid removedDefaults')
    }

    // Validate overrides values
    for (const [key, value] of Object.entries(data.overrides)) {
      if (typeof value !== 'string' && !Array.isArray(value)) {
        throw new Error(`Invalid override for key "${key}": expected string or array`)
      }
      if (Array.isArray(value) && !value.every(v => typeof v === 'string')) {
        throw new Error(`Invalid override for key "${key}": array must contain only strings`)
      }
    }

    // Validate removedDefaults values
    for (const [action, keys] of Object.entries(data.removedDefaults)) {
      if (!Array.isArray(keys) || !keys.every(k => typeof k === 'string')) {
        throw new Error(`Invalid removedDefaults for action "${action}": expected array of strings`)
      }
    }

    // Apply the imported data (replace mode)
    updateOverrides(data.overrides)
    updateRemovedDefaults(data.removedDefaults)
    if (data.modeCustomizations) {
      setModeCustomizations(data.modeCustomizations)
    } else {
      setModeCustomizations(EMPTY_MODE_CUSTOMIZATIONS)
    }
  }, [updateOverrides, updateRemovedDefaults, setModeCustomizations])

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
    isActionEnabled,
    actions,
    keymap,
    actionRegistry,
    getBindingsForAction,
    getFirstBindingForAction,
    overrides,
    removedDefaults,
    setBinding,
    removeBinding,
    resetOverrides,
    exportBindings,
    importBindings,
    modeCustomizations,
    setModeCustomizations,
    getEffectiveMode,
    addActionToMode,
    removeActionFromMode,
  }), [
    register,
    unregister,
    execute,
    isActionEnabled,
    actions,
    keymap,
    actionRegistry,
    getBindingsForAction,
    getFirstBindingForAction,
    overrides,
    removedDefaults,
    setBinding,
    removeBinding,
    resetOverrides,
    exportBindings,
    importBindings,
    modeCustomizations,
    setModeCustomizations,
    getEffectiveMode,
    addActionToMode,
    removeActionFromMode,
  ])
}
