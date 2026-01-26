import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { ActionsRegistryContext, useActionsRegistry } from './ActionsRegistry'
import { OmnibarEndpointsRegistryContext, useOmnibarEndpointsRegistry } from './OmnibarEndpointsRegistry'
import { DEFAULT_SEQUENCE_TIMEOUT } from './constants'
import { useHotkeys } from './useHotkeys'
import { findConflicts, getSequenceCompletions, searchActions } from './utils'
import type { ActionsRegistryValue } from './ActionsRegistry'
import type { OmnibarEndpointsRegistryValue } from './OmnibarEndpointsRegistry'
import type { HotkeySequence } from './types'

/**
 * Configuration for the HotkeysProvider.
 */
export interface HotkeysConfig {
  /** Storage key for persisting user binding overrides */
  storageKey?: string

  /** Timeout in ms before a sequence auto-submits (default: Infinity, no timeout) */
  sequenceTimeout?: number

  /** When true, keys with conflicts are disabled (default: true) */
  disableConflicts?: boolean

  /** Minimum viewport width to enable hotkeys (default: false = no viewport restriction) */
  minViewportWidth?: number | false

  /** Whether to show hotkey UI on touch-only devices (default: false) */
  enableOnTouch?: boolean
}

/**
 * Context value for hotkeys.
 */
export interface HotkeysContextValue {
  /** The actions registry */
  registry: ActionsRegistryValue
  /** The omnibar endpoints registry */
  endpointsRegistry: OmnibarEndpointsRegistryValue
  /** Whether hotkeys are enabled (based on viewport/touch) */
  isEnabled: boolean
  /** Modal open state */
  isModalOpen: boolean
  /** Open the shortcuts modal */
  openModal: () => void
  /** Close the shortcuts modal */
  closeModal: () => void
  /** Toggle the shortcuts modal */
  toggleModal: () => void
  /** Omnibar open state */
  isOmnibarOpen: boolean
  /** Open the omnibar */
  openOmnibar: () => void
  /** Close the omnibar */
  closeOmnibar: () => void
  /** Toggle the omnibar */
  toggleOmnibar: () => void
  /** Whether currently editing a binding in ShortcutsModal */
  isEditingBinding: boolean
  /** Set editing state (called by ShortcutsModal) */
  setIsEditingBinding: (value: boolean) => void
  /** Lookup modal open state */
  isLookupOpen: boolean
  /** Initial keys to pre-fill when lookup modal opens */
  lookupInitialKeys: HotkeySequence
  /** Open the lookup modal, optionally with pre-filled keys */
  openLookup: (initialKeys?: HotkeySequence) => void
  /** Close the lookup modal */
  closeLookup: () => void
  /** Toggle the lookup modal */
  toggleLookup: () => void
  /** Execute an action by ID */
  executeAction: (id: string, captures?: number[]) => void
  /** Recently executed action IDs (most recent first) */
  recentActionIds: string[]
  /** Sequence state: pending key combinations */
  pendingKeys: HotkeySequence
  /** Sequence state: whether waiting for more keys */
  isAwaitingSequence: boolean
  /** Sequence state: when the timeout started */
  sequenceTimeoutStartedAt: number | null
  /** Sequence state: timeout duration in ms */
  sequenceTimeout: number
  /** Map of key -> actions[] for keys with multiple actions bound */
  conflicts: Map<string, string[]>
  /** Whether there are any conflicts */
  hasConflicts: boolean
  /** Search actions by query */
  searchActions: (query: string) => ReturnType<typeof searchActions>
  /** Get sequence completions for pending keys */
  getCompletions: (pendingKeys: HotkeySequence) => ReturnType<typeof getSequenceCompletions>
  /** Cancel the current sequence */
  cancelSequence: () => void
}

const HotkeysContext = createContext<HotkeysContextValue | null>(null)

const DEFAULT_CONFIG: Required<HotkeysConfig> = {
  storageKey: 'use-kbd',
  sequenceTimeout: DEFAULT_SEQUENCE_TIMEOUT,
  disableConflicts: false,  // Keep conflicting bindings active; SeqM handles disambiguation
  minViewportWidth: false,  // Don't disable based on viewport; use enableOnTouch instead
  enableOnTouch: false,
}

export interface HotkeysProviderProps {
  config?: HotkeysConfig
  children: ReactNode
}

/**
 * Provider for hotkey registration via useAction.
 *
 * Components register their own actions using the useAction hook.
 *
 * @example
 * ```tsx
 * function App() {
 *   return (
 *     <HotkeysProvider config={{ storageKey: 'my-app' }}>
 *       <Dashboard />
 *       <ShortcutsModal />
 *       <Omnibar />
 *       <SequenceModal />
 *     </HotkeysProvider>
 *   )
 * }
 *
 * function Dashboard() {
 *   const { save } = useDocument()
 *
 *   useAction('doc:save', {
 *     label: 'Save document',
 *     group: 'Document',
 *     defaultBindings: ['meta+s'],
 *     handler: save,
 *   })
 *
 *   return <Editor />
 * }
 * ```
 */
export function HotkeysProvider({
  config: configProp = {},
  children,
}: HotkeysProviderProps) {
  const config = useMemo<Required<HotkeysConfig>>(() => ({
    ...DEFAULT_CONFIG,
    ...configProp,
  }), [configProp])

  // Create the actions registry
  const registry = useActionsRegistry({ storageKey: config.storageKey })

  // Create the omnibar endpoints registry
  const endpointsRegistry = useOmnibarEndpointsRegistry()

  // Check if hotkeys should be enabled
  const [isEnabled, setIsEnabled] = useState(true)

  useEffect(() => {
    if (typeof window === 'undefined') return

    const checkEnabled = () => {
      if (config.minViewportWidth !== false) {
        if (window.innerWidth < config.minViewportWidth) {
          setIsEnabled(false)
          return
        }
      }

      if (!config.enableOnTouch) {
        const hasHover = window.matchMedia('(hover: hover)').matches
        if (!hasHover) {
          setIsEnabled(false)
          return
        }
      }

      setIsEnabled(true)
    }

    checkEnabled()
    window.addEventListener('resize', checkEnabled)
    return () => window.removeEventListener('resize', checkEnabled)
  }, [config.minViewportWidth, config.enableOnTouch])

  // Modal state - persisted to sessionStorage
  const modalStorageKey = `${config.storageKey}-modal-open`
  const [isModalOpen, setIsModalOpen] = useState(() => {
    if (typeof window === 'undefined') return false
    return sessionStorage.getItem(modalStorageKey) === 'true'
  })
  useEffect(() => {
    sessionStorage.setItem(modalStorageKey, String(isModalOpen))
  }, [modalStorageKey, isModalOpen])
  const openModal = useCallback(() => setIsModalOpen(true), [])
  const closeModal = useCallback(() => setIsModalOpen(false), [])
  const toggleModal = useCallback(() => setIsModalOpen(prev => !prev), [])

  // Omnibar state
  const [isOmnibarOpen, setIsOmnibarOpen] = useState(false)
  const openOmnibar = useCallback(() => setIsOmnibarOpen(true), [])
  const closeOmnibar = useCallback(() => setIsOmnibarOpen(false), [])
  const toggleOmnibar = useCallback(() => setIsOmnibarOpen(prev => !prev), [])

  // Lookup modal state
  const [isLookupOpen, setIsLookupOpen] = useState(false)
  const [lookupInitialKeys, setLookupInitialKeys] = useState<HotkeySequence>([])
  const openLookup = useCallback((initialKeys?: HotkeySequence) => {
    setLookupInitialKeys(initialKeys ?? [])
    setIsLookupOpen(true)
  }, [])
  const closeLookup = useCallback(() => setIsLookupOpen(false), [])
  const toggleLookup = useCallback(() => setIsLookupOpen(prev => !prev), [])

  // Centralized history management for all modals
  // This prevents race conditions when switching between modals
  type ActiveModal = 'shortcuts' | 'omnibar' | 'lookup' | null
  const activeModal: ActiveModal = isModalOpen ? 'shortcuts'
    : isOmnibarOpen ? 'omnibar'
    : isLookupOpen ? 'lookup'
    : null

  // Track whether close was triggered by popstate (to avoid double history.back())
  const closedByPopstateRef = useRef(false)
  // Track the previous activeModal to detect transitions
  const prevActiveModalRef = useRef<ActiveModal>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return

    const stateKey = 'kbdActiveModal'
    const prevModal = prevActiveModalRef.current
    prevActiveModalRef.current = activeModal

    if (!activeModal) {
      // No modal open
      // If we had a modal open before and it wasn't closed via back button, clean up history
      if (prevModal && !closedByPopstateRef.current && window.history.state?.[stateKey]) {
        window.history.back()
      }
      closedByPopstateRef.current = false
      return
    }

    // A modal is open - manage history state
    const currentState = window.history.state
    if (!currentState?.[stateKey]) {
      // No modal state in history - push new state
      window.history.pushState({ ...currentState, [stateKey]: activeModal }, '')
    } else if (currentState[stateKey] !== activeModal) {
      // Switching between modals - replace state (no push/pop needed)
      window.history.replaceState({ ...currentState, [stateKey]: activeModal }, '')
    }

    const handlePopstate = () => {
      // Check if our modal state is still in history
      if (window.history.state?.[stateKey]) {
        return
      }

      // User pressed back button - close the active modal
      closedByPopstateRef.current = true

      // Blur any focused element
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur()
      }

      // Close whichever modal is open
      if (isModalOpen) setIsModalOpen(false)
      if (isOmnibarOpen) setIsOmnibarOpen(false)
      if (isLookupOpen) setIsLookupOpen(false)
    }

    window.addEventListener('popstate', handlePopstate)
    return () => {
      window.removeEventListener('popstate', handlePopstate)
      // Note: Don't call history.back() here - it's handled when activeModal becomes null
    }
  }, [activeModal, isModalOpen, isOmnibarOpen, isLookupOpen])

  // Editing binding state (set by ShortcutsModal when recording a new binding)
  const [isEditingBinding, setIsEditingBinding] = useState(false)

  // Recent actions (persisted to localStorage)
  const recentsStorageKey = `${config.storageKey}-recents`
  const MAX_RECENTS = 5
  const [recentActionIds, setRecentActionIds] = useState<string[]>(() => {
    if (typeof window === 'undefined') return []
    try {
      const stored = localStorage.getItem(recentsStorageKey)
      return stored ? JSON.parse(stored) : []
    } catch {
      return []
    }
  })

  // Track action execution for recents
  const trackRecentAction = useCallback((actionId: string) => {
    setRecentActionIds(prev => {
      // Remove if already in list, add to front
      const filtered = prev.filter(id => id !== actionId)
      const updated = [actionId, ...filtered].slice(0, MAX_RECENTS)
      // Persist
      try {
        localStorage.setItem(recentsStorageKey, JSON.stringify(updated))
      } catch {
        // Ignore storage errors
      }
      return updated
    })
  }, [recentsStorageKey])

  // Use registry keymap directly
  const keymap = registry.keymap

  // Compute conflicts
  const conflicts = useMemo(() => findConflicts(keymap), [keymap])
  const hasConflicts = conflicts.size > 0

  // Effective keymap (without conflicts if disabled)
  const effectiveKeymap = useMemo(() => {
    if (!config.disableConflicts || conflicts.size === 0) {
      return keymap
    }
    const filtered: typeof keymap = {}
    for (const [key, action] of Object.entries(keymap)) {
      if (!conflicts.has(key)) {
        filtered[key] = action
      }
    }
    return filtered
  }, [keymap, conflicts, config.disableConflicts])

  // Build handlers map from registered actions
  const handlers = useMemo(() => {
    const map: Record<string, (e: KeyboardEvent, captures?: number[]) => void> = {}

    for (const [id, action] of registry.actions) {
      map[id] = action.config.handler
    }

    return map
  }, [registry.actions])

  // Register hotkeys (enabled unless editing a binding, omnibar, or lookup is open)
  const hotkeysEnabled = isEnabled && !isEditingBinding && !isOmnibarOpen && !isLookupOpen
  const {
    pendingKeys,
    isAwaitingSequence,
    cancelSequence,
    timeoutStartedAt: sequenceTimeoutStartedAt,
    sequenceTimeout,
  } = useHotkeys(effectiveKeymap, handlers, {
    enabled: hotkeysEnabled,
    sequenceTimeout: config.sequenceTimeout,
  })

  // Close modal when a sequence starts (so SequenceModal can show)
  useEffect(() => {
    if (isAwaitingSequence && isModalOpen) {
      closeModal()
    }
  }, [isAwaitingSequence, isModalOpen, closeModal])

  // Search helper
  const searchActionsHelper = useCallback(
    (query: string) => searchActions(query, registry.actionRegistry, keymap),
    [registry.actionRegistry, keymap]
  )

  // Completions helper
  const getCompletions = useCallback(
    (pending: HotkeySequence) => getSequenceCompletions(pending, keymap, registry.actionRegistry),
    [keymap, registry.actionRegistry]
  )

  // Wrap execute to track recents
  const executeAction = useCallback((id: string, captures?: number[]) => {
    registry.execute(id, captures)
    trackRecentAction(id)
  }, [registry, trackRecentAction])

  const value = useMemo<HotkeysContextValue>(() => ({
    registry,
    endpointsRegistry,
    isEnabled,
    isModalOpen,
    openModal,
    closeModal,
    toggleModal,
    isOmnibarOpen,
    openOmnibar,
    closeOmnibar,
    toggleOmnibar,
    isLookupOpen,
    lookupInitialKeys,
    openLookup,
    closeLookup,
    toggleLookup,
    isEditingBinding,
    setIsEditingBinding,
    executeAction,
    recentActionIds,
    pendingKeys,
    isAwaitingSequence,
    cancelSequence,
    sequenceTimeoutStartedAt,
    sequenceTimeout,
    conflicts,
    hasConflicts,
    searchActions: searchActionsHelper,
    getCompletions,
  }), [
    registry,
    endpointsRegistry,
    isEnabled,
    isModalOpen,
    openModal,
    closeModal,
    toggleModal,
    isOmnibarOpen,
    openOmnibar,
    closeOmnibar,
    toggleOmnibar,
    isLookupOpen,
    lookupInitialKeys,
    openLookup,
    closeLookup,
    toggleLookup,
    isEditingBinding,
    executeAction,
    recentActionIds,
    pendingKeys,
    isAwaitingSequence,
    cancelSequence,
    sequenceTimeoutStartedAt,
    sequenceTimeout,
    conflicts,
    hasConflicts,
    searchActionsHelper,
    getCompletions,
  ])

  return (
    <ActionsRegistryContext.Provider value={registry}>
      <OmnibarEndpointsRegistryContext.Provider value={endpointsRegistry}>
        <HotkeysContext.Provider value={value}>
          {children}
        </HotkeysContext.Provider>
      </OmnibarEndpointsRegistryContext.Provider>
    </ActionsRegistryContext.Provider>
  )
}

/**
 * Hook to access the hotkeys context.
 * Must be used within a HotkeysProvider.
 */
export function useHotkeysContext(): HotkeysContextValue {
  const context = useContext(HotkeysContext)
  if (!context) {
    throw new Error('useHotkeysContext must be used within a HotkeysProvider')
  }
  return context
}

/**
 * Hook to optionally access hotkeys context.
 */
export function useMaybeHotkeysContext(): HotkeysContextValue | null {
  return useContext(HotkeysContext)
}
