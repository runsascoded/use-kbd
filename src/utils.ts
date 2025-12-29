import { max } from '@rdub/base'
import type { KeyCombination, KeyCombinationDisplay, HotkeySequence } from './types'

/**
 * Detect if running on macOS
 */
export function isMac(): boolean {
  if (typeof navigator === 'undefined') return false
  return /Mac|iPod|iPhone|iPad/.test(navigator.platform)
}

/**
 * Normalize a key name to a canonical form
 */
export function normalizeKey(key: string): string {
  // Handle special keys
  const keyMap: Record<string, string> = {
    ' ': 'space',
    'Escape': 'escape',
    'Enter': 'enter',
    'Tab': 'tab',
    'Backspace': 'backspace',
    'Delete': 'delete',
    'ArrowUp': 'arrowup',
    'ArrowDown': 'arrowdown',
    'ArrowLeft': 'arrowleft',
    'ArrowRight': 'arrowright',
    'Home': 'home',
    'End': 'end',
    'PageUp': 'pageup',
    'PageDown': 'pagedown',
  }

  if (key in keyMap) {
    return keyMap[key]
  }

  // Single characters to lowercase
  if (key.length === 1) {
    return key.toLowerCase()
  }

  // Function keys (F1-F12)
  if (/^F\d{1,2}$/.test(key)) {
    return key.toLowerCase()
  }

  return key.toLowerCase()
}

/**
 * Format a key for display (platform-aware)
 */
export function formatKeyForDisplay(key: string): string {
  const displayMap: Record<string, string> = {
    'space': 'Space',
    'escape': 'Esc',
    'enter': '↵',
    'tab': 'Tab',
    'backspace': '⌫',
    'delete': 'Del',
    'arrowup': '↑',
    'arrowdown': '↓',
    'arrowleft': '←',
    'arrowright': '→',
    'home': 'Home',
    'end': 'End',
    'pageup': 'PgUp',
    'pagedown': 'PgDn',
  }

  if (key in displayMap) {
    return displayMap[key]
  }

  // Function keys
  if (/^f\d{1,2}$/.test(key)) {
    return key.toUpperCase()
  }

  // Single letter - uppercase for display
  if (key.length === 1) {
    return key.toUpperCase()
  }

  return key
}

/**
 * Format a single KeyCombination (internal helper)
 */
function formatSingleCombination(combo: KeyCombination): { display: string; id: string } {
  const mac = isMac()
  const parts: string[] = []
  const idParts: string[] = []

  // Order: Ctrl/Cmd, Alt/Option, Shift, Key
  if (combo.modifiers.ctrl) {
    parts.push(mac ? '⌃' : 'Ctrl')
    idParts.push('ctrl')
  }
  if (combo.modifiers.meta) {
    parts.push(mac ? '⌘' : 'Win')
    idParts.push('meta')
  }
  if (combo.modifiers.alt) {
    parts.push(mac ? '⌥' : 'Alt')
    idParts.push('alt')
  }
  if (combo.modifiers.shift) {
    parts.push(mac ? '⇧' : 'Shift')
    idParts.push('shift')
  }

  parts.push(formatKeyForDisplay(combo.key))
  idParts.push(combo.key)

  return {
    display: mac ? parts.join('') : parts.join('+'),
    id: idParts.join('+'),
  }
}

/**
 * Convert a KeyCombination or HotkeySequence to display format
 */
export function formatCombination(combo: KeyCombination): KeyCombinationDisplay
export function formatCombination(sequence: HotkeySequence): KeyCombinationDisplay
export function formatCombination(input: KeyCombination | HotkeySequence): KeyCombinationDisplay {
  // Handle array (sequence)
  if (Array.isArray(input)) {
    if (input.length === 0) {
      return { display: '', id: '', isSequence: false }
    }
    if (input.length === 1) {
      const single = formatSingleCombination(input[0])
      return { ...single, isSequence: false }
    }
    // Multiple keys = sequence
    const formatted = input.map(formatSingleCombination)
    return {
      display: formatted.map(f => f.display).join(' '),
      id: formatted.map(f => f.id).join(' '),
      isSequence: true,
    }
  }

  // Handle single KeyCombination
  const single = formatSingleCombination(input)
  return { ...single, isSequence: false }
}

/**
 * Format a binding string for display.
 * Takes a binding like "meta+k" or "2 w" and returns a display string like "⌘K" or "2 W".
 *
 * @example
 * formatBinding('meta+k') // "⌘K" on Mac, "Ctrl+K" on Windows
 * formatBinding('2 w')    // "2 W"
 * formatBinding('?')      // "?"
 */
export function formatBinding(binding: string): string {
  const parsed = parseHotkeyString(binding)
  return formatCombination(parsed).display
}

/**
 * Check if a key is a modifier key
 */
export function isModifierKey(key: string): boolean {
  return ['Control', 'Alt', 'Shift', 'Meta'].includes(key)
}

/**
 * Characters that require shift to type (US keyboard layout)
 * When matching these keys, we should ignore shiftKey mismatch
 */
const SHIFTED_CHARS = new Set([
  '~', '!', '@', '#', '$', '%', '^', '&', '*', '(', ')',
  '_', '+', '{', '}', '|', ':', '"', '<', '>', '?',
])

/**
 * Check if a key is a shifted character (requires shift to type)
 */
export function isShiftedChar(key: string): boolean {
  return SHIFTED_CHARS.has(key)
}

/**
 * Check if a hotkey string represents a sequence (space-separated keys)
 */
export function isSequence(hotkeyStr: string): boolean {
  // A sequence has spaces that aren't inside a modifier combo
  // "2 w" is a sequence, "ctrl+k" is not, "ctrl+k ctrl+c" is a sequence
  return hotkeyStr.includes(' ')
}

/**
 * Parse a single combination string (e.g., "ctrl+k") to KeyCombination.
 * Supports uppercase letters as shorthand for shift+letter (e.g., "J" → shift+j)
 */
function parseSingleCombination(str: string): KeyCombination {
  // Single uppercase letter (A-Z) is shorthand for shift+<lowercase>
  if (str.length === 1 && /^[A-Z]$/.test(str)) {
    return {
      key: str.toLowerCase(),
      modifiers: { ctrl: false, alt: false, shift: true, meta: false },
    }
  }

  const parts = str.toLowerCase().split('+')
  const key = parts[parts.length - 1]

  return {
    key,
    modifiers: {
      ctrl: parts.includes('ctrl') || parts.includes('control'),
      alt: parts.includes('alt') || parts.includes('option'),
      shift: parts.includes('shift'),
      meta: parts.includes('meta') || parts.includes('cmd') || parts.includes('command'),
    },
  }
}

/**
 * Parse a hotkey string to a HotkeySequence.
 * Handles both single keys ("ctrl+k") and sequences ("2 w", "ctrl+k ctrl+c")
 */
export function parseHotkeyString(hotkeyStr: string): HotkeySequence {
  if (!hotkeyStr.trim()) return []

  // Split by space to get sequence parts
  const parts = hotkeyStr.trim().split(/\s+/)
  return parts.map(parseSingleCombination)
}

/**
 * Parse a combination ID back to a KeyCombination (single key only)
 * @deprecated Use parseHotkeyString for sequence support
 */
export function parseCombinationId(id: string): KeyCombination {
  // For backwards compatibility, if it's a sequence, return first key
  const sequence = parseHotkeyString(id)
  if (sequence.length === 0) {
    return { key: '', modifiers: { ctrl: false, alt: false, shift: false, meta: false } }
  }
  return sequence[0]
}

/**
 * Conflict detection result
 */
export interface KeyConflict {
  /** The key combination that has a conflict */
  key: string
  /** Actions bound to this key */
  actions: string[]
  /** Type of conflict */
  type: 'duplicate' | 'prefix'
}

/**
 * Check if sequence A is a prefix of sequence B
 */
function isPrefix(a: HotkeySequence, b: HotkeySequence): boolean {
  if (a.length >= b.length) return false
  for (let i = 0; i < a.length; i++) {
    if (!combinationsEqual(a[i], b[i])) return false
  }
  return true
}

/**
 * Check if two KeyCombinations are equal
 */
function combinationsEqual(a: KeyCombination, b: KeyCombination): boolean {
  return (
    a.key === b.key &&
    a.modifiers.ctrl === b.modifiers.ctrl &&
    a.modifiers.alt === b.modifiers.alt &&
    a.modifiers.shift === b.modifiers.shift &&
    a.modifiers.meta === b.modifiers.meta
  )
}

/**
 * Check if two HotkeySequences are equal
 */
function sequencesEqual(a: HotkeySequence, b: HotkeySequence): boolean {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) {
    if (!combinationsEqual(a[i], b[i])) return false
  }
  return true
}

/**
 * Find conflicts in a keymap.
 * Detects:
 * - Duplicate: multiple actions bound to the exact same key/sequence
 * - Prefix: one hotkey is a prefix of another (e.g., "2" and "2 w")
 *
 * @param keymap - HotkeyMap to check for conflicts
 * @returns Map of key -> actions[] for keys with conflicts
 */
export function findConflicts(keymap: Record<string, string | string[]>): Map<string, string[]> {
  const conflicts = new Map<string, string[]>()

  // Parse all hotkeys into sequences for comparison
  const entries = Object.entries(keymap).map(([key, actionOrActions]) => ({
    key,
    sequence: parseHotkeyString(key),
    actions: Array.isArray(actionOrActions) ? actionOrActions : [actionOrActions],
  }))

  // Check for duplicate keys (multiple actions on same key)
  const keyToActions = new Map<string, string[]>()
  for (const { key, actions } of entries) {
    const existing = keyToActions.get(key) ?? []
    keyToActions.set(key, [...existing, ...actions])
  }
  for (const [key, actions] of keyToActions) {
    if (actions.length > 1) {
      conflicts.set(key, actions)
    }
  }

  // Check for prefix conflicts
  for (let i = 0; i < entries.length; i++) {
    for (let j = i + 1; j < entries.length; j++) {
      const a = entries[i]
      const b = entries[j]

      // Check if a is prefix of b or b is prefix of a
      if (isPrefix(a.sequence, b.sequence)) {
        // a is a prefix of b - both are conflicted
        const existingA = conflicts.get(a.key) ?? []
        if (!existingA.includes(`prefix of: ${b.key}`)) {
          conflicts.set(a.key, [...existingA, ...a.actions, `prefix of: ${b.key}`])
        }
        const existingB = conflicts.get(b.key) ?? []
        if (!existingB.includes(`has prefix: ${a.key}`)) {
          conflicts.set(b.key, [...existingB, ...b.actions, `has prefix: ${a.key}`])
        }
      } else if (isPrefix(b.sequence, a.sequence)) {
        // b is a prefix of a
        const existingB = conflicts.get(b.key) ?? []
        if (!existingB.includes(`prefix of: ${a.key}`)) {
          conflicts.set(b.key, [...existingB, ...b.actions, `prefix of: ${a.key}`])
        }
        const existingA = conflicts.get(a.key) ?? []
        if (!existingA.includes(`has prefix: ${b.key}`)) {
          conflicts.set(a.key, [...existingA, ...a.actions, `has prefix: ${b.key}`])
        }
      }
    }
  }

  return conflicts
}

/**
 * Check if a keymap has any conflicts
 */
export function hasConflicts(keymap: Record<string, string | string[]>): boolean {
  return findConflicts(keymap).size > 0
}

/**
 * Get conflicts as an array of KeyConflict objects
 */
export function getConflictsArray(keymap: Record<string, string | string[]>): KeyConflict[] {
  const conflicts = findConflicts(keymap)
  return Array.from(conflicts.entries()).map(([key, actions]) => ({
    key,
    actions: actions.filter(a => !a.startsWith('prefix of:') && !a.startsWith('has prefix:')),
    type: actions.some(a => a.startsWith('prefix of:') || a.startsWith('has prefix:')) ? 'prefix' : 'duplicate',
  }))
}

// ============================================================================
// Sequence Completion Utilities
// ============================================================================

import type { SequenceCompletion, ActionRegistry, ActionSearchResult } from './types'

/**
 * Get possible completions for a partially-typed sequence.
 *
 * @example
 * ```tsx
 * const keymap = { '2 w': 'twoWeeks', '2 d': 'twoDays', 't': 'temp' }
 * const pending = parseHotkeyString('2')
 * const completions = getSequenceCompletions(pending, keymap)
 * // Returns:
 * // [
 * //   { nextKeys: 'w', fullSequence: '2 w', actions: ['twoWeeks'], ... },
 * //   { nextKeys: 'd', fullSequence: '2 d', actions: ['twoDays'], ... },
 * // ]
 * ```
 */
export function getSequenceCompletions(
  pendingKeys: HotkeySequence,
  keymap: Record<string, string | string[]>,
): SequenceCompletion[] {
  if (pendingKeys.length === 0) return []

  const completions: SequenceCompletion[] = []

  for (const [hotkeyStr, actionOrActions] of Object.entries(keymap)) {
    const sequence = parseHotkeyString(hotkeyStr)

    // Check if pending is a prefix of this sequence
    if (sequence.length <= pendingKeys.length) continue

    let isPrefix = true
    for (let i = 0; i < pendingKeys.length; i++) {
      if (!combinationsEqual(pendingKeys[i], sequence[i])) {
        isPrefix = false
        break
      }
    }

    if (isPrefix) {
      // Get remaining keys needed
      const remainingKeys = sequence.slice(pendingKeys.length)
      const nextKeys = formatCombination(remainingKeys).id

      const actions = Array.isArray(actionOrActions) ? actionOrActions : [actionOrActions]

      completions.push({
        nextKeys,
        fullSequence: hotkeyStr,
        display: formatCombination(sequence),
        actions,
      })
    }
  }

  return completions
}

/**
 * Build a map of action -> keys[] from a keymap
 */
export function getActionBindings(keymap: Record<string, string | string[]>): Map<string, string[]> {
  const actionToKeys = new Map<string, string[]>()

  for (const [key, actionOrActions] of Object.entries(keymap)) {
    const actions = Array.isArray(actionOrActions) ? actionOrActions : [actionOrActions]
    for (const action of actions) {
      const existing = actionToKeys.get(action) ?? []
      actionToKeys.set(action, [...existing, key])
    }
  }

  // Debug logging for stack:none and region:nyc
  const stackNone = actionToKeys.get('stack:none')
  const regionNyc = actionToKeys.get('region:nyc')
  if (stackNone || regionNyc) {
    console.log('getActionBindings:', { 'stack:none': stackNone, 'region:nyc': regionNyc })
  }

  return actionToKeys
}

// ============================================================================
// Fuzzy Search Utilities
// ============================================================================

/**
 * Fuzzy match result
 */
export interface FuzzyMatchResult {
  /** Whether the pattern matched */
  matched: boolean
  /** Match score (higher = better) */
  score: number
  /** Matched character ranges for highlighting [start, end] */
  ranges: Array<[number, number]>
}

/**
 * Perform fuzzy matching of a pattern against text.
 * Returns match info including score and ranges for highlighting.
 *
 * Scoring:
 * - Consecutive matches score higher
 * - Matches at word boundaries score higher
 * - Earlier matches score higher
 */
export function fuzzyMatch(pattern: string, text: string): FuzzyMatchResult {
  if (!pattern) return { matched: true, score: 1, ranges: [] }
  if (!text) return { matched: false, score: 0, ranges: [] }

  const patternLower = pattern.toLowerCase()
  const textLower = text.toLowerCase()

  let patternIdx = 0
  let score = 0
  let consecutiveBonus = 0
  let lastMatchIdx = -2
  const ranges: Array<[number, number]> = []
  let rangeStart = -1

  for (let textIdx = 0; textIdx < textLower.length && patternIdx < patternLower.length; textIdx++) {
    if (textLower[textIdx] === patternLower[patternIdx]) {
      // Base score for match
      let matchScore = 1

      // Bonus for consecutive matches
      if (lastMatchIdx === textIdx - 1) {
        consecutiveBonus += 1
        matchScore += consecutiveBonus
      } else {
        consecutiveBonus = 0
      }

      // Bonus for word boundary match (start of word)
      if (textIdx === 0 || /[\s\-_./]/.test(text[textIdx - 1])) {
        matchScore += 2
      }

      // Bonus for matching uppercase (camelCase boundary)
      if (text[textIdx] === text[textIdx].toUpperCase() && /[a-z]/.test(text[textIdx].toLowerCase())) {
        matchScore += 1
      }

      // Penalty for later matches (prefer earlier matches)
      matchScore -= textIdx * 0.01

      score += matchScore
      lastMatchIdx = textIdx
      patternIdx++

      // Track ranges for highlighting
      if (rangeStart === -1) {
        rangeStart = textIdx
      }
    } else {
      // End current range
      if (rangeStart !== -1) {
        ranges.push([rangeStart, lastMatchIdx + 1])
        rangeStart = -1
      }
    }
  }

  // Close final range
  if (rangeStart !== -1) {
    ranges.push([rangeStart, lastMatchIdx + 1])
  }

  const matched = patternIdx === patternLower.length

  // Bonus for exact match
  if (matched && textLower === patternLower) {
    score += 10
  }

  // Bonus for prefix match
  if (matched && textLower.startsWith(patternLower)) {
    score += 5
  }

  return { matched, score, ranges }
}

/**
 * Search actions by query with fuzzy matching.
 *
 * @example
 * ```tsx
 * const results = searchActions('temp', actions, keymap)
 * // Returns ActionSearchResult[] sorted by relevance
 * ```
 */
export function searchActions(
  query: string,
  actions: ActionRegistry,
  keymap?: Record<string, string | string[]>,
): ActionSearchResult[] {
  const actionBindings = keymap ? getActionBindings(keymap) : new Map<string, string[]>()
  const results: ActionSearchResult[] = []

  for (const [id, action] of Object.entries(actions)) {
    // Skip disabled actions
    if (action.enabled === false) continue

    // Match against multiple fields
    const labelMatch = fuzzyMatch(query, action.label)
    const descMatch = action.description ? fuzzyMatch(query, action.description) : { matched: false, score: 0, ranges: [] }
    const groupMatch = action.group ? fuzzyMatch(query, action.group) : { matched: false, score: 0, ranges: [] }
    const idMatch = fuzzyMatch(query, id)

    // Check keywords
    let keywordScore = 0
    if (action.keywords) {
      for (const keyword of action.keywords) {
        const kwMatch = fuzzyMatch(query, keyword)
        if (kwMatch.matched) {
          keywordScore = max(keywordScore, kwMatch.score)
        }
      }
    }

    // Calculate total score (label weighted highest)
    const matched = labelMatch.matched || descMatch.matched || groupMatch.matched || idMatch.matched || keywordScore > 0
    if (!matched && query) continue

    const score =
      (labelMatch.matched ? labelMatch.score * 3 : 0) +
      (descMatch.matched ? descMatch.score * 1.5 : 0) +
      (groupMatch.matched ? groupMatch.score * 1 : 0) +
      (idMatch.matched ? idMatch.score * 0.5 : 0) +
      keywordScore * 2

    results.push({
      id,
      action,
      bindings: actionBindings.get(id) ?? [],
      score,
      labelMatches: labelMatch.ranges,
    })
  }

  // Sort by score (descending)
  results.sort((a, b) => b.score - a.score)

  return results
}
