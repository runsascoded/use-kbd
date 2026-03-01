import { ComponentType, createContext, Fragment, MouseEvent, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { ACTION_MODAL, ACTION_MODE_PREFIX, DEFAULT_SEQUENCE_TIMEOUT } from './constants'
import { dbg } from './debug'
import { useMaybeHotkeysContext } from './HotkeysProvider'
import { renderModifierIcons, renderKeyContent } from './KeyElements'
import { Left, Right, Up, Down, ArrowsMove, ArrowsDpad, ArrowsDouble } from './KeyIcons'
import type { KeyIconProps } from './KeyIcons'
import { useAction } from './useAction'
import { useHotkeys } from './useHotkeys'
import { useRecordHotkey } from './useRecordHotkey'
import { findConflicts, formatCombination, getActionBindings, parseHotkeyString, parseKeySeq } from './utils'
import type { ActionsRegistryValue } from './ActionsRegistry'
import type { ActionRegistry, Direction, HotkeySequence, KeyCombination, KeyCombinationDisplay, Modifiers, RegisteredMode, SeqElem } from './types'
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
 * Default tooltip uses native title attribute.
 * Pass a custom TooltipComponent (e.g., MUI Tooltip) for richer tooltips.
 */
const DefaultTooltip: TooltipComponent = ({ title, children }) => (
  <span title={title} style={{ display: 'contents' }}>{children}</span>
)

/** Download icon for export button */
const DownloadIcon = () => (
  <svg className="kbd-footer-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </svg>
)

/** Upload icon for import button */
const UploadIcon = () => (
  <svg className="kbd-footer-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="17 8 12 3 7 8" />
    <line x1="12" y1="3" x2="12" y2="15" />
  </svg>
)

/** Reset icon (circular arrow) */
const ResetIcon = () => (
  <svg className="kbd-footer-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
    <path d="M3 3v5h5" />
  </svg>
)

/**
 * Context for tooltip component (allows nested components to access it)
 */
const TooltipContext = createContext<TooltipComponent>(DefaultTooltip)

/** A regular action shortcut entry */
export interface ActionShortcut {
  type: 'action'
  actionId: string
  label: string
  description?: string
  bindings: string[]
}

/** An arrow group shortcut entry (collapsed from 4 directional actions) */
export interface ArrowGroupShortcut {
  type: 'arrowGroup'
  groupId: string
  label: string
  description?: string
  /** Action IDs for each direction */
  actionIds: Record<Direction, string>
  /** Current modifier prefix for the arrow bindings */
  modifierPrefix: string
  /** Extra per-direction bindings (non-arrow, e.g., vim keys) */
  extraBindings: Partial<Record<Direction, string[]>>
}

/** An action pair shortcut entry (collapsed from 2 inverse actions) */
export interface ActionPairShortcut {
  type: 'actionPair'
  pairId: string
  label: string
  description?: string
  actionIds: [string, string]
  bindings: [string[], string[]]
}

/** An action triplet shortcut entry (collapsed from 3 related actions) */
export interface ActionTripletShortcut {
  type: 'actionTriplet'
  tripletId: string
  label: string
  description?: string
  actionIds: [string, string, string]
  bindings: [string[], string[], string[]]
}

export type ShortcutEntry = ActionShortcut | ArrowGroupShortcut | ActionPairShortcut | ActionTripletShortcut

export interface ShortcutGroup {
  name: string
  shortcuts: ShortcutEntry[]
  /** Mode metadata (if this group represents a mode's actions) */
  mode?: {
    id: string
    color?: string
    active: boolean
    /** Key bindings to activate this mode (e.g., ['g v']) */
    activationBindings: string[]
  }
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
  /** Called when bindings are exported */
  onExport?: () => void
  /** Called when bindings are imported (with import data) */
  onImport?: (file: File) => Promise<void>
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
  /**
   * Compact arrow icon for arrow group rows.
   * Built-in options: 'move' (default), 'dpad', 'double'.
   * Or pass a custom component with KeyIconProps.
   */
  arrowIcon?: 'move' | 'dpad' | 'double' | ComponentType<KeyIconProps>
  /**
   * Custom footer content. Return `null` to hide the default footer.
   * Receives default footer actions for composition.
   */
  footerContent?: (actions: {
    exportBindings: (() => void) | undefined
    importBindings: (() => void) | undefined
    resetBindings: (() => void) | undefined
    importInputRef: React.RefObject<HTMLInputElement>
    handleFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  }) => ReactNode
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
  modesMap?: Map<string, RegisteredMode>,
  activeMode?: string | null,
  getEffectiveMode?: (actionId: string) => string | undefined,
): ShortcutGroup[] {
  // Build action -> bindings map
  const actionBindings = getActionBindings(keymap)
  const groupMap = new Map<string, ShortcutGroup>()
  const includedActions = new Set<string>()

  // Helper to get group name for an action (consistent logic for both paths)
  const getGroupName = (actionId: string): string => {
    let groupKey: string

    // For mode-scoped actions, use mode label as group name
    const actionMode = getEffectiveMode ? getEffectiveMode(actionId) : actionRegistry?.[actionId]?.mode
    if (actionMode && modesMap) {
      const mode = modesMap.get(actionMode)
      if (mode) return mode.config.label
    }

    // First, check if action has a registered group in the registry
    const registeredGroup = actionRegistry?.[actionId]?.group
    if (registeredGroup) {
      groupKey = registeredGroup
    } else {
      // Fall back to parsing actionId prefix
      groupKey = parseActionId(actionId).group
    }

    // Apply groupNames mapping to ALL groups (both registered and prefix-derived)
    return groupNames?.[groupKey] ?? groupKey
  }

  // Helper to get mode metadata for a group
  const getModeForAction = (actionId: string): ShortcutGroup['mode'] => {
    const actionMode = getEffectiveMode ? getEffectiveMode(actionId) : actionRegistry?.[actionId]?.mode
    if (!actionMode || !modesMap) return undefined
    const mode = modesMap.get(actionMode)
    if (!mode) return undefined
    // Look up activation bindings from the keymap
    const activationActionId = `${ACTION_MODE_PREFIX}${actionMode}`
    const activationBindings = actionBindings.get(activationActionId) ?? []
    return {
      id: actionMode,
      color: mode.config.color,
      active: activeMode === actionMode,
      activationBindings,
    }
  }

  for (const [actionId, bindings] of actionBindings) {
    // Skip actions marked as hidden from modal
    if (actionRegistry?.[actionId]?.hideFromModal) continue

    includedActions.add(actionId)
    const { name } = parseActionId(actionId)
    const groupName = getGroupName(actionId)

    if (!groupMap.has(groupName)) {
      groupMap.set(groupName, { name: groupName, shortcuts: [], mode: getModeForAction(actionId) })
    }

    groupMap.get(groupName)!.shortcuts.push({
      type: 'action',
      actionId,
      label: labels?.[actionId] ?? actionRegistry?.[actionId]?.label ?? name,
      description: descriptions?.[actionId] ?? actionRegistry?.[actionId]?.description,
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
        groupMap.set(groupName, { name: groupName, shortcuts: [], mode: getModeForAction(actionId) })
      }

      groupMap.get(groupName)!.shortcuts.push({
        type: 'action',
        actionId,
        label: labels?.[actionId] ?? action.label ?? name,
        description: descriptions?.[actionId] ?? action.description,
        bindings: [], // No bindings
      })
    }
  }

  // Sort shortcuts within each group by actionId
  for (const group of groupMap.values()) {
    group.shortcuts.sort((a, b) => {
      const aId = a.type === 'action' ? a.actionId : a.type === 'arrowGroup' ? a.groupId : a.type === 'actionPair' ? a.pairId : a.tripletId
      const bId = b.type === 'action' ? b.actionId : b.type === 'arrowGroup' ? b.groupId : b.type === 'actionPair' ? b.pairId : b.tripletId
      return aId.localeCompare(bId)
    })
  }

  // Collapse arrow group actions into compact ArrowGroupShortcut entries
  if (actionRegistry) {
    for (const group of groupMap.values()) {
      const arrowGroups = new Map<string, { entries: ActionShortcut[]; directions: Set<Direction> }>()

      // Identify arrow group members
      for (const entry of group.shortcuts) {
        if (entry.type !== 'action') continue
        const ag = actionRegistry[entry.actionId]?.arrowGroup
        if (!ag) continue
        if (!arrowGroups.has(ag.groupId)) {
          arrowGroups.set(ag.groupId, { entries: [], directions: new Set() })
        }
        const g = arrowGroups.get(ag.groupId)!
        g.entries.push(entry)
        g.directions.add(ag.direction)
      }

      // Only collapse complete quads (all 4 directions present)
      const toRemove = new Set<string>()
      const toInsert: Array<{ index: number; entry: ArrowGroupShortcut }> = []

      for (const [groupId, { entries, directions }] of arrowGroups) {
        if (directions.size !== 4) continue

        // Extract shared label (strip direction suffix)
        const firstEntry = entries[0]
        const label = firstEntry.label.replace(/\s+(left|right|up|down)$/i, '')

        // Parse arrow bindings to extract modifier prefix and extra bindings
        const actionIds = {} as Record<Direction, string>
        const extraBindings: Partial<Record<Direction, string[]>> = {}
        let modifierPrefix = ''

        for (const entry of entries) {
          const ag = actionRegistry[entry.actionId]!.arrowGroup!
          actionIds[ag.direction] = entry.actionId

          // Separate arrow bindings from extra bindings
          const arrowKey = `arrow${ag.direction}`
          const extras: string[] = []
          for (const b of entry.bindings) {
            if (b.endsWith(arrowKey)) {
              // Extract modifier prefix from this arrow binding
              const prefix = b.slice(0, b.length - arrowKey.length)
              if (ag.direction === 'left') {
                modifierPrefix = prefix
              }
            } else {
              extras.push(b)
            }
          }
          if (extras.length > 0) {
            extraBindings[ag.direction] = extras
          }

          toRemove.add(entry.actionId)
        }

        // Find insertion index (position of first entry)
        const firstIndex = group.shortcuts.findIndex(
          s => s.type === 'action' && s.actionId === entries[0].actionId
        )

        toInsert.push({
          index: firstIndex,
          entry: {
            type: 'arrowGroup',
            groupId,
            label,
            description: firstEntry.description,
            actionIds,
            modifierPrefix,
            extraBindings,
          },
        })
      }

      if (toRemove.size > 0) {
        // Remove individual entries and insert collapsed ones
        group.shortcuts = group.shortcuts.filter(
          s => s.type !== 'action' || !toRemove.has(s.actionId)
        )
        // Insert collapsed entries at their original positions (adjusted for removals)
        // Sort inserts by original index descending to insert from end
        toInsert.sort((a, b) => b.index - a.index)
        for (const { entry } of toInsert) {
          // Find the right insertion point based on groupId sorting
          let insertIdx = group.shortcuts.findIndex(s => {
            const sId = s.type === 'action' ? s.actionId : s.type === 'arrowGroup' ? s.groupId : s.type === 'actionPair' ? s.pairId : s.tripletId
            return sId.localeCompare(entry.groupId) > 0
          })
          if (insertIdx === -1) insertIdx = group.shortcuts.length
          group.shortcuts.splice(insertIdx, 0, entry)
        }
      }
    }

    // Collapse action pair entries into compact ActionPairShortcut entries
    for (const group of groupMap.values()) {
      const pairs = new Map<string, { entries: ActionShortcut[]; indices: Set<number> }>()

      for (const entry of group.shortcuts) {
        if (entry.type !== 'action') continue
        const ap = actionRegistry[entry.actionId]?.actionPair
        if (!ap) continue
        if (!pairs.has(ap.pairId)) {
          pairs.set(ap.pairId, { entries: [], indices: new Set() })
        }
        const p = pairs.get(ap.pairId)!
        p.entries.push(entry)
        p.indices.add(ap.index)
      }

      const toRemovePair = new Set<string>()
      const toInsertPair: ActionPairShortcut[] = []

      for (const [pairId, { entries, indices }] of pairs) {
        if (indices.size !== 2) continue

        // Sort entries by index
        entries.sort((a, b) => {
          const ai = actionRegistry[a.actionId]!.actionPair!.index
          const bi = actionRegistry[b.actionId]!.actionPair!.index
          return ai - bi
        })

        // Strip " a" / " b" suffix from label
        const label = entries[0].label.replace(/\s+[ab]$/i, '')

        toInsertPair.push({
          type: 'actionPair',
          pairId,
          label,
          description: entries[0].description,
          actionIds: [entries[0].actionId, entries[1].actionId],
          bindings: [entries[0].bindings, entries[1].bindings],
        })

        for (const entry of entries) {
          toRemovePair.add(entry.actionId)
        }
      }

      if (toRemovePair.size > 0) {
        group.shortcuts = group.shortcuts.filter(
          s => s.type !== 'action' || !toRemovePair.has(s.actionId)
        )
        for (const entry of toInsertPair) {
          let insertIdx = group.shortcuts.findIndex(s => {
            const sId = s.type === 'action' ? s.actionId : s.type === 'arrowGroup' ? s.groupId : s.type === 'actionPair' ? s.pairId : s.tripletId
            return sId.localeCompare(entry.pairId) > 0
          })
          if (insertIdx === -1) insertIdx = group.shortcuts.length
          group.shortcuts.splice(insertIdx, 0, entry)
        }
      }
    }

    // Collapse action triplet entries into compact ActionTripletShortcut entries
    for (const group of groupMap.values()) {
      const triplets = new Map<string, { entries: ActionShortcut[]; indices: Set<number> }>()

      for (const entry of group.shortcuts) {
        if (entry.type !== 'action') continue
        const at = actionRegistry[entry.actionId]?.actionTriplet
        if (!at) continue
        if (!triplets.has(at.tripletId)) {
          triplets.set(at.tripletId, { entries: [], indices: new Set() })
        }
        const t = triplets.get(at.tripletId)!
        t.entries.push(entry)
        t.indices.add(at.index)
      }

      const toRemoveTriplet = new Set<string>()
      const toInsertTriplet: ActionTripletShortcut[] = []

      for (const [tripletId, { entries, indices }] of triplets) {
        if (indices.size !== 3) continue

        // Sort entries by index
        entries.sort((a, b) => {
          const ai = actionRegistry[a.actionId]!.actionTriplet!.index
          const bi = actionRegistry[b.actionId]!.actionTriplet!.index
          return ai - bi
        })

        // Strip " a" / " b" / " c" suffix from label
        const label = entries[0].label.replace(/\s+[abc]$/i, '')

        toInsertTriplet.push({
          type: 'actionTriplet',
          tripletId,
          label,
          description: entries[0].description,
          actionIds: [entries[0].actionId, entries[1].actionId, entries[2].actionId],
          bindings: [entries[0].bindings, entries[1].bindings, entries[2].bindings],
        })

        for (const entry of entries) {
          toRemoveTriplet.add(entry.actionId)
        }
      }

      if (toRemoveTriplet.size > 0) {
        group.shortcuts = group.shortcuts.filter(
          s => s.type !== 'action' || !toRemoveTriplet.has(s.actionId)
        )
        for (const entry of toInsertTriplet) {
          let insertIdx = group.shortcuts.findIndex(s => {
            const sId = s.type === 'action' ? s.actionId : s.type === 'arrowGroup' ? s.groupId : s.type === 'actionPair' ? s.pairId : s.tripletId
            return sId.localeCompare(entry.tripletId) > 0
          })
          if (insertIdx === -1) insertIdx = group.shortcuts.length
          group.shortcuts.splice(insertIdx, 0, entry)
        }
      }
    }
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
    // Default: "General" last, mode groups after regular groups, others alphabetically
    groups.sort((a, b) => {
      if (a.name === 'General') return 1
      if (b.name === 'General') return -1
      // Mode groups sort after non-mode groups
      if (a.mode && !b.mode) return 1
      if (!a.mode && b.mode) return -1
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
  if (elem.type === 'float') {
    return (
      <Tooltip title="A number (integer or decimal)">
        <span className={`kbd-placeholder ${className || ''}`}>#.#</span>
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
  onAdd,
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
  onAdd?: () => void
  pendingKeys?: HotkeySequence
  activeKeys?: KeyCombination | null
  timeoutDuration?: number
}) {
  const sequence = parseHotkeyString(binding)
  const keySeq = parseKeySeq(binding)

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
      {editable && onAdd && (
        <button
          className="kbd-add-inline-btn"
          onClick={(e) => { e.stopPropagation(); onAdd() }}
          aria-label="Add binding"
        >
          +
        </button>
      )}
    </kbd>
  )
}

/** Parse a modifier prefix string like "shift+" into Modifiers */
function parseModifierPrefix(prefix: string): Modifiers {
  const p = prefix.toLowerCase()
  return {
    ctrl: p.includes('ctrl'),
    alt: p.includes('alt'),
    shift: p.includes('shift'),
    meta: p.includes('meta'),
  }
}

const DIRECTION_ICONS: Record<Direction, typeof Left> = { left: Left, right: Right, up: Up, down: Down }
const DIRECTION_ORDER: Direction[] = ['left', 'right', 'up', 'down']

/**
 * Compact row for an arrow group — renders as:
 *   Pan    [Shift] + [←] [→] [↑] [↓]    [h] [l] [k] [j]
 */
function ArrowGroupRow({
  entry,
  editable,
  TooltipComponent: Tooltip,
  onStartEditing,
  renderExtraBindings,
  arrowGroupEditState,
  arrowGroupActiveKeys,
  conflicts,
  ArrowIconComponent,
}: {
  entry: ArrowGroupShortcut
  editable: boolean
  TooltipComponent: TooltipComponent
  onStartEditing: (groupId: string) => void
  renderExtraBindings: (actionId: string, bindings: string[]) => ReactNode
  arrowGroupEditState: { groupId: string } | null
  arrowGroupActiveKeys: KeyCombination | null
  conflicts: Map<string, string[]>
  ArrowIconComponent: ComponentType<KeyIconProps> | null
}) {
  const isEditing = arrowGroupEditState?.groupId === entry.groupId
  const modifiers = parseModifierPrefix(entry.modifierPrefix)
  const hasModifiers = modifiers.ctrl || modifiers.alt || modifiers.shift || modifiers.meta

  // Check if any arrow binding is conflicted
  const arrowKeys: Record<Direction, string> = {
    left: 'arrowleft', right: 'arrowright',
    up: 'arrowup', down: 'arrowdown',
  }
  const hasConflict = DIRECTION_ORDER.some(dir => {
    const binding = `${entry.modifierPrefix}${arrowKeys[dir]}`
    return conflicts.has(binding)
  })

  // Collect extra bindings across all directions
  const hasExtras = DIRECTION_ORDER.some(d => (entry.extraBindings[d]?.length ?? 0) > 0)

  // Render arrows: compact icon or 4 individual icons
  const renderArrows = () => {
    if (ArrowIconComponent) {
      return <ArrowIconComponent className="kbd-key-icon kbd-arrow-group-compact" />
    }
    return (
      <span className="kbd-arrow-group-arrows">
        {DIRECTION_ORDER.map(dir => {
          const Icon = DIRECTION_ICONS[dir]
          return <Icon key={dir} className="kbd-key-icon" />
        })}
      </span>
    )
  }

  return (
    <div className="kbd-action kbd-arrow-group-row" data-arrow-group={entry.groupId}>
      {entry.description ? (
        <Tooltip title={entry.description}>
          <span className="kbd-action-label">{entry.label}</span>
        </Tooltip>
      ) : (
        <span className="kbd-action-label">{entry.label}</span>
      )}
      <span className="kbd-action-bindings">
        <kbd
          className={`kbd-kbd kbd-arrow-group-binding${editable ? ' editable' : ''}${isEditing ? ' editing' : ''}${hasConflict ? ' conflict' : ''}`}
          onClick={editable ? () => onStartEditing(entry.groupId) : undefined}
          tabIndex={editable ? 0 : undefined}
          onKeyDown={editable ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onStartEditing(entry.groupId) } } : undefined}
        >
          {isEditing ? (
            <>
              {arrowGroupActiveKeys && (arrowGroupActiveKeys.modifiers.ctrl || arrowGroupActiveKeys.modifiers.alt || arrowGroupActiveKeys.modifiers.shift || arrowGroupActiveKeys.modifiers.meta) ? (
                <>
                  {renderModifierIcons(arrowGroupActiveKeys.modifiers)}
                </>
              ) : null}
              {renderArrows()}
              <span>...</span>
            </>
          ) : (
            <>
              {hasModifiers && (
                <>
                  {renderModifierIcons(modifiers)}
                </>
              )}
              {renderArrows()}
            </>
          )}
        </kbd>
        {hasExtras && DIRECTION_ORDER.map(dir => {
          const extras = entry.extraBindings[dir]
          if (!extras || extras.length === 0) return null
          return <Fragment key={dir}>{renderExtraBindings(entry.actionIds[dir], extras)}</Fragment>
        })}
      </span>
    </div>
  )
}

/**
 * Compact row for an action pair — renders as:
 *   Zoom in / out    [=]  /  [−]
 */
function ActionPairRow({
  entry,
  renderCell,
  TooltipComponent: Tooltip,
}: {
  entry: ActionPairShortcut
  renderCell: (actionId: string, keys: string[]) => ReactNode
  TooltipComponent: TooltipComponent
}) {
  return (
    <div className="kbd-action kbd-action-pair-row" data-action-pair={entry.pairId}>
      {entry.description ? (
        <Tooltip title={entry.description}>
          <span className="kbd-action-label">{entry.label}</span>
        </Tooltip>
      ) : (
        <span className="kbd-action-label">{entry.label}</span>
      )}
      <span className="kbd-action-bindings">
        {renderCell(entry.actionIds[0], entry.bindings[0])}
        <span className="kbd-action-pair-sep">/</span>
        {renderCell(entry.actionIds[1], entry.bindings[1])}
      </span>
    </div>
  )
}

/**
 * Compact row for an action triplet — renders as:
 *   Slice along    [X]  /  [Y]  /  [Z]
 */
function ActionTripletRow({
  entry,
  renderCell,
  TooltipComponent: Tooltip,
}: {
  entry: ActionTripletShortcut
  renderCell: (actionId: string, keys: string[]) => ReactNode
  TooltipComponent: TooltipComponent
}) {
  return (
    <div className="kbd-action kbd-action-triplet-row" data-action-triplet={entry.tripletId}>
      {entry.description ? (
        <Tooltip title={entry.description}>
          <span className="kbd-action-label">{entry.label}</span>
        </Tooltip>
      ) : (
        <span className="kbd-action-label">{entry.label}</span>
      )}
      <span className="kbd-action-bindings">
        {renderCell(entry.actionIds[0], entry.bindings[0])}
        <span className="kbd-action-pair-sep">/</span>
        {renderCell(entry.actionIds[1], entry.bindings[1])}
        <span className="kbd-action-pair-sep">/</span>
        {renderCell(entry.actionIds[2], entry.bindings[2])}
      </span>
    </div>
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

interface ModesSectionProps {
  modeGroups: ShortcutGroup[]
  editable: boolean
  registry: ActionsRegistryValue
  actionRegistry: ActionRegistry
  renderShortcutEntry: (entry: ShortcutEntry) => ReactNode
}

function ModesSection({ modeGroups, editable, registry, actionRegistry, renderShortcutEntry }: ModesSectionProps) {
  const [addingToMode, setAddingToMode] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const { getEffectiveMode, addActionToMode, removeActionFromMode } = registry

  // Focus search input when opening add-action panel
  useEffect(() => {
    if (addingToMode && searchInputRef.current) {
      searchInputRef.current.focus()
    }
  }, [addingToMode])

  // Get global (unassigned) actions for add-to-mode search
  const globalActions = useMemo(() => {
    return Object.entries(actionRegistry)
      .filter(([id, action]) => {
        if (id.startsWith(ACTION_MODE_PREFIX)) return false
        if (action.hideFromModal) return false
        return !getEffectiveMode(id)
      })
      .map(([id, action]) => ({ id, label: action.label }))
  }, [actionRegistry, getEffectiveMode])

  const filteredGlobalActions = useMemo(() => {
    if (!searchQuery) return globalActions
    const q = searchQuery.toLowerCase()
    return globalActions.filter(a =>
      a.id.toLowerCase().includes(q) || a.label.toLowerCase().includes(q)
    )
  }, [globalActions, searchQuery])

  // Reset selected index when filtered results change
  useEffect(() => {
    setSelectedIndex(-1)
  }, [filteredGlobalActions])

  const addAction = useCallback((actionId: string, modeId: string) => {
    addActionToMode(actionId, modeId)
    setAddingToMode(null)
    setSearchQuery('')
    setSelectedIndex(-1)
  }, [addActionToMode])

  return (
    <div className="kbd-modes-section">
      <h3 className="kbd-modes-title">Modes</h3>
      {modeGroups.map(group => {
        const mode = group.mode!
        return (
          <div
            key={group.name}
            className="kbd-modes-entry"
            style={mode.color ? { '--kbd-mode-color': mode.color } as React.CSSProperties : undefined}
          >
            <div className="kbd-modes-header">
              <span className="kbd-modes-label" style={mode.color ? { color: mode.color } : undefined}>
                {group.name}
              </span>
              {mode.activationBindings.map(binding => (
                <kbd key={binding} className="kbd-kbd kbd-modes-binding">
                  {parseKeySeq(binding).map((elem, i) => (
                    <Fragment key={i}>
                      {i > 0 && <span className="kbd-sequence-sep"> </span>}
                      <SeqElemDisplay elem={elem} />
                    </Fragment>
                  ))}
                </kbd>
              ))}
              {mode.color && (
                <span className="kbd-modes-color" style={{ backgroundColor: mode.color }} />
              )}
            </div>
            <div className="kbd-modes-shortcuts">
              {group.shortcuts.map((entry) => {
                const entryKey = entry.type === 'action' ? entry.actionId : entry.type === 'arrowGroup' ? entry.groupId : entry.type === 'actionPair' ? entry.pairId : entry.tripletId
                const actionIdForRemove = entry.type === 'action' ? entry.actionId : entry.type === 'arrowGroup' ? entry.actionIds.left : entry.actionIds[0]
                const entryLabel = entry.label
                return (
                  <div key={entryKey} className="kbd-modes-action-row">
                    {renderShortcutEntry(entry)}
                    {editable && (
                      <button
                        className="kbd-modes-remove"
                        onClick={() => removeActionFromMode(actionIdForRemove, mode.id)}
                        aria-label={`Remove ${entryLabel} from ${group.name}`}
                        title="Remove from mode"
                      >
                        &times;
                      </button>
                    )}
                  </div>
                )
              })}
              {group.shortcuts.length === 0 && (
                <div className="kbd-modes-empty">No actions</div>
              )}
            </div>
            {editable && (addingToMode === mode.id ? (
              <div className="kbd-modes-add-panel">
                <input
                  ref={searchInputRef}
                  type="text"
                  className="kbd-modes-search"
                  placeholder="Search actions..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  onKeyDown={e => {
                    const items = filteredGlobalActions.slice(0, 8)
                    if (e.key === 'Escape') {
                      setAddingToMode(null)
                      setSearchQuery('')
                      setSelectedIndex(-1)
                    } else if (e.key === 'ArrowDown') {
                      e.preventDefault()
                      setSelectedIndex(prev => Math.min(prev + 1, items.length - 1))
                    } else if (e.key === 'ArrowUp') {
                      e.preventDefault()
                      setSelectedIndex(prev => Math.max(prev - 1, -1))
                    } else if (e.key === 'Enter' && selectedIndex >= 0 && selectedIndex < items.length) {
                      e.preventDefault()
                      addAction(items[selectedIndex].id, mode.id)
                    }
                  }}
                />
                <ul className="kbd-modes-search-results">
                  {filteredGlobalActions.slice(0, 8).map((action, i) => (
                    <li key={action.id}>
                      <button
                        className={`kbd-modes-search-item${i === selectedIndex ? ' selected' : ''}`}
                        onClick={() => addAction(action.id, mode.id)}
                      >
                        {action.label}
                      </button>
                    </li>
                  ))}
                  {filteredGlobalActions.length === 0 && (
                    <li className="kbd-modes-no-results">No global actions found</li>
                  )}
                </ul>
              </div>
            ) : (
              <button
                className="kbd-modes-add-btn"
                onClick={() => {
                  setAddingToMode(mode.id)
                  setSearchQuery('')
                  setSelectedIndex(-1)
                }}
              >
                + Add action...
              </button>
            ))}
          </div>
        )
      })}
    </div>
  )
}

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
  editable: editableProp = false,
  onBindingChange,
  onBindingAdd,
  onBindingRemove,
  onReset,
  onExport,
  onImport,
  multipleBindings = true,
  children,
  backdropClassName = 'kbd-backdrop',
  modalClassName = 'kbd-modal',
  title = 'Keyboard Shortcuts',
  hint,
  showUnbound,
  TooltipComponent: TooltipComponentProp = DefaultTooltip,
  arrowIcon: arrowIconProp,
  footerContent,
}: ShortcutsModalProps) {
  // Try to get context (returns null if not within HotkeysProvider)
  const ctx = useMaybeHotkeysContext()

  // Resolve arrowIcon prop to a component
  const ArrowIconComponent = useMemo((): ComponentType<KeyIconProps> | null => {
    if (!arrowIconProp) return null
    if (typeof arrowIconProp === 'string') {
      switch (arrowIconProp) {
        case 'move': return ArrowsMove
        case 'dpad': return ArrowsDpad
        case 'double': return ArrowsDouble
        default: return null
      }
    }
    return arrowIconProp
  }, [arrowIconProp])

  // Disable editing on touch devices (no physical keyboard to capture)
  const [isTouchDevice, setIsTouchDevice] = useState(false)
  useEffect(() => {
    if (typeof window === 'undefined') return
    const hasHover = window.matchMedia('(hover: hover)').matches
    setIsTouchDevice(!hasHover)
  }, [])
  const editable = editableProp && !isTouchDevice

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

  // Export/Import handlers
  const importInputRef = useRef<HTMLInputElement>(null)
  const [importError, setImportError] = useState<string | null>(null)

  // Check if there are any customizations to export
  const modeCusts = ctx?.registry.modeCustomizations
  const hasCustomizations = ctx ? (
    Object.keys(ctx.registry.overrides).length > 0 ||
    Object.keys(ctx.registry.removedDefaults).length > 0 ||
    (modeCusts && (
      Object.keys(modeCusts.additions).length > 0 ||
      Object.keys(modeCusts.removals).length > 0 ||
      Object.keys(modeCusts.userModes).length > 0
    ))
  ) : false

  const handleExport = onExport ?? (ctx ? () => {
    const data = ctx.registry.exportBindings()
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    // Use storageKey as app identifier in filename
    const appName = ctx.storageKey.replace(/[^a-zA-Z0-9-_]/g, '-')
    a.download = `${appName}-shortcuts-${new Date().toISOString().slice(0, 10)}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  } : undefined)

  const handleImport = onImport ?? (ctx ? async (file: File) => {
    try {
      const text = await file.text()
      const data = JSON.parse(text)
      ctx.registry.importBindings(data)
      setImportError(null)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to import bindings'
      setImportError(message)
    }
  } : undefined)

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file && handleImport) {
      handleImport(file)
    }
    // Reset input so same file can be selected again
    if (importInputRef.current) {
      importInputRef.current.value = ''
    }
  }, [handleImport])

  const [internalIsOpen, setInternalIsOpen] = useState(false)
  // Use prop, then context, then internal state
  const isOpen = isOpenProp ?? ctx?.isModalOpen ?? internalIsOpen

  // Editing state - use key-based tracking (not index-based)
  const [editingAction, setEditingAction] = useState<string | null>(null)
  const [editingKey, setEditingKey] = useState<string | null>(null)
  const [addingAction, setAddingAction] = useState<string | null>(null)
  const [addAfterKey, setAddAfterKey] = useState<string | null>(null)
  const [pendingConflict, setPendingConflict] = useState<{
    action: string
    key: string
    conflictsWith: string[]
  } | null>(null)
  // Track if current pending keys have a conflict (for pausing timeout)
  const [hasPendingConflictState, setHasPendingConflictState] = useState(false)

  // Arrow group editing state
  const [arrowGroupEditState, setArrowGroupEditState] = useState<{ groupId: string } | null>(null)
  const [arrowGroupActiveKeys, setArrowGroupActiveKeys] = useState<KeyCombination | null>(null)
  const arrowGroupEditRef = useRef<{ groupId: string } | null>(null)

  // Refs to avoid stale closures in onCapture callback
  const editingActionRef = useRef<string | null>(null)
  const editingKeyRef = useRef<string | null>(null)
  const addingActionRef = useRef<string | null>(null)
  const addAfterKeyRef = useRef<string | null>(null)
  const setIsEditingBindingRef = useRef(ctx?.setIsEditingBinding)
  setIsEditingBindingRef.current = ctx?.setIsEditingBinding

  // Compute conflicts (mode-aware when context is available)
  const conflicts = useMemo(() => findConflicts(keymap, ctx?.registry.getEffectiveMode), [keymap, ctx?.registry.getEffectiveMode])
  const actionBindings = useMemo(() => getActionBindings(keymap), [keymap])

  const close = useCallback(() => {
    setInternalIsOpen(false)
    setEditingAction(null)
    setEditingKey(null)
    setAddingAction(null)
    setAddAfterKey(null)
    editingActionRef.current = null
    editingKeyRef.current = null
    addingActionRef.current = null
    addAfterKeyRef.current = null
    setPendingConflict(null)
    arrowGroupEditRef.current = null
    setArrowGroupEditState(null)
    setArrowGroupActiveKeys(null)
    // Use prop callback, then context, then nothing
    if (onCloseProp) {
      onCloseProp()
    } else if (ctx?.closeModal) {
      ctx.closeModal()
    }
  }, [onCloseProp, ctx])

  // Note: Browser back button handling is centralized in HotkeysProvider

  // Register the shortcuts modal trigger action
  useAction(ACTION_MODAL, {
    label: 'Show shortcuts',
    group: 'Global',
    defaultBindings: defaultBinding ? [defaultBinding] : [],
    protected: true, // Prevent users from removing the only way to edit shortcuts
    handler: useCallback(() => {
      if (ctx) {
        ctx.toggleModal()
      } else {
        setInternalIsOpen(prev => !prev)
      }
    }, [ctx]),
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
        addAfterKeyRef.current = null
        setEditingAction(null)
        setEditingKey(null)
        setAddingAction(null)
        setAddAfterKey(null)
        setIsEditingBindingRef.current?.(false)
      },
      [checkConflict, handleBindingChange, handleBindingAdd],
    ),
    onCancel: useCallback(() => {
      editingActionRef.current = null
      editingKeyRef.current = null
      addingActionRef.current = null
      addAfterKeyRef.current = null
      setEditingAction(null)
      setEditingKey(null)
      setAddingAction(null)
      setAddAfterKey(null)
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
      addAfterKeyRef.current = null
      // Also set state for re-render
      setEditingAction(null)
      setEditingKey(null)
      setAddingAction(action)
      setAddAfterKey(null)
      setPendingConflict(null)
      ctx?.setIsEditingBinding(true)
      startRecording()
    },
    [startRecording, ctx?.setIsEditingBinding],
  )

  // Start adding a new binding after a specific existing binding
  const startAddingAfter = useCallback(
    (action: string, afterKey: string) => {
      // Set refs immediately (sync)
      editingActionRef.current = null
      editingKeyRef.current = null
      addingActionRef.current = action
      addAfterKeyRef.current = afterKey
      // Also set state for re-render
      setEditingAction(null)
      setEditingKey(null)
      setAddingAction(action)
      setAddAfterKey(afterKey)
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
    addAfterKeyRef.current = null
    setEditingAction(null)
    setEditingKey(null)
    setAddingAction(null)
    setAddAfterKey(null)
    setPendingConflict(null)
    ctx?.setIsEditingBinding(false)
  }, [cancel, ctx?.setIsEditingBinding])

  // Start editing an arrow group's modifiers
  const startArrowGroupEditing = useCallback((groupId: string) => {
    dbg.recording('arrow group edit start: %s', groupId)
    // Cancel any regular editing first
    cancelEditing()
    arrowGroupEditRef.current = { groupId }
    setArrowGroupEditState({ groupId })
    setArrowGroupActiveKeys(null)
    ctx?.setIsEditingBinding(true)
  }, [cancelEditing, ctx?.setIsEditingBinding])

  const cancelArrowGroupEditing = useCallback(() => {
    dbg.recording('arrow group edit cancel')
    arrowGroupEditRef.current = null
    setArrowGroupEditState(null)
    setArrowGroupActiveKeys(null)
    ctx?.setIsEditingBinding(false)
  }, [ctx?.setIsEditingBinding])

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
      // Check if action is protected (bindings cannot be removed)
      const isProtected = ctx?.registry.actionRegistry?.[actionId]?.protected ?? false

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
          onRemove={editable && showRemove && !isProtected ? () => removeBinding(actionId, key) : undefined}
          onAdd={editable && multipleBindings ? () => startAddingAfter(actionId, key) : undefined}
          pendingKeys={pendingKeys}
          activeKeys={activeKeys}
          timeoutDuration={pendingConflictInfo.hasConflict ? Infinity : sequenceTimeout}
        />
      )
    },
    [editingAction, editingKey, addingAction, conflicts, defaults, editable, startEditingBinding, startAddingAfter, removeBinding, pendingKeys, activeKeys, isRecording, cancel, handleBindingAdd, handleBindingChange, sequenceTimeout, pendingConflictInfo, multipleBindings, ctx?.registry.actionRegistry],
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
      const isAddingThis = addingAction === actionId
      // Standalone "+" only when no bindings exist
      const showStandaloneAdd = editable && keys.length === 0
      return (
        <span className="kbd-action-bindings">
          {keys.map((key) => (
            <Fragment key={key}>
              {renderEditableKbd(actionId, key, true)}
              {/* Inline placeholder after the binding whose "+" was clicked */}
              {isAddingThis && addAfterKey === key && (
                <BindingDisplay
                  binding=""
                  isEditing
                  isPendingConflict={pendingConflictInfo.hasConflict}
                  pendingKeys={pendingKeys}
                  activeKeys={activeKeys}
                  timeoutDuration={pendingConflictInfo.hasConflict ? Infinity : sequenceTimeout}
                />
              )}
            </Fragment>
          ))}
          {/* Placeholder at end when adding from empty state (standalone "+") */}
          {isAddingThis && addAfterKey === null && (
            <BindingDisplay
              binding=""
              isEditing
              isPendingConflict={pendingConflictInfo.hasConflict}
              pendingKeys={pendingKeys}
              activeKeys={activeKeys}
              timeoutDuration={pendingConflictInfo.hasConflict ? Infinity : sequenceTimeout}
            />
          )}
          {showStandaloneAdd && !isAddingThis && renderAddButton(actionId)}
        </span>
      )
    },
    [renderEditableKbd, renderAddButton, editable, addingAction, addAfterKey, pendingKeys, activeKeys, sequenceTimeout, pendingConflictInfo],
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
      // Cancel arrow group editing on outside click
      if (arrowGroupEditState) {
        const target = e.target as HTMLElement
        if (!target.closest('.kbd-arrow-group-binding')) {
          cancelArrowGroupEditing()
        }
        return
      }
      if (!editingAction && !addingAction) return
      const target = e.target as HTMLElement
      // If click is on or inside an editing kbd, don't cancel
      if (target.closest('.kbd-kbd.editing')) return
      // If click is on another editable kbd, don't cancel (it will start its own editing)
      if (target.closest('.kbd-kbd.editable')) return
      // If click is on add button, don't cancel (it will start its own editing)
      if (target.closest('.kbd-add-btn')) return
      if (target.closest('.kbd-add-inline-btn')) return
      cancelEditing()
    },
    [editingAction, addingAction, cancelEditing, arrowGroupEditState, cancelArrowGroupEditing],
  )

  // Organize shortcuts into groups (include actionRegistry to show actions with no bindings)
  // Default showUnbound to true in editable mode, false otherwise
  const effectiveShowUnbound = showUnbound ?? editable
  const shortcutGroups = useMemo(
    () => organizeShortcuts(keymap, labels, descriptions, groupNames, groupOrder, ctx?.registry.actionRegistry, effectiveShowUnbound, ctx?.modes, ctx?.activeMode, ctx?.registry.getEffectiveMode),
    [keymap, labels, descriptions, groupNames, groupOrder, ctx?.registry.actionRegistry, effectiveShowUnbound, ctx?.modes, ctx?.activeMode, ctx?.registry.getEffectiveMode],
  )

  // Arrow group modifier-only recording: listen for keydown/keyup when editing
  useEffect(() => {
    if (!arrowGroupEditState) return

    const handleKeyDown = (e: KeyboardEvent) => {
      e.preventDefault()
      e.stopPropagation()

      // Escape cancels
      if (e.key === 'Escape') {
        cancelArrowGroupEditing()
        return
      }

      // Arrow key or Enter confirms with currently-held modifiers
      const isArrow = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)
      if (isArrow || e.key === 'Enter') {
        const currentRef = arrowGroupEditRef.current
        if (!currentRef) return
        dbg.recording('arrow group confirm: %s (key: %s)', currentRef.groupId, e.key)

        // Build modifier prefix from held keys
        const mods: string[] = []
        if (e.ctrlKey) mods.push('ctrl')
        if (e.altKey) mods.push('alt')
        if (e.shiftKey) mods.push('shift')
        if (e.metaKey) mods.push('meta')
        const modPrefix = mods.length > 0 ? mods.join('+') + '+' : ''

        // Find the arrow group entry in current shortcutGroups
        for (const group of shortcutGroups) {
          for (const entry of group.shortcuts) {
            if (entry.type === 'arrowGroup' && entry.groupId === currentRef.groupId) {
              // Update all 4 direction bindings
              const arrowKeys: Record<Direction, string> = {
                left: 'arrowleft', right: 'arrowright',
                up: 'arrowup', down: 'arrowdown',
              }
              for (const dir of DIRECTION_ORDER) {
                const actionId = entry.actionIds[dir]
                const oldArrowBinding = `${entry.modifierPrefix}${arrowKeys[dir]}`
                const newArrowBinding = `${modPrefix}${arrowKeys[dir]}`
                if (oldArrowBinding !== newArrowBinding) {
                  handleBindingChange?.(actionId, oldArrowBinding, newArrowBinding)
                }
              }
              break
            }
          }
        }

        cancelArrowGroupEditing()
        return
      }

      // Non-modifier, non-arrow, non-Enter key cancels
      if (!['Control', 'Alt', 'Shift', 'Meta'].includes(e.key)) {
        cancelArrowGroupEditing()
        return
      }

      // Modifier key: update display
      dbg.recording('arrow group modifier update: ctrl=%s alt=%s shift=%s meta=%s', e.ctrlKey, e.altKey, e.shiftKey, e.metaKey)
      setArrowGroupActiveKeys({
        key: '',
        modifiers: {
          ctrl: e.ctrlKey,
          alt: e.altKey,
          shift: e.shiftKey,
          meta: e.metaKey,
        },
      })
    }

    const handleKeyUp = (e: KeyboardEvent) => {
      e.preventDefault()
      e.stopPropagation()
      // Update modifier display on keyup
      if (['Control', 'Alt', 'Shift', 'Meta'].includes(e.key)) {
        setArrowGroupActiveKeys({
          key: '',
          modifiers: {
            ctrl: e.ctrlKey,
            alt: e.altKey,
            shift: e.shiftKey,
            meta: e.metaKey,
          },
        })
      }
    }

    window.addEventListener('keydown', handleKeyDown, true)
    window.addEventListener('keyup', handleKeyUp, true)
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true)
      window.removeEventListener('keyup', handleKeyUp, true)
    }
  }, [arrowGroupEditState, shortcutGroups, handleBindingChange, cancelArrowGroupEditing])

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

  // Render a single shortcut entry (action, arrow group, or action pair)
  const renderShortcutEntry = (entry: ShortcutEntry): ReactNode => {
    if (entry.type === 'arrowGroup') {
      return (
        <ArrowGroupRow
          key={entry.groupId}
          entry={entry}
          editable={editable}
          TooltipComponent={TooltipComponentProp}
          onStartEditing={startArrowGroupEditing}
          renderExtraBindings={(actionId, bindings) => (
            <>
              {bindings.map(key => renderEditableKbd(actionId, key, true))}
            </>
          )}
          arrowGroupEditState={arrowGroupEditState}
          arrowGroupActiveKeys={arrowGroupActiveKeys}
          conflicts={conflicts}
          ArrowIconComponent={ArrowIconComponent}
        />
      )
    }
    if (entry.type === 'actionPair') {
      return (
        <ActionPairRow
          key={entry.pairId}
          entry={entry}
          renderCell={renderCell}
          TooltipComponent={TooltipComponentProp}
        />
      )
    }
    if (entry.type === 'actionTriplet') {
      return (
        <ActionTripletRow
          key={entry.tripletId}
          entry={entry}
          renderCell={renderCell}
          TooltipComponent={TooltipComponentProp}
        />
      )
    }
    const { actionId, label, description, bindings } = entry
    return (
      <div key={actionId} className="kbd-action">
        {description ? (
          <TooltipComponentProp title={description}>
            <span className="kbd-action-label">
              {label}
            </span>
          </TooltipComponentProp>
        ) : (
          <span className="kbd-action-label">
            {label}
          </span>
        )}
        {renderCell(actionId, bindings)}
      </div>
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
    return group.shortcuts.map(renderShortcutEntry)
  }

  // Default render
  return (
    <TooltipContext.Provider value={TooltipComponentProp}>
      <div className={backdropClassName} onClick={handleBackdropClick}>
        <div className={modalClassName} role="dialog" aria-modal="true" aria-label="Keyboard shortcuts" onClick={handleModalClick}>
          <div className="kbd-modal-header">
            <h2 className="kbd-modal-title">{title}</h2>
            <button className="kbd-modal-close" onClick={close} aria-label="Close">
              ×
            </button>
          </div>

          {hint && <p className="kbd-hint">{hint}</p>}

          {importError && (
            <div className="kbd-import-error">
              <span>{importError}</span>
              <button onClick={() => setImportError(null)} aria-label="Dismiss error">×</button>
            </div>
          )}

          {shortcutGroups.filter(g => !g.mode).map((group) => (
            <div
              key={group.name}
              className="kbd-group"
            >
              <h3 className="kbd-group-title">
                {group.name}
              </h3>
              {renderGroup(group)}
            </div>
          ))}

          {/* Modes section: editable mode groups with add/remove */}
          {ctx && ctx.modes.size > 0 && (() => {
            const modeGroups = shortcutGroups.filter(g => g.mode)
            if (modeGroups.length === 0) return null
            return (
              <ModesSection
                modeGroups={modeGroups}
                editable={editable}
                registry={ctx.registry}
                actionRegistry={ctx.registry.actionRegistry}
                renderShortcutEntry={renderShortcutEntry}
              />
            )
          })()}

          {/* Footer with Export/Import/Reset */}
          {editable && (handleExport || handleImport || handleReset) && (
            footerContent !== null && (
              footerContent ? (
                footerContent({
                  exportBindings: hasCustomizations ? handleExport : undefined,
                  importBindings: handleImport ? () => importInputRef.current?.click() : undefined,
                  resetBindings: hasCustomizations ? reset : undefined,
                  importInputRef,
                  handleFileChange,
                })
              ) : (
                <div className="kbd-modal-footer">
                  {handleExport && (
                    <TooltipComponentProp title={hasCustomizations ? "Export bindings" : "No customizations to export"}>
                      <button
                        className="kbd-footer-btn"
                        onClick={handleExport}
                        disabled={!hasCustomizations}
                      >
                        <DownloadIcon />
                        <span>Export</span>
                      </button>
                    </TooltipComponentProp>
                  )}
                  {handleImport && (
                    <TooltipComponentProp title="Import bindings">
                      <button className="kbd-footer-btn" onClick={() => importInputRef.current?.click()}>
                        <UploadIcon />
                        <span>Import</span>
                      </button>
                    </TooltipComponentProp>
                  )}
                  {handleReset && (
                    <TooltipComponentProp title={hasCustomizations ? "Reset to defaults" : "No customizations to reset"}>
                      <button
                        className="kbd-footer-btn"
                        onClick={reset}
                        disabled={!hasCustomizations}
                      >
                        <ResetIcon />
                        <span>Reset</span>
                      </button>
                    </TooltipComponentProp>
                  )}
                </div>
              )
            )
          )}

          {/* Hidden file input for import */}
          {handleImport && (
            <input
              type="file"
              accept=".json,application/json"
              ref={importInputRef}
              onChange={handleFileChange}
              style={{ display: 'none' }}
            />
          )}

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
