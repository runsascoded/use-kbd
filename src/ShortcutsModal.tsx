import { ComponentType, createContext, Fragment, MouseEvent, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { ACTION_MODAL, DEFAULT_SEQUENCE_TIMEOUT } from './constants'
import { useMaybeHotkeysContext } from './HotkeysProvider'
import { renderModifierIcons, renderKeyContent } from './KeyElements'
import { useAction } from './useAction'
import { useHotkeys } from './useHotkeys'
import { useRecordHotkey } from './useRecordHotkey'
import { findConflicts, formatCombination, getActionBindings, parseHotkeyString, parseKeySeq, formatKeySeq } from './utils'
import type { ActionRegistry, HotkeySequence, KeyCombination, KeyCombinationDisplay, SeqElem } from './types'
import type { HotkeyMap } from './useHotkeys'

/**
 * Props for a tooltip wrapper component.
 * Compatible with MUI Tooltip and similar libraries.
 */
export interface TooltipProps {
  title: string
  children: ReactNode
}

/**
 * A component that wraps children with a tooltip.
 * Default uses native title attribute; can be replaced with MUI Tooltip etc.
 */
export type TooltipComponent = ComponentType<TooltipProps>

/**
 * Default tooltip renders children without any tooltip.
 * Pass a custom TooltipComponent (e.g., MUI Tooltip) to show tooltips.
 */
const DefaultTooltip: TooltipComponent = ({ children }) => <>{children}</>

/**
 * Context for tooltip component (allows nested components to access it)
 */
const TooltipContext = createContext<TooltipComponent>(DefaultTooltip)

export interface ShortcutGroup {
  name: string
  shortcuts: Array<{
    actionId: string
    label: string
    description?: string
    bindings: string[]
  }>
}

/**
 * Props passed to custom group renderers
 */
export interface GroupRendererProps {
  /** The group being rendered */
  group: ShortcutGroup
  /** Render a cell for an action (handles editing state, kbd styling) */
  renderCell: (actionId: string, keys: string[]) => ReactNode
  /** Render a single editable kbd element */
  renderEditableKbd: (actionId: string, key: string, showRemove?: boolean) => ReactNode
  /** Render the add button for an action */
  renderAddButton: (actionId: string) => ReactNode
  /** Start editing a specific binding */
  startEditing: (actionId: string, key: string) => void
  /** Start adding a new binding to an action */
  startAdding: (actionId: string) => void
  /** Remove a binding */
  removeBinding: (actionId: string, key: string) => void
  /** Whether currently recording a hotkey */
  isRecording: boolean
  /** Action currently being edited */
  editingAction: string | null
  /** Key currently being edited */
  editingKey: string | null
  /** Action currently being added to */
  addingAction: string | null
}

/**
 * Custom renderer for a group. Return null to use default rendering.
 */
export type GroupRenderer = (props: GroupRendererProps) => ReactNode

export interface ShortcutsModalProps {
  /**
   * The hotkey map to display.
   * If not provided, uses keymap from HotkeysContext.
   */
  keymap?: HotkeyMap
  /**
   * Default keymap (for showing reset indicators).
   * If not provided, uses defaults from HotkeysContext.
   */
  defaults?: HotkeyMap
  /** Labels for actions (action ID -> label). Falls back to action.label from context. */
  labels?: Record<string, string>
  /** Descriptions for actions (action ID -> description). Falls back to action.description from context. */
  descriptions?: Record<string, string>
  /** Group definitions: action prefix -> display name (e.g., { metric: 'Metrics' }). Falls back to action.group from context. */
  groups?: Record<string, string>
  /** Ordered list of group names (if omitted, groups are sorted alphabetically) */
  groupOrder?: string[]
  /**
   * Custom renderers for specific groups.
   * Key is the group name, value is a render function.
   * Groups without custom renderers use the default single-column layout.
   */
  groupRenderers?: Record<string, GroupRenderer>
  /**
   * Control visibility externally.
   * If not provided, uses isModalOpen from HotkeysContext.
   */
  isOpen?: boolean
  /**
   * Called when modal should close.
   * If not provided, uses closeModal from HotkeysContext.
   */
  onClose?: () => void
  /**
   * Default keybinding to open shortcuts modal (default: '?').
   * Users can override this in the shortcuts modal.
   * Set to empty string to disable.
   */
  defaultBinding?: string
  /** Enable editing mode */
  editable?: boolean
  /** Called when a binding changes (required if editable) */
  onBindingChange?: (action: string, oldKey: string | null, newKey: string) => void
  /** Called when a binding is added (required if editable) */
  onBindingAdd?: (action: string, key: string) => void
  /** Called when a binding is removed */
  onBindingRemove?: (action: string, key: string) => void
  /** Called when reset is requested */
  onReset?: () => void
  /** Whether to allow multiple bindings per action (default: true) */
  multipleBindings?: boolean
  /** Custom render function for the modal content */
  children?: (props: ShortcutsModalRenderProps) => ReactNode
  /** CSS class for the backdrop */
  backdropClassName?: string
  /** CSS class for the modal container */
  modalClassName?: string
  /** Modal title (default: "Keyboard Shortcuts") */
  title?: string
  /** Hint text shown below title (e.g., "Click any key to customize") */
  hint?: string
  /** Whether to show actions with no bindings (default: true in editable mode, false otherwise) */
  showUnbound?: boolean
  /**
   * Custom tooltip component for digit placeholders.
   * Should accept { title: string, children: ReactNode } props.
   * Default uses native title attribute. Can be MUI Tooltip, etc.
   */
  TooltipComponent?: TooltipComponent
}

export interface ShortcutsModalRenderProps {
  groups: ShortcutGroup[]
  close: () => void
  editable: boolean
  editingAction: string | null
  editingBindingIndex: number | null
  pendingKeys: HotkeySequence
  activeKeys: KeyCombination | null
  conflicts: Map<string, string[]>
  startEditing: (action: string, bindingIndex?: number) => void
  cancelEditing: () => void
  removeBinding: (action: string, key: string) => void
  reset: () => void
}

/**
 * Parse action ID to extract group prefix.
 * e.g., "metric:temp" -> { group: "metric", name: "temp" }
 */
function parseActionId(actionId: string): { group: string; name: string } {
  const colonIndex = actionId.indexOf(':')
  if (colonIndex > 0) {
    return { group: actionId.slice(0, colonIndex), name: actionId.slice(colonIndex + 1) }
  }
  return { group: 'General', name: actionId }
}

/**
 * Organize keymap into groups for display.
 * Also includes actions with no bindings (from registry) so they can be assigned.
 */
function organizeShortcuts(
  keymap: HotkeyMap,
  labels?: Record<string, string>,
  descriptions?: Record<string, string>,
  groupNames?: Record<string, string>,
  groupOrder?: string[],
  actionRegistry?: ActionRegistry,
  showUnbound = true,
): ShortcutGroup[] {
  // Build action -> bindings map
  const actionBindings = getActionBindings(keymap)
  const groupMap = new Map<string, ShortcutGroup>()
  const includedActions = new Set<string>()

  // Helper to get group name for an action (consistent logic for both paths)
  const getGroupName = (actionId: string): string => {
    // First, check if action has a registered group in the registry
    const registeredGroup = actionRegistry?.[actionId]?.group
    if (registeredGroup) return registeredGroup

    // Fall back to parsing actionId prefix and looking up in groupNames
    const { group: groupKey } = parseActionId(actionId)
    return groupNames?.[groupKey] ?? groupKey
  }

  for (const [actionId, bindings] of actionBindings) {
    // Skip actions marked as hidden from modal
    if (actionRegistry?.[actionId]?.hideFromModal) continue

    includedActions.add(actionId)
    const { name } = parseActionId(actionId)
    const groupName = getGroupName(actionId)

    if (!groupMap.has(groupName)) {
      groupMap.set(groupName, { name: groupName, shortcuts: [] })
    }

    groupMap.get(groupName)!.shortcuts.push({
      actionId,
      label: labels?.[actionId] ?? actionRegistry?.[actionId]?.label ?? name,
      description: descriptions?.[actionId],
      bindings,
    })
  }

  // Add actions from registry that have no bindings (if showUnbound is true)
  if (actionRegistry && showUnbound) {
    for (const [actionId, action] of Object.entries(actionRegistry)) {
      if (includedActions.has(actionId)) continue
      // Skip actions marked as hidden from modal
      if (action.hideFromModal) continue

      const { name } = parseActionId(actionId)
      const groupName = getGroupName(actionId)

      if (!groupMap.has(groupName)) {
        groupMap.set(groupName, { name: groupName, shortcuts: [] })
      }

      groupMap.get(groupName)!.shortcuts.push({
        actionId,
        label: labels?.[actionId] ?? action.label ?? name,
        description: descriptions?.[actionId],
        bindings: [], // No bindings
      })
    }
  }

  // Sort shortcuts within each group by actionId
  for (const group of groupMap.values()) {
    group.shortcuts.sort((a, b) => a.actionId.localeCompare(b.actionId))
  }

  // Sort groups
  const groups = Array.from(groupMap.values())

  if (groupOrder) {
    // Use provided order
    groups.sort((a, b) => {
      const aIdx = groupOrder.indexOf(a.name)
      const bIdx = groupOrder.indexOf(b.name)
      if (aIdx === -1 && bIdx === -1) return a.name.localeCompare(b.name)
      if (aIdx === -1) return 1
      if (bIdx === -1) return -1
      return aIdx - bIdx
    })
  } else {
    // Default: "General" last, others alphabetically
    groups.sort((a, b) => {
      if (a.name === 'General') return 1
      if (b.name === 'General') return -1
      return a.name.localeCompare(b.name)
    })
  }

  return groups
}

/**
 * Render a single key combination with modifier icons
 */
function KeyDisplay({
  combo,
  className,
}: {
  combo: KeyCombination
  className?: string
}) {
  return (
    <span className={className}>
      {renderModifierIcons(combo.modifiers)}
      {renderKeyContent(combo.key)}
    </span>
  )
}

/**
 * Render a single sequence element (key, digit, or digits placeholder)
 */
function SeqElemDisplay({ elem, className }: { elem: SeqElem; className?: string }) {
  const Tooltip = useContext(TooltipContext)

  if (elem.type === 'digit') {
    return (
      <Tooltip title="Any single digit (0-9)">
        <span className={`kbd-placeholder ${className || ''}`}>#</span>
      </Tooltip>
    )
  }
  if (elem.type === 'digits') {
    return (
      <Tooltip title="One or more digits (0-9)">
        <span className={`kbd-placeholder ${className || ''}`}>##</span>
      </Tooltip>
    )
  }
  // Regular key - use KeyDisplay
  return <KeyDisplay combo={{ key: elem.key, modifiers: elem.modifiers }} className={className} />
}

/**
 * Render a hotkey binding (single key or sequence)
 */
function BindingDisplay({
  binding,
  className,
  editable,
  isEditing,
  isConflict,
  isPendingConflict,
  isDefault,
  onEdit,
  onRemove,
  pendingKeys,
  activeKeys,
  timeoutDuration = DEFAULT_SEQUENCE_TIMEOUT,
}: {
  binding: string
  className?: string
  editable?: boolean
  isEditing?: boolean
  isConflict?: boolean
  isPendingConflict?: boolean
  isDefault?: boolean
  onEdit?: () => void
  onRemove?: () => void
  pendingKeys?: HotkeySequence
  activeKeys?: KeyCombination | null
  timeoutDuration?: number
}) {
  const sequence = parseHotkeyString(binding)
  const keySeq = parseKeySeq(binding)
  const _display = formatKeySeq(keySeq)

  let kbdClassName = 'kbd-kbd'
  if (editable && !isEditing) kbdClassName += ' editable'
  if (isEditing) kbdClassName += ' editing'
  if (isConflict) kbdClassName += ' conflict'
  if (isPendingConflict) kbdClassName += ' pending-conflict'
  if (isDefault) kbdClassName += ' default-binding'
  if (className) kbdClassName += ' ' + className

  const handleClick = editable && onEdit ? onEdit : undefined

  // Render editing state
  if (isEditing) {
    let content: ReactNode
    if (pendingKeys && pendingKeys.length > 0) {
      content = (
        <>
          {pendingKeys.map((combo, i) => (
            <Fragment key={i}>
              {i > 0 && <span className="kbd-sequence-sep"> </span>}
              <KeyDisplay combo={combo} />
            </Fragment>
          ))}
          {activeKeys && activeKeys.key && (
            <>
              <span className="kbd-sequence-sep"> → </span>
              <KeyDisplay combo={activeKeys} />
            </>
          )}
          <span>...</span>
        </>
      )
    } else if (activeKeys && activeKeys.key) {
      content = <><KeyDisplay combo={activeKeys} /><span>...</span></>
    } else {
      content = '...'
    }

    return (
      <kbd className={kbdClassName} tabIndex={editable ? 0 : undefined}>
        {content}
        {pendingKeys && pendingKeys.length > 0 && Number.isFinite(timeoutDuration) && (
          <span
            key={pendingKeys.length}
            className="kbd-timeout-bar"
            style={{ animationDuration: `${timeoutDuration}ms` }}
          />
        )}
      </kbd>
    )
  }

  // Render normal binding (using keySeq to support digit placeholders)
  return (
    <kbd className={kbdClassName} onClick={handleClick} tabIndex={editable ? 0 : undefined} onKeyDown={editable && onEdit ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onEdit() } } : undefined}>
      {keySeq.length > 1 ? (
        keySeq.map((elem, i) => (
          <Fragment key={i}>
            {i > 0 && <span className="kbd-sequence-sep"> </span>}
            <SeqElemDisplay elem={elem} />
          </Fragment>
        ))
      ) : keySeq.length === 1 ? (
        <SeqElemDisplay elem={keySeq[0]} />
      ) : (
        // Fallback for legacy parsing
        <KeyDisplay combo={sequence[0]} />
      )}
      {editable && onRemove && (
        <button
          className="kbd-remove-btn"
          onClick={(e) => { e.stopPropagation(); onRemove() }}
          aria-label="Remove binding"
        >
          ×
        </button>
      )}
    </kbd>
  )
}

/**
 * Modal for displaying all keyboard shortcuts, organized by group.
 *
 * Opens by default with `?` key. Shows all registered actions and their bindings,
 * grouped by category (e.g., "Navigation", "Edit", "Global").
 *
 * Features:
 * - **Editable bindings**: Click any shortcut to rebind it (when `editable` is true)
 * - **Conflict detection**: Warns when a binding conflicts with existing shortcuts
 * - **Custom group renderers**: Use `groupRenderers` for custom layouts (e.g., two-column for fwd/back pairs)
 * - **Persistence**: Integrates with HotkeysProvider's localStorage persistence
 *
 * Unlike Omnibar (search-first) or LookupModal (type keys to filter), ShortcutsModal
 * shows everything at once in a browsable, organized view.
 *
 * Styled via CSS custom properties: --kbd-bg, --kbd-text, --kbd-kbd-bg, etc.
 *
 * @example
 * ```tsx
 * // Basic usage with HotkeysProvider (recommended)
 * <HotkeysProvider>
 *   <App />
 *   <ShortcutsModal editable />
 * </HotkeysProvider>
 *
 * // Standalone with explicit props
 * <ShortcutsModal
 *   keymap={keymap}
 *   defaults={DEFAULT_KEYMAP}
 *   labels={labels}
 *   editable
 *   onBindingChange={(action, oldKey, newKey) => updateBinding(action, newKey)}
 *   onBindingRemove={(action, key) => removeBinding(action, key)}
 * />
 * ```
 */
export function ShortcutsModal({
  keymap: keymapProp,
  defaults: defaultsProp,
  labels: labelsProp,
  descriptions: descriptionsProp,
  groups: groupNamesProp,
  groupOrder,
  groupRenderers,
  isOpen: isOpenProp,
  onClose: onCloseProp,
  defaultBinding = '?',
  editable = false,
  onBindingChange,
  onBindingAdd,
  onBindingRemove,
  onReset,
  multipleBindings = true,
  children,
  backdropClassName = 'kbd-backdrop',
  modalClassName = 'kbd-modal',
  title = 'Keyboard Shortcuts',
  hint,
  showUnbound,
  TooltipComponent: TooltipComponentProp = DefaultTooltip,
}: ShortcutsModalProps) {
  // Try to get context (returns null if not within HotkeysProvider)
  const ctx = useMaybeHotkeysContext()

  // Derive labels/descriptions/groups from context registry if not provided as props
  const contextLabels = useMemo(() => {
    const registry = ctx?.registry.actionRegistry
    if (!registry) return undefined
    const labels: Record<string, string> = {}
    for (const [id, action] of Object.entries(registry)) {
      labels[id] = action.label
    }
    return labels
  }, [ctx?.registry.actionRegistry])

  const contextDescriptions = useMemo(() => {
    const registry = ctx?.registry.actionRegistry
    if (!registry) return undefined
    const descriptions: Record<string, string> = {}
    for (const [id, action] of Object.entries(registry)) {
      if (action.description) descriptions[id] = action.description
    }
    return descriptions
  }, [ctx?.registry.actionRegistry])

  const contextGroups = useMemo(() => {
    const registry = ctx?.registry.actionRegistry
    if (!registry) return undefined
    const groups: Record<string, string> = {}
    for (const action of Object.values(registry)) {
      if (action.group) {
        // Map action prefix to group name
        const prefix = action.group.toLowerCase().replace(/[\s-]/g, '')
        groups[prefix] = action.group
      }
    }
    return groups
  }, [ctx?.registry.actionRegistry])

  // Use context values with prop overrides
  const keymap = keymapProp ?? ctx?.registry.keymap ?? {}
  const defaults = defaultsProp
  const labels = labelsProp ?? contextLabels
  const descriptions = descriptionsProp ?? contextDescriptions
  const groupNames = groupNamesProp ?? contextGroups

  // Editing callbacks - fall back to context registry if not provided
  const handleBindingChange = onBindingChange ?? (ctx ? (action, oldKey, newKey) => {
    if (oldKey) ctx.registry.removeBinding(action, oldKey)
    ctx.registry.setBinding(action, newKey)
  } : undefined)
  const handleBindingAdd = onBindingAdd ?? (ctx ? (action, key) => {
    ctx.registry.setBinding(action, key)
  } : undefined)
  const handleBindingRemove = onBindingRemove ?? (ctx ? (action, key) => {
    ctx.registry.removeBinding(action, key)
  } : undefined)
  const handleReset = onReset ?? (ctx ? () => {
    ctx.registry.resetOverrides()
  } : undefined)

  const [internalIsOpen, setInternalIsOpen] = useState(false)
  // Use prop, then context, then internal state
  const isOpen = isOpenProp ?? ctx?.isModalOpen ?? internalIsOpen

  // Editing state - use key-based tracking (not index-based)
  const [editingAction, setEditingAction] = useState<string | null>(null)
  const [editingKey, setEditingKey] = useState<string | null>(null)
  const [addingAction, setAddingAction] = useState<string | null>(null)
  const [pendingConflict, setPendingConflict] = useState<{
    action: string
    key: string
    conflictsWith: string[]
  } | null>(null)
  // Track if current pending keys have a conflict (for pausing timeout)
  const [hasPendingConflictState, setHasPendingConflictState] = useState(false)

  // Refs to avoid stale closures in onCapture callback
  const editingActionRef = useRef<string | null>(null)
  const editingKeyRef = useRef<string | null>(null)
  const addingActionRef = useRef<string | null>(null)
  const setIsEditingBindingRef = useRef(ctx?.setIsEditingBinding)
  setIsEditingBindingRef.current = ctx?.setIsEditingBinding

  // Compute conflicts
  const conflicts = useMemo(() => findConflicts(keymap), [keymap])
  const actionBindings = useMemo(() => getActionBindings(keymap), [keymap])

  const close = useCallback(() => {
    setInternalIsOpen(false)
    setEditingAction(null)
    setEditingKey(null)
    setAddingAction(null)
    editingActionRef.current = null
    editingKeyRef.current = null
    addingActionRef.current = null
    setPendingConflict(null)
    // Use prop callback, then context, then nothing
    if (onCloseProp) {
      onCloseProp()
    } else if (ctx?.closeModal) {
      ctx.closeModal()
    }
  }, [onCloseProp, ctx])

  const _open = useCallback(() => {
    if (ctx?.openModal) {
      ctx.openModal()
    } else {
      setInternalIsOpen(true)
    }
  }, [ctx])

  // Register the shortcuts modal trigger action
  useAction(ACTION_MODAL, {
    label: 'Show shortcuts',
    group: 'Global',
    defaultBindings: defaultBinding ? [defaultBinding] : [],
    handler: useCallback(() => ctx?.toggleModal() ?? setInternalIsOpen(prev => !prev), [ctx?.toggleModal]),
  })

  // Check if a new binding would conflict
  const checkConflict = useCallback((newKey: string, forAction: string): string[] | null => {
    const existingActions = keymap[newKey]
    if (!existingActions) return null
    const actions = Array.isArray(existingActions) ? existingActions : [existingActions]
    const conflicts = actions.filter(a => a !== forAction)
    return conflicts.length > 0 ? conflicts : null
  }, [keymap])

  // Check if two KeyCombinations are equal
  const combinationsEqual = useCallback((a: KeyCombination, b: KeyCombination): boolean => {
    return (
      a.key === b.key &&
      a.modifiers.ctrl === b.modifiers.ctrl &&
      a.modifiers.alt === b.modifiers.alt &&
      a.modifiers.shift === b.modifiers.shift &&
      a.modifiers.meta === b.modifiers.meta
    )
  }, [])

  // Check if sequence A is a prefix of sequence B
  const isSequencePrefix = useCallback((a: HotkeySequence, b: HotkeySequence): boolean => {
    if (a.length >= b.length) return false
    for (let i = 0; i < a.length; i++) {
      if (!combinationsEqual(a[i], b[i])) return false
    }
    return true
  }, [combinationsEqual])

  // Check if two sequences are equal
  const sequencesEqual = useCallback((a: HotkeySequence, b: HotkeySequence): boolean => {
    if (a.length !== b.length) return false
    for (let i = 0; i < a.length; i++) {
      if (!combinationsEqual(a[i], b[i])) return false
    }
    return true
  }, [combinationsEqual])

  // Recording hook - uses refs to avoid stale closures
  const { isRecording, startRecording, cancel, pendingKeys, activeKeys, sequenceTimeout } = useRecordHotkey({
    onCapture: useCallback(
      (_sequence: HotkeySequence, display: KeyCombinationDisplay) => {
        // Use refs for current values (avoids stale closure)
        const currentAddingAction = addingActionRef.current
        const currentEditingAction = editingActionRef.current
        const currentEditingKey = editingKeyRef.current

        const actionToUpdate = currentAddingAction || currentEditingAction
        if (!actionToUpdate) return

        // Check for conflicts
        const conflictActions = checkConflict(display.id, actionToUpdate)
        if (conflictActions && conflictActions.length > 0) {
          setPendingConflict({
            action: actionToUpdate,
            key: display.id,
            conflictsWith: conflictActions,
          })
          return
        }

        if (currentAddingAction) {
          // Adding new binding
          handleBindingAdd?.(currentAddingAction, display.id)
        } else if (currentEditingAction && currentEditingKey) {
          // Replacing existing binding
          handleBindingChange?.(currentEditingAction, currentEditingKey, display.id)
        }

        // Clear state
        editingActionRef.current = null
        editingKeyRef.current = null
        addingActionRef.current = null
        setEditingAction(null)
        setEditingKey(null)
        setAddingAction(null)
        setIsEditingBindingRef.current?.(false)
      },
      [checkConflict, handleBindingChange, handleBindingAdd],
    ),
    onCancel: useCallback(() => {
      editingActionRef.current = null
      editingKeyRef.current = null
      addingActionRef.current = null
      setEditingAction(null)
      setEditingKey(null)
      setAddingAction(null)
      setPendingConflict(null)
      setIsEditingBindingRef.current?.(false)
    }, []),
    // Tab to next/prev editable kbd and start editing
    onTab: useCallback(() => {
      // Find all editable kbd elements
      const editables = Array.from(document.querySelectorAll('.kbd-kbd.editable, .kbd-kbd.editing'))
      const current = document.querySelector('.kbd-kbd.editing')
      const currentIndex = current ? editables.indexOf(current) : -1
      const nextIndex = (currentIndex + 1) % editables.length
      const next = editables[nextIndex] as HTMLElement
      if (next) {
        next.focus()
        next.click()
      }
    }, []),
    onShiftTab: useCallback(() => {
      const editables = Array.from(document.querySelectorAll('.kbd-kbd.editable, .kbd-kbd.editing'))
      const current = document.querySelector('.kbd-kbd.editing')
      const currentIndex = current ? editables.indexOf(current) : -1
      const prevIndex = currentIndex <= 0 ? editables.length - 1 : currentIndex - 1
      const prev = editables[prevIndex] as HTMLElement
      if (prev) {
        prev.focus()
        prev.click()
      }
    }, []),
    pauseTimeout: pendingConflict !== null || hasPendingConflictState,
  })

  // Start editing a specific existing binding
  const startEditingBinding = useCallback(
    (action: string, key: string) => {
      // Set refs immediately (sync)
      addingActionRef.current = null
      editingActionRef.current = action
      editingKeyRef.current = key
      // Also set state for re-render
      setAddingAction(null)
      setEditingAction(action)
      setEditingKey(key)
      setPendingConflict(null)
      ctx?.setIsEditingBinding(true)
      startRecording()
    },
    [startRecording, ctx?.setIsEditingBinding],
  )

  // Start adding a new binding to an action
  const startAddingBinding = useCallback(
    (action: string) => {
      // Set refs immediately (sync)
      editingActionRef.current = null
      editingKeyRef.current = null
      addingActionRef.current = action
      // Also set state for re-render
      setEditingAction(null)
      setEditingKey(null)
      setAddingAction(action)
      setPendingConflict(null)
      ctx?.setIsEditingBinding(true)
      startRecording()
    },
    [startRecording, ctx?.setIsEditingBinding],
  )

  // Legacy startEditing for backwards compatibility
  const startEditing = useCallback(
    (action: string, bindingIndex?: number) => {
      const bindings = actionBindings.get(action) ?? []
      if (bindingIndex !== undefined && bindings[bindingIndex]) {
        startEditingBinding(action, bindings[bindingIndex])
      } else {
        startAddingBinding(action)
      }
    },
    [actionBindings, startEditingBinding, startAddingBinding],
  )

  const cancelEditing = useCallback(() => {
    cancel()
    editingActionRef.current = null
    editingKeyRef.current = null
    addingActionRef.current = null
    setEditingAction(null)
    setEditingKey(null)
    setAddingAction(null)
    setPendingConflict(null)
    ctx?.setIsEditingBinding(false)
  }, [cancel, ctx?.setIsEditingBinding])

  const removeBinding = useCallback(
    (action: string, key: string) => {
      handleBindingRemove?.(action, key)
    },
    [handleBindingRemove],
  )

  const reset = useCallback(() => {
    handleReset?.()
  }, [handleReset])

  // Compute which existing bindings would conflict with current pendingKeys
  // A conflict occurs when:
  // 1. pendingKeys exactly matches an existing binding (and it's not the one being edited)
  // 2. pendingKeys is a prefix of an existing binding
  // 3. An existing binding is a prefix of pendingKeys
  const pendingConflictInfo = useMemo(() => {
    if (!isRecording || pendingKeys.length === 0) {
      return { hasConflict: false, conflictingKeys: new Set<string>() }
    }

    const conflictingKeys = new Set<string>()

    for (const key of Object.keys(keymap)) {
      // Skip the key we're currently editing (it will be replaced)
      if (editingKey && key.toLowerCase() === editingKey.toLowerCase()) continue

      const keySequence = parseHotkeyString(key)

      // Exact match conflict
      if (sequencesEqual(pendingKeys, keySequence)) {
        conflictingKeys.add(key)
        continue
      }

      // Prefix conflict: pending is a prefix of existing key
      if (isSequencePrefix(pendingKeys, keySequence)) {
        conflictingKeys.add(key)
        continue
      }

      // Prefix conflict: existing key is a prefix of pending
      if (isSequencePrefix(keySequence, pendingKeys)) {
        conflictingKeys.add(key)
      }
    }

    return { hasConflict: conflictingKeys.size > 0, conflictingKeys }
  }, [isRecording, pendingKeys, keymap, editingKey, sequencesEqual, isSequencePrefix])

  // Update hasPendingConflictState when pendingConflictInfo changes
  useEffect(() => {
    setHasPendingConflictState(pendingConflictInfo.hasConflict)
  }, [pendingConflictInfo.hasConflict])

  // Helper: render a single editable kbd element
  const renderEditableKbd = useCallback(
    (actionId: string, key: string, showRemove = false) => {
      const isEditingThis = editingAction === actionId && editingKey === key && !addingAction
      const conflictActions = conflicts.get(key)
      const isConflict = conflictActions && conflictActions.length > 1
      const isDefault = defaults
        ? (() => {
          const defaultAction = defaults[key]
          if (!defaultAction) return false
          const defaultActions = Array.isArray(defaultAction) ? defaultAction : [defaultAction]
          return defaultActions.includes(actionId)
        })()
        : true
      // Check if this binding would conflict with current pending input
      const isPendingConflict = pendingConflictInfo.conflictingKeys.has(key)

      return (
        <BindingDisplay
          key={key}
          binding={key}
          editable={editable}
          isEditing={isEditingThis}
          isConflict={isConflict}
          isPendingConflict={isPendingConflict}
          isDefault={isDefault}
          onEdit={() => {
            // If recording another element, commit pending keys first
            if (isRecording && !(editingAction === actionId && editingKey === key)) {
              if (pendingKeys.length > 0) {
                const display = formatCombination(pendingKeys)
                const currentAddingAction = addingActionRef.current
                const currentEditingAction = editingActionRef.current
                const currentEditingKey = editingKeyRef.current
                if (currentAddingAction) {
                  handleBindingAdd?.(currentAddingAction, display.id)
                } else if (currentEditingAction && currentEditingKey) {
                  handleBindingChange?.(currentEditingAction, currentEditingKey, display.id)
                }
              }
              cancel()
            }
            startEditingBinding(actionId, key)
          }}
          onRemove={editable && showRemove ? () => removeBinding(actionId, key) : undefined}
          pendingKeys={pendingKeys}
          activeKeys={activeKeys}
          timeoutDuration={pendingConflictInfo.hasConflict ? Infinity : sequenceTimeout}
        />
      )
    },
    [editingAction, editingKey, addingAction, conflicts, defaults, editable, startEditingBinding, removeBinding, pendingKeys, activeKeys, isRecording, cancel, handleBindingAdd, handleBindingChange, sequenceTimeout, pendingConflictInfo],
  )

  // Helper: render add button for an action
  const renderAddButton = useCallback(
    (actionId: string) => {
      const isAddingThis = addingAction === actionId

      if (isAddingThis) {
        return (
          <BindingDisplay
            binding=""
            isEditing
            isPendingConflict={pendingConflictInfo.hasConflict}
            pendingKeys={pendingKeys}
            activeKeys={activeKeys}
            timeoutDuration={pendingConflictInfo.hasConflict ? Infinity : sequenceTimeout}
          />
        )
      }

      return (
        <button
          className="kbd-add-btn"
          onClick={() => {
            // If recording another element, commit pending keys first
            if (isRecording && !isAddingThis) {
              if (pendingKeys.length > 0) {
                // Commit the pending keys before switching
                const display = formatCombination(pendingKeys)
                const currentAddingAction = addingActionRef.current
                const currentEditingAction = editingActionRef.current
                const currentEditingKey = editingKeyRef.current
                if (currentAddingAction) {
                  handleBindingAdd?.(currentAddingAction, display.id)
                } else if (currentEditingAction && currentEditingKey) {
                  handleBindingChange?.(currentEditingAction, currentEditingKey, display.id)
                }
              }
              cancel()
            }
            startAddingBinding(actionId)
          }}
        >
          +
        </button>
      )
    },
    [addingAction, pendingKeys, activeKeys, startAddingBinding, isRecording, cancel, handleBindingAdd, handleBindingChange, sequenceTimeout, pendingConflictInfo],
  )

  // Helper: render a cell with all bindings for an action
  const renderCell = useCallback(
    (actionId: string, keys: string[]) => {
      // Show add button if: multiple bindings allowed, OR no bindings exist (need to reassign)
      const showAddButton = editable && (multipleBindings || keys.length === 0)
      return (
        <span className="kbd-action-bindings">
          {keys.map((key) => (
            <Fragment key={key}>
              {renderEditableKbd(actionId, key, true)}
            </Fragment>
          ))}
          {showAddButton && renderAddButton(actionId)}
        </span>
      )
    },
    [renderEditableKbd, renderAddButton, editable, multipleBindings],
  )

  // Props for custom group renderers
  const groupRendererProps: Omit<GroupRendererProps, 'group'> = useMemo(() => ({
    renderCell,
    renderEditableKbd,
    renderAddButton,
    startEditing: startEditingBinding,
    startAdding: startAddingBinding,
    removeBinding,
    isRecording,
    editingAction,
    editingKey,
    addingAction,
  }), [renderCell, renderEditableKbd, renderAddButton, startEditingBinding, startAddingBinding, removeBinding, isRecording, editingAction, editingKey, addingAction])

  // Register Escape to close modal (trigger is handled via useAction)
  useHotkeys(
    { escape: 'closeShortcuts' },
    { closeShortcuts: close },
    { enabled: isOpen },
  )

  // Close on Escape during editing
  useEffect(() => {
    if (!isOpen || (!editingAction && !addingAction)) return

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        cancelEditing()
      }
    }

    window.addEventListener('keydown', handleEscape, true)
    return () => window.removeEventListener('keydown', handleEscape, true)
  }, [isOpen, editingAction, addingAction, cancelEditing])

  // Close modal and open omnibar on meta+k
  useEffect(() => {
    if (!isOpen || !ctx) return

    const handleMetaK = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        e.stopPropagation()
        close()
        ctx.openOmnibar()
      }
    }

    window.addEventListener('keydown', handleMetaK, true)
    return () => window.removeEventListener('keydown', handleMetaK, true)
  }, [isOpen, ctx, close])

  // Close on backdrop click
  const handleBackdropClick = useCallback(
    (e: MouseEvent) => {
      if (e.target === e.currentTarget) {
        close()
      }
    },
    [close],
  )

  // Cancel editing when clicking outside the editing element
  const handleModalClick = useCallback(
    (e: MouseEvent) => {
      if (!editingAction && !addingAction) return
      const target = e.target as HTMLElement
      // If click is on or inside an editing kbd, don't cancel
      if (target.closest('.kbd-kbd.editing')) return
      // If click is on another editable kbd, don't cancel (it will start its own editing)
      if (target.closest('.kbd-kbd.editable')) return
      // If click is on add button, don't cancel (it will start its own editing)
      if (target.closest('.kbd-add-btn')) return
      cancelEditing()
    },
    [editingAction, addingAction, cancelEditing],
  )

  // Organize shortcuts into groups (include actionRegistry to show actions with no bindings)
  // Default showUnbound to true in editable mode, false otherwise
  const effectiveShowUnbound = showUnbound ?? editable
  const shortcutGroups = useMemo(
    () => organizeShortcuts(keymap, labels, descriptions, groupNames, groupOrder, ctx?.registry.actionRegistry, effectiveShowUnbound),
    [keymap, labels, descriptions, groupNames, groupOrder, ctx?.registry.actionRegistry, effectiveShowUnbound],
  )

  if (!isOpen) return null

  // Custom render (legacy - takes full control)
  if (children) {
    return (
      <>
        {children({
          groups: shortcutGroups,
          close,
          editable,
          editingAction,
          editingBindingIndex: null, // deprecated, use editingKey
          pendingKeys,
          activeKeys,
          conflicts,
          startEditing,
          cancelEditing,
          removeBinding,
          reset,
        })}
      </>
    )
  }

  // Render a single group (default or custom)
  const renderGroup = (group: ShortcutGroup) => {
    // Check for custom renderer
    const customRenderer = groupRenderers?.[group.name]
    if (customRenderer) {
      return customRenderer({ group, ...groupRendererProps })
    }

    // Default single-column rendering
    return group.shortcuts.map(({ actionId, label, description, bindings }) => (
      <div key={actionId} className="kbd-action">
        <span className="kbd-action-label" title={description}>
          {label}
        </span>
        {renderCell(actionId, bindings)}
      </div>
    ))
  }

  // Default render
  return (
    <TooltipContext.Provider value={TooltipComponentProp}>
      <div className={backdropClassName} onClick={handleBackdropClick}>
        <div className={modalClassName} role="dialog" aria-modal="true" aria-label="Keyboard shortcuts" onClick={handleModalClick}>
          <div className="kbd-modal-header">
            <h2 className="kbd-modal-title">{title}</h2>
            <div className="kbd-modal-header-buttons">
              {editable && handleReset && (
                <button className="kbd-reset-btn" onClick={reset}>
                Reset
                </button>
              )}
              <button className="kbd-modal-close" onClick={close} aria-label="Close">
              ×
              </button>
            </div>
          </div>

          {hint && <p className="kbd-hint">{hint}</p>}

          {shortcutGroups.map((group) => (
            <div key={group.name} className="kbd-group">
              <h3 className="kbd-group-title">{group.name}</h3>
              {renderGroup(group)}
            </div>
          ))}

          {/* Pending conflict warning */}
          {pendingConflict && (
            <div className="kbd-conflict-warning" style={{
              padding: '12px',
              marginTop: '16px',
              backgroundColor: 'var(--kbd-warning-bg)',
              borderRadius: 'var(--kbd-radius-sm)',
              border: '1px solid var(--kbd-warning)',
            }}>
              <p style={{ margin: '0 0 8px', color: 'var(--kbd-warning)' }}>
              This key is already bound to: {pendingConflict.conflictsWith.join(', ')}
              </p>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={() => {
                  // Accept and override
                    if (addingActionRef.current) {
                      handleBindingAdd?.(pendingConflict.action, pendingConflict.key)
                    } else if (editingKeyRef.current) {
                      handleBindingChange?.(pendingConflict.action, editingKeyRef.current, pendingConflict.key)
                    }
                    editingActionRef.current = null
                    editingKeyRef.current = null
                    addingActionRef.current = null
                    setEditingAction(null)
                    setEditingKey(null)
                    setAddingAction(null)
                    setPendingConflict(null)
                  }}
                  style={{
                    padding: '4px 12px',
                    backgroundColor: 'var(--kbd-accent)',
                    color: 'white',
                    border: 'none',
                    borderRadius: 'var(--kbd-radius-sm)',
                    cursor: 'pointer',
                  }}
                >
                Override
                </button>
                <button
                  onClick={cancelEditing}
                  style={{
                    padding: '4px 12px',
                    backgroundColor: 'var(--kbd-bg-secondary)',
                    border: '1px solid var(--kbd-border)',
                    borderRadius: 'var(--kbd-radius-sm)',
                    cursor: 'pointer',
                  }}
                >
                Cancel
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </TooltipContext.Provider>
  )
}
