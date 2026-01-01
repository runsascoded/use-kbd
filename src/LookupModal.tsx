import { useCallback, useEffect, useMemo, useState } from 'react'
import { ACTION_LOOKUP } from './constants'
import { useHotkeysContext } from './HotkeysProvider'
import { useAction } from './useAction'
import type { HotkeySequence, KeyCombination } from './types'
import { formatCombination, parseHotkeyString, normalizeKey, isModifierKey } from './utils'

interface LookupResult {
  binding: string
  sequence: HotkeySequence
  display: string
  actions: string[]
  labels: string[]
}

export interface LookupModalProps {
  /**
   * Default keybinding to open lookup modal (default: 'meta+shift+k').
   * Users can override this in the shortcuts modal.
   * Set to empty string to disable.
   */
  defaultBinding?: string
}

/**
 * Modal for browsing and looking up keyboard shortcuts by typing key sequences.
 *
 * Unlike SequenceModal (which auto-executes when a complete sequence is entered),
 * LookupModal lets you browse all available shortcuts and select one to execute.
 *
 * - Press keys to filter to matching sequences
 * - Use arrow keys to navigate results
 * - Press Enter to execute selected action
 * - Press Escape to close or clear filter
 * - Press Backspace to remove last key from filter
 */
export function LookupModal({ defaultBinding = 'meta+shift+k' }: LookupModalProps = {}) {
  const {
    isLookupOpen,
    closeLookup,
    toggleLookup,
    registry,
    executeAction,
  } = useHotkeysContext()

  // Register the lookup modal trigger action
  useAction(ACTION_LOOKUP, {
    label: 'Key lookup',
    group: 'Global',
    defaultBindings: defaultBinding ? [defaultBinding] : [],
    handler: useCallback(() => toggleLookup(), [toggleLookup]),
  })

  // Internal pending keys state (separate from global)
  const [pendingKeys, setPendingKeys] = useState<HotkeySequence>([])
  const [selectedIndex, setSelectedIndex] = useState(0)

  // Get all bindings from keymap
  const allBindings = useMemo((): LookupResult[] => {
    const results: LookupResult[] = []
    const keymap = registry.keymap

    for (const [binding, actionOrActions] of Object.entries(keymap)) {
      // Skip internal triggers
      if (binding.startsWith('__')) continue

      const actions = Array.isArray(actionOrActions) ? actionOrActions : [actionOrActions]
      const sequence = parseHotkeyString(binding)
      const display = formatCombination(sequence).display

      // Get labels for actions
      const labels = actions.map(actionId => {
        const action = registry.actions.get(actionId)
        return action?.config.label || actionId
      })

      results.push({ binding, sequence, display, actions, labels })
    }

    // Sort by binding for consistent ordering
    results.sort((a, b) => a.binding.localeCompare(b.binding))

    return results
  }, [registry.keymap, registry.actions])

  // Filter bindings based on pending keys
  const filteredBindings = useMemo((): LookupResult[] => {
    if (pendingKeys.length === 0) return allBindings

    return allBindings.filter(result => {
      // Check if pending keys match the start of this binding
      if (result.sequence.length < pendingKeys.length) return false

      for (let i = 0; i < pendingKeys.length; i++) {
        const pending = pendingKeys[i]
        const target = result.sequence[i]

        if (pending.key !== target.key) return false
        if (pending.modifiers.ctrl !== target.modifiers.ctrl) return false
        if (pending.modifiers.alt !== target.modifiers.alt) return false
        if (pending.modifiers.shift !== target.modifiers.shift) return false
        if (pending.modifiers.meta !== target.modifiers.meta) return false
      }

      return true
    })
  }, [allBindings, pendingKeys])

  // Group by next key (for showing available continuations)
  const groupedByNextKey = useMemo(() => {
    const groups = new Map<string, LookupResult[]>()

    for (const result of filteredBindings) {
      // If this binding is longer than pending, group by next key
      if (result.sequence.length > pendingKeys.length) {
        const nextCombo = result.sequence[pendingKeys.length]
        const nextKey = formatCombination([nextCombo]).display

        const existing = groups.get(nextKey) || []
        existing.push(result)
        groups.set(nextKey, existing)
      } else {
        // Exact match - group under empty string
        const existing = groups.get('') || []
        existing.push(result)
        groups.set('', existing)
      }
    }

    return groups
  }, [filteredBindings, pendingKeys])

  // Format pending keys for display
  const formattedPendingKeys = useMemo(() => {
    if (pendingKeys.length === 0) return ''
    return formatCombination(pendingKeys).display
  }, [pendingKeys])

  // Reset state when modal opens/closes
  useEffect(() => {
    if (isLookupOpen) {
      setPendingKeys([])
      setSelectedIndex(0)
    }
  }, [isLookupOpen])

  // Reset selection when filtered results change
  useEffect(() => {
    setSelectedIndex(0)
  }, [filteredBindings.length])

  // Handle keyboard input
  useEffect(() => {
    if (!isLookupOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      // Handle navigation keys
      if (e.key === 'Escape') {
        e.preventDefault()
        if (pendingKeys.length > 0) {
          // Clear filter first
          setPendingKeys([])
        } else {
          closeLookup()
        }
        return
      }

      if (e.key === 'Backspace') {
        e.preventDefault()
        setPendingKeys(prev => prev.slice(0, -1))
        return
      }

      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex(prev => Math.min(prev + 1, filteredBindings.length - 1))
        return
      }

      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex(prev => Math.max(prev - 1, 0))
        return
      }

      if (e.key === 'Enter') {
        e.preventDefault()
        const selected = filteredBindings[selectedIndex]
        if (selected && selected.actions.length > 0) {
          closeLookup()
          // Execute first action
          executeAction(selected.actions[0])
        }
        return
      }

      // Skip modifier-only keys
      if (isModifierKey(e.key)) return

      // Add this key to pending
      e.preventDefault()
      const newCombo: KeyCombination = {
        key: normalizeKey(e.key),
        modifiers: {
          ctrl: e.ctrlKey,
          alt: e.altKey,
          shift: e.shiftKey,
          meta: e.metaKey,
        },
      }
      setPendingKeys(prev => [...prev, newCombo])
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isLookupOpen, pendingKeys, filteredBindings, selectedIndex, closeLookup, executeAction])

  // Handle backdrop click
  const handleBackdropClick = useCallback(() => {
    closeLookup()
  }, [closeLookup])

  if (!isLookupOpen) return null

  return (
    <div className="kbd-lookup-backdrop" onClick={handleBackdropClick}>
      <div className="kbd-lookup" onClick={e => e.stopPropagation()}>
        {/* Search/filter display */}
        <div className="kbd-lookup-header">
          <div className="kbd-lookup-search">
            {formattedPendingKeys ? (
              <kbd className="kbd-sequence-keys">{formattedPendingKeys}</kbd>
            ) : (
              <span className="kbd-lookup-placeholder">Type keys to filter...</span>
            )}
          </div>
          <span className="kbd-lookup-hint">
            ↑↓ navigate · Enter select · Esc {pendingKeys.length > 0 ? 'clear' : 'close'} · ⌫ back
          </span>
        </div>

        {/* Results list */}
        <div className="kbd-lookup-results">
          {filteredBindings.length === 0 ? (
            <div className="kbd-lookup-empty">No matching shortcuts</div>
          ) : (
            filteredBindings.map((result, index) => (
              <div
                key={result.binding}
                className={`kbd-lookup-result ${index === selectedIndex ? 'selected' : ''}`}
                onClick={() => {
                  closeLookup()
                  if (result.actions.length > 0) {
                    executeAction(result.actions[0])
                  }
                }}
                onMouseEnter={() => setSelectedIndex(index)}
              >
                <kbd className="kbd-kbd">{result.display}</kbd>
                <span className="kbd-lookup-labels">
                  {result.labels.join(', ')}
                </span>
              </div>
            ))
          )}
        </div>

        {/* Available next keys hint */}
        {pendingKeys.length > 0 && groupedByNextKey.size > 1 && (
          <div className="kbd-lookup-continuations">
            <span className="kbd-lookup-continuations-label">Continue with:</span>
            {Array.from(groupedByNextKey.keys())
              .filter(k => k !== '')
              .slice(0, 8)
              .map(nextKey => (
                <kbd key={nextKey} className="kbd-kbd kbd-small">{nextKey}</kbd>
              ))}
            {groupedByNextKey.size > 9 && <span>...</span>}
          </div>
        )}
      </div>
    </div>
  )
}
