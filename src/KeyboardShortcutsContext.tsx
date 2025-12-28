import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { useHotkeys, HotkeyMap, HandlerMap, UseHotkeysOptions, UseHotkeysResult } from './useHotkeys'
import { findConflicts, searchActions, getSequenceCompletions, getActionBindings } from './utils'
import type { ActionRegistry, ActionSearchResult, HotkeySequence, SequenceCompletion } from './types'

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
  /** Remove a key binding entirely */
  removeBinding: (key: string) => void
  /** Remove a specific action from a key (for resolving conflicts) */
  removeBindingForAction: (action: string, key: string) => void
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
  /** Check if a key binding is a default (not user-added) */
  isDefaultBinding: (key: string, action: string) => boolean
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
  children: ReactNode
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
    // Build effective key -> action map
    // Overrides REPLACE defaults for that key (not add to them)
    const effectiveMap: Record<string, string | string[]> = {}

    // Start with defaults
    for (const [key, action] of Object.entries(defaults)) {
      effectiveMap[key] = action
    }

    // Apply overrides - they replace defaults for that key
    for (const [key, action] of Object.entries(overrides)) {
      if (action === '') {
        // Remove the key entirely
        delete effectiveMap[key]
      } else if (action !== undefined) {
        // Replace the default with the override
        effectiveMap[key] = action
      }
    }

    return effectiveMap as HotkeyMap
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

  // Check if a binding is from defaults (not user-added)
  const isDefaultBinding = useCallback(
    (key: string, action: string) => {
      const defaultAction = defaults[key]
      if (!defaultAction) return false
      const defaultActions = Array.isArray(defaultAction) ? defaultAction : [defaultAction]
      return defaultActions.includes(action)
    },
    [defaults],
  )

  const setBinding = useCallback((action: string, key: string) => {
    setOverrides((prev) => {
      const result: Partial<HotkeyMap> = {}

      // Helper to compare values (handles string vs array normalization)
      const valuesEqual = (a: string | string[] | undefined, b: string | string[] | undefined): boolean => {
        if (a === undefined && b === undefined) return true
        if (a === undefined || b === undefined) return false
        const arrA = Array.isArray(a) ? a : [a]
        const arrB = Array.isArray(b) ? b : [b]
        if (arrA.length !== arrB.length) return false
        return arrA.every((v, i) => v === arrB[i])
      }

      // Handle default keys that map to this action - remove action from old keys
      for (const [k, v] of Object.entries(defaults)) {
        if (k === key) continue // Skip if it's the new key
        const defaultActions = Array.isArray(v) ? v : [v]
        if (defaultActions.includes(action)) {
          // This default key maps to our action - need to remove this specific binding
          const remaining = defaultActions.filter(a => a !== action)
          if (remaining.length === 0) {
            result[k] = '' // Mark as fully removed
          } else {
            // Keep the remaining actions - override replaces defaults for this key
            result[k] = remaining.length === 1 ? remaining[0] : remaining
          }
        }
      }

      // Copy previous overrides, handling keys that map to this action
      for (const [k, v] of Object.entries(prev)) {
        if (k === key) continue // Skip if it's the new key (we'll handle it at the end)
        if (v === '' || v === undefined) {
          result[k] = v
          continue
        }
        const overrideActions = Array.isArray(v) ? v : [v]
        if (overrideActions.includes(action)) {
          // Remove this action from the override
          const remaining = overrideActions.filter(a => a !== action)
          if (remaining.length === 0) {
            // No actions left - check if it was overriding defaults
            if (k in defaults) {
              result[k] = '' // Mark default as removed
            }
            // Otherwise, just don't include this override
          } else {
            result[k] = remaining.length === 1 ? remaining[0] : remaining
          }
        } else {
          result[k] = v
        }
      }

      // Add the new binding - MERGE with existing actions for this key (allows conflicts)
      // Get current actions for this key from defaults + previous overrides
      const existingFromOverrides = prev[key]
      const existingFromDefaults = defaults[key]

      let currentActions: string[] = []
      if (existingFromOverrides !== undefined) {
        // Override takes precedence over defaults
        if (existingFromOverrides !== '') {
          currentActions = Array.isArray(existingFromOverrides)
            ? [...existingFromOverrides]
            : [existingFromOverrides]
        }
      } else if (existingFromDefaults !== undefined) {
        // Fall back to defaults
        currentActions = Array.isArray(existingFromDefaults)
          ? [...existingFromDefaults]
          : [existingFromDefaults]
      }

      // Add our action if not already present
      if (!currentActions.includes(action)) {
        currentActions.push(action)
      }

      // Set the merged result
      result[key] = currentActions.length === 1 ? currentActions[0] : currentActions

      // Canonicalize: remove entries that match defaults
      const canonical: Partial<HotkeyMap> = {}
      for (const [k, v] of Object.entries(result)) {
        const defaultVal = defaults[k]
        // Keep entry if:
        // - It's a removal marker ('') for a default key
        // - It differs from the default
        // - It's for a key not in defaults
        if (v === '') {
          // Removal marker - only keep if key exists in defaults
          if (k in defaults) {
            canonical[k] = v
          }
        } else if (!valuesEqual(v, defaultVal)) {
          canonical[k] = v
        }
        // If value equals default, don't include it (canonical form)
      }

      return canonical
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

  const removeBindingForAction = useCallback((action: string, key: string) => {
    setOverrides((prev) => {
      // Get current actions for this key (from overrides or defaults)
      const overrideValue = prev[key]
      const defaultValue = defaults[key]

      let currentActions: string[]
      if (overrideValue !== undefined) {
        if (overrideValue === '') {
          // Key was already removed, nothing to do
          return prev
        }
        currentActions = Array.isArray(overrideValue) ? [...overrideValue] : [overrideValue]
      } else if (defaultValue !== undefined) {
        currentActions = Array.isArray(defaultValue) ? [...defaultValue] : [defaultValue]
      } else {
        // Key doesn't exist, nothing to do
        return prev
      }

      // Remove the specific action
      const remaining = currentActions.filter(a => a !== action)

      if (remaining.length === 0) {
        // No actions left - mark as removed if it was a default key
        if (key in defaults) {
          return { ...prev, [key]: '' }
        } else {
          const { [key]: _removed, ...rest } = prev
          return rest
        }
      } else if (remaining.length === currentActions.length) {
        // Action wasn't in the list, nothing changed
        return prev
      } else {
        // Update with remaining actions
        return { ...prev, [key]: remaining.length === 1 ? remaining[0] : remaining }
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
      removeBindingForAction,
      setKeymap,
      reset,
      overrides,
      conflicts,
      hasConflicts: hasConflictsValue,
      disableConflicts,
      searchActions: searchActionsInContext,
      getCompletions,
      getBindingsForAction,
      isDefaultBinding,
    }),
    [defaults, keymap, actionsProp, setBinding, addBinding, removeBinding, removeBindingForAction, setKeymap, reset, overrides, conflicts, hasConflictsValue, disableConflicts, searchActionsInContext, getCompletions, getBindingsForAction, isDefaultBinding],
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
