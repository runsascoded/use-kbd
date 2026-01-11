/**
 * Modifier keys state
 */
export interface Modifiers {
  ctrl: boolean
  alt: boolean
  shift: boolean
  meta: boolean
}

/**
 * Represents a single key press (possibly with modifiers)
 */
export interface KeyCombination {
  /** The main key (lowercase, e.g., 'k', 'enter', 'arrowup') */
  key: string
  /** Modifier keys pressed */
  modifiers: Modifiers
}

/**
 * Represents a hotkey - either a single key or a sequence of keys.
 * Single key: [{ key: 'k', modifiers: {...} }]
 * Sequence: [{ key: '2', ... }, { key: 'w', ... }]
 */
export type HotkeySequence = KeyCombination[]

// ============================================================================
// New sequence types with digit placeholder support
// ============================================================================

/**
 * A single element in a key sequence (sum type).
 * - 'key': exact key match (with optional modifiers)
 * - 'digit': matches any single digit 0-9 (\d)
 * - 'digits': matches one or more digits (\d+)
 */
export type SeqElem =
  | { type: 'key'; key: string; modifiers: Modifiers }
  | { type: 'digit' }
  | { type: 'digits' }

/**
 * A key sequence pattern (array of sequence elements)
 */
export type KeySeq = SeqElem[]

/**
 * Sequence element with match state (for tracking during input).
 * - 'key': has `matched` flag
 * - 'digit': has captured `value`
 * - 'digits': has captured `value` or in-progress `partial` string
 */
export type SeqElemState =
  | { type: 'key'; key: string; modifiers: Modifiers; matched?: true }
  | { type: 'digit'; value?: number }
  | { type: 'digits'; value?: number; partial?: string }

/**
 * Sequence match state - tracks progress through a sequence with captures
 */
export type SeqMatchState = SeqElemState[]

/**
 * Extract captured values from a completed sequence match
 */
export function extractCaptures(state: SeqMatchState): number[] {
  return state
    .filter((e): e is { type: 'digit'; value: number } | { type: 'digits'; value: number } =>
      (e.type === 'digit' || e.type === 'digits') && e.value !== undefined
    )
    .map(e => e.value)
}

/**
 * Check if a SeqElem is a digit placeholder
 */
export function isDigitPlaceholder(elem: SeqElem): elem is { type: 'digit' } | { type: 'digits' } {
  return elem.type === 'digit' || elem.type === 'digits'
}

/**
 * Count digit placeholders in a sequence
 */
export function countPlaceholders(seq: KeySeq): number {
  return seq.filter(isDigitPlaceholder).length
}

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
  /** The timeout duration for sequences (ms) */
  sequenceTimeout: number
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
  /** Timeout in ms before sequence is submitted (default: Infinity, no timeout).
   * Set to 0 for immediate submit (no sequences - first key press is captured).
   * Set to a finite number for auto-submit after that duration. */
  sequenceTimeout?: number
  /** When true, pause the auto-submit timeout (useful for conflict warnings). Default: false */
  pauseTimeout?: boolean
}

/**
 * Definition of an action that can be triggered by hotkeys or omnibar
 */
export interface ActionDefinition {
  /** Display label for the action */
  label: string
  /** Longer description (shown in omnibar, tooltips) */
  description?: string
  /** Group for organizing in shortcuts modal (e.g., "Metrics", "Time Range") */
  group?: string
  /** Additional search keywords */
  keywords?: string[]
  /** Icon identifier (user provides rendering) */
  icon?: string
  /** Whether the action is currently enabled (default: true) */
  enabled?: boolean
  /** Hide from ShortcutsModal (still searchable in omnibar) */
  hideFromModal?: boolean
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
  /** The next key(s) needed to complete this sequence (empty string if complete) */
  nextKeys: string
  /** Structured next keys for rendering with icons (undefined if complete) */
  nextKeySeq?: KeySeq
  /** The full hotkey string */
  fullSequence: string
  /** Display format for the full sequence */
  display: KeyCombinationDisplay
  /** Actions triggered by this sequence */
  actions: string[]
  /** Whether the sequence is already complete (can be executed now with Enter) */
  isComplete: boolean
  /** Captured digit values from \d and \d+ placeholders */
  captures?: number[]
}

// ============================================================================
// Remote omnibar endpoint types
// ============================================================================

/**
 * Base fields for all omnibar entries
 */
export interface OmnibarEntryBase {
  /** Unique identifier for this entry */
  id: string
  /** Display label */
  label: string
  /** Optional description (shown below label) */
  description?: string
  /** Group name for organizing results */
  group?: string
  /** Additional search keywords */
  keywords?: string[]
}

/**
 * Omnibar entry that navigates to a URL when selected
 */
export interface OmnibarLinkEntry extends OmnibarEntryBase {
  /** URL to navigate to */
  href: string
  handler?: never
}

/**
 * Omnibar entry that executes a handler when selected
 */
export interface OmnibarActionEntry extends OmnibarEntryBase {
  /** Handler to execute (can close over data) */
  handler: () => void
  href?: never
}

/**
 * An entry returned from a remote omnibar endpoint.
 * Must have either `href` (for navigation) or `handler` (for custom action).
 */
export type OmnibarEntry = OmnibarLinkEntry | OmnibarActionEntry

/**
 * Pagination parameters passed to endpoint fetch function
 */
export interface EndpointPagination {
  /** Starting offset (0-indexed) */
  offset: number
  /** Maximum number of entries to return */
  limit: number
}

/**
 * Response from an endpoint fetch, including pagination metadata
 */
export interface EndpointResponse {
  /** Entries for this page */
  entries: OmnibarEntry[]
  /** Total count if known (enables "X of Y" display) */
  total?: number
  /** Whether more results exist (fallback when total is expensive to compute) */
  hasMore?: boolean
}

/**
 * Pagination mode for an endpoint
 * - 'scroll': Fetch more when scrolling near bottom (IntersectionObserver)
 * - 'buttons': Show pagination controls at bottom of endpoint's group
 * - 'none': Single page, no pagination (default)
 */
export type EndpointPaginationMode = 'scroll' | 'buttons' | 'none'

/**
 * Configuration for a remote omnibar endpoint
 */
export interface OmnibarEndpointConfig {
  /** Fetch function that returns entries for a query */
  fetch: (query: string, signal: AbortSignal, pagination: EndpointPagination) => Promise<EndpointResponse>
  /** Default group for entries from this endpoint */
  group?: string
  /** Priority for result ordering (higher = shown first, default: 0, local actions: 100) */
  priority?: number
  /** Minimum query length before fetching (default: 2) */
  minQueryLength?: number
  /** Whether this endpoint is enabled (default: true) */
  enabled?: boolean
  /** Number of results per page (default: 10) */
  pageSize?: number
  /** Pagination mode (default: 'none') */
  pagination?: EndpointPaginationMode
}
