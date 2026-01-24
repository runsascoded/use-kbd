import { Fragment, KeyboardEvent, MouseEvent, ReactNode, RefObject, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ACTION_OMNIBAR } from './constants'
import { useMaybeHotkeysContext } from './HotkeysProvider'
import { ModifierIcon } from './ModifierIcons'
import { useAction } from './useAction'
import { useOmnibar, RemoteOmnibarResult, EndpointPaginationInfo } from './useOmnibar'
import { parseKeySeq, formatKeyForDisplay } from './utils'
import type { SeqElem, OmnibarEntry } from './types'
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
   * Called when a local action is executed.
   * If not provided, uses executeAction from HotkeysContext.
   */
  onExecute?: (actionId: string) => void
  /**
   * Called when a remote omnibar entry is executed.
   * Use this to handle navigation for entries with `href`.
   */
  onExecuteRemote?: (entry: OmnibarEntry) => void
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
  /** Local action search results */
  results: ActionSearchResult[]
  /** Remote endpoint results */
  remoteResults: RemoteOmnibarResult[]
  /** Whether remote endpoints are being queried */
  isLoadingRemote: boolean
  /** Pagination info per endpoint */
  endpointPagination: Map<string, EndpointPaginationInfo>
  /** Load more results for a specific endpoint */
  loadMore: (endpointId: string) => void
  /** Currently selected index (across local + remote) */
  selectedIndex: number
  /** Total number of results (local + remote) */
  totalResults: number
  selectNext: () => void
  selectPrev: () => void
  execute: (actionId?: string, captures?: number[]) => void
  close: () => void
  completions: SequenceCompletion[]
  pendingKeys: HotkeySequence
  isAwaitingSequence: boolean
  inputRef: RefObject<HTMLInputElement | null>
  /** Action ID pending parameter entry */
  pendingParamAction: string | null
  /** Submit parameter value */
  submitParam: (value: number) => void
  /** Cancel parameter entry */
  cancelParam: () => void
}

/**
 * Render a single sequence element
 */
function SeqElemBadge({ elem }: { elem: SeqElem }) {
  if (elem.type === 'digit') {
    return <span className="kbd-placeholder" title="Any single digit (0-9)">#</span>
  }
  if (elem.type === 'digits') {
    return <span className="kbd-placeholder" title="One or more digits (0-9)">##</span>
  }
  // Regular key with modifiers
  return (
    <>
      {elem.modifiers.meta && <ModifierIcon modifier="meta" className="kbd-modifier-icon" />}
      {elem.modifiers.ctrl && <ModifierIcon modifier="ctrl" className="kbd-modifier-icon" />}
      {elem.modifiers.alt && <ModifierIcon modifier="alt" className="kbd-modifier-icon" />}
      {elem.modifiers.shift && <ModifierIcon modifier="shift" className="kbd-modifier-icon" />}
      <span>{formatKeyForDisplay(elem.key)}</span>
    </>
  )
}

/**
 * Render a key binding with modifier icons and digit placeholders
 */
function BindingBadge({ binding }: { binding: string }) {
  const keySeq = parseKeySeq(binding)

  return (
    <kbd className="kbd-kbd">
      {keySeq.map((elem, i) => (
        <Fragment key={i}>
          {i > 0 && <span className="kbd-sequence-sep"> </span>}
          <SeqElemBadge elem={elem} />
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
  onExecuteRemote: onExecuteRemoteProp,
  maxResults = 10,
  placeholder = 'Type a command...',
  children,
  backdropClassName = 'kbd-omnibar-backdrop',
  omnibarClassName = 'kbd-omnibar',
}: OmnibarProps) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const paramInputRef = useRef<HTMLInputElement | null>(null)
  const [paramValue, setParamValue] = useState('')

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
  const handleExecute = useCallback((actionId: string, captures?: number[]) => {
    if (onExecuteProp) {
      onExecuteProp(actionId)
    } else if (ctx?.executeAction) {
      ctx.executeAction(actionId, captures)
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

  // Create remote execute handler
  const handleExecuteRemote = useCallback((entry: OmnibarEntry) => {
    if (onExecuteRemoteProp) {
      onExecuteRemoteProp(entry)
    } else if ('href' in entry && entry.href) {
      // Default behavior: navigate to href using window.location
      window.location.href = entry.href
    }
  }, [onExecuteRemoteProp])

  const {
    isOpen: internalIsOpen,
    close,
    query,
    setQuery,
    results,
    remoteResults,
    isLoadingRemote,
    endpointPagination,
    loadMore,
    selectedIndex,
    totalResults,
    selectNext,
    selectPrev,
    execute,
    completions,
    pendingKeys,
    isAwaitingSequence,
    pendingParamAction,
    submitParam,
    cancelParam,
  } = useOmnibar({
    actions,
    handlers: handlersProp,
    keymap,
    openKey: '', // Trigger is handled via useAction, not useOmnibar
    enabled: false,
    onOpen: handleOpen,
    onClose: handleClose,
    onExecute: handleExecute,
    onExecuteRemote: handleExecuteRemote,
    maxResults,
    endpointsRegistry: ctx?.endpointsRegistry,
  })

  // Use prop, then context, then internal state
  const isOpen = isOpenProp ?? ctx?.isOmnibarOpen ?? internalIsOpen

  // Ref for the results container (IntersectionObserver root)
  const resultsContainerRef = useRef<HTMLDivElement | null>(null)

  // Refs for sentinel elements (one per endpoint with scroll mode)
  const sentinelRefs = useRef<Map<string, HTMLDivElement | null>>(new Map())

  // Group remote results by endpoint for rendering sentinels
  const remoteResultsByEndpoint = useMemo(() => {
    const grouped = new Map<string, RemoteOmnibarResult[]>()
    for (const result of remoteResults) {
      const existing = grouped.get(result.endpointId) ?? []
      existing.push(result)
      grouped.set(result.endpointId, existing)
    }
    return grouped
  }, [remoteResults])

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      // Slight delay to ensure DOM is ready
      requestAnimationFrame(() => {
        inputRef.current?.focus()
      })
    }
  }, [isOpen])

  // Focus parameter input when entering param mode
  useEffect(() => {
    if (pendingParamAction) {
      setParamValue('')
      requestAnimationFrame(() => {
        paramInputRef.current?.focus()
      })
    }
  }, [pendingParamAction])

  // Handle parameter input keydown
  const handleParamKeyDown = useCallback(
    (e: KeyboardEvent) => {
      switch (e.key) {
        case 'Escape':
          e.preventDefault()
          cancelParam()
          // Return focus to main input
          requestAnimationFrame(() => inputRef.current?.focus())
          break
        case 'Enter':
          e.preventDefault()
          if (paramValue) {
            const num = parseInt(paramValue, 10)
            if (!isNaN(num)) {
              submitParam(num)
            }
          }
          break
        case 'Backspace':
          if (!paramValue) {
            e.preventDefault()
            cancelParam()
            requestAnimationFrame(() => inputRef.current?.focus())
          }
          break
      }
    },
    [paramValue, cancelParam, submitParam],
  )

  // IntersectionObserver for scroll-based pagination
  useEffect(() => {
    if (!isOpen) return

    const container = resultsContainerRef.current
    if (!container) return

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue

          // Get endpoint ID from data attribute
          const endpointId = (entry.target as HTMLElement).dataset.endpointId
          if (!endpointId) continue

          // Check if this endpoint uses scroll mode and has more results
          const paginationInfo = endpointPagination.get(endpointId)
          if (!paginationInfo) continue
          if (paginationInfo.mode !== 'scroll') continue
          if (!paginationInfo.hasMore) continue
          if (paginationInfo.isLoading) continue

          // Load more!
          loadMore(endpointId)
        }
      },
      {
        root: container,
        rootMargin: '100px', // Trigger slightly before sentinel is visible
        threshold: 0,
      },
    )

    // Observe all sentinel elements
    for (const [_endpointId, sentinel] of sentinelRefs.current) {
      if (sentinel) {
        observer.observe(sentinel)
      }
    }

    return () => observer.disconnect()
  }, [isOpen, endpointPagination, loadMore])

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
          remoteResults,
          isLoadingRemote,
          endpointPagination,
          loadMore,
          selectedIndex,
          totalResults,
          selectNext,
          selectPrev,
          execute,
          close,
          completions,
          pendingKeys,
          isAwaitingSequence,
          inputRef,
          pendingParamAction,
          submitParam,
          cancelParam,
        })}
      </>
    )
  }

  // Get pending action label for parameter input
  const pendingActionLabel = pendingParamAction
    ? results.find(r => r.id === pendingParamAction)?.action.label ?? pendingParamAction
    : null

  // Default render
  return (
    <div className={backdropClassName} onClick={handleBackdropClick}>
      <div className={omnibarClassName} role="dialog" aria-modal="true" aria-label="Command palette">
        {pendingParamAction ? (
          // Parameter entry mode
          <div className="kbd-omnibar-param-entry">
            <span className="kbd-omnibar-param-label">{pendingActionLabel}</span>
            <input
              ref={paramInputRef}
              type="number"
              className="kbd-omnibar-param-input"
              value={paramValue}
              onChange={(e) => setParamValue(e.target.value)}
              onKeyDown={handleParamKeyDown}
              placeholder="Enter value..."
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              min="0"
            />
            <span className="kbd-omnibar-param-hint">↵ to confirm · Esc to cancel</span>
          </div>
        ) : (
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
        )}

        <div className="kbd-omnibar-results" ref={resultsContainerRef}>
          {totalResults === 0 && !isLoadingRemote ? (
            <div className="kbd-omnibar-no-results">
              {query ? 'No matching commands' : 'Start typing to search commands...'}
            </div>
          ) : (
            <>
              {/* Local action results */}
              {results.map((result, i) => (
                <div
                  key={result.id}
                  className={`kbd-omnibar-result ${i === selectedIndex ? 'selected' : ''}`}
                  onClick={() => execute(result.id)}
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
              ))}

              {/* Remote endpoint results grouped by endpoint */}
              {(() => {
                let remoteIndex = 0
                return Array.from(remoteResultsByEndpoint.entries()).map(([endpointId, endpointResults]) => {
                  const paginationInfo = endpointPagination.get(endpointId)
                  const showPagination = paginationInfo?.mode === 'scroll' && paginationInfo.total !== undefined

                  return (
                    <Fragment key={endpointId}>
                      {endpointResults.map((result) => {
                        const absoluteIndex = results.length + remoteIndex
                        remoteIndex++
                        return (
                          <div
                            key={result.id}
                            className={`kbd-omnibar-result ${absoluteIndex === selectedIndex ? 'selected' : ''}`}
                            onClick={() => execute(result.id)}
                          >
                            <span className="kbd-omnibar-result-label">
                              {result.entry.label}
                            </span>
                            {result.entry.group && (
                              <span className="kbd-omnibar-result-category">
                                {result.entry.group}
                              </span>
                            )}
                            {result.entry.description && (
                              <span className="kbd-omnibar-result-description">
                                {result.entry.description}
                              </span>
                            )}
                          </div>
                        )
                      })}

                      {/* Pagination info and sentinel for scroll mode */}
                      {paginationInfo?.mode === 'scroll' && (
                        <div
                          className="kbd-omnibar-pagination"
                          ref={(el) => sentinelRefs.current.set(endpointId, el)}
                          data-endpoint-id={endpointId}
                        >
                          {paginationInfo.isLoading ? (
                            <span className="kbd-omnibar-pagination-loading">Loading more...</span>
                          ) : showPagination ? (
                            <span className="kbd-omnibar-pagination-info">
                              {paginationInfo.loaded} of {paginationInfo.total}
                            </span>
                          ) : paginationInfo.hasMore ? (
                            <span className="kbd-omnibar-pagination-more">Scroll for more...</span>
                          ) : null}
                        </div>
                      )}
                    </Fragment>
                  )
                })
              })()}

              {/* Loading indicator for initial load */}
              {isLoadingRemote && remoteResults.length === 0 && (
                <div className="kbd-omnibar-loading">
                  Searching...
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
