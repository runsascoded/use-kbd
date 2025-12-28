import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  filterActionsByRoute,
  getActionRegistry,
  getDefaultKeymap,
  getGroups,
  getHandlers,
  groupActions,
} from './actions'
import { KeyboardShortcutsProvider, useKeyboardShortcutsContext, useRegisteredHotkeys } from './KeyboardShortcutsContext'
import type { Actions } from './actions'
import type { KeyboardShortcutsContextValue } from './KeyboardShortcutsContext'
import type { HotkeySequence } from './types'

/**
 * Configuration for hotkeys behavior and appearance.
 */
export interface HotkeysConfig {
  // === Binding behavior ===

  /** Allow multiple key sequences per action (default: true) */
  multipleBindingsPerAction?: boolean

  /** Timeout in ms before a sequence auto-submits (default: 1000) */
  sequenceTimeout?: number

  // === Conflict handling ===

  /** How to handle conflicting key assignments */
  conflictMode?: 'warn' | 'prevent' | 'allow'

  /** When true, keys with conflicts are disabled (default: true) */
  disableConflicts?: boolean

  // === Responsiveness ===

  /** Minimum viewport width to enable hotkeys (false = always enabled) */
  minViewportWidth?: number | false

  /** Whether to show hotkey UI on touch-only devices (default: false) */
  enableOnTouch?: boolean

  // === Persistence ===

  /** Storage key for persisting user overrides */
  storageKey?: string

  /** Storage type: 'local', 'session', or 'none' (default: 'local') */
  storageType?: 'local' | 'session' | 'none'

  // === Built-in triggers ===

  /** Key sequence to open shortcuts modal (false to disable) */
  modalTrigger?: string | false

  /** Key sequence to open omnibar (false to disable) */
  omnibarTrigger?: string | false

  // === Current route (for route-scoped actions) ===

  /** Current route path for filtering actions (e.g., from useLocation) */
  currentRoute?: string
}

/**
 * Extended context value that includes actions and config.
 */
export interface HotkeysContextValue extends KeyboardShortcutsContextValue {
  /** All defined actions */
  allActions: Actions
  /** Actions filtered for current route */
  actions: Actions
  /** Handlers for current route's actions */
  handlers: Record<string, () => void>
  /** Ordered list of group names */
  groups: string[]
  /** Actions grouped by group name */
  groupedActions: Map<string | undefined, Actions>
  /** Current configuration */
  config: HotkeysConfig
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
  /** Execute an action by ID */
  executeAction: (actionId: string) => void
  /** Sequence state: pending key combinations */
  pendingKeys: HotkeySequence
  /** Sequence state: whether waiting for more keys */
  isAwaitingSequence: boolean
  /** Sequence state: when the timeout started */
  sequenceTimeoutStartedAt: number | null
  /** Sequence state: timeout duration in ms */
  sequenceTimeout: number
}

const HotkeysContext = createContext<HotkeysContextValue | null>(null)

export interface HotkeysProviderProps {
  /** Action definitions */
  actions: Actions
  /** Handlers for actions (merged with any handlers in action definitions) */
  handlers?: Record<string, () => void>
  /** Configuration options */
  config?: HotkeysConfig
  /** Children */
  children: ReactNode
}

/**
 * Inner provider that has access to KeyboardShortcutsContext.
 */
function HotkeysProviderInner({
  allActions,
  externalHandlers,
  config,
  children,
}: {
  allActions: Actions
  externalHandlers?: Record<string, () => void>
  config: Required<HotkeysConfig>
  children: ReactNode
}) {
  const shortcutsContext = useKeyboardShortcutsContext()

  // Filter actions by current route
  const actions = useMemo(() => {
    if (!config.currentRoute) return allActions
    return filterActionsByRoute(allActions, config.currentRoute)
  }, [allActions, config.currentRoute])

  // Get handlers: merge action handlers with external handlers (external takes precedence)
  const handlers = useMemo(() => {
    const actionHandlers = getHandlers(actions)
    return { ...actionHandlers, ...externalHandlers }
  }, [actions, externalHandlers])

  // Get groups and grouped actions
  const groups = useMemo(() => getGroups(actions), [actions])
  const groupedActions = useMemo(() => groupActions(actions), [actions])

  // Check if hotkeys should be enabled
  const [isEnabled, setIsEnabled] = useState(true)

  useEffect(() => {
    if (typeof window === 'undefined') return

    const checkEnabled = () => {
      // Check viewport width
      if (config.minViewportWidth !== false) {
        if (window.innerWidth < config.minViewportWidth) {
          setIsEnabled(false)
          return
        }
      }

      // Check touch-only device
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

  // Modal state (session storage)
  const [isModalOpen, setIsModalOpen] = useState(() => {
    if (typeof window === 'undefined' || config.storageType === 'none') return false
    try {
      const storage = config.storageType === 'session' ? sessionStorage : localStorage
      return storage.getItem(`${config.storageKey}-modal-open`) === 'true'
    } catch {
      return false
    }
  })

  // Persist modal state
  useEffect(() => {
    if (typeof window === 'undefined' || config.storageType === 'none' || !config.storageKey) return
    try {
      const storage = config.storageType === 'session' ? sessionStorage : localStorage
      if (isModalOpen) {
        storage.setItem(`${config.storageKey}-modal-open`, 'true')
      } else {
        storage.removeItem(`${config.storageKey}-modal-open`)
      }
    } catch {
      // Ignore storage errors
    }
  }, [isModalOpen, config.storageKey, config.storageType])

  const openModal = useCallback(() => setIsModalOpen(true), [])
  const closeModal = useCallback(() => setIsModalOpen(false), [])
  const toggleModal = useCallback(() => setIsModalOpen(prev => !prev), [])

  // Omnibar state (not persisted - always starts closed)
  const [isOmnibarOpen, setIsOmnibarOpen] = useState(false)
  const openOmnibar = useCallback(() => setIsOmnibarOpen(true), [])
  const closeOmnibar = useCallback(() => setIsOmnibarOpen(false), [])
  const toggleOmnibar = useCallback(() => setIsOmnibarOpen(prev => !prev), [])

  // Execute action by ID (uses merged handlers)
  const executeAction = useCallback((actionId: string) => {
    const handler = handlers[actionId]
    if (handler) {
      // Check if action is enabled (if action exists)
      const action = actions[actionId]
      if (!action || action.enabled === undefined || action.enabled) {
        handler()
      }
    }
  }, [handlers, actions])

  // Build handlers including built-in triggers
  const allHandlers = useMemo(() => {
    const result = { ...handlers }

    // Add modal trigger handler
    if (config.modalTrigger !== false) {
      result['__hotkeys:modal'] = toggleModal
    }

    // Add omnibar trigger handler
    if (config.omnibarTrigger !== false) {
      result['__hotkeys:omnibar'] = toggleOmnibar
    }

    return result
  }, [handlers, config.modalTrigger, config.omnibarTrigger, toggleModal, toggleOmnibar])

  // Register hotkeys (only when enabled and modal/omnibar closed)
  const hotkeysEnabled = isEnabled && !isModalOpen && !isOmnibarOpen
  const {
    pendingKeys,
    isAwaitingSequence,
    timeoutStartedAt: sequenceTimeoutStartedAt,
    sequenceTimeout,
  } = useRegisteredHotkeys(allHandlers, { enabled: hotkeysEnabled })

  // Build context value
  const value = useMemo<HotkeysContextValue>(() => ({
    ...shortcutsContext,
    allActions,
    actions,
    handlers,
    groups,
    groupedActions,
    config,
    isEnabled,
    isModalOpen,
    openModal,
    closeModal,
    toggleModal,
    isOmnibarOpen,
    openOmnibar,
    closeOmnibar,
    toggleOmnibar,
    executeAction,
    pendingKeys,
    isAwaitingSequence,
    sequenceTimeoutStartedAt,
    sequenceTimeout,
  }), [
    shortcutsContext,
    allActions,
    actions,
    handlers,
    groups,
    groupedActions,
    config,
    isEnabled,
    isModalOpen,
    openModal,
    closeModal,
    toggleModal,
    isOmnibarOpen,
    openOmnibar,
    closeOmnibar,
    toggleOmnibar,
    executeAction,
    pendingKeys,
    isAwaitingSequence,
    sequenceTimeoutStartedAt,
    sequenceTimeout,
  ])

  return (
    <HotkeysContext.Provider value={value}>
      {children}
    </HotkeysContext.Provider>
  )
}

const DEFAULT_CONFIG: Required<HotkeysConfig> = {
  multipleBindingsPerAction: true,
  sequenceTimeout: 1000,
  conflictMode: 'warn',
  disableConflicts: true,
  minViewportWidth: 768,
  enableOnTouch: false,
  storageKey: 'hotkeys',
  storageType: 'local',
  modalTrigger: '?',
  omnibarTrigger: 'meta+k',
  currentRoute: '',
}

/**
 * Provider for hotkeys with actions, config, and built-in modal/omnibar support.
 *
 * Handlers can be provided inline in action definitions, or separately via the
 * `handlers` prop (useful when handlers need access to runtime state).
 *
 * @example
 * ```tsx
 * // Define actions (handlers optional)
 * const ACTIONS = defineActions({
 *   'nav:home': {
 *     label: 'Go Home',
 *     defaultBindings: ['g h'],
 *     group: 'Navigation',
 *   },
 *   'edit:save': {
 *     label: 'Save',
 *     defaultBindings: ['meta+s'],
 *     group: 'Edit',
 *   },
 * })
 *
 * function App() {
 *   const navigate = useNavigate()
 *   const { save } = useDocument()
 *
 *   // Handlers defined where they have access to state
 *   const handlers = useMemo(() => ({
 *     'nav:home': () => navigate('/'),
 *     'edit:save': save,
 *   }), [navigate, save])
 *
 *   return (
 *     <HotkeysProvider
 *       actions={ACTIONS}
 *       handlers={handlers}
 *       config={{ storageKey: 'my-app-hotkeys' }}
 *     >
 *       <MyApp />
 *       <ShortcutsModal />
 *       <Omnibar />
 *     </HotkeysProvider>
 *   )
 * }
 * ```
 */
export function HotkeysProvider({
  actions: actionsProp,
  handlers: handlersProp,
  config: configProp = {},
  children,
}: HotkeysProviderProps) {
  // Merge config with defaults
  const config = useMemo<Required<HotkeysConfig>>(() => ({
    ...DEFAULT_CONFIG,
    ...configProp,
  }), [configProp])

  // Extract defaults from actions
  const defaults = useMemo(() => {
    const keymap = getDefaultKeymap(actionsProp)

    // Add built-in triggers
    if (config.modalTrigger !== false) {
      keymap[config.modalTrigger] = '__hotkeys:modal'
    }
    if (config.omnibarTrigger !== false) {
      keymap[config.omnibarTrigger] = '__hotkeys:omnibar'
    }

    return keymap
  }, [actionsProp, config.modalTrigger, config.omnibarTrigger])

  // Extract action registry for search
  const actionRegistry = useMemo(() => getActionRegistry(actionsProp), [actionsProp])

  return (
    <KeyboardShortcutsProvider
      defaults={defaults}
      actions={actionRegistry}
      storageKey={config.storageType !== 'none' ? config.storageKey : undefined}
      disableConflicts={config.disableConflicts}
    >
      <HotkeysProviderInner allActions={actionsProp} externalHandlers={handlersProp} config={config}>
        {children}
      </HotkeysProviderInner>
    </KeyboardShortcutsProvider>
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
 * Returns null if not within a HotkeysProvider (useful for components that can work standalone).
 */
export function useMaybeHotkeysContext(): HotkeysContextValue | null {
  return useContext(HotkeysContext)
}

/**
 * Hook to get only the modal/omnibar state (for simpler components).
 */
export function useHotkeysUI() {
  const {
    isEnabled,
    isModalOpen,
    openModal,
    closeModal,
    toggleModal,
    isOmnibarOpen,
    openOmnibar,
    closeOmnibar,
    toggleOmnibar,
    executeAction,
  } = useHotkeysContext()

  return {
    isEnabled,
    isModalOpen,
    openModal,
    closeModal,
    toggleModal,
    isOmnibarOpen,
    openOmnibar,
    closeOmnibar,
    toggleOmnibar,
    executeAction,
  }
}
