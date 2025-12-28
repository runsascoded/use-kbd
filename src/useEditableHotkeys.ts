import { useCallback, useEffect, useMemo, useState } from 'react'
import { useHotkeys, HotkeyMap, HandlerMap, UseHotkeysOptions } from './useHotkeys'
import { findConflicts } from './utils'
import type { HotkeySequence } from './types'

export interface UseEditableHotkeysOptions extends UseHotkeysOptions {
  /** localStorage key for persistence (omit to disable persistence) */
  storageKey?: string
  /** When true, keys with multiple actions bound are disabled (default: true) */
  disableConflicts?: boolean
}

export interface UseEditableHotkeysResult {
  /** Current keymap (defaults merged with user overrides) */
  keymap: HotkeyMap
  /** Update a single keybinding */
  setBinding: (action: string, key: string) => void
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
  /** Keys pressed so far in current sequence */
  pendingKeys: HotkeySequence
  /** Whether currently awaiting more keys in a sequence */
  isAwaitingSequence: boolean
  /** Cancel the current sequence */
  cancelSequence: () => void
  /** When the current sequence timeout started (null if not awaiting) */
  timeoutStartedAt: number | null
  /** The sequence timeout duration in ms */
  sequenceTimeout: number
}

/**
 * Wraps useHotkeys with editable keybindings and optional persistence.
 *
 * @example
 * ```tsx
 * const { keymap, setBinding, reset } = useEditableHotkeys(
 *   { 't': 'setTemp', 'c': 'setCO2' },
 *   { setTemp: () => setMetric('temp'), setCO2: () => setMetric('co2') },
 *   { storageKey: 'app-hotkeys' }
 * )
 * ```
 */
export function useEditableHotkeys(
  defaults: HotkeyMap,
  handlers: HandlerMap,
  options: UseEditableHotkeysOptions = {},
): UseEditableHotkeysResult {
  const { storageKey, disableConflicts = true, ...hotkeyOptions } = options

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

  // Merge defaults with overrides (invert the map: action -> key becomes key -> action)
  const keymap = useMemo(() => {
    // Build action -> key map from defaults
    const actionToKey: Record<string, string> = {}
    for (const [key, action] of Object.entries(defaults)) {
      const actions = Array.isArray(action) ? action : [action]
      for (const a of actions) {
        actionToKey[a] = key
      }
    }

    // Apply overrides (key -> action)
    for (const [key, action] of Object.entries(overrides)) {
      if (action === undefined) continue
      const actions = Array.isArray(action) ? action : [action]
      for (const a of actions) {
        actionToKey[a] = key
      }
    }

    // Rebuild key -> action map
    const result: HotkeyMap = {}
    for (const [action, key] of Object.entries(actionToKey)) {
      if (result[key]) {
        const existing = result[key]
        result[key] = Array.isArray(existing) ? [...existing, action] : [existing, action]
      } else {
        result[key] = action
      }
    }

    return result
  }, [defaults, overrides])

  // Compute conflicts from current keymap
  const conflicts = useMemo(() => findConflicts(keymap), [keymap])
  const hasConflictsValue = conflicts.size > 0

  // Effective keymap for useHotkeys - removes conflicting keys if disableConflicts is true
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

  // Register hotkeys (using effective keymap that excludes conflicts)
  const { pendingKeys, isAwaitingSequence, cancelSequence, timeoutStartedAt, sequenceTimeout } = useHotkeys(effectiveKeymap, handlers, hotkeyOptions)

  const setBinding = useCallback((action: string, key: string) => {
    setOverrides((prev) => {
      // Remove any existing override that maps a different key to this action
      const cleaned: Partial<HotkeyMap> = {}
      for (const [k, v] of Object.entries(prev)) {
        // Keep the entry unless it's a different key mapping to the same action
        const actions = Array.isArray(v) ? v : [v]
        if (k === key || !actions.includes(action)) {
          cleaned[k] = v
        }
      }
      // Add the new binding
      return { ...cleaned, [key]: action }
    })
  }, [])

  const setKeymap = useCallback((newOverrides: Partial<HotkeyMap>) => {
    setOverrides((prev) => ({ ...prev, ...newOverrides }))
  }, [])

  const reset = useCallback(() => {
    setOverrides({})
  }, [])

  return {
    keymap,
    setBinding,
    setKeymap,
    reset,
    overrides,
    conflicts,
    hasConflicts: hasConflictsValue,
    pendingKeys,
    isAwaitingSequence,
    cancelSequence,
    timeoutStartedAt,
    sequenceTimeout,
  }
}
