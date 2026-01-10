import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useHotkeys, HotkeyMap, HandlerMap } from './useHotkeys'

const { max, min } = Math
import { searchActions, getSequenceCompletions, fuzzyMatch } from './utils'
import type { ActionRegistry, ActionSearchResult, HotkeySequence, OmnibarEntry } from './types'
import type { SequenceCompletion } from './types'
import type { OmnibarEndpointsRegistryValue } from './OmnibarEndpointsRegistry'

/** Default priority for local actions (higher than remote endpoints) */
const _LOCAL_ACTION_PRIORITY = 100

/** Default debounce time for remote queries */
const DEFAULT_DEBOUNCE_MS = 150

/**
 * Result from remote endpoint, normalized for display
 */
export interface RemoteOmnibarResult {
  /** Unique ID (prefixed with endpoint ID) */
  id: string
  /** Entry data from endpoint */
  entry: OmnibarEntry
  /** Endpoint ID this came from */
  endpointId: string
  /** Priority from endpoint config */
  priority: number
  /** Fuzzy match score */
  score: number
  /** Matched ranges in label for highlighting */
  labelMatches: Array<[number, number]>
}

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
  /** Called when a remote entry is executed */
  onExecuteRemote?: (entry: OmnibarEntry) => void
  /** Called when omnibar opens */
  onOpen?: () => void
  /** Called when omnibar closes */
  onClose?: () => void
  /** Maximum number of results to show (default: 10) */
  maxResults?: number
  /** Remote endpoints registry (optional - enables remote search) */
  endpointsRegistry?: OmnibarEndpointsRegistryValue
  /** Debounce time for remote queries in ms (default: 150) */
  debounceMs?: number
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
  /** Local action search results (filtered and sorted) */
  results: ActionSearchResult[]
  /** Remote endpoint results */
  remoteResults: RemoteOmnibarResult[]
  /** Whether remote endpoints are being queried */
  isLoadingRemote: boolean
  /** Currently selected result index (across local + remote) */
  selectedIndex: number
  /** Total number of results (local + remote) */
  totalResults: number
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
    onExecuteRemote,
    onOpen,
    onClose,
    maxResults = 10,
    endpointsRegistry,
    debounceMs = DEFAULT_DEBOUNCE_MS,
  } = options

  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [remoteResults, setRemoteResults] = useState<RemoteOmnibarResult[]>([])
  const [isLoadingRemote, setIsLoadingRemote] = useState(false)

  // Refs for stable callbacks
  const handlersRef = useRef(handlers)
  handlersRef.current = handlers

  const onExecuteRef = useRef(onExecute)
  onExecuteRef.current = onExecute

  const onExecuteRemoteRef = useRef(onExecuteRemote)
  onExecuteRemoteRef.current = onExecuteRemote

  // Refs for abort controller and debounce timer
  const abortControllerRef = useRef<AbortController | null>(null)
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

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

  // Search results (local actions)
  const results = useMemo(() => {
    const allResults = searchActions(query, actions, keymap)
    return allResults.slice(0, maxResults)
  }, [query, actions, keymap, maxResults])

  // Query remote endpoints (debounced)
  useEffect(() => {
    // Clear any pending debounce timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
      debounceTimerRef.current = null
    }

    // Abort any in-flight request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }

    // Skip if no endpoints registry or empty query
    if (!endpointsRegistry || !query.trim()) {
      setRemoteResults([])
      setIsLoadingRemote(false)
      return
    }

    // Debounce the query
    setIsLoadingRemote(true)
    debounceTimerRef.current = setTimeout(async () => {
      const controller = new AbortController()
      abortControllerRef.current = controller

      try {
        const endpointResults = await endpointsRegistry.queryAll(query, controller.signal)

        // Don't update if aborted
        if (controller.signal.aborted) return

        // Process results: score with fuzzy match and sort by priority then score
        const processed: RemoteOmnibarResult[] = []

        for (const epResult of endpointResults) {
          if (epResult.error) continue

          const endpoint = endpointsRegistry.endpoints.get(epResult.endpointId)
          const priority = endpoint?.config.priority ?? 0

          for (const entry of epResult.entries) {
            // Score the entry against the query
            const labelMatch = fuzzyMatch(query, entry.label)
            const descMatch = entry.description ? fuzzyMatch(query, entry.description) : null
            const keywordsMatch = entry.keywords?.map(k => fuzzyMatch(query, k)) ?? []

            // Calculate weighted score
            let score = 0
            let labelMatches: Array<[number, number]> = []
            if (labelMatch.matched) {
              score = Math.max(score, labelMatch.score * 3)
              labelMatches = labelMatch.ranges
            }
            if (descMatch?.matched) {
              score = Math.max(score, descMatch.score * 1.5)
            }
            for (const km of keywordsMatch) {
              if (km.matched) {
                score = Math.max(score, km.score * 2)
              }
            }

            // Include if any match (or if query is short, be more lenient)
            if (score > 0 || query.length <= 2) {
              processed.push({
                id: `${epResult.endpointId}:${entry.id}`,
                entry,
                endpointId: epResult.endpointId,
                priority,
                score: score || 1, // Minimum score for short queries
                labelMatches,
              })
            }
          }
        }

        // Sort by priority (desc) then score (desc)
        processed.sort((a, b) => {
          if (a.priority !== b.priority) return b.priority - a.priority
          return b.score - a.score
        })

        setRemoteResults(processed.slice(0, maxResults))
        setIsLoadingRemote(false)
      } catch (error) {
        // Ignore abort errors
        if (error instanceof Error && error.name === 'AbortError') return
        console.error('Omnibar endpoint query failed:', error)
        setIsLoadingRemote(false)
      }
    }, debounceMs)

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [query, endpointsRegistry, debounceMs, maxResults])

  // Total results count
  const totalResults = results.length + remoteResults.length

  // Sequence completions (based on pending keys from main hotkey handler, not omnibar)
  const completions = useMemo(() => {
    return getSequenceCompletions(pendingKeys, keymap)
  }, [pendingKeys, keymap])

  // Reset selection when results change
  useEffect(() => {
    setSelectedIndex(0)
  }, [results, remoteResults])

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
    setSelectedIndex(prev => min(prev + 1, totalResults - 1))
  }, [totalResults])

  const selectPrev = useCallback(() => {
    setSelectedIndex(prev => max(prev - 1, 0))
  }, [])

  const resetSelection = useCallback(() => {
    setSelectedIndex(0)
  }, [])

  const execute = useCallback((actionId?: string) => {
    // Determine if executing a local action or remote entry
    const localCount = results.length

    // If actionId provided, try to find it in local or remote
    if (actionId) {
      // Check if it's a remote result ID (contains endpoint prefix)
      const remoteResult = remoteResults.find(r => r.id === actionId)
      if (remoteResult) {
        close()
        const entry = remoteResult.entry
        if ('handler' in entry && entry.handler) {
          entry.handler()
        }
        onExecuteRemoteRef.current?.(entry)
        return
      }

      // Otherwise treat as local action
      close()
      if (handlersRef.current?.[actionId]) {
        const event = new KeyboardEvent('keydown', { key: 'Enter' })
        handlersRef.current[actionId](event)
      }
      onExecuteRef.current?.(actionId)
      return
    }

    // No actionId - use selectedIndex
    if (selectedIndex < localCount) {
      // Local action
      const id = results[selectedIndex]?.id
      if (!id) return

      close()
      if (handlersRef.current?.[id]) {
        const event = new KeyboardEvent('keydown', { key: 'Enter' })
        handlersRef.current[id](event)
      }
      onExecuteRef.current?.(id)
    } else {
      // Remote entry
      const remoteIndex = selectedIndex - localCount
      const remoteResult = remoteResults[remoteIndex]
      if (!remoteResult) return

      close()
      const entry = remoteResult.entry
      if ('handler' in entry && entry.handler) {
        entry.handler()
      }
      onExecuteRemoteRef.current?.(entry)
    }
  }, [results, remoteResults, selectedIndex, close])

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
    remoteResults,
    isLoadingRemote,
    selectedIndex,
    totalResults,
    selectNext,
    selectPrev,
    execute,
    resetSelection,
    completions,
    pendingKeys,
    isAwaitingSequence,
  }
}
