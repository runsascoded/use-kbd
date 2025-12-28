import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { ActionsRegistryContext, useActionsRegistry } from './ActionsRegistry'
import { useHotkeys } from './useHotkeys'
import { findConflicts, getSequenceCompletions, searchActions } from './utils'
import type { ActionsRegistryValue } from './ActionsRegistry'
import type { HotkeySequence } from './types'

/**
 * Configuration for the HotkeysProvider.
 */
export interface HotkeysConfig {
  /** Storage key for persisting user binding overrides */
  storageKey?: string

  /** Timeout in ms before a sequence auto-submits (default: 1000) */
  sequenceTimeout?: number

  /** When true, keys with conflicts are disabled (default: true) */
  disableConflicts?: boolean

  /** Minimum viewport width to enable hotkeys (false = always enabled) */
  minViewportWidth?: number | false

  /** Whether to show hotkey UI on touch-only devices (default: false) */
  enableOnTouch?: boolean

  /** Key sequence to open shortcuts modal (false to disable) */
  modalTrigger?: string | false

  /** Key sequence to open omnibar (false to disable) */
  omnibarTrigger?: string | false
}

/**
 * Context value for hotkeys.
 */
export interface HotkeysContextValue {
  /** The actions registry */
  registry: ActionsRegistryValue
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
  executeAction: (id: string) => void
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
}

const HotkeysContext = createContext<HotkeysContextValue | null>(null)

const DEFAULT_CONFIG: Required<HotkeysConfig> = {
  storageKey: 'hotkeys',
  sequenceTimeout: 1000,
  disableConflicts: true,
  minViewportWidth: 768,
  enableOnTouch: false,
  modalTrigger: '?',
  omnibarTrigger: 'meta+k',
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

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false)
  const openModal = useCallback(() => setIsModalOpen(true), [])
  const closeModal = useCallback(() => setIsModalOpen(false), [])
  const toggleModal = useCallback(() => setIsModalOpen(prev => !prev), [])

  // Omnibar state
  const [isOmnibarOpen, setIsOmnibarOpen] = useState(false)
  const openOmnibar = useCallback(() => setIsOmnibarOpen(true), [])
  const closeOmnibar = useCallback(() => setIsOmnibarOpen(false), [])
  const toggleOmnibar = useCallback(() => setIsOmnibarOpen(prev => !prev), [])

  // Build keymap with built-in triggers
  const keymap = useMemo(() => {
    const map = { ...registry.keymap }

    if (config.modalTrigger !== false) {
      map[config.modalTrigger] = '__hotkeys:modal'
    }
    if (config.omnibarTrigger !== false) {
      map[config.omnibarTrigger] = '__hotkeys:omnibar'
    }

    return map
  }, [registry.keymap, config.modalTrigger, config.omnibarTrigger])

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

  // Build handlers map
  const handlers = useMemo(() => {
    const map: Record<string, () => void> = {}

    for (const [id, action] of registry.actions) {
      map[id] = action.config.handler
    }

    // Built-in triggers
    map['__hotkeys:modal'] = toggleModal
    map['__hotkeys:omnibar'] = toggleOmnibar

    return map
  }, [registry.actions, toggleModal, toggleOmnibar])

  // Register hotkeys
  const hotkeysEnabled = isEnabled && !isModalOpen && !isOmnibarOpen
  const {
    pendingKeys,
    isAwaitingSequence,
    timeoutStartedAt: sequenceTimeoutStartedAt,
    sequenceTimeout,
  } = useHotkeys(effectiveKeymap, handlers, {
    enabled: hotkeysEnabled,
    sequenceTimeout: config.sequenceTimeout,
  })

  // Search helper
  const searchActionsHelper = useCallback(
    (query: string) => searchActions(query, registry.actionRegistry, keymap),
    [registry.actionRegistry, keymap]
  )

  // Completions helper
  const getCompletions = useCallback(
    (pending: HotkeySequence) => getSequenceCompletions(pending, keymap),
    [keymap]
  )

  const value = useMemo<HotkeysContextValue>(() => ({
    registry,
    isEnabled,
    isModalOpen,
    openModal,
    closeModal,
    toggleModal,
    isOmnibarOpen,
    openOmnibar,
    closeOmnibar,
    toggleOmnibar,
    executeAction: registry.execute,
    pendingKeys,
    isAwaitingSequence,
    sequenceTimeoutStartedAt,
    sequenceTimeout,
    conflicts,
    hasConflicts,
    searchActions: searchActionsHelper,
    getCompletions,
  }), [
    registry,
    isEnabled,
    isModalOpen,
    openModal,
    closeModal,
    toggleModal,
    isOmnibarOpen,
    openOmnibar,
    closeOmnibar,
    toggleOmnibar,
    pendingKeys,
    isAwaitingSequence,
    sequenceTimeoutStartedAt,
    sequenceTimeout,
    conflicts,
    hasConflicts,
    searchActionsHelper,
    getCompletions,
  ])

  return (
    <ActionsRegistryContext.Provider value={registry}>
      <HotkeysContext.Provider value={value}>
        {children}
      </HotkeysContext.Provider>
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
