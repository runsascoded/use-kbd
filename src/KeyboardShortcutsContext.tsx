import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ActionRegistry, ActionSearchResult, HotkeySequence, SequenceCompletion } from './types'
import { useHotkeys, HotkeyMap, HandlerMap, UseHotkeysOptions, UseHotkeysResult } from './useHotkeys'
import { findConflicts, searchActions, getSequenceCompletions, getActionBindings } from './utils'

export interface KeyboardShortcutsContextValue {
  /** Default keymap (before user overrides) */
  defaults: HotkeyMap
  /** Current keymap (defaults merged with user overrides) */
  keymap: HotkeyMap
  /** Registry of available actions (if provided) */
  actions: ActionRegistry
  /** Update a single keybinding (replaces existing binding for the action) */
  setBinding: (action: string, key: string) => void
  /** Add a new key binding for an action (keeps existing bindings) */
  addBinding: (action: string, key: string) => void
  /** Remove a key binding */
  removeBinding: (key: string) => void
  /** Update multiple keybindings at once */
  setKeymap: (overrides: Partial<HotkeyMap>) => void
  /** Reset all overrides to defaults */
  reset: () => void
  /** User overrides only (for inspection/export) */
  overrides: Partial<HotkeyMap>
  /** Map of key -> actions[] for keys with multiple actions bound */
  conflicts: Map<string, string[]>
  /** Whether there are any conflicts in the current keymap */
  hasConflicts: boolean
  /** When true, keys with multiple actions bound are disabled */
  disableConflicts: boolean
  /** Search actions by query */
  searchActions: (query: string) => ActionSearchResult[]
  /** Get sequence completions for pending keys */
  getCompletions: (pendingKeys: HotkeySequence) => SequenceCompletion[]
  /** Get all bindings for an action */
  getBindingsForAction: (actionId: string) => string[]
}

const KeyboardShortcutsContext = createContext<KeyboardShortcutsContextValue | null>(null)

export interface KeyboardShortcutsProviderProps {
  /** Default hotkey map */
  defaults: HotkeyMap
  /** Registry of available actions (for omnibar and action management) */
  actions?: ActionRegistry
  /** localStorage key for persistence (omit to disable persistence) */
  storageKey?: string
  /** When true, keys with multiple actions bound are disabled (default: true) */
  disableConflicts?: boolean
  children: React.ReactNode
}

/**
 * Provider for keyboard shortcuts context.
 * Manages the keymap, user overrides, persistence, and conflict detection.
 *
 * @example
 * ```tsx
 * <KeyboardShortcutsProvider
 *   defaults={{ 't': 'setTemp', 'c': 'setCO2' }}
 *   storageKey="app-hotkeys"
 * >
 *   <App />
 * </KeyboardShortcutsProvider>
 * ```
 */
export function KeyboardShortcutsProvider({
  defaults,
  actions: actionsProp = {},
  storageKey,
  disableConflicts = true,
  children,
}: KeyboardShortcutsProviderProps) {
  // Load overrides from storage on mount
  const [overrides, setOverrides] = useState<Partial<HotkeyMap>>(() => {
    if (!storageKey || typeof window === 'undefined') return {}
    try {
      const stored = localStorage.getItem(storageKey)
      return stored ? JSON.parse(stored) : {}
    } catch {
      return {}
    }
  })

  // Persist overrides to storage
  useEffect(() => {
    if (!storageKey || typeof window === 'undefined') return
    try {
      if (Object.keys(overrides).length === 0) {
        localStorage.removeItem(storageKey)
      } else {
        localStorage.setItem(storageKey, JSON.stringify(overrides))
      }
    } catch {
      // Ignore storage errors
    }
  }, [storageKey, overrides])

  // Merge defaults with overrides
  const keymap = useMemo(() => {
    // Track removed keys (marked with empty string in overrides)
    const removedKeys = new Set<string>()
    for (const [key, action] of Object.entries(overrides)) {
      if (action === '') {
        removedKeys.add(key)
      }
    }

    // Build action -> keys map from defaults (excluding removed)
    const actionToKeys: Record<string, string[]> = {}
    for (const [key, action] of Object.entries(defaults)) {
      if (removedKeys.has(key)) continue
      const actions = Array.isArray(action) ? action : [action]
      for (const a of actions) {
        if (!actionToKeys[a]) actionToKeys[a] = []
        actionToKeys[a].push(key)
      }
    }

    // Apply overrides (key -> action), excluding removed markers
    for (const [key, action] of Object.entries(overrides)) {
      if (action === undefined || action === '') continue
      const actions = Array.isArray(action) ? action : [action]
      for (const a of actions) {
        if (!actionToKeys[a]) actionToKeys[a] = []
        if (!actionToKeys[a].includes(key)) {
          actionToKeys[a].push(key)
        }
      }
    }

    // Rebuild key -> action map
    const result: HotkeyMap = {}
    for (const [action, keys] of Object.entries(actionToKeys)) {
      for (const key of keys) {
        if (result[key]) {
          const existing = result[key]
          result[key] = Array.isArray(existing) ? [...existing, action] : [existing, action]
        } else {
          result[key] = action
        }
      }
    }

    return result
  }, [defaults, overrides])

  // Compute conflicts from current keymap
  const conflicts = useMemo(() => findConflicts(keymap), [keymap])
  const hasConflictsValue = conflicts.size > 0

  // Action bindings map
  const actionBindings = useMemo(() => getActionBindings(keymap), [keymap])

  // Search actions helper
  const searchActionsInContext = useCallback(
    (query: string) => searchActions(query, actionsProp, keymap),
    [actionsProp, keymap],
  )

  // Get sequence completions helper
  const getCompletions = useCallback(
    (pendingKeys: HotkeySequence) => getSequenceCompletions(pendingKeys, keymap),
    [keymap],
  )

  // Get bindings for action helper
  const getBindingsForAction = useCallback(
    (actionId: string) => actionBindings.get(actionId) ?? [],
    [actionBindings],
  )

  const setBinding = useCallback((action: string, key: string) => {
    setOverrides((prev) => {
      // Find default keys that map to this action and mark them as removed
      const result: Partial<HotkeyMap> = {}

      // Mark default keys for this action as removed (unless it's the new key)
      for (const [k, v] of Object.entries(defaults)) {
        const actions = Array.isArray(v) ? v : [v]
        if (actions.includes(action) && k !== key) {
          result[k] = '' // Mark as removed
        }
      }

      // Copy previous overrides, excluding any that map a different key to this action
      for (const [k, v] of Object.entries(prev)) {
        const actions = Array.isArray(v) ? v : [v]
        if (k === key || !actions.includes(action)) {
          result[k] = v
        }
      }

      // Add the new binding
      result[key] = action
      return result
    })
  }, [defaults])

  const addBinding = useCallback((action: string, key: string) => {
    setOverrides((prev) => {
      // Simply add the new key -> action binding without removing existing ones
      return { ...prev, [key]: action }
    })
  }, [])

  const removeBinding = useCallback((key: string) => {
    setOverrides((prev) => {
      // Check if this key is in defaults
      const isDefault = key in defaults
      if (isDefault) {
        // Mark as removed by setting to empty string (special marker)
        return { ...prev, [key]: '' }
      } else {
        // Remove from overrides
        const { [key]: _removed, ...rest } = prev
        return rest
      }
    })
  }, [defaults])

  const setKeymap = useCallback((newOverrides: Partial<HotkeyMap>) => {
    setOverrides((prev) => ({ ...prev, ...newOverrides }))
  }, [])

  const reset = useCallback(() => {
    setOverrides({})
  }, [])

  const value = useMemo<KeyboardShortcutsContextValue>(
    () => ({
      defaults,
      keymap,
      actions: actionsProp,
      setBinding,
      addBinding,
      removeBinding,
      setKeymap,
      reset,
      overrides,
      conflicts,
      hasConflicts: hasConflictsValue,
      disableConflicts,
      searchActions: searchActionsInContext,
      getCompletions,
      getBindingsForAction,
    }),
    [defaults, keymap, actionsProp, setBinding, addBinding, removeBinding, setKeymap, reset, overrides, conflicts, hasConflictsValue, disableConflicts, searchActionsInContext, getCompletions, getBindingsForAction],
  )

  return (
    <KeyboardShortcutsContext.Provider value={value}>
      {children}
    </KeyboardShortcutsContext.Provider>
  )
}

/**
 * Hook to access the keyboard shortcuts context.
 * Must be used within a KeyboardShortcutsProvider.
 *
 * @example
 * ```tsx
 * const { keymap, setBinding, conflicts } = useKeyboardShortcutsContext()
 * ```
 */
export function useKeyboardShortcutsContext(): KeyboardShortcutsContextValue {
  const context = useContext(KeyboardShortcutsContext)
  if (!context) {
    throw new Error('useKeyboardShortcutsContext must be used within a KeyboardShortcutsProvider')
  }
  return context
}

/**
 * Hook to register hotkey handlers using the keymap from context.
 * Automatically excludes conflicting keys if disableConflicts is true.
 *
 * @example
 * ```tsx
 * useRegisteredHotkeys({
 *   setTemp: () => setMetric('temp'),
 *   setCO2: () => setMetric('co2'),
 * })
 * ```
 */
export function useRegisteredHotkeys(
  handlers: HandlerMap,
  options: Omit<UseHotkeysOptions, 'enabled'> & { enabled?: boolean } = {},
): UseHotkeysResult {
  const { keymap, conflicts, disableConflicts } = useKeyboardShortcutsContext()

  // Effective keymap - removes conflicting keys if disableConflicts is true
  const effectiveKeymap = useMemo(() => {
    if (!disableConflicts || conflicts.size === 0) {
      return keymap
    }
    // Filter out keys that have conflicts
    const filtered: HotkeyMap = {}
    for (const [key, action] of Object.entries(keymap)) {
      if (!conflicts.has(key)) {
        filtered[key] = action
      }
    }
    return filtered
  }, [keymap, conflicts, disableConflicts])

  return useHotkeys(effectiveKeymap, handlers, options)
}
