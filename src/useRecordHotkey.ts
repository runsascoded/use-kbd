import { useCallback, useEffect, useRef, useState } from 'react'
import { formatCombination, isModifierKey, normalizeKey } from './utils'
import type { KeyCombination, HotkeySequence, RecordHotkeyOptions, RecordHotkeyResult } from './types'

/** Store callback in ref to avoid effect re-runs when callback changes */
function useEventCallback<T extends (...args: never[]) => unknown>(fn: T | undefined): T | undefined {
  const ref = useRef(fn)
  ref.current = fn
  return useCallback(((...args) => ref.current?.(...args)) as T, [])
}

/**
 * Hook to record a keyboard shortcut (single key or sequence) from user input.
 *
 * Recording behavior:
 * - Each key press (after modifiers released) adds to the sequence
 * - Enter key submits the current sequence
 * - Timeout submits the current sequence (configurable)
 * - Escape cancels recording
 *
 * @example
 * ```tsx
 * function KeybindingEditor() {
 *   const { isRecording, startRecording, sequence, display, pendingKeys, activeKeys } = useRecordHotkey({
 *     onCapture: (sequence, display) => {
 *       console.log('Captured:', display.display) // "2 W" or "⌘K"
 *       saveKeybinding(display.id) // "2 w" or "meta+k"
 *     },
 *     sequenceTimeout: 1000,
 *   })
 *
 *   return (
 *     <button onClick={() => startRecording()}>
 *       {isRecording
 *         ? (pendingKeys.length > 0
 *             ? formatCombination(pendingKeys).display + '...'
 *             : 'Press keys...')
 *         : (display?.display ?? 'Click to set')}
 *     </button>
 *   )
 * }
 * ```
 */
export function useRecordHotkey(options: RecordHotkeyOptions = {}): RecordHotkeyResult {
  const {
    onCapture: onCaptureProp,
    onCancel: onCancelProp,
    onTab: onTabProp,
    onShiftTab: onShiftTabProp,
    preventDefault = true,
    sequenceTimeout = 1000,
    pauseTimeout = false,
  } = options

  // Stabilize callbacks to avoid effect re-runs
  const onCapture = useEventCallback(onCaptureProp)
  const onCancel = useEventCallback(onCancelProp)
  const onTab = useEventCallback(onTabProp)
  const onShiftTab = useEventCallback(onShiftTabProp)

  const [isRecording, setIsRecording] = useState(false)
  const [sequence, setSequence] = useState<HotkeySequence | null>(null)
  const [pendingKeys, setPendingKeys] = useState<HotkeySequence>([])
  const [activeKeys, setActiveKeys] = useState<KeyCombination | null>(null)

  // Track pressed keys during recording
  const pressedKeysRef = useRef<Set<string>>(new Set())
  const hasNonModifierRef = useRef(false)
  const currentComboRef = useRef<KeyCombination | null>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Keep pauseTimeout in a ref for synchronous access in handlers
  const pauseTimeoutRef = useRef(pauseTimeout)
  pauseTimeoutRef.current = pauseTimeout

  // Keep a ref in sync with pendingKeys for synchronous access in event handlers
  // (React 18 batching can delay useState updates)
  const pendingKeysRef = useRef<HotkeySequence>([])

  const clearTimeout_ = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
  }, [])

  const submit = useCallback((seq: HotkeySequence) => {
    if (seq.length === 0) return

    const display = formatCombination(seq)

    // Clear state
    clearTimeout_()
    pressedKeysRef.current.clear()
    hasNonModifierRef.current = false
    currentComboRef.current = null

    setSequence(seq)
    pendingKeysRef.current = []
    setPendingKeys([])
    setIsRecording(false)
    setActiveKeys(null)

    onCapture?.(seq, display)
  }, [clearTimeout_, onCapture])

  const cancel = useCallback(() => {
    clearTimeout_()
    setIsRecording(false)
    pendingKeysRef.current = []
    setPendingKeys([])
    setActiveKeys(null)
    pressedKeysRef.current.clear()
    hasNonModifierRef.current = false
    currentComboRef.current = null
    onCancel?.()
  }, [clearTimeout_, onCancel])

  // Commit pending keys immediately (if any), otherwise cancel
  const commit = useCallback(() => {
    // Read from ref for synchronous access
    const current = pendingKeysRef.current
    if (current.length > 0) {
      submit(current)
    } else {
      cancel()
    }
  }, [submit, cancel])

  const startRecording = useCallback(() => {
    clearTimeout_()
    setIsRecording(true)
    setSequence(null)
    pendingKeysRef.current = []
    setPendingKeys([])
    setActiveKeys(null)
    pressedKeysRef.current.clear()
    hasNonModifierRef.current = false
    currentComboRef.current = null

    // Return cancel function
    return cancel
  }, [cancel, clearTimeout_])

  // Manage timeout based on pauseTimeout state
  useEffect(() => {
    if (pauseTimeout) {
      // Pause: clear any existing timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }
    } else if (isRecording && pendingKeysRef.current.length > 0 && !timeoutRef.current) {
      // Resume: start a new timeout if we have pending keys and no timeout running
      const currentSequence = pendingKeysRef.current
      timeoutRef.current = setTimeout(() => {
        submit(currentSequence)
      }, sequenceTimeout)
    }
  }, [pauseTimeout, isRecording, sequenceTimeout, submit])

  useEffect(() => {
    if (!isRecording) return

    const handleKeyDown = (e: KeyboardEvent) => {
      // Handle Tab BEFORE preventDefault - let browser handle focus navigation
      // This enables native tab order through focusable kbd elements
      if (e.key === 'Tab') {
        clearTimeout_()

        // Read pending keys from ref (synchronous, unaffected by React batching)
        // Also include any key currently being held (Tab might fire before keyup)
        const pendingSeq = [...pendingKeysRef.current]
        if (hasNonModifierRef.current && currentComboRef.current) {
          pendingSeq.push(currentComboRef.current)
        }

        // Clear all state
        pendingKeysRef.current = []
        setPendingKeys([])
        pressedKeysRef.current.clear()
        hasNonModifierRef.current = false
        currentComboRef.current = null
        setActiveKeys(null)
        setIsRecording(false)

        // Call onCapture with pending keys (if any)
        if (pendingSeq.length > 0) {
          const display = formatCombination(pendingSeq)
          onCapture?.(pendingSeq, display)
        }

        // Call legacy onTab/onShiftTab if provided (for backwards compat)
        if (!e.shiftKey && onTab) {
          e.preventDefault()
          e.stopPropagation()
          onTab()
        } else if (e.shiftKey && onShiftTab) {
          e.preventDefault()
          e.stopPropagation()
          onShiftTab()
        }
        // Otherwise let browser handle focus navigation naturally
        return
      }

      if (preventDefault) {
        e.preventDefault()
        e.stopPropagation()
      }

      // Clear timeout on any keypress
      clearTimeout_()

      // Enter submits current sequence
      if (e.key === 'Enter') {
        setPendingKeys(current => {
          if (current.length > 0) {
            submit(current)
          }
          return current
        })
        return
      }

      // Escape cancels
      if (e.key === 'Escape') {
        cancel()
        return
      }

      // Use e.code when Alt is pressed (macOS transforms Alt+key into special chars)
      // e.code gives physical key like "KeyH", extract the letter
      let key = e.key
      if (e.altKey && e.code.startsWith('Key')) {
        key = e.code.slice(3).toLowerCase()
      } else if (e.altKey && e.code.startsWith('Digit')) {
        key = e.code.slice(5)
      }
      pressedKeysRef.current.add(key)

      // Build current combination from pressed keys
      const combo: KeyCombination = {
        key: '',
        modifiers: {
          ctrl: e.ctrlKey,
          alt: e.altKey,
          shift: e.shiftKey,
          meta: e.metaKey,
        },
      }

      // Find the non-modifier key
      for (const k of pressedKeysRef.current) {
        if (!isModifierKey(k)) {
          combo.key = normalizeKey(k)
          hasNonModifierRef.current = true
          break
        }
      }

      // Only update if we have a non-modifier key
      if (combo.key) {
        currentComboRef.current = combo
        setActiveKeys(combo)
      } else {
        // Show modifiers being held
        setActiveKeys({
          key: '',
          modifiers: combo.modifiers,
        })
      }
    }

    const handleKeyUp = (e: KeyboardEvent) => {
      if (preventDefault) {
        e.preventDefault()
        e.stopPropagation()
      }

      // Use same key extraction as keydown
      let key = e.key
      if (e.altKey && e.code.startsWith('Key')) {
        key = e.code.slice(3).toLowerCase()
      } else if (e.altKey && e.code.startsWith('Digit')) {
        key = e.code.slice(5)
      }
      pressedKeysRef.current.delete(key)

      // On Mac, releasing Meta swallows other keyup events, so check if we have a valid
      // combination when Meta is released (or when all keys are released)
      const shouldComplete =
        (pressedKeysRef.current.size === 0) ||
        (e.key === 'Meta' && hasNonModifierRef.current)

      if (shouldComplete && hasNonModifierRef.current && currentComboRef.current) {
        const combo = currentComboRef.current

        // Clear for next key in sequence
        pressedKeysRef.current.clear()
        hasNonModifierRef.current = false
        currentComboRef.current = null
        setActiveKeys(null)

        // Add to pending sequence (update both ref and state)
        const newSequence = [...pendingKeysRef.current, combo]
        pendingKeysRef.current = newSequence
        setPendingKeys(newSequence)

        // Set timeout to submit (unless paused)
        clearTimeout_()
        if (!pauseTimeoutRef.current) {
          timeoutRef.current = setTimeout(() => {
            submit(newSequence)
          }, sequenceTimeout)
        }
      }
    }

    // Capture phase to intercept before other handlers
    window.addEventListener('keydown', handleKeyDown, true)
    window.addEventListener('keyup', handleKeyUp, true)

    return () => {
      window.removeEventListener('keydown', handleKeyDown, true)
      window.removeEventListener('keyup', handleKeyUp, true)
      clearTimeout_()
    }
  }, [isRecording, preventDefault, sequenceTimeout, clearTimeout_, submit, cancel, onCapture, onTab, onShiftTab])

  const display = sequence ? formatCombination(sequence) : null

  // Backwards compatibility: return first key as combination
  const combination = sequence && sequence.length > 0 ? sequence[0] : null

  return {
    isRecording,
    startRecording,
    cancel,
    commit,
    sequence,
    display,
    pendingKeys,
    activeKeys,
    combination, // deprecated
  }
}
