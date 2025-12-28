import { Fragment, MouseEvent, ReactNode, useCallback, useEffect, useMemo, useState } from 'react'
import { getActionRegistry } from './actions'
import { useMaybeHotkeysContext } from './HotkeysProvider'
import { ModifierIcon } from './ModifierIcons'
import { useHotkeys } from './useHotkeys'
import { useRecordHotkey } from './useRecordHotkey'
import { findConflicts, formatCombination, getActionBindings, parseHotkeyString } from './utils'
import type { HotkeySequence, KeyCombination, KeyCombinationDisplay } from './types'
import type { HotkeyMap } from './useHotkeys'

export interface ShortcutGroup {
  name: string
  shortcuts: Array<{
    actionId: string
    label: string
    description?: string
    bindings: string[]
  }>
}

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
   * Control visibility externally.
   * If not provided, uses isModalOpen from HotkeysContext.
   */
  isOpen?: boolean
  /**
   * Called when modal should close.
   * If not provided, uses closeModal from HotkeysContext.
   */
  onClose?: () => void
  /** Hotkey to open modal (default: '?'). Set to empty string to disable. */
  openKey?: string
  /**
   * Whether to auto-register the open hotkey (default: true).
   * When using HotkeysContext, the provider already handles this, so set to false.
   */
  autoRegisterOpen?: boolean
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
 */
function organizeShortcuts(
  keymap: HotkeyMap,
  labels?: Record<string, string>,
  descriptions?: Record<string, string>,
  groupNames?: Record<string, string>,
  groupOrder?: string[],
): ShortcutGroup[] {
  // Build action -> bindings map
  const actionBindings = getActionBindings(keymap)
  const groupMap = new Map<string, ShortcutGroup>()

  for (const [actionId, bindings] of actionBindings) {
    const { group: groupKey, name } = parseActionId(actionId)
    const groupName = groupNames?.[groupKey] ?? groupKey

    if (!groupMap.has(groupName)) {
      groupMap.set(groupName, { name: groupName, shortcuts: [] })
    }

    groupMap.get(groupName)!.shortcuts.push({
      actionId,
      label: labels?.[actionId] ?? name,
      description: descriptions?.[actionId],
      bindings,
    })
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
  const { key, modifiers } = combo
  const parts: ReactNode[] = []

  if (modifiers.meta) {
    parts.push(<ModifierIcon key="meta" modifier="meta" className="hotkeys-modifier-icon" />)
  }
  if (modifiers.ctrl) {
    parts.push(<ModifierIcon key="ctrl" modifier="ctrl" className="hotkeys-modifier-icon" />)
  }
  if (modifiers.alt) {
    parts.push(<ModifierIcon key="alt" modifier="alt" className="hotkeys-modifier-icon" />)
  }
  if (modifiers.shift) {
    parts.push(<ModifierIcon key="shift" modifier="shift" className="hotkeys-modifier-icon" />)
  }

  // Display key (uppercase for single chars)
  const keyDisplay = key.length === 1 ? key.toUpperCase() : key.charAt(0).toUpperCase() + key.slice(1)
  parts.push(<span key="key">{keyDisplay}</span>)

  return <span className={className}>{parts}</span>
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
}) {
  const sequence = parseHotkeyString(binding)
  const display = formatCombination(sequence)

  let kbdClassName = 'hotkeys-kbd'
  if (editable) kbdClassName += ' editable'
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
              {i > 0 && <span className="hotkeys-sequence-sep"> </span>}
              <KeyDisplay combo={combo} />
            </Fragment>
          ))}
          {activeKeys && activeKeys.key && (
            <>
              <span className="hotkeys-sequence-sep"> → </span>
              <KeyDisplay combo={activeKeys} />
            </>
          )}
          <span>...</span>
        </>
      )
    } else if (activeKeys && activeKeys.key) {
      content = <><KeyDisplay combo={activeKeys} /><span>...</span></>
    } else {
      content = 'Press keys...'
    }

    return <kbd className={kbdClassName}>{content}</kbd>
  }

  // Render normal binding
  return (
    <kbd className={kbdClassName} onClick={handleClick}>
      {display.isSequence ? (
        sequence.map((combo, i) => (
          <Fragment key={i}>
            {i > 0 && <span className="hotkeys-sequence-sep"> </span>}
            <KeyDisplay combo={combo} />
          </Fragment>
        ))
      ) : (
        <KeyDisplay combo={sequence[0]} />
      )}
      {editable && onRemove && (
        <button
          className="hotkeys-remove-btn"
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
 * Modal component for displaying and optionally editing keyboard shortcuts.
 *
 * Uses CSS classes from styles.css. Override via CSS custom properties:
 * --hotkeys-bg, --hotkeys-text, --hotkeys-kbd-bg, etc.
 *
 * @example
 * ```tsx
 * // Read-only display
 * <ShortcutsModal
 *   keymap={HOTKEYS}
 *   labels={{ 'metric:temp': 'Temperature' }}
 * />
 *
 * // Editable with callbacks
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
  isOpen: isOpenProp,
  onClose: onCloseProp,
  openKey = '?',
  autoRegisterOpen,
  editable = false,
  onBindingChange,
  onBindingAdd,
  onBindingRemove,
  onReset,
  multipleBindings = true,
  children,
  backdropClassName = 'hotkeys-backdrop',
  modalClassName = 'hotkeys-modal',
}: ShortcutsModalProps) {
  // Try to get context (returns null if not within HotkeysProvider)
  const ctx = useMaybeHotkeysContext()

  // Derive labels/descriptions/groups from context actions if not provided as props
  const contextLabels = useMemo(() => {
    if (!ctx?.allActions) return undefined
    const registry = getActionRegistry(ctx.allActions)
    const labels: Record<string, string> = {}
    for (const [id, action] of Object.entries(registry)) {
      labels[id] = action.label
    }
    return labels
  }, [ctx?.allActions])

  const contextDescriptions = useMemo(() => {
    if (!ctx?.allActions) return undefined
    const registry = getActionRegistry(ctx.allActions)
    const descriptions: Record<string, string> = {}
    for (const [id, action] of Object.entries(registry)) {
      if (action.description) descriptions[id] = action.description
    }
    return descriptions
  }, [ctx?.allActions])

  const contextGroups = useMemo(() => {
    if (!ctx?.allActions) return undefined
    const groups: Record<string, string> = {}
    for (const action of Object.values(ctx.allActions)) {
      if (action.group) {
        // Map action prefix to group name
        const prefix = action.group.toLowerCase().replace(/[\s-]/g, '')
        groups[prefix] = action.group
      }
    }
    return groups
  }, [ctx?.allActions])

  // Use context values with prop overrides
  const keymap = keymapProp ?? ctx?.keymap ?? {}
  const defaults = defaultsProp ?? ctx?.defaults
  const labels = labelsProp ?? contextLabels
  const descriptions = descriptionsProp ?? contextDescriptions
  const groupNames = groupNamesProp ?? contextGroups

  // When using context, default autoRegisterOpen to false (HotkeysProvider handles it)
  const shouldAutoRegisterOpen = autoRegisterOpen ?? !ctx

  const [internalIsOpen, setInternalIsOpen] = useState(false)
  // Use prop, then context, then internal state
  const isOpen = isOpenProp ?? ctx?.isModalOpen ?? internalIsOpen

  // Editing state
  const [editingAction, setEditingAction] = useState<string | null>(null)
  const [editingBindingIndex, setEditingBindingIndex] = useState<number | null>(null)
  const [pendingConflict, setPendingConflict] = useState<{
    action: string
    key: string
    conflictsWith: string[]
  } | null>(null)

  // Compute conflicts
  const conflicts = useMemo(() => findConflicts(keymap), [keymap])
  const actionBindings = useMemo(() => getActionBindings(keymap), [keymap])

  const close = useCallback(() => {
    setInternalIsOpen(false)
    setEditingAction(null)
    setEditingBindingIndex(null)
    setPendingConflict(null)
    // Use prop callback, then context, then nothing
    if (onCloseProp) {
      onCloseProp()
    } else if (ctx?.closeModal) {
      ctx.closeModal()
    }
  }, [onCloseProp, ctx])

  const open = useCallback(() => {
    if (ctx?.openModal) {
      ctx.openModal()
    } else {
      setInternalIsOpen(true)
    }
  }, [ctx])

  // Check if a new binding would conflict
  const checkConflict = useCallback((newKey: string, forAction: string): string[] | null => {
    const existingActions = keymap[newKey]
    if (!existingActions) return null
    const actions = Array.isArray(existingActions) ? existingActions : [existingActions]
    const conflicts = actions.filter(a => a !== forAction)
    return conflicts.length > 0 ? conflicts : null
  }, [keymap])

  // Recording hook
  const { isRecording, startRecording, cancel, pendingKeys, activeKeys } = useRecordHotkey({
    onCapture: useCallback(
      (sequence: HotkeySequence, display: KeyCombinationDisplay) => {
        if (!editingAction) return

        // Check for conflicts
        const conflictActions = checkConflict(display.id, editingAction)
        if (conflictActions && conflictActions.length > 0) {
          setPendingConflict({
            action: editingAction,
            key: display.id,
            conflictsWith: conflictActions,
          })
          return
        }

        // Get old key if replacing
        const oldBindings = actionBindings.get(editingAction) ?? []
        const oldKey = editingBindingIndex !== null ? oldBindings[editingBindingIndex] : null

        if (editingBindingIndex !== null && oldKey) {
          // Replacing existing binding
          onBindingChange?.(editingAction, oldKey, display.id)
        } else {
          // Adding new binding
          onBindingAdd?.(editingAction, display.id)
        }

        setEditingAction(null)
        setEditingBindingIndex(null)
      },
      [editingAction, editingBindingIndex, actionBindings, checkConflict, onBindingChange, onBindingAdd],
    ),
    onCancel: useCallback(() => {
      setEditingAction(null)
      setEditingBindingIndex(null)
      setPendingConflict(null)
    }, []),
    pauseTimeout: pendingConflict !== null,
  })

  const startEditing = useCallback(
    (action: string, bindingIndex?: number) => {
      setEditingAction(action)
      setEditingBindingIndex(bindingIndex ?? null)
      setPendingConflict(null)
      startRecording()
    },
    [startRecording],
  )

  const cancelEditing = useCallback(() => {
    cancel()
    setEditingAction(null)
    setEditingBindingIndex(null)
    setPendingConflict(null)
  }, [cancel])

  const removeBinding = useCallback(
    (action: string, key: string) => {
      onBindingRemove?.(action, key)
    },
    [onBindingRemove],
  )

  const reset = useCallback(() => {
    onReset?.()
  }, [onReset])

  // Register open/close hotkeys
  const modalKeymap = shouldAutoRegisterOpen ? { [openKey]: 'openShortcuts' } : {}
  useHotkeys(
    { ...modalKeymap, escape: 'closeShortcuts' },
    {
      openShortcuts: open,
      closeShortcuts: close,
    },
    { enabled: shouldAutoRegisterOpen || isOpen },
  )

  // Close on Escape during editing
  useEffect(() => {
    if (!isOpen || !editingAction) return

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        cancelEditing()
      }
    }

    window.addEventListener('keydown', handleEscape, true)
    return () => window.removeEventListener('keydown', handleEscape, true)
  }, [isOpen, editingAction, cancelEditing])

  // Close on backdrop click
  const handleBackdropClick = useCallback(
    (e: MouseEvent) => {
      if (e.target === e.currentTarget) {
        close()
      }
    },
    [close],
  )

  // Organize shortcuts into groups
  const shortcutGroups = useMemo(
    () => organizeShortcuts(keymap, labels, descriptions, groupNames, groupOrder),
    [keymap, labels, descriptions, groupNames, groupOrder],
  )

  if (!isOpen) return null

  // Custom render
  if (children) {
    return (
      <>
        {children({
          groups: shortcutGroups,
          close,
          editable,
          editingAction,
          editingBindingIndex,
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

  // Default render
  return (
    <div className={backdropClassName} onClick={handleBackdropClick}>
      <div className={modalClassName} role="dialog" aria-modal="true" aria-label="Keyboard shortcuts">
        <div className="hotkeys-modal-header">
          <h2 className="hotkeys-modal-title">Keyboard Shortcuts</h2>
          <button className="hotkeys-modal-close" onClick={close} aria-label="Close">
            ×
          </button>
        </div>

        {shortcutGroups.map((group) => (
          <div key={group.name} className="hotkeys-group">
            <h3 className="hotkeys-group-title">{group.name}</h3>

            {group.shortcuts.map(({ actionId, label, description, bindings }) => {
              const isEditingThisAction = editingAction === actionId

              return (
                <div key={actionId} className="hotkeys-action">
                  <span className="hotkeys-action-label" title={description}>
                    {label}
                  </span>
                  <div className="hotkeys-action-bindings">
                    {bindings.map((binding, idx) => {
                      const conflictActions = conflicts.get(binding)
                      const isConflict = conflictActions && conflictActions.length > 1
                      const isEditing = isEditingThisAction && editingBindingIndex === idx
                      const isDefault = defaults
                        ? (() => {
                          const defaultAction = defaults[binding]
                          if (!defaultAction) return false
                          const defaultActions = Array.isArray(defaultAction) ? defaultAction : [defaultAction]
                          return defaultActions.includes(actionId)
                        })()
                        : true

                      return (
                        <BindingDisplay
                          key={binding}
                          binding={binding}
                          editable={editable}
                          isEditing={isEditing}
                          isConflict={isConflict}
                          isDefault={isDefault}
                          onEdit={() => startEditing(actionId, idx)}
                          onRemove={editable ? () => removeBinding(actionId, binding) : undefined}
                          pendingKeys={pendingKeys}
                          activeKeys={activeKeys}
                        />
                      )
                    })}

                    {/* Add binding button */}
                    {editable && multipleBindings && !isEditingThisAction && (
                      <button
                        className="hotkeys-add-btn"
                        onClick={() => startEditing(actionId)}
                        disabled={isRecording && !isEditingThisAction}
                      >
                        +
                      </button>
                    )}

                    {/* New binding being added (no existing bindings or adding another) */}
                    {isEditingThisAction && editingBindingIndex === null && (
                      <BindingDisplay
                        binding=""
                        isEditing
                        pendingKeys={pendingKeys}
                        activeKeys={activeKeys}
                      />
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        ))}

        {/* Pending conflict warning */}
        {pendingConflict && (
          <div className="hotkeys-conflict-warning" style={{
            padding: '12px',
            marginTop: '16px',
            backgroundColor: 'var(--hk-warning-bg)',
            borderRadius: 'var(--hk-radius-sm)',
            border: '1px solid var(--hk-warning)',
          }}>
            <p style={{ margin: '0 0 8px', color: 'var(--hk-warning)' }}>
              This key is already bound to: {pendingConflict.conflictsWith.join(', ')}
            </p>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => {
                  // Accept and override
                  const oldBindings = actionBindings.get(pendingConflict.action) ?? []
                  const oldKey = editingBindingIndex !== null ? oldBindings[editingBindingIndex] : null

                  if (editingBindingIndex !== null && oldKey) {
                    onBindingChange?.(pendingConflict.action, oldKey, pendingConflict.key)
                  } else {
                    onBindingAdd?.(pendingConflict.action, pendingConflict.key)
                  }

                  setEditingAction(null)
                  setEditingBindingIndex(null)
                  setPendingConflict(null)
                }}
                style={{
                  padding: '4px 12px',
                  backgroundColor: 'var(--hk-accent)',
                  color: 'white',
                  border: 'none',
                  borderRadius: 'var(--hk-radius-sm)',
                  cursor: 'pointer',
                }}
              >
                Override
              </button>
              <button
                onClick={cancelEditing}
                style={{
                  padding: '4px 12px',
                  backgroundColor: 'var(--hk-bg-secondary)',
                  border: '1px solid var(--hk-border)',
                  borderRadius: 'var(--hk-radius-sm)',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Reset button */}
        {editable && onReset && (
          <div style={{ marginTop: '16px', textAlign: 'right' }}>
            <button
              onClick={reset}
              style={{
                padding: '6px 12px',
                backgroundColor: 'var(--hk-bg-secondary)',
                border: '1px solid var(--hk-border)',
                borderRadius: 'var(--hk-radius-sm)',
                cursor: 'pointer',
                color: 'var(--hk-text)',
              }}
            >
              Reset to defaults
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
