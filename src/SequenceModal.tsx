import { useCallback, useEffect, useMemo, useState } from 'react'
import { useHotkeysContext } from './HotkeysProvider'
import { getKeyIcon } from './KeyIcons'
import type { SequenceCompletion } from './types'
import { formatKeyForDisplay } from './utils'

/**
 * Modal that appears during multi-key sequence input (e.g., `g t` for "go to table").
 *
 * When a user presses a key that starts a sequence, this modal appears showing:
 * - The keys pressed so far
 * - Available completions (what keys can come next)
 * - A timeout indicator (only shown when exactly one completion exists)
 *
 * Features:
 * - Arrow keys navigate between completions (cancels auto-timeout)
 * - Enter executes the selected completion (even for digit patterns - handler gets undefined captures)
 * - Escape cancels the sequence
 *
 * Unlike LookupModal (which requires explicit activation and lets you browse/search),
 * SequenceModal appears automatically when you start typing a sequence.
 *
 * @example
 * ```tsx
 * // Include in your app (no props needed - uses HotkeysContext)
 * <HotkeysProvider>
 *   <App />
 *   <SequenceModal />
 * </HotkeysProvider>
 * ```
 */
export function SequenceModal() {
  const {
    pendingKeys,
    isAwaitingSequence,
    cancelSequence,
    sequenceTimeoutStartedAt: timeoutStartedAt,
    sequenceTimeout,
    getCompletions,
    registry,
    executeAction,
  } = useHotkeysContext()

  const [selectedIndex, setSelectedIndex] = useState(0)
  // Track if user has interacted with arrows - cancels timeout
  const [hasInteracted, setHasInteracted] = useState(false)

  // Get completions for the current pending keys
  const completions = useMemo(() => {
    if (pendingKeys.length === 0) return []
    return getCompletions(pendingKeys)
  }, [getCompletions, pendingKeys])

  // Flatten completions for navigation (each action gets its own row)
  // Group complete matches first, then continuations
  const flatCompletions = useMemo(() => {
    const items: Array<{
      completion: SequenceCompletion
      action: string
      displayKey: string
      isComplete: boolean
    }> = []

    for (const c of completions) {
      for (const action of c.actions) {
        // For complete matches, show "↵" as the key
        // For continuations, show the next keys needed
        const displayKey = c.isComplete ? '↵' : c.nextKeys
        items.push({
          completion: c,
          action,
          displayKey,
          isComplete: c.isComplete,
        })
      }
    }

    return items
  }, [completions])

  const itemCount = flatCompletions.length

  // Should show timeout? Only when exactly one completion AND no user interaction
  const shouldShowTimeout = timeoutStartedAt !== null && completions.length === 1 && !hasInteracted

  // Reset selection and interaction state when pending keys change
  useEffect(() => {
    setSelectedIndex(0)
    setHasInteracted(false)
  }, [pendingKeys])

  // Execute selected action
  const executeSelected = useCallback(() => {
    if (selectedIndex >= 0 && selectedIndex < flatCompletions.length) {
      const item = flatCompletions[selectedIndex]
      // Execute the action with any captured digit values
      executeAction(item.action, item.completion.captures)
      cancelSequence()
    }
  }, [selectedIndex, flatCompletions, executeAction, cancelSequence])

  // Keyboard navigation - intercept arrow keys to prevent page actions
  useEffect(() => {
    if (!isAwaitingSequence || pendingKeys.length === 0) return

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault()
          e.stopPropagation()
          setSelectedIndex(prev => Math.min(prev + 1, itemCount - 1))
          setHasInteracted(true)
          break
        case 'ArrowUp':
          e.preventDefault()
          e.stopPropagation()
          setSelectedIndex(prev => Math.max(prev - 1, 0))
          setHasInteracted(true)
          break
        case 'Enter':
          e.preventDefault()
          e.stopPropagation()
          executeSelected()
          break
        // Note: Escape is handled by useHotkeys
        // Other keys continue the sequence via useHotkeys
      }
    }

    // Use capture phase to intercept before useHotkeys
    document.addEventListener('keydown', handleKeyDown, true)
    return () => document.removeEventListener('keydown', handleKeyDown, true)
  }, [isAwaitingSequence, pendingKeys.length, itemCount, executeSelected])

  // Render a single key with icon if available
  const renderKey = useCallback((key: string, index: number) => {
    const Icon = getKeyIcon(key)
    const displayKey = formatKeyForDisplay(key)
    return (
      <kbd key={index} className="kbd-kbd">
        {Icon ? <Icon className="kbd-key-icon" /> : null}
        {Icon ? null : displayKey}
      </kbd>
    )
  }, [])

  // Get human-readable label for an action from registry, with captured digits interpolated
  const getActionLabel = (actionId: string, captures?: number[]) => {
    const action = registry.actions.get(actionId)
    let label = action?.config.label || actionId
    // Replace N placeholders with captured digit values
    if (captures && captures.length > 0) {
      let captureIdx = 0
      label = label.replace(/\bN\b/g, () => {
        if (captureIdx < captures.length) {
          return String(captures[captureIdx++])
        }
        return 'N'
      })
    }
    return label
  }

  // Don't render if not awaiting sequence or no pending keys
  if (!isAwaitingSequence || pendingKeys.length === 0) {
    return null
  }

  return (
    <div className="kbd-sequence-backdrop" onClick={cancelSequence}>
      <div className="kbd-sequence" onClick={e => e.stopPropagation()}>
        {/* Current sequence at top */}
        <div className="kbd-sequence-current">
          <div className="kbd-sequence-keys">
            {pendingKeys.map((combo, i) => renderKey(combo.key, i))}
          </div>
          <span className="kbd-sequence-ellipsis">…</span>
        </div>

        {/* Timeout progress bar - only shown when exactly one completion and no interaction */}
        {shouldShowTimeout && (
          <div
            className="kbd-sequence-timeout"
            key={timeoutStartedAt}
            style={{ animationDuration: `${sequenceTimeout}ms` }}
          />
        )}

        {/* Completions list */}
        {flatCompletions.length > 0 && (
          <div className="kbd-sequence-completions">
            {flatCompletions.map((item, index) => (
              <div
                key={`${item.completion.fullSequence}-${item.action}`}
                className={`kbd-sequence-completion ${index === selectedIndex ? 'selected' : ''} ${item.isComplete ? 'complete' : ''}`}
              >
                <kbd className="kbd-kbd">{item.displayKey}</kbd>
                <span className="kbd-sequence-arrow">→</span>
                <span className="kbd-sequence-actions">
                  {getActionLabel(item.action, item.completion.captures)}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* No completions message */}
        {flatCompletions.length === 0 && (
          <div className="kbd-sequence-empty">
            No matching shortcuts
          </div>
        )}
      </div>
    </div>
  )
}
