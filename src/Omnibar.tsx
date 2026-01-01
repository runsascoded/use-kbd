import { Fragment, KeyboardEvent, MouseEvent, ReactNode, RefObject, useCallback, useEffect, useRef } from 'react'
import { ACTION_OMNIBAR } from './constants'
import { useMaybeHotkeysContext } from './HotkeysProvider'
import { ModifierIcon } from './ModifierIcons'
import { useAction } from './useAction'
import { useOmnibar } from './useOmnibar'
import { parseHotkeyString } from './utils'
import type { ActionRegistry, ActionSearchResult, HotkeySequence, SequenceCompletion } from './types'
import type { HandlerMap, HotkeyMap } from './useHotkeys'

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
  /**
   * Default keybinding to open omnibar (default: 'meta+k').
   * Users can override this in the shortcuts modal.
   * Set to empty string to disable.
   */
  defaultBinding?: string
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
  children?: (props: OmnibarRenderProps) => ReactNode
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
  inputRef: RefObject<HTMLInputElement | null>
}

/**
 * Render a key binding with modifier icons
 */
function BindingBadge({ binding }: { binding: string }) {
  const sequence = parseHotkeyString(binding)

  return (
    <kbd className="kbd-kbd">
      {sequence.map((combo, i) => (
        <Fragment key={i}>
          {i > 0 && <span className="kbd-sequence-sep"> </span>}
          {combo.modifiers.meta && <ModifierIcon modifier="meta" className="kbd-modifier-icon" />}
          {combo.modifiers.ctrl && <ModifierIcon modifier="ctrl" className="kbd-modifier-icon" />}
          {combo.modifiers.alt && <ModifierIcon modifier="alt" className="kbd-modifier-icon" />}
          {combo.modifiers.shift && <ModifierIcon modifier="shift" className="kbd-modifier-icon" />}
          <span>{combo.key.length === 1 ? combo.key.toUpperCase() : combo.key}</span>
        </Fragment>
      ))}
    </kbd>
  )
}

/**
 * Command palette for searching and executing actions by name.
 *
 * Opens by default with `⌘K` (macOS) or `Ctrl+K` (Windows/Linux). Type to search
 * across all registered actions by label, then press Enter to execute.
 *
 * Features:
 * - **Fuzzy search**: Matches action labels (e.g., "nav tab" finds "Navigate to Table")
 * - **Keyboard navigation**: Arrow keys to select, Enter to execute, Escape to close
 * - **Binding display**: Shows keyboard shortcuts next to each result
 * - **Sequence support**: Can also match and execute key sequences
 *
 * Unlike ShortcutsModal (shows all shortcuts organized by group) or LookupModal
 * (type keys to filter by binding), Omnibar is search-first by action name/label.
 *
 * Styled via CSS custom properties: --kbd-bg, --kbd-text, --kbd-accent, etc.
 *
 * @example
 * ```tsx
 * // Basic usage with HotkeysProvider (recommended)
 * <HotkeysProvider>
 *   <App />
 *   <Omnibar />
 * </HotkeysProvider>
 *
 * // Standalone with explicit props
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
  defaultBinding = 'meta+k',
  isOpen: isOpenProp,
  onOpen: onOpenProp,
  onClose: onCloseProp,
  onExecute: onExecuteProp,
  maxResults = 10,
  placeholder = 'Type a command...',
  children,
  backdropClassName = 'kbd-omnibar-backdrop',
  omnibarClassName = 'kbd-omnibar',
}: OmnibarProps) {
  const inputRef = useRef<HTMLInputElement | null>(null)

  // Try to get context (returns null if not within HotkeysProvider)
  const ctx = useMaybeHotkeysContext()

  // Use context values with prop overrides
  const actions = actionsProp ?? ctx?.registry.actionRegistry ?? {}
  const keymap = keymapProp ?? ctx?.registry.keymap ?? {}

  // Register the omnibar trigger action (only works within HotkeysProvider)
  useAction(ACTION_OMNIBAR, {
    label: 'Command palette',
    group: 'Global',
    defaultBindings: defaultBinding ? [defaultBinding] : [],
    handler: useCallback(() => ctx?.toggleOmnibar(), [ctx?.toggleOmnibar]),
  })

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
    handlers: handlersProp,
    keymap,
    openKey: '', // Trigger is handled via useAction, not useOmnibar
    enabled: false,
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

  // Global ESC handler to close omnibar (works even if input loses focus)
  useEffect(() => {
    if (!isOpen) return

    const handleGlobalKeyDown = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        close()
      }
    }

    // Use capture phase to catch ESC before other handlers
    document.addEventListener('keydown', handleGlobalKeyDown, true)
    return () => document.removeEventListener('keydown', handleGlobalKeyDown, true)
  }, [isOpen, close])

  // Handle input keydown
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
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
    (e: MouseEvent) => {
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
          className="kbd-omnibar-input"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
        />

        <div className="kbd-omnibar-results">
          {results.length === 0 ? (
            <div className="kbd-omnibar-no-results">
              {query ? 'No matching commands' : 'Start typing to search commands...'}
            </div>
          ) : (
            results.map((result, i) => (
              <div
                key={result.id}
                className={`kbd-omnibar-result ${i === selectedIndex ? 'selected' : ''}`}
                onClick={() => execute(result.id)}
                onMouseEnter={() => {/* Could set selectedIndex here for hover selection */}}
              >
                <span className="kbd-omnibar-result-label">
                  {result.action.label}
                </span>
                {result.action.group && (
                  <span className="kbd-omnibar-result-category">
                    {result.action.group}
                  </span>
                )}
                {result.bindings.length > 0 && (
                  <div className="kbd-omnibar-result-bindings">
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
