import { useEffect, useMemo, useState } from 'react'
import { useHotkeysContext } from './HotkeysProvider'
import type { SequenceCompletion } from './types'
import { formatCombination } from './utils'

/**
 * Modal that appears during multi-key sequence input (e.g., `g t` for "go to table").
 *
 * When a user presses a key that starts a sequence, this modal appears showing:
 * - The keys pressed so far
 * - Available completions (what keys can come next)
 * - A timeout indicator
 *
 * Unlike LookupModal (which requires explicit activation and lets you browse/search),
 * SequenceModal appears automatically when you start typing a sequence and auto-executes
 * when a complete sequence is entered.
 *
 * The modal auto-dismisses if no completion is pressed within the sequence timeout,
 * or when the user presses Escape, or when a complete sequence is executed.
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
  } = useHotkeysContext()

  const [selectedIndex, setSelectedIndex] = useState(0)

  // Get completions for the current pending keys
  const completions = useMemo(() => {
    if (pendingKeys.length === 0) return []
    return getCompletions(pendingKeys)
  }, [getCompletions, pendingKeys])

  // Group completions by what happens next
  // Each completion shows: nextKeys → actionLabel
  const groupedCompletions = useMemo(() => {
    const byNextKey = new Map<string, SequenceCompletion[]>()
    for (const c of completions) {
      const existing = byNextKey.get(c.nextKeys)
      if (existing) {
        existing.push(c)
      } else {
        byNextKey.set(c.nextKeys, [c])
      }
    }
    return byNextKey
  }, [completions])

  const groupCount = groupedCompletions.size

  // Reset selection when completions change
  useEffect(() => {
    setSelectedIndex(0)
  }, [completions])

  // Keyboard navigation - intercept arrow keys to prevent page actions
  useEffect(() => {
    if (!isAwaitingSequence || pendingKeys.length === 0) return

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault()
          e.stopPropagation()
          setSelectedIndex(prev => Math.min(prev + 1, groupCount - 1))
          break
        case 'ArrowUp':
          e.preventDefault()
          e.stopPropagation()
          setSelectedIndex(prev => Math.max(prev - 1, 0))
          break
        // Note: Escape and Enter are handled by useHotkeys
        // Other keys continue the sequence via useHotkeys
      }
    }

    // Use capture phase to intercept before useHotkeys
    document.addEventListener('keydown', handleKeyDown, true)
    return () => document.removeEventListener('keydown', handleKeyDown, true)
  }, [isAwaitingSequence, pendingKeys.length, groupCount])

  // Format pending keys for display
  const formattedPendingKeys = useMemo(() => {
    if (pendingKeys.length === 0) return ''
    return formatCombination(pendingKeys).display
  }, [pendingKeys])

  // Get human-readable label for an action from registry
  const getActionLabel = (actionId: string) => {
    const action = registry.actions.get(actionId)
    return action?.config.label || actionId
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
          <kbd className="kbd-sequence-keys">{formattedPendingKeys}</kbd>
          <span className="kbd-sequence-ellipsis">…</span>
        </div>

        {/* Timeout progress bar */}
        {timeoutStartedAt && (
          <div
            className="kbd-sequence-timeout"
            key={timeoutStartedAt}
            style={{ animationDuration: `${sequenceTimeout}ms` }}
          />
        )}

        {/* Completions list */}
        {completions.length > 0 && (
          <div className="kbd-sequence-completions">
            {Array.from(groupedCompletions.entries()).map(([nextKey, comps], index) => (
              <div
                key={nextKey}
                className={`kbd-sequence-completion ${index === selectedIndex ? 'selected' : ''}`}
              >
                <kbd className="kbd-kbd">{nextKey}</kbd>
                <span className="kbd-sequence-arrow">→</span>
                <span className="kbd-sequence-actions">
                  {comps.flatMap(c => c.actions).map((action, i) => (
                    <span key={action}>
                      {i > 0 && ', '}
                      {getActionLabel(action)}
                    </span>
                  ))}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* No completions message */}
        {completions.length === 0 && (
          <div className="kbd-sequence-empty">
            No matching shortcuts
          </div>
        )}
      </div>
    </div>
  )
}
