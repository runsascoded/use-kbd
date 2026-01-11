import { ReactNode, useCallback, useMemo, useState } from 'react'
import { useRecordHotkey } from './useRecordHotkey'
import { findConflicts, formatCombination, parseHotkeyString } from './utils'
import type { HotkeySequence, KeyCombination, KeyCombinationDisplay } from './types'
import type { HotkeyMap } from './useHotkeys'

export interface KeybindingEditorProps {
  /** Current keymap */
  keymap: HotkeyMap
  /** Default keymap (for reset functionality) */
  defaults: HotkeyMap
  /** Descriptions for actions */
  descriptions?: Record<string, string>
  /** Called when a binding changes */
  onChange: (action: string, key: string) => void
  /** Called when reset is requested */
  onReset?: () => void
  /** CSS class for the container */
  className?: string
  /** Custom render function */
  children?: (props: KeybindingEditorRenderProps) => ReactNode
}

export interface KeybindingEditorRenderProps {
  bindings: BindingInfo[]
  editingAction: string | null
  /** Keys already pressed and released (waiting for timeout or more keys) */
  pendingKeys: HotkeySequence
  /** Keys currently being held down */
  activeKeys: KeyCombination | null
  startEditing: (action: string) => void
  cancelEditing: () => void
  reset: () => void
  conflicts: Map<string, string[]>
}

export interface BindingInfo {
  action: string
  key: string
  display: KeyCombinationDisplay
  description: string
  isDefault: boolean
  hasConflict: boolean
}

/**
 * Build action -> key lookup from keymap
 */
function buildActionMap(keymap: HotkeyMap): Map<string, string> {
  const map = new Map<string, string>()
  for (const [key, actionOrActions] of Object.entries(keymap)) {
    const actions = Array.isArray(actionOrActions) ? actionOrActions : [actionOrActions]
    for (const action of actions) {
      map.set(action, key)
    }
  }
  return map
}

/**
 * UI component for editing keybindings.
 *
 * @example
 * ```tsx
 * <KeybindingEditor
 *   keymap={keymap}
 *   defaults={DEFAULT_KEYMAP}
 *   descriptions={{ save: 'Save document' }}
 *   onChange={(action, key) => setBinding(action, key)}
 *   onReset={() => reset()}
 * />
 * ```
 */
export function KeybindingEditor({
  keymap,
  defaults,
  descriptions,
  onChange,
  onReset,
  className,
  children,
}: KeybindingEditorProps) {
  const [editingAction, setEditingAction] = useState<string | null>(null)

  const actionMap = useMemo(() => buildActionMap(keymap), [keymap])
  const defaultActionMap = useMemo(() => buildActionMap(defaults), [defaults])
  const conflicts = useMemo(() => findConflicts(keymap), [keymap])

  const { isRecording, startRecording, cancel, pendingKeys, activeKeys } = useRecordHotkey({
    onCapture: useCallback(
      (_sequence: HotkeySequence, display: KeyCombinationDisplay) => {
        if (editingAction) {
          onChange(editingAction, display.id)
          setEditingAction(null)
        }
      },
      [editingAction, onChange],
    ),
    onCancel: useCallback(() => {
      setEditingAction(null)
    }, []),
  })

  const startEditing = useCallback(
    (action: string) => {
      setEditingAction(action)
      startRecording()
    },
    [startRecording],
  )

  const cancelEditing = useCallback(() => {
    cancel()
    setEditingAction(null)
  }, [cancel])

  const reset = useCallback(() => {
    onReset?.()
  }, [onReset])

  // Format keys for display during recording
  // Shows pendingKeys (released keys) + activeKeys (currently held)
  const getRecordingDisplay = () => {
    // Nothing pressed yet
    if (pendingKeys.length === 0 && (!activeKeys || !activeKeys.key)) {
      return 'Press keys...'
    }

    // Format pending keys (already pressed and released)
    let display = pendingKeys.length > 0 ? formatCombination(pendingKeys).display : ''

    // Add currently held keys
    if (activeKeys && activeKeys.key) {
      if (display) display += ' → '
      display += formatCombination([activeKeys]).display
    }

    // Ellipsis indicates we're waiting for timeout or more keys
    return display + '...'
  }

  // Build binding info for all actions
  const bindings: BindingInfo[] = useMemo(() => {
    const allActions = new Set([...actionMap.keys(), ...defaultActionMap.keys()])

    return Array.from(allActions).map((action) => {
      const key = actionMap.get(action) ?? defaultActionMap.get(action) ?? ''
      const defaultKey = defaultActionMap.get(action) ?? ''
      const combo = parseHotkeyString(key)
      const display = formatCombination(combo)
      const conflictActions = conflicts.get(key)

      return {
        action,
        key,
        display,
        description: descriptions?.[action] ?? action,
        isDefault: key === defaultKey,
        hasConflict: conflictActions !== undefined && conflictActions.length > 1,
      }
    }).sort((a, b) => a.action.localeCompare(b.action))
  }, [actionMap, defaultActionMap, descriptions, conflicts])

  // Custom render
  if (children) {
    return (
      <>
        {children({
          bindings,
          editingAction,
          pendingKeys,
          activeKeys,
          startEditing,
          cancelEditing,
          reset,
          conflicts,
        })}
      </>
    )
  }

  // Default render
  return (
    <div className={className}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h3 style={{ margin: 0 }}>Keybindings</h3>
        {onReset && (
          <button
            onClick={reset}
            style={{
              padding: '6px 12px',
              backgroundColor: '#f5f5f5',
              border: '1px solid #ddd',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            Reset to defaults
          </button>
        )}
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left', padding: '8px', borderBottom: '2px solid #ddd' }}>Action</th>
            <th style={{ textAlign: 'left', padding: '8px', borderBottom: '2px solid #ddd' }}>Keybinding</th>
            <th style={{ width: '80px', padding: '8px', borderBottom: '2px solid #ddd' }}></th>
          </tr>
        </thead>
        <tbody>
          {bindings.map(({ action, display, description, isDefault, hasConflict }) => {
            const isEditing = editingAction === action

            return (
              <tr key={action} style={{ backgroundColor: hasConflict ? '#fff3cd' : undefined }}>
                <td style={{ padding: '8px', borderBottom: '1px solid #eee' }}>
                  {description}
                  {!isDefault && (
                    <span style={{ marginLeft: '8px', fontSize: '0.75rem', color: '#666' }}>(modified)</span>
                  )}
                </td>
                <td style={{ padding: '8px', borderBottom: '1px solid #eee' }}>
                  {isEditing ? (
                    <kbd
                      style={{
                        backgroundColor: '#e3f2fd',
                        padding: '4px 8px',
                        borderRadius: '4px',
                        border: '2px solid #2196f3',
                        fontFamily: 'monospace',
                      }}
                    >
                      {getRecordingDisplay()}
                    </kbd>
                  ) : (
                    <kbd
                      style={{
                        backgroundColor: '#f5f5f5',
                        padding: '4px 8px',
                        borderRadius: '4px',
                        border: '1px solid #ddd',
                        fontFamily: 'monospace',
                      }}
                    >
                      {display.display}
                    </kbd>
                  )}
                  {hasConflict && !isEditing && (
                    <span style={{ marginLeft: '8px', color: '#856404', fontSize: '0.75rem' }}>⚠ Conflict</span>
                  )}
                </td>
                <td style={{ padding: '8px', borderBottom: '1px solid #eee', textAlign: 'center' }}>
                  {isEditing ? (
                    <button
                      onClick={cancelEditing}
                      style={{
                        padding: '4px 8px',
                        backgroundColor: '#f5f5f5',
                        border: '1px solid #ddd',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '0.875rem',
                      }}
                    >
                      Cancel
                    </button>
                  ) : (
                    <button
                      onClick={() => startEditing(action)}
                      disabled={isRecording}
                      style={{
                        padding: '4px 8px',
                        backgroundColor: '#f5f5f5',
                        border: '1px solid #ddd',
                        borderRadius: '4px',
                        cursor: isRecording ? 'not-allowed' : 'pointer',
                        fontSize: '0.875rem',
                        opacity: isRecording ? 0.5 : 1,
                      }}
                    >
                      Edit
                    </button>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
