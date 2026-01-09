import { useMemo } from 'react'
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

  // Get completions for the current pending keys
  const completions = useMemo(() => {
    if (pendingKeys.length === 0) return []
    return getCompletions(pendingKeys)
  }, [getCompletions, pendingKeys])

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

  // Group completions by what happens next
  // Each completion shows: nextKeys → actionLabel
  const groupedCompletions = useMemo(() => {
    // Create map of nextKey -> completions
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
            {Array.from(groupedCompletions.entries()).map(([nextKey, comps]) => (
              <div key={nextKey} className="kbd-sequence-completion">
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
