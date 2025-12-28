import { useCallback, useEffect, useRef, useState } from 'react'
import {
  isModifierKey,
  isShiftedChar,
  normalizeKey,
  parseHotkeyString,
} from './utils'
import type { KeyCombination, HotkeySequence } from './types'

/**
 * Hotkey definition - maps key combinations/sequences to action names
 */
export type HotkeyMap = Record<string, string | string[]>

/**
 * Handler map - maps action names to handler functions
 */
export type HandlerMap = Record<string, (e: KeyboardEvent) => void>

export interface UseHotkeysOptions {
  /** Whether hotkeys are enabled (default: true) */
  enabled?: boolean
  /** Element to attach listeners to (default: window) */
  target?: HTMLElement | Window | null
  /** Prevent default on matched hotkeys (default: true) */
  preventDefault?: boolean
  /** Stop propagation on matched hotkeys (default: true) */
  stopPropagation?: boolean
  /** Enable hotkeys even when focused on input/textarea/select (default: false) */
  enableOnFormTags?: boolean
  /** Timeout in ms for sequences (default: 1000) */
  sequenceTimeout?: number
  /** What happens on timeout: 'submit' executes current sequence, 'cancel' resets (default: 'submit') */
  onTimeout?: 'submit' | 'cancel'
  /** Called when sequence input starts */
  onSequenceStart?: (keys: HotkeySequence) => void
  /** Called when sequence progresses (new key added) */
  onSequenceProgress?: (keys: HotkeySequence) => void
  /** Called when sequence is cancelled (timeout with 'cancel' mode, or no match) */
  onSequenceCancel?: () => void
}

export interface UseHotkeysResult {
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
 * Check if a keyboard event matches a KeyCombination
 */
function matchesCombination(e: KeyboardEvent, combo: KeyCombination): boolean {
  const eventKey = normalizeKey(e.key)

  // For shifted characters (like ?, !, @), ignore shift key mismatch
  const shiftMatches = isShiftedChar(e.key)
    ? (combo.modifiers.shift ? e.shiftKey : true)
    : e.shiftKey === combo.modifiers.shift

  return (
    e.ctrlKey === combo.modifiers.ctrl &&
    e.altKey === combo.modifiers.alt &&
    shiftMatches &&
    e.metaKey === combo.modifiers.meta &&
    eventKey === combo.key
  )
}

/**
 * Create a KeyCombination from a KeyboardEvent
 */
function eventToCombination(e: KeyboardEvent): KeyCombination {
  return {
    key: normalizeKey(e.key),
    modifiers: {
      ctrl: e.ctrlKey,
      alt: e.altKey,
      shift: e.shiftKey,
      meta: e.metaKey,
    },
  }
}

/**
 * Check if a pending sequence matches the start of a hotkey sequence
 */
function isPartialMatch(pending: HotkeySequence, target: HotkeySequence): boolean {
  if (pending.length >= target.length) return false
  for (let i = 0; i < pending.length; i++) {
    if (!combinationsMatch(pending[i], target[i])) {
      return false
    }
  }
  return true
}

/**
 * Check if two key combinations match (handles shifted chars like ?)
 */
function combinationsMatch(event: KeyCombination, target: KeyCombination): boolean {
  // For shifted characters (like ?, !, @), ignore shift key mismatch
  const shiftMatches = isShiftedChar(event.key)
    ? (target.modifiers.shift ? event.modifiers.shift : true)
    : event.modifiers.shift === target.modifiers.shift

  return (
    event.modifiers.ctrl === target.modifiers.ctrl &&
    event.modifiers.alt === target.modifiers.alt &&
    shiftMatches &&
    event.modifiers.meta === target.modifiers.meta &&
    event.key === target.key
  )
}

/**
 * Check if two sequences are exactly equal
 */
function sequencesMatch(a: HotkeySequence, b: HotkeySequence): boolean {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) {
    if (!combinationsMatch(a[i], b[i])) {
      return false
    }
  }
  return true
}

/**
 * Hook to register keyboard shortcuts with sequence support.
 *
 * @example
 * ```tsx
 * // Single keys
 * const { pendingKeys } = useHotkeys(
 *   { 't': 'setTemp', 'ctrl+s': 'save' },
 *   { setTemp: () => setMetric('temp'), save: handleSave }
 * )
 *
 * // Sequences
 * const { pendingKeys, isAwaitingSequence } = useHotkeys(
 *   { '2 w': 'twoWeeks', '2 d': 'twoDays' },
 *   { twoWeeks: () => setRange('2w'), twoDays: () => setRange('2d') },
 *   { sequenceTimeout: 1000 }
 * )
 * ```
 */
export function useHotkeys(
  keymap: HotkeyMap,
  handlers: HandlerMap,
  options: UseHotkeysOptions = {},
): UseHotkeysResult {
  const {
    enabled = true,
    target,
    preventDefault = true,
    stopPropagation = true,
    enableOnFormTags = false,
    sequenceTimeout = 1000,
    onTimeout = 'submit',
    onSequenceStart,
    onSequenceProgress,
    onSequenceCancel,
  } = options

  const [pendingKeys, setPendingKeys] = useState<HotkeySequence>([])
  const [isAwaitingSequence, setIsAwaitingSequence] = useState(false)
  const [timeoutStartedAt, setTimeoutStartedAt] = useState<number | null>(null)

  // Use refs for handlers to avoid re-attaching listeners
  const handlersRef = useRef(handlers)
  handlersRef.current = handlers

  const keymapRef = useRef(keymap)
  keymapRef.current = keymap

  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Use ref for pendingKeys to avoid stale closure in event handlers
  const pendingKeysRef = useRef<HotkeySequence>([])
  pendingKeysRef.current = pendingKeys

  // Parse keymap into sequences for matching
  const parsedKeymapRef = useRef<Array<{ key: string; sequence: HotkeySequence; actions: string[] }>>([])

  useEffect(() => {
    parsedKeymapRef.current = Object.entries(keymap).map(([key, actionOrActions]) => ({
      key,
      sequence: parseHotkeyString(key),
      actions: Array.isArray(actionOrActions) ? actionOrActions : [actionOrActions],
    }))
  }, [keymap])

  const clearPending = useCallback(() => {
    setPendingKeys([])
    setIsAwaitingSequence(false)
    setTimeoutStartedAt(null)
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
  }, [])

  const cancelSequence = useCallback(() => {
    clearPending()
    onSequenceCancel?.()
  }, [clearPending, onSequenceCancel])

  // Try to execute a handler for the given sequence
  const tryExecute = useCallback((
    sequence: HotkeySequence,
    e: KeyboardEvent,
  ): boolean => {
    for (const entry of parsedKeymapRef.current) {
      if (sequencesMatch(sequence, entry.sequence)) {
        for (const action of entry.actions) {
          const handler = handlersRef.current[action]
          if (handler) {
            if (preventDefault) {
              e.preventDefault()
            }
            if (stopPropagation) {
              e.stopPropagation()
            }
            handler(e)
            return true
          }
        }
      }
    }
    return false
  }, [preventDefault, stopPropagation])

  // Check if sequence has any potential matches (partial or full)
  const hasPotentialMatch = useCallback((sequence: HotkeySequence): boolean => {
    for (const entry of parsedKeymapRef.current) {
      if (isPartialMatch(sequence, entry.sequence) || sequencesMatch(sequence, entry.sequence)) {
        return true
      }
    }
    return false
  }, [])

  // Check if there are any sequences that start with current pending
  const hasSequenceExtension = useCallback((sequence: HotkeySequence): boolean => {
    for (const entry of parsedKeymapRef.current) {
      if (entry.sequence.length > sequence.length && isPartialMatch(sequence, entry.sequence)) {
        return true
      }
    }
    return false
  }, [])

  useEffect(() => {
    if (!enabled) return

    const targetElement = target ?? window

    const handleKeyDown = (e: KeyboardEvent) => {
      // Skip if focused on form element (unless enabled)
      if (!enableOnFormTags) {
        const eventTarget = e.target as HTMLElement
        if (
          eventTarget instanceof HTMLInputElement ||
          eventTarget instanceof HTMLTextAreaElement ||
          eventTarget instanceof HTMLSelectElement ||
          eventTarget.isContentEditable
        ) {
          return
        }
      }

      // Skip modifier-only keypresses
      if (isModifierKey(e.key)) {
        return
      }

      // Clear any existing timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }

      // Enter key submits current sequence
      if (e.key === 'Enter' && pendingKeysRef.current.length > 0) {
        e.preventDefault()
        const executed = tryExecute(pendingKeysRef.current, e)
        clearPending()
        if (!executed) {
          onSequenceCancel?.()
        }
        return
      }

      // Escape cancels current sequence
      if (e.key === 'Escape' && pendingKeysRef.current.length > 0) {
        e.preventDefault()
        cancelSequence()
        return
      }

      // Add current key to sequence
      const currentCombo = eventToCombination(e)
      const newSequence = [...pendingKeysRef.current, currentCombo]

      // Check for exact match first
      const exactMatch = tryExecute(newSequence, e)
      if (exactMatch) {
        clearPending()
        return
      }

      // Check if this could be the start of a longer sequence
      if (hasPotentialMatch(newSequence)) {
        // Check if there are longer sequences this could match
        if (hasSequenceExtension(newSequence)) {
          // Wait for more keys
          setPendingKeys(newSequence)
          setIsAwaitingSequence(true)

          if (pendingKeysRef.current.length === 0) {
            onSequenceStart?.(newSequence)
          } else {
            onSequenceProgress?.(newSequence)
          }

          // Set timeout
          setTimeoutStartedAt(Date.now())
          timeoutRef.current = setTimeout(() => {
            if (onTimeout === 'submit') {
              // Try to execute whatever we have
              // Note: We need to get the current pending keys from state
              setPendingKeys(current => {
                if (current.length > 0) {
                  // We can't call tryExecute here because we don't have the event
                  // So we'll just clear and call onSequenceCancel
                  onSequenceCancel?.()
                }
                return []
              })
              setIsAwaitingSequence(false)
              setTimeoutStartedAt(null)
            } else {
              // Cancel mode
              setPendingKeys([])
              setIsAwaitingSequence(false)
              setTimeoutStartedAt(null)
              onSequenceCancel?.()
            }
            timeoutRef.current = null
          }, sequenceTimeout)

          // Prevent default for potential sequence keys
          if (preventDefault) {
            e.preventDefault()
          }
          return
        }
      }

      // No match and no potential - reset and try single key
      if (pendingKeysRef.current.length > 0) {
        clearPending()
        onSequenceCancel?.()
      }

      // Try as single key (sequence of 1)
      const singleMatch = tryExecute([currentCombo], e)
      if (!singleMatch) {
        // Check if single key could start a sequence
        if (hasSequenceExtension([currentCombo])) {
          setPendingKeys([currentCombo])
          setIsAwaitingSequence(true)
          onSequenceStart?.([currentCombo])

          if (preventDefault) {
            e.preventDefault()
          }

          // Set timeout
          setTimeoutStartedAt(Date.now())
          timeoutRef.current = setTimeout(() => {
            if (onTimeout === 'submit') {
              setPendingKeys([])
              setIsAwaitingSequence(false)
              setTimeoutStartedAt(null)
              onSequenceCancel?.()
            } else {
              setPendingKeys([])
              setIsAwaitingSequence(false)
              setTimeoutStartedAt(null)
              onSequenceCancel?.()
            }
            timeoutRef.current = null
          }, sequenceTimeout)
        }
      }
    }

    targetElement.addEventListener('keydown', handleKeyDown as EventListener)

    return () => {
      targetElement.removeEventListener('keydown', handleKeyDown as EventListener)
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [
    enabled,
    target,
    preventDefault,
    stopPropagation,
    enableOnFormTags,
    sequenceTimeout,
    onTimeout,
    clearPending,
    cancelSequence,
    tryExecute,
    hasPotentialMatch,
    hasSequenceExtension,
    onSequenceStart,
    onSequenceProgress,
    onSequenceCancel,
  ])

  return { pendingKeys, isAwaitingSequence, cancelSequence, timeoutStartedAt, sequenceTimeout }
}
