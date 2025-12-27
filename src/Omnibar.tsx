import React, { useCallback, useEffect, useMemo, useRef } from 'react'
import { getActionRegistry } from './actions'
import { useMaybeHotkeysContext } from './HotkeysProvider'
import type { ActionRegistry, ActionSearchResult, HotkeySequence, SequenceCompletion } from './types'
import type { HandlerMap, HotkeyMap } from './useHotkeys'
import { useOmnibar } from './useOmnibar'
import { formatCombination, parseHotkeyString } from './utils'
import { ModifierIcon } from './ModifierIcons'

export interface OmnibarProps {
  /**
   * Registry of available actions.
   * If not provided, uses actions from HotkeysContext.
   */
  actions?: ActionRegistry
  /**
   * Handlers for actions.
   * If not provided, uses handlers from HotkeysContext, falling back to executeAction.
   */
  handlers?: HandlerMap
  /**
   * Current keymap (to show bindings in results).
   * If not provided, uses keymap from HotkeysContext.
   */
  keymap?: HotkeyMap
  /** Hotkey to open omnibar (default: 'meta+k'). Set to empty string to disable. */
  openKey?: string
  /**
   * Whether omnibar hotkey is enabled.
   * When using HotkeysContext, defaults to false (provider handles it).
   */
  enabled?: boolean
  /**
   * Control visibility externally.
   * If not provided, uses isOmnibarOpen from HotkeysContext.
   */
  isOpen?: boolean
  /** Called when omnibar opens */
  onOpen?: () => void
  /**
   * Called when omnibar closes.
   * If not provided, uses closeOmnibar from HotkeysContext.
   */
  onClose?: () => void
  /**
   * Called when an action is executed.
   * If not provided, uses executeAction from HotkeysContext.
   */
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
  actions: actionsProp,
  handlers: handlersProp,
  keymap: keymapProp,
  openKey = 'meta+k',
  enabled: enabledProp,
  isOpen: isOpenProp,
  onOpen: onOpenProp,
  onClose: onCloseProp,
  onExecute: onExecuteProp,
  maxResults = 10,
  placeholder = 'Type a command...',
  children,
  backdropClassName = 'hotkeys-omnibar-backdrop',
  omnibarClassName = 'hotkeys-omnibar',
}: OmnibarProps) {
  const inputRef = useRef<HTMLInputElement | null>(null)

  // Try to get context (returns null if not within HotkeysProvider)
  const ctx = useMaybeHotkeysContext()

  // Derive actions from context if not provided as prop
  const contextActions = useMemo(() => {
    if (!ctx?.allActions) return undefined
    return getActionRegistry(ctx.allActions)
  }, [ctx?.allActions])

  // Use context values with prop overrides
  const actions = actionsProp ?? contextActions ?? {}
  const handlers = handlersProp ?? ctx?.handlers
  const keymap = keymapProp ?? ctx?.keymap ?? {}

  // When using context, default enabled to false (HotkeysProvider handles the trigger)
  const enabled = enabledProp ?? (ctx ? false : true)

  // Create execute handler that falls back to context
  const handleExecute = useCallback((actionId: string) => {
    if (onExecuteProp) {
      onExecuteProp(actionId)
    } else if (ctx?.executeAction) {
      ctx.executeAction(actionId)
    }
  }, [onExecuteProp, ctx])

  // Create close handler that falls back to context
  const handleClose = useCallback(() => {
    if (onCloseProp) {
      onCloseProp()
    } else if (ctx?.closeOmnibar) {
      ctx.closeOmnibar()
    }
  }, [onCloseProp, ctx])

  // Create open handler that falls back to context
  const handleOpen = useCallback(() => {
    if (onOpenProp) {
      onOpenProp()
    } else if (ctx?.openOmnibar) {
      ctx.openOmnibar()
    }
  }, [onOpenProp, ctx])

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
    enabled: isOpenProp === undefined && ctx === null ? enabled : false, // Disable hotkey if controlled or using context
    onOpen: handleOpen,
    onClose: handleClose,
    onExecute: handleExecute,
    maxResults,
  })

  // Use prop, then context, then internal state
  const isOpen = isOpenProp ?? ctx?.isOmnibarOpen ?? internalIsOpen

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
