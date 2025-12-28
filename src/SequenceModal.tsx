import { useMemo } from 'react'
import { useHotkeysContext } from './HotkeysProvider'
import type { SequenceCompletion } from './types'
import { formatCombination } from './utils'

export function SequenceModal() {
  const {
    pendingKeys,
    isAwaitingSequence,
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
    <div className="hotkeys-sequence-backdrop">
      <div className="hotkeys-sequence">
        {/* Current sequence at top */}
        <div className="hotkeys-sequence-current">
          <kbd className="hotkeys-sequence-keys">{formattedPendingKeys}</kbd>
          <span className="hotkeys-sequence-ellipsis">…</span>
        </div>

        {/* Timeout progress bar */}
        {timeoutStartedAt && (
          <div
            className="hotkeys-sequence-timeout"
            key={timeoutStartedAt}
            style={{ animationDuration: `${sequenceTimeout}ms` }}
          />
        )}

        {/* Completions list */}
        {completions.length > 0 && (
          <div className="hotkeys-sequence-completions">
            {Array.from(groupedCompletions.entries()).map(([nextKey, comps]) => (
              <div key={nextKey} className="hotkeys-sequence-completion">
                <kbd className="hotkeys-kbd">{nextKey.toUpperCase()}</kbd>
                <span className="hotkeys-sequence-arrow">→</span>
                <span className="hotkeys-sequence-actions">
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
          <div className="hotkeys-sequence-empty">
            No matching shortcuts
          </div>
        )}
      </div>
    </div>
  )
}
