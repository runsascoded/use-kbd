import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useHotkeys, HotkeyMap, HandlerMap } from './useHotkeys'
import { searchActions, getSequenceCompletions } from './utils'
import type { ActionRegistry, ActionSearchResult, HotkeySequence } from './types'
import type { SequenceCompletion } from './types'

export interface UseOmnibarOptions {
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
  /** Called when an action is executed (if handlers not provided, or in addition to) */
  onExecute?: (actionId: string) => void
  /** Called when omnibar opens */
  onOpen?: () => void
  /** Called when omnibar closes */
  onClose?: () => void
  /** Maximum number of results to show (default: 10) */
  maxResults?: number
}

export interface UseOmnibarResult {
  /** Whether omnibar is open */
  isOpen: boolean
  /** Open the omnibar */
  open: () => void
  /** Close the omnibar */
  close: () => void
  /** Toggle the omnibar */
  toggle: () => void
  /** Current search query */
  query: string
  /** Set the search query */
  setQuery: (query: string) => void
  /** Search results (filtered and sorted) */
  results: ActionSearchResult[]
  /** Currently selected result index */
  selectedIndex: number
  /** Select the next result */
  selectNext: () => void
  /** Select the previous result */
  selectPrev: () => void
  /** Execute the selected action (or a specific action by ID) */
  execute: (actionId?: string) => void
  /** Reset selection to first result */
  resetSelection: () => void
  /** Sequence completions based on pending keys */
  completions: SequenceCompletion[]
  /** Keys pressed so far in current sequence (from useHotkeys) */
  pendingKeys: HotkeySequence
  /** Whether currently awaiting more keys in a sequence */
  isAwaitingSequence: boolean
}

/**
 * Hook for implementing an omnibar/command palette.
 *
 * @example
 * ```tsx
 * const ACTIONS: ActionRegistry = {
 *   'metric:temp': { label: 'Temperature', category: 'Metrics' },
 *   'metric:co2': { label: 'CO₂', category: 'Metrics' },
 *   'save': { label: 'Save', description: 'Save current settings' },
 * }
 *
 * function App() {
 *   const {
 *     isOpen, open, close,
 *     query, setQuery,
 *     results,
 *     selectedIndex, selectNext, selectPrev,
 *     execute,
 *   } = useOmnibar({
 *     actions: ACTIONS,
 *     handlers: HANDLERS,
 *     keymap: KEYMAP,
 *   })
 *
 *   return (
 *     <>
 *       {isOpen && (
 *         <div className="omnibar">
 *           <input
 *             value={query}
 *             onChange={e => setQuery(e.target.value)}
 *             onKeyDown={e => {
 *               if (e.key === 'ArrowDown') selectNext()
 *               if (e.key === 'ArrowUp') selectPrev()
 *               if (e.key === 'Enter') execute()
 *               if (e.key === 'Escape') close()
 *             }}
 *           />
 *           {results.map((result, i) => (
 *             <div
 *               key={result.id}
 *               className={i === selectedIndex ? 'selected' : ''}
 *               onClick={() => execute(result.id)}
 *             >
 *               {result.action.label}
 *               {result.bindings.length > 0 && (
 *                 <kbd>{result.bindings[0]}</kbd>
 *               )}
 *             </div>
 *           ))}
 *         </div>
 *       )}
 *     </>
 *   )
 * }
 * ```
 */
export function useOmnibar(options: UseOmnibarOptions): UseOmnibarResult {
  const {
    actions,
    handlers,
    keymap = {},
    openKey = 'meta+k',
    enabled = true,
    onExecute,
    onOpen,
    onClose,
    maxResults = 10,
  } = options

  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)

  // Refs for stable callbacks
  const handlersRef = useRef(handlers)
  handlersRef.current = handlers

  const onExecuteRef = useRef(onExecute)
  onExecuteRef.current = onExecute

  // Register omnibar hotkey
  const omnibarKeymap = useMemo(() => {
    if (!enabled) return {}
    return { [openKey]: 'omnibar:toggle' }
  }, [enabled, openKey])

  const { pendingKeys, isAwaitingSequence } = useHotkeys(
    omnibarKeymap,
    {
      'omnibar:toggle': () => {
        setIsOpen(prev => {
          const next = !prev
          if (next) {
            onOpen?.()
          } else {
            onClose?.()
          }
          return next
        })
      },
    },
    { enabled },
  )

  // Search results
  const results = useMemo(() => {
    const allResults = searchActions(query, actions, keymap)
    return allResults.slice(0, maxResults)
  }, [query, actions, keymap, maxResults])

  // Sequence completions (based on pending keys from main hotkey handler, not omnibar)
  const completions = useMemo(() => {
    return getSequenceCompletions(pendingKeys, keymap)
  }, [pendingKeys, keymap])

  // Reset selection when results change
  useEffect(() => {
    setSelectedIndex(0)
  }, [results])

  const open = useCallback(() => {
    setIsOpen(true)
    setQuery('')
    setSelectedIndex(0)
    onOpen?.()
  }, [onOpen])

  const close = useCallback(() => {
    setIsOpen(false)
    setQuery('')
    setSelectedIndex(0)
    onClose?.()
  }, [onClose])

  const toggle = useCallback(() => {
    setIsOpen(prev => {
      const next = !prev
      if (next) {
        setQuery('')
        setSelectedIndex(0)
        onOpen?.()
      } else {
        onClose?.()
      }
      return next
    })
  }, [onOpen, onClose])

  const selectNext = useCallback(() => {
    setSelectedIndex(prev => Math.min(prev + 1, results.length - 1))
  }, [results.length])

  const selectPrev = useCallback(() => {
    setSelectedIndex(prev => Math.max(prev - 1, 0))
  }, [])

  const resetSelection = useCallback(() => {
    setSelectedIndex(0)
  }, [])

  const execute = useCallback((actionId?: string) => {
    const id = actionId ?? results[selectedIndex]?.id
    if (!id) return

    // Close omnibar
    close()

    // Call handler if available
    if (handlersRef.current?.[id]) {
      // Create a synthetic keyboard event
      const event = new KeyboardEvent('keydown', { key: 'Enter' })
      handlersRef.current[id](event)
    }

    // Call onExecute callback
    onExecuteRef.current?.(id)
  }, [results, selectedIndex, close])

  // Handle keyboard navigation when open
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't handle if focused on an input (let the input handle it)
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        // Still handle Escape to close
        if (e.key === 'Escape') {
          e.preventDefault()
          close()
        }
        return
      }

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
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, close, selectNext, selectPrev, execute])

  return {
    isOpen,
    open,
    close,
    toggle,
    query,
    setQuery,
    results,
    selectedIndex,
    selectNext,
    selectPrev,
    execute,
    resetSelection,
    completions,
    pendingKeys,
    isAwaitingSequence,
  }
}
