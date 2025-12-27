import React, { useCallback, useEffect, useRef } from 'react'
import type { ActionRegistry, ActionSearchResult, HotkeySequence, SequenceCompletion } from './types'
import type { HandlerMap, HotkeyMap } from './useHotkeys'
import { useOmnibar } from './useOmnibar'
import { formatCombination, parseHotkeyString } from './utils'
import { ModifierIcon } from './ModifierIcons'

export interface OmnibarProps {
  /** Registry of available actions */
  actions: ActionRegistry
  /** Handlers for actions (optional - if not provided, use onExecute callback) */
  handlers?: HandlerMap
  /** Current keymap (to show bindings in results) */
  keymap?: HotkeyMap
  /** Hotkey to open omnibar (default: 'meta+k') */
  openKey?: string
  /** Whether omnibar hotkey is enabled (default: true) */
  enabled?: boolean
  /** Control visibility externally */
  isOpen?: boolean
  /** Called when omnibar opens */
  onOpen?: () => void
  /** Called when omnibar closes */
  onClose?: () => void
  /** Called when an action is executed */
  onExecute?: (actionId: string) => void
  /** Maximum number of results to show (default: 10) */
  maxResults?: number
  /** Placeholder text for input (default: 'Type a command...') */
  placeholder?: string
  /** Custom render function */
  children?: (props: OmnibarRenderProps) => React.ReactNode
  /** CSS class for the backdrop */
  backdropClassName?: string
  /** CSS class for the omnibar container */
  omnibarClassName?: string
}

export interface OmnibarRenderProps {
  query: string
  setQuery: (query: string) => void
  results: ActionSearchResult[]
  selectedIndex: number
  selectNext: () => void
  selectPrev: () => void
  execute: (actionId?: string) => void
  close: () => void
  completions: SequenceCompletion[]
  pendingKeys: HotkeySequence
  isAwaitingSequence: boolean
  inputRef: React.RefObject<HTMLInputElement | null>
}

/**
 * Render a key binding with modifier icons
 */
function BindingBadge({ binding }: { binding: string }) {
  const sequence = parseHotkeyString(binding)
  const display = formatCombination(sequence)

  return (
    <kbd className="hotkeys-kbd">
      {sequence.map((combo, i) => (
        <React.Fragment key={i}>
          {i > 0 && <span className="hotkeys-sequence-sep"> </span>}
          {combo.modifiers.meta && <ModifierIcon modifier="meta" className="hotkeys-modifier-icon" />}
          {combo.modifiers.ctrl && <ModifierIcon modifier="ctrl" className="hotkeys-modifier-icon" />}
          {combo.modifiers.alt && <ModifierIcon modifier="alt" className="hotkeys-modifier-icon" />}
          {combo.modifiers.shift && <ModifierIcon modifier="shift" className="hotkeys-modifier-icon" />}
          <span>{combo.key.length === 1 ? combo.key.toUpperCase() : combo.key}</span>
        </React.Fragment>
      ))}
    </kbd>
  )
}

/**
 * Omnibar/command palette component for searching and executing actions.
 *
 * Uses CSS classes from styles.css. Override via CSS custom properties:
 * --hotkeys-bg, --hotkeys-text, --hotkeys-accent, etc.
 *
 * @example
 * ```tsx
 * <Omnibar
 *   actions={ACTIONS}
 *   handlers={HANDLERS}
 *   keymap={KEYMAP}
 *   onExecute={(id) => console.log('Executed:', id)}
 * />
 * ```
 */
export function Omnibar({
  actions,
  handlers,
  keymap = {},
  openKey = 'meta+k',
  enabled = true,
  isOpen: controlledIsOpen,
  onOpen,
  onClose,
  onExecute,
  maxResults = 10,
  placeholder = 'Type a command...',
  children,
  backdropClassName = 'hotkeys-omnibar-backdrop',
  omnibarClassName = 'hotkeys-omnibar',
}: OmnibarProps) {
  const inputRef = useRef<HTMLInputElement | null>(null)

  const {
    isOpen: internalIsOpen,
    open,
    close,
    query,
    setQuery,
    results,
    selectedIndex,
    selectNext,
    selectPrev,
    execute,
    completions,
    pendingKeys,
    isAwaitingSequence,
  } = useOmnibar({
    actions,
    handlers,
    keymap,
    openKey,
    enabled: controlledIsOpen === undefined ? enabled : false, // Disable hotkey if controlled
    onOpen,
    onClose,
    onExecute,
    maxResults,
  })

  const isOpen = controlledIsOpen ?? internalIsOpen

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      // Slight delay to ensure DOM is ready
      requestAnimationFrame(() => {
        inputRef.current?.focus()
      })
    }
  }, [isOpen])

  // Handle input keydown
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case 'Escape':
          e.preventDefault()
          close()
          break
        case 'ArrowDown':
          e.preventDefault()
          selectNext()
          break
        case 'ArrowUp':
          e.preventDefault()
          selectPrev()
          break
        case 'Enter':
          e.preventDefault()
          execute()
          break
      }
    },
    [close, selectNext, selectPrev, execute],
  )

  // Close on backdrop click
  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) {
        close()
      }
    },
    [close],
  )

  if (!isOpen) return null

  // Custom render
  if (children) {
    return (
      <>
        {children({
          query,
          setQuery,
          results,
          selectedIndex,
          selectNext,
          selectPrev,
          execute,
          close,
          completions,
          pendingKeys,
          isAwaitingSequence,
          inputRef,
        })}
      </>
    )
  }

  // Default render
  return (
    <div className={backdropClassName} onClick={handleBackdropClick}>
      <div className={omnibarClassName} role="dialog" aria-modal="true" aria-label="Command palette">
        <input
          ref={inputRef}
          type="text"
          className="hotkeys-omnibar-input"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
        />

        <div className="hotkeys-omnibar-results">
          {results.length === 0 ? (
            <div className="hotkeys-omnibar-no-results">
              {query ? 'No matching commands' : 'Start typing to search commands...'}
            </div>
          ) : (
            results.map((result, i) => (
              <div
                key={result.id}
                className={`hotkeys-omnibar-result ${i === selectedIndex ? 'selected' : ''}`}
                onClick={() => execute(result.id)}
                onMouseEnter={() => {/* Could set selectedIndex here for hover selection */}}
              >
                <span className="hotkeys-omnibar-result-label">
                  {result.action.label}
                </span>
                {result.action.category && (
                  <span className="hotkeys-omnibar-result-category">
                    {result.action.category}
                  </span>
                )}
                {result.bindings.length > 0 && (
                  <div className="hotkeys-omnibar-result-bindings">
                    {result.bindings.slice(0, 2).map((binding) => (
                      <BindingBadge key={binding} binding={binding} />
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
