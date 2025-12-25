/**
 * Represents a single key press (possibly with modifiers)
 */
export interface KeyCombination {
  /** The main key (lowercase, e.g., 'k', 'enter', 'arrowup') */
  key: string
  /** Modifier keys pressed */
  modifiers: {
    ctrl: boolean
    alt: boolean
    shift: boolean
    meta: boolean
  }
}

/**
 * Represents a hotkey - either a single key or a sequence of keys.
 * Single key: [{ key: 'k', modifiers: {...} }]
 * Sequence: [{ key: '2', ... }, { key: 'w', ... }]
 */
export type HotkeySequence = KeyCombination[]

/**
 * Platform-aware display format for a key combination or sequence
 */
export interface KeyCombinationDisplay {
  /** Human-readable string (e.g., "⌘⇧K" on Mac, "Ctrl+Shift+K" elsewhere, "2 W" for sequence) */
  display: string
  /** Canonical ID for storage/comparison (e.g., "ctrl+shift+k", "2 w" for sequence) */
  id: string
  /** Whether this is a sequence (multiple keys pressed in order) */
  isSequence: boolean
}

/**
 * Result from the useRecordHotkey hook
 */
export interface RecordHotkeyResult {
  /** Whether currently recording */
  isRecording: boolean
  /** Start recording - returns cancel function */
  startRecording: () => () => void
  /** Cancel recording */
  cancel: () => void
  /** Commit pending keys immediately (if any), otherwise cancel */
  commit: () => void
  /** The captured sequence (null until complete) */
  sequence: HotkeySequence | null
  /** Display strings for the sequence */
  display: KeyCombinationDisplay | null
  /** Keys captured so far during recording (for live UI feedback) */
  pendingKeys: HotkeySequence
  /** The key currently being held (for live UI feedback during recording) */
  activeKeys: KeyCombination | null
  /**
   * @deprecated Use `sequence` instead
   */
  combination: KeyCombination | null
}

/**
 * Options for useRecordHotkey
 */
export interface RecordHotkeyOptions {
  /** Called when a sequence is captured (timeout or Enter) */
  onCapture?: (sequence: HotkeySequence, display: KeyCombinationDisplay) => void
  /** Called when recording is cancelled */
  onCancel?: () => void
  /** Called when Tab is pressed during recording (for advancing to next field) */
  onTab?: () => void
  /** Called when Shift+Tab is pressed during recording (for going to previous field) */
  onShiftTab?: () => void
  /** Prevent default on captured keys (default: true) */
  preventDefault?: boolean
  /** Timeout in ms before sequence is submitted (default: 1000) */
  sequenceTimeout?: number
}

/**
 * Definition of an action that can be triggered by hotkeys or omnibar
 */
export interface ActionDefinition {
  /** Display label for the action */
  label: string
  /** Longer description (shown in omnibar, tooltips) */
  description?: string
  /** Category for grouping (e.g., "Metrics", "Time Range") */
  category?: string
  /** Additional search keywords */
  keywords?: string[]
  /** Icon identifier (user provides rendering) */
  icon?: string
  /** Whether the action is currently enabled (default: true) */
  enabled?: boolean
}

/**
 * Registry of all available actions
 */
export type ActionRegistry = Record<string, ActionDefinition>

/**
 * An action with its current keybinding(s) and search match info
 */
export interface ActionSearchResult {
  /** Action ID */
  id: string
  /** Action definition */
  action: ActionDefinition
  /** Current keybindings for this action */
  bindings: string[]
  /** Fuzzy match score (higher = better match) */
  score: number
  /** Matched ranges in label for highlighting */
  labelMatches: Array<[number, number]>
}

/**
 * A possible completion for a partially-typed sequence
 */
export interface SequenceCompletion {
  /** The next key(s) needed to complete this sequence */
  nextKeys: string
  /** The full hotkey string */
  fullSequence: string
  /** Display format for the full sequence */
  display: KeyCombinationDisplay
  /** Actions triggered by this sequence */
  actions: string[]
}
