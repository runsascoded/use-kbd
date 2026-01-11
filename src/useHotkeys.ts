import { useCallback, useEffect, useRef, useState } from 'react'
import { DEFAULT_SEQUENCE_TIMEOUT } from './constants'
import {
  isModifierKey,
  isShiftedChar,
  normalizeKey,
  parseHotkeyString,
  parseKeySeq,
} from './utils'
import type { KeyCombination, HotkeySequence, KeySeq, SeqElem, SeqElemState, SeqMatchState } from './types'

/**
 * Hotkey definition - maps key combinations/sequences to action names
 */
export type HotkeyMap = Record<string, string | string[]>

/**
 * Handler function type - can optionally receive captured values
 */
export type HotkeyHandler = (e: KeyboardEvent, captures?: number[]) => void

/**
 * Handler map - maps action names to handler functions
 */
export type HandlerMap = Record<string, HotkeyHandler>

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
  /** Timeout in ms for sequences (default: Infinity, no timeout) */
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

// ============================================================================
// New KeySeq Matching (with digit placeholder support)
// ============================================================================

/**
 * Check if a key is a digit (0-9)
 */
function isDigit(key: string): boolean {
  return /^[0-9]$/.test(key)
}

/**
 * Initialize match state from a KeySeq pattern
 */
function initMatchState(seq: KeySeq): SeqMatchState {
  return seq.map((elem): SeqElemState => {
    if (elem.type === 'digit') return { type: 'digit' }
    if (elem.type === 'digits') return { type: 'digits' }
    return { type: 'key', key: elem.key, modifiers: elem.modifiers }
  })
}

/**
 * Check if a KeyCombination matches a SeqElem (for 'key' type)
 */
function matchesKeyElem(combo: KeyCombination, elem: SeqElem & { type: 'key' }): boolean {
  const shiftMatches = isShiftedChar(combo.key)
    ? (elem.modifiers.shift ? combo.modifiers.shift : true)
    : combo.modifiers.shift === elem.modifiers.shift

  return (
    combo.modifiers.ctrl === elem.modifiers.ctrl &&
    combo.modifiers.alt === elem.modifiers.alt &&
    shiftMatches &&
    combo.modifiers.meta === elem.modifiers.meta &&
    combo.key === elem.key
  )
}

/**
 * Result of advancing a match state with a key press
 */
type AdvanceResult =
  | { status: 'matched'; state: SeqMatchState; captures: number[] }
  | { status: 'partial'; state: SeqMatchState }
  | { status: 'failed' }

/**
 * Advance a match state with a key press.
 * Returns the new state (partial match), captures (complete match), or null (no match).
 */
function advanceMatchState(
  state: SeqMatchState,
  pattern: KeySeq,
  combo: KeyCombination,
): AdvanceResult {
  // Create mutable state copy
  const newState: SeqMatchState = [...state]

  // Find current position in match
  let pos = 0
  for (let i = 0; i < state.length; i++) {
    const elem = state[i]
    if (elem.type === 'key' && !elem.matched) break
    if (elem.type === 'digit' && elem.value === undefined) break
    if (elem.type === 'digits' && elem.value === undefined) {
      // digits can still be in-progress (partial)
      if (!elem.partial) break
      // Check if current key is a digit (continue) or not (finalize)
      if (isDigit(combo.key)) {
        // Accumulate digit
        const newPartial = (elem.partial || '') + combo.key
        newState[i] = { type: 'digits', partial: newPartial }
        // Still at same position, return partial
        return { status: 'partial', state: newState }
      } else {
        // Non-digit key: finalize the digits value and try to match next element
        const digitValue = parseInt(elem.partial, 10)
        newState[i] = { type: 'digits', value: digitValue }
        // Continue to next element with this key
        pos = i + 1

        // If this was the last element, the key doesn't match anything.
        // Return failed - Enter will handle execution separately.
        if (pos >= pattern.length) {
          return { status: 'failed' }
        }
        break
      }
    }
    pos++
  }

  if (pos >= pattern.length) {
    // Already fully matched
    return { status: 'failed' }
  }

  const currentPattern = pattern[pos]

  if (currentPattern.type === 'digit') {
    // Match single digit
    if (!isDigit(combo.key) || combo.modifiers.ctrl || combo.modifiers.alt || combo.modifiers.meta) {
      return { status: 'failed' }
    }
    newState[pos] = { type: 'digit', value: parseInt(combo.key, 10) }
  } else if (currentPattern.type === 'digits') {
    // Start or continue digits match
    if (!isDigit(combo.key) || combo.modifiers.ctrl || combo.modifiers.alt || combo.modifiers.meta) {
      return { status: 'failed' }
    }
    newState[pos] = { type: 'digits', partial: combo.key }
  } else {
    // Match key
    if (!matchesKeyElem(combo, currentPattern)) {
      return { status: 'failed' }
    }
    newState[pos] = { type: 'key', key: currentPattern.key, modifiers: currentPattern.modifiers, matched: true }
  }

  // Check if fully matched
  const isComplete = newState.every((elem) => {
    if (elem.type === 'key') return elem.matched === true
    if (elem.type === 'digit') return elem.value !== undefined
    if (elem.type === 'digits') return elem.value !== undefined
    return false
  })

  if (isComplete) {
    const captures = newState
      .filter((e): e is { type: 'digit'; value: number } | { type: 'digits'; value: number } =>
        (e.type === 'digit' || e.type === 'digits') && e.value !== undefined
      )
      .map(e => e.value)
    return { status: 'matched', state: newState, captures }
  }

  return { status: 'partial', state: newState }
}

/**
 * Check if a SeqMatchState is in the middle of collecting digits
 */
function isCollectingDigits(state: SeqMatchState): boolean {
  return state.some(elem => elem.type === 'digits' && elem.partial !== undefined && elem.value === undefined)
}

/**
 * Finalize any in-progress digits collection in state
 */
function finalizeDigits(state: SeqMatchState): SeqMatchState {
  return state.map(elem => {
    if (elem.type === 'digits' && elem.partial !== undefined && elem.value === undefined) {
      return { type: 'digits', value: parseInt(elem.partial, 10) }
    }
    return elem
  })
}

/**
 * Extract captures from a match state
 */
function extractMatchCaptures(state: SeqMatchState): number[] {
  return state
    .filter((e): e is { type: 'digit'; value: number } | { type: 'digits'; value: number } =>
      (e.type === 'digit' || e.type === 'digits') && e.value !== undefined
    )
    .map(e => e.value)
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
 *   { twoWeeks: () => setRange('2w'), twoDays: () => setRange('2d') }
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
    sequenceTimeout = DEFAULT_SEQUENCE_TIMEOUT,
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

  // Track match states for patterns with digit placeholders
  const matchStatesRef = useRef<Map<string, SeqMatchState>>(new Map())

  // Parse keymap into sequences for matching
  const parsedKeymapRef = useRef<Array<{
    key: string
    sequence: HotkeySequence
    keySeq: KeySeq
    actions: string[]
  }>>([])

  useEffect(() => {
    parsedKeymapRef.current = Object.entries(keymap).map(([key, actionOrActions]) => ({
      key,
      sequence: parseHotkeyString(key),
      keySeq: parseKeySeq(key),
      actions: Array.isArray(actionOrActions) ? actionOrActions : [actionOrActions],
    }))
  }, [keymap])

  const clearPending = useCallback(() => {
    setPendingKeys([])
    setIsAwaitingSequence(false)
    setTimeoutStartedAt(null)
    matchStatesRef.current.clear()
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
  }, [])

  const cancelSequence = useCallback(() => {
    clearPending()
    onSequenceCancel?.()
  }, [clearPending, onSequenceCancel])

  // Try to execute a handler for the given sequence (with optional captures)
  const tryExecute = useCallback((
    sequence: HotkeySequence,
    e: KeyboardEvent,
    captures?: number[],
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
            handler(e, captures)
            return true
          }
        }
      }
    }
    return false
  }, [preventDefault, stopPropagation])

  // Try to execute using KeySeq matching (with digit placeholders)
  const tryExecuteKeySeq = useCallback((
    matchKey: string,
    matchState: SeqMatchState,
    captures: number[],
    e: KeyboardEvent,
  ): boolean => {
    for (const entry of parsedKeymapRef.current) {
      if (entry.key === matchKey) {
        for (const action of entry.actions) {
          const handler = handlersRef.current[action]
          if (handler) {
            if (preventDefault) {
              e.preventDefault()
            }
            if (stopPropagation) {
              e.stopPropagation()
            }
            handler(e, captures.length > 0 ? captures : undefined)
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
      // Skip if focused on text-like form element (unless enabled)
      if (!enableOnFormTags) {
        const eventTarget = e.target as HTMLElement
        // Check if it's a text-like input (not checkbox, radio, button, etc.)
        const isTextInput = eventTarget instanceof HTMLInputElement &&
          ['text', 'email', 'password', 'search', 'tel', 'url', 'number', 'date', 'datetime-local', 'month', 'time', 'week'].includes(eventTarget.type)
        if (
          isTextInput ||
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

      // Enter key submits current sequence (handled by SequenceModal when visible)
      // Note: SequenceModal captures Enter in capture phase and executes via executeAction
      if (e.key === 'Enter' && pendingKeysRef.current.length > 0) {
        e.preventDefault()

        // Try to execute any complete or finalizable digit patterns from current match states
        let executed = false
        for (const [key, state] of matchStatesRef.current.entries()) {
          // Finalize any in-progress digits
          const finalizedState = isCollectingDigits(state) ? finalizeDigits(state) : state

          // Check if state is complete
          const isComplete = finalizedState.every((elem) => {
            if (elem.type === 'key') return elem.matched === true
            if (elem.type === 'digit') return elem.value !== undefined
            if (elem.type === 'digits') return elem.value !== undefined
            return false
          })

          if (isComplete) {
            const captures = extractMatchCaptures(finalizedState)
            executed = tryExecuteKeySeq(key, finalizedState, captures, e)
            if (executed) break
          }
        }

        // Fall back to legacy matching
        if (!executed) {
          executed = tryExecute(pendingKeysRef.current, e)
        }

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

      // Backspace during sequence: check if any binding matches backspace continuation
      // If not, treat as "delete last key" for editing the sequence
      if (e.key === 'Backspace' && pendingKeysRef.current.length > 0) {
        // Quick check: would backspace match any pattern continuation?
        let backspaceMatches = false
        for (const entry of parsedKeymapRef.current) {
          let state = matchStatesRef.current.get(entry.key)
          if (!state) {
            state = initMatchState(entry.keySeq)
          }
          // If currently collecting digits, backspace should edit (not finalize and execute)
          // This prevents `h \d+` from executing when typing `h 1 2 <backspace>`
          if (isCollectingDigits(state)) {
            continue
          }
          const result = advanceMatchState(state, entry.keySeq, currentCombo)
          if (result.status === 'matched' || result.status === 'partial') {
            backspaceMatches = true
            break
          }
        }

        if (!backspaceMatches) {
          e.preventDefault()
          const newPending = pendingKeysRef.current.slice(0, -1)
          if (newPending.length === 0) {
            clearPending()
            onSequenceCancel?.()
          } else {
            setPendingKeys(newPending)
            // Replay remaining pending keys to reconstruct match states
            matchStatesRef.current.clear()
            for (const combo of newPending) {
              for (const entry of parsedKeymapRef.current) {
                let state = matchStatesRef.current.get(entry.key)
                if (!state) {
                  state = initMatchState(entry.keySeq)
                }
                const result = advanceMatchState(state, entry.keySeq, combo)
                if (result.status === 'partial') {
                  matchStatesRef.current.set(entry.key, result.state)
                } else {
                  matchStatesRef.current.delete(entry.key)
                }
              }
            }
          }
          return
        }
      }

      const newSequence = [...pendingKeysRef.current, currentCombo]

      // Try KeySeq matching first (handles digit placeholders)
      // Collect all matches (complete and partial) for permissive conflict resolution
      const completeMatches: Array<{
        key: string
        state: SeqMatchState
        captures: number[]
      }> = []
      let hasPartials = false
      const matchStates = matchStatesRef.current

      // Check if we have any partial matches in progress
      const hadPartialMatches = matchStates.size > 0

      for (const entry of parsedKeymapRef.current) {
        // Get existing match state for this pattern
        let state = matchStates.get(entry.key)

        // If we have partial matches in progress, only check patterns with existing state
        // This prevents a fresh "j" pattern from matching when we're trying to complete "\d+ j"
        if (hadPartialMatches && !state) {
          continue
        }

        if (!state) {
          state = initMatchState(entry.keySeq)
          matchStates.set(entry.key, state)
        }

        const result = advanceMatchState(state, entry.keySeq, currentCombo)

        if (result.status === 'matched') {
          // Complete match - collect it
          completeMatches.push({
            key: entry.key,
            state: result.state,
            captures: result.captures,
          })
          // Also mark as failed so we don't keep stale state
          matchStates.delete(entry.key)
        } else if (result.status === 'partial') {
          // Update state and continue
          matchStates.set(entry.key, result.state)
          hasPartials = true
        } else {
          // Failed - reset this pattern's state
          matchStates.delete(entry.key)
        }
      }

      // Permissive conflict resolution:
      // - If exactly one complete match AND no partial matches → execute immediately
      // - Otherwise → enter sequence mode for disambiguation via SeqM
      if (completeMatches.length === 1 && !hasPartials) {
        const match = completeMatches[0]
        if (tryExecuteKeySeq(match.key, match.state, match.captures, e)) {
          clearPending()
          return
        }
      }

      // Multiple complete matches OR partials exist → enter sequence mode
      if (completeMatches.length > 0 || hasPartials) {
        // We have partial matches, wait for more keys
        setPendingKeys(newSequence)
        setIsAwaitingSequence(true)

        if (pendingKeysRef.current.length === 0) {
          onSequenceStart?.(newSequence)
        } else {
          onSequenceProgress?.(newSequence)
        }

        if (preventDefault) {
          e.preventDefault()
        }

        // Set timeout for digit sequences
        if (Number.isFinite(sequenceTimeout)) {
          setTimeoutStartedAt(Date.now())
          timeoutRef.current = setTimeout(() => {
            // On timeout, try to finalize any in-progress digits
            for (const [key, state] of matchStates.entries()) {
              if (isCollectingDigits(state)) {
                const finalizedState = finalizeDigits(state)
                // Check if finalized state is complete
                const entry = parsedKeymapRef.current.find(e => e.key === key)
                if (entry) {
                  const isComplete = finalizedState.every((elem) => {
                    if (elem.type === 'key') return elem.matched === true
                    if (elem.type === 'digit') return elem.value !== undefined
                    if (elem.type === 'digits') return elem.value !== undefined
                    return false
                  })
                  if (isComplete) {
                    // Note: We can't execute without the event, but the pattern matched
                    // In practice, digit sequences should match on the terminating key
                    void extractMatchCaptures(finalizedState)
                  }
                }
              }
            }
            setPendingKeys([])
            setIsAwaitingSequence(false)
            setTimeoutStartedAt(null)
            matchStatesRef.current.clear()
            onSequenceCancel?.()
            timeoutRef.current = null
          }, sequenceTimeout)
        }

        return
      }

      // Fall back to legacy exact matching for non-placeholder patterns
      const exactMatch = tryExecute(newSequence, e)
      if (exactMatch) {
        clearPending()
        return
      }

      // Check if this could be the start of a longer sequence (legacy)
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

          // Set timeout (unless Infinity - then user must explicitly cancel)
          if (Number.isFinite(sequenceTimeout)) {
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
          }

          // Prevent default for potential sequence keys
          if (preventDefault) {
            e.preventDefault()
          }
          return
        }
      }

      // No match and no potential
      if (pendingKeysRef.current.length > 0) {
        // Already in sequence mode - keep modal open with invalid key showing
        // "No matching shortcuts". User can backspace to fix or Escape to cancel.
        setPendingKeys(newSequence)
        if (preventDefault) {
          e.preventDefault()
        }
        return
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

          // Set timeout (unless Infinity - then user must explicitly cancel)
          if (Number.isFinite(sequenceTimeout)) {
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
    tryExecuteKeySeq,
    hasPotentialMatch,
    hasSequenceExtension,
    onSequenceStart,
    onSequenceProgress,
    onSequenceCancel,
  ])

  return { pendingKeys, isAwaitingSequence, cancelSequence, timeoutStartedAt, sequenceTimeout }
}
