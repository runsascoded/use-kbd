import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { ActionsRegistryContext, useActionsRegistry } from './ActionsRegistry'
import { dbg } from './debug'
import { ModesRegistryContext, useModesRegistry } from './ModesRegistry'
import { OmnibarEndpointsRegistryContext, useOmnibarEndpointsRegistry } from './OmnibarEndpointsRegistry'
import { ACTION_MODE_PREFIX, DEFAULT_BUILTIN_GROUP, DEFAULT_SEQUENCE_TIMEOUT } from './constants'
import { useHotkeys } from './useHotkeys'
import { findConflicts, getSequenceCompletions, searchActions } from './utils'
import type { ActionsRegistryValue } from './ActionsRegistry'
import type { ModesRegistryValue } from './ModesRegistry'
import type { OmnibarEndpointsRegistryValue } from './OmnibarEndpointsRegistry'
import type { HotkeySequence, RegisteredMode } from './types'

/**
 * Configuration for the HotkeysProvider.
 */
export interface HotkeysConfig {
  /** Storage key for persisting user binding overrides */
  storageKey?: string

  /** Timeout in ms before a sequence auto-submits (default: Infinity, no timeout) */
  sequenceTimeout?: number

  /** Group name for built-in actions: shortcuts modal, omnibar, key lookup (default: "Meta") */
  builtinGroup?: string

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
  /** Storage key used for persisting bindings (useful for export filename) */
  storageKey: string
  /** Group name for built-in actions (shortcuts modal, omnibar, key lookup) */
  builtinGroup: string
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
  /** Currently active mode ID (null if none) */
  activeMode: string | null
  /** All registered modes */
  modes: Map<string, RegisteredMode>
  /** The modes registry */
  modesRegistry: ModesRegistryValue
  /** Activate a mode by ID */
  activateMode: (id: string) => void
  /** Deactivate the current mode */
  deactivateMode: () => void
}

const HotkeysContext = createContext<HotkeysContextValue | null>(null)

const DEFAULT_CONFIG: Required<HotkeysConfig> = {
  storageKey: 'use-kbd',
  builtinGroup: DEFAULT_BUILTIN_GROUP,
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

  // Create the modes registry
  const modesRegistry = useModesRegistry()

  // Create the omnibar endpoints registry
  const endpointsRegistry = useOmnibarEndpointsRegistry()

  // Register user-created modes dynamically
  const userModes = registry.modeCustomizations.userModes
  useEffect(() => {
    const ids: string[] = []
    for (const [id, config] of Object.entries(userModes)) {
      modesRegistry.register(id, {
        label: config.label,
        color: config.color,
        defaultBindings: config.bindings ?? [],
        toggle: true,
        escapeExits: true,
        passthrough: true,
      })
      ids.push(id)
    }
    return () => {
      for (const id of ids) {
        modesRegistry.unregister(id)
      }
    }
  }, [userModes, modesRegistry])

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

  // Only manage history state on touch/mobile devices where swipe-back
  // is the natural gesture for dismissing modals. On desktop, users use
  // Escape and don't expect back button to close modals.
  const isTouchDevice = typeof window !== 'undefined' && window.matchMedia('(hover: none)').matches

  useEffect(() => {
    if (typeof window === 'undefined' || !isTouchDevice) return

    const stateKey = 'kbdActiveModal'
    const prevModal = prevActiveModalRef.current
    prevActiveModalRef.current = activeModal

    if (!activeModal) {
      // Modal closed programmatically (not via back button/swipe).
      // Remove our modal marker from the current state.
      // This leaves one extra history entry, but preserves the URL
      // and scroll position. Swipe-back still works naturally.
      if (prevModal && !closedByPopstateRef.current && window.history.state?.[stateKey]) {
        const { [stateKey]: _, ...cleanState } = window.history.state
        window.history.replaceState(cleanState, '')
      }
      closedByPopstateRef.current = false
      return
    }

    // A modal is open - push history state so swipe-back can close it
    const currentState = window.history.state
    if (!currentState?.[stateKey]) {
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

      // User swiped back / pressed back button - close the active modal
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

  // Compute conflicts (mode-aware: cross-scope overlaps are intentional shadowing)
  const conflicts = useMemo(() => findConflicts(keymap, registry.getEffectiveMode), [keymap, registry.getEffectiveMode])
  const hasConflicts = conflicts.size > 0

  // Mode-aware effective keymap
  const { activeMode } = modesRegistry
  const effectiveKeymap = useMemo(() => {
    const activeModeConfig = activeMode ? modesRegistry.modes.get(activeMode)?.config : null

    // Start with conflict filtering if needed
    let baseKeymap = keymap
    if (config.disableConflicts && conflicts.size > 0) {
      baseKeymap = {}
      for (const [key, action] of Object.entries(keymap)) {
        if (!conflicts.has(key)) {
          baseKeymap[key] = action
        }
      }
    }

    // If no modes are registered at all, skip mode filtering
    if (modesRegistry.modes.size === 0) return baseKeymap

    const result: typeof keymap = {}
    for (const [key, actionOrActions] of Object.entries(baseKeymap)) {
      const actions = Array.isArray(actionOrActions) ? actionOrActions : [actionOrActions]
      const filtered = actions.filter(id => {
        const actionMode = registry.getEffectiveMode(id)
        if (!actionMode) return true                          // global: always include
        if (actionMode === activeMode) return true            // active mode: include
        if (id.startsWith(ACTION_MODE_PREFIX)) return true    // mode activators: always
        return false                                          // inactive mode: exclude
      })
      if (filtered.length === 0) continue

      // If mode action shadows global on same key, keep only mode action
      if (activeMode && activeModeConfig?.passthrough !== false) {
        const modeActions = filtered.filter(id => registry.getEffectiveMode(id) === activeMode)
        if (modeActions.length > 0) {
          result[key] = modeActions.length === 1 ? modeActions[0] : modeActions
          continue
        }
      }
      result[key] = filtered.length === 1 ? filtered[0] : filtered
    }

    // Inject escape → mode exit when a mode is active and escapeExits !== false
    if (activeMode && activeModeConfig?.escapeExits !== false) {
      result['escape'] = '__mode:exit'
    }

    dbg.modes('effective keymap: %d bindings (active mode: %s)', Object.keys(result).length, activeMode ?? 'none')
    return result
  }, [keymap, activeMode, modesRegistry.modes, registry.actions, conflicts, config.disableConflicts])

  // Build handlers map from registered actions + mode exit handler
  const handlers = useMemo(() => {
    const map: Record<string, (e: KeyboardEvent, captures?: number[]) => void> = {}

    for (const [id, action] of registry.actions) {
      map[id] = action.config.handler
    }

    // Add mode exit handler
    if (activeMode) {
      map['__mode:exit'] = () => {
        modesRegistry.deactivateMode()
      }
    }

    return map
  }, [registry.actions, activeMode, modesRegistry])

  // Register hotkeys (enabled unless editing a binding, omnibar, or lookup is open)
  const hotkeysEnabled = isEnabled && !isEditingBinding && !isOmnibarOpen && !isLookupOpen
  dbg.modes('hotkeys %s (editing=%s, omnibar=%s, lookup=%s)', hotkeysEnabled ? 'enabled' : 'disabled', isEditingBinding, isOmnibarOpen, isLookupOpen)
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

  // Wrap execute to track recents + auto-activate mode for mode-scoped actions
  const executeAction = useCallback((id: string, captures?: number[]) => {
    const actionMode = registry.getEffectiveMode(id)
    if (actionMode && modesRegistry.activeMode !== actionMode) {
      modesRegistry.activateMode(actionMode)
    }
    registry.execute(id, captures)
    trackRecentAction(id)
  }, [registry, trackRecentAction, modesRegistry])

  const value = useMemo<HotkeysContextValue>(() => ({
    storageKey: config.storageKey,
    builtinGroup: config.builtinGroup,
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
    activeMode: modesRegistry.activeMode,
    modes: modesRegistry.modes,
    modesRegistry,
    activateMode: modesRegistry.activateMode,
    deactivateMode: modesRegistry.deactivateMode,
  }), [
    config.storageKey,
    config.builtinGroup,
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
    modesRegistry,
  ])

  return (
    <ActionsRegistryContext.Provider value={registry}>
      <ModesRegistryContext.Provider value={modesRegistry}>
        <OmnibarEndpointsRegistryContext.Provider value={endpointsRegistry}>
          <HotkeysContext.Provider value={value}>
            {children}
          </HotkeysContext.Provider>
        </OmnibarEndpointsRegistryContext.Provider>
      </ModesRegistryContext.Provider>
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
