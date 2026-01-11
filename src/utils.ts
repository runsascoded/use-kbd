import type { KeyCombination, KeyCombinationDisplay, HotkeySequence, SeqElem, KeySeq, Modifiers } from './types'

const { max } = Math

/**
 * Symbols that require Shift key on US keyboard layout.
 * When these are the key, we should not show/store the shift modifier
 * since it's implicit in the symbol itself.
 */
const SHIFTED_SYMBOLS = new Set([
  '!', '@', '#', '$', '%', '^', '&', '*', '(', ')',
  '_', '+', '{', '}', '|', ':', '"', '<', '>', '?', '~',
])

/**
 * Check if a key is a shifted symbol (requires Shift on US keyboard).
 * For these keys, shift modifier should be implicit, not shown separately.
 */
export function isShiftedSymbol(key: string): boolean {
  return SHIFTED_SYMBOLS.has(key)
}

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
 * Sentinel values for digit placeholders in KeyCombination.key
 * These are used during recording to represent placeholder patterns.
 */
export const DIGIT_PLACEHOLDER = '__DIGIT__'
export const DIGITS_PLACEHOLDER = '__DIGITS__'

/**
 * Check if a key string is a digit placeholder sentinel value.
 * Used during recording to identify placeholder keys.
 */
export function isPlaceholderSentinel(key: string): boolean {
  return key === DIGIT_PLACEHOLDER || key === DIGITS_PLACEHOLDER
}

/**
 * Format a single KeyCombination (internal helper)
 */
function formatSingleCombination(combo: KeyCombination): { display: string; id: string } {
  // Handle digit placeholder sentinels
  if (combo.key === DIGIT_PLACEHOLDER) {
    return { display: '#', id: '\\d' }
  }
  if (combo.key === DIGITS_PLACEHOLDER) {
    return { display: '##', id: '\\d+' }
  }

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

// ============================================================================
// New KeySeq Parsing (with digit placeholder support)
// ============================================================================

const NO_MODIFIERS: Modifiers = { ctrl: false, alt: false, shift: false, meta: false }

/**
 * Parse a single sequence element string to SeqElem.
 * Handles:
 * - `\d` → digit placeholder
 * - `\d+` → digits placeholder (one or more)
 * - Regular keys with modifiers (e.g., "ctrl+k", "J", "2")
 */
function parseSeqElem(str: string): SeqElem {
  // Check for digit placeholders
  if (str === '\\d') {
    return { type: 'digit' }
  }
  if (str === '\\d+') {
    return { type: 'digits' }
  }

  // Single uppercase letter (A-Z) is shorthand for shift+<lowercase>
  if (str.length === 1 && /^[A-Z]$/.test(str)) {
    return {
      type: 'key',
      key: str.toLowerCase(),
      modifiers: { ctrl: false, alt: false, shift: true, meta: false },
    }
  }

  const parts = str.toLowerCase().split('+')
  const key = parts[parts.length - 1]

  return {
    type: 'key',
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
 * Parse a hotkey string to a KeySeq (new sequence type with digit placeholders).
 * Handles both single keys ("ctrl+k") and sequences ("2 w", "\\d+ d")
 *
 * @example
 * parseKeySeq('\\d+ d')  // [{ type: 'digits' }, { type: 'key', key: 'd', ... }]
 * parseKeySeq('ctrl+k')  // [{ type: 'key', key: 'k', modifiers: { ctrl: true, ... } }]
 */
export function parseKeySeq(hotkeyStr: string): KeySeq {
  if (!hotkeyStr.trim()) return []

  // Split by space to get sequence parts
  const parts = hotkeyStr.trim().split(/\s+/)
  return parts.map(parseSeqElem)
}

/**
 * Format a single SeqElem for display
 */
function formatSeqElem(elem: SeqElem): { display: string; id: string } {
  if (elem.type === 'digit') {
    return { display: '⟨#⟩', id: '\\d' }
  }
  if (elem.type === 'digits') {
    return { display: '⟨##⟩', id: '\\d+' }
  }

  // Regular key
  const mac = isMac()
  const parts: string[] = []
  const idParts: string[] = []

  if (elem.modifiers.ctrl) {
    parts.push(mac ? '⌃' : 'Ctrl')
    idParts.push('ctrl')
  }
  if (elem.modifiers.meta) {
    parts.push(mac ? '⌘' : 'Win')
    idParts.push('meta')
  }
  if (elem.modifiers.alt) {
    parts.push(mac ? '⌥' : 'Alt')
    idParts.push('alt')
  }
  if (elem.modifiers.shift) {
    parts.push(mac ? '⇧' : 'Shift')
    idParts.push('shift')
  }

  parts.push(formatKeyForDisplay(elem.key))
  idParts.push(elem.key)

  return {
    display: mac ? parts.join('') : parts.join('+'),
    id: idParts.join('+'),
  }
}

/**
 * Format a KeySeq to display format
 */
export function formatKeySeq(seq: KeySeq): KeyCombinationDisplay {
  if (seq.length === 0) {
    return { display: '', id: '', isSequence: false }
  }

  const formatted = seq.map(formatSeqElem)

  if (seq.length === 1) {
    return { ...formatted[0], isSequence: false }
  }

  return {
    display: formatted.map(f => f.display).join(' '),
    id: formatted.map(f => f.id).join(' '),
    isSequence: true,
  }
}

/**
 * Check if a KeySeq contains any digit placeholders
 */
export function hasDigitPlaceholders(seq: KeySeq): boolean {
  return seq.some(elem => elem.type === 'digit' || elem.type === 'digits')
}

/**
 * Convert a KeySeq to HotkeySequence (for backwards compatibility).
 * Note: Digit placeholders become literal '\d' or '\d+' keys.
 * This is only useful for legacy code paths.
 */
export function keySeqToHotkeySequence(seq: KeySeq): HotkeySequence {
  return seq.map(elem => {
    if (elem.type === 'digit') {
      return { key: '\\d', modifiers: NO_MODIFIERS }
    }
    if (elem.type === 'digits') {
      return { key: '\\d+', modifiers: NO_MODIFIERS }
    }
    return { key: elem.key, modifiers: elem.modifiers }
  })
}

/**
 * Convert a HotkeySequence to KeySeq (for migration).
 * Note: This does NOT detect digit patterns - use parseKeySeq for that.
 */
export function hotkeySequenceToKeySeq(seq: HotkeySequence): KeySeq {
  return seq.map(combo => {
    // Check if it's a digit placeholder (from keySeqToHotkeySequence)
    if (combo.key === '\\d' && !combo.modifiers.ctrl && !combo.modifiers.alt && !combo.modifiers.shift && !combo.modifiers.meta) {
      return { type: 'digit' }
    }
    if (combo.key === '\\d+' && !combo.modifiers.ctrl && !combo.modifiers.alt && !combo.modifiers.shift && !combo.modifiers.meta) {
      return { type: 'digits' }
    }
    return { type: 'key', key: combo.key, modifiers: combo.modifiers }
  })
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
 * Check if a pending key matches a pattern key (handles digit placeholders)
 */
function keyMatchesPattern(pending: KeyCombination, pattern: KeyCombination): boolean {
  // Check modifiers first
  if (
    pending.modifiers.ctrl !== pattern.modifiers.ctrl ||
    pending.modifiers.alt !== pattern.modifiers.alt ||
    pending.modifiers.shift !== pattern.modifiers.shift ||
    pending.modifiers.meta !== pattern.modifiers.meta
  ) {
    return false
  }

  // Exact match
  if (pending.key === pattern.key) return true

  // Check if pending is a digit and pattern expects a digit placeholder
  if (/^[0-9]$/.test(pending.key) && (pattern.key === DIGIT_PLACEHOLDER || pattern.key === DIGITS_PLACEHOLDER)) {
    return true
  }

  return false
}

// ============================================================================
// KeySeq Conflict Detection
// ============================================================================

/**
 * Check if a key is a digit (0-9)
 */
function isDigitKey(key: string): boolean {
  return /^[0-9]$/.test(key)
}

/**
 * Check if two SeqElems could potentially match the same input.
 * - digit matches any single digit key
 * - digits matches any sequence of digit keys
 * - key matches itself exactly
 */
function seqElemsCouldConflict(a: SeqElem, b: SeqElem): boolean {
  // digit matches any single digit
  if (a.type === 'digit' && b.type === 'digit') return true
  if (a.type === 'digit' && b.type === 'key' && isDigitKey(b.key)) return true
  if (a.type === 'key' && isDigitKey(a.key) && b.type === 'digit') return true

  // digits matches any sequence starting with digits
  if (a.type === 'digits' && b.type === 'digits') return true
  if (a.type === 'digits' && b.type === 'digit') return true
  if (a.type === 'digit' && b.type === 'digits') return true
  if (a.type === 'digits' && b.type === 'key' && isDigitKey(b.key)) return true
  if (a.type === 'key' && isDigitKey(a.key) && b.type === 'digits') return true

  // key vs key - exact match
  if (a.type === 'key' && b.type === 'key') {
    return (
      a.key === b.key &&
      a.modifiers.ctrl === b.modifiers.ctrl &&
      a.modifiers.alt === b.modifiers.alt &&
      a.modifiers.shift === b.modifiers.shift &&
      a.modifiers.meta === b.modifiers.meta
    )
  }

  return false
}

/**
 * Check if KeySeq A could be a prefix of KeySeq B (considering digit patterns)
 */
function keySeqIsPrefix(a: KeySeq, b: KeySeq): boolean {
  if (a.length >= b.length) return false
  for (let i = 0; i < a.length; i++) {
    if (!seqElemsCouldConflict(a[i], b[i])) return false
  }
  return true
}

/**
 * Check if two KeySeqs could match the same input (exact match)
 */
function keySeqsCouldConflict(a: KeySeq, b: KeySeq): boolean {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) {
    if (!seqElemsCouldConflict(a[i], b[i])) return false
  }
  return true
}

/**
 * Find conflicts in a keymap.
 * Detects:
 * - Duplicate: multiple actions bound to the exact same key/sequence
 * - Pattern overlap: digit patterns that could match the same input (e.g., "\d d" and "5 d")
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
    keySeq: parseKeySeq(key),
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

  // Check for pattern conflicts and prefix conflicts
  for (let i = 0; i < entries.length; i++) {
    for (let j = i + 1; j < entries.length; j++) {
      const a = entries[i]
      const b = entries[j]

      // Check for exact conflict (including digit patterns)
      if (keySeqsCouldConflict(a.keySeq, b.keySeq) && a.key !== b.key) {
        // These patterns could match the same input
        const existingA = conflicts.get(a.key) ?? []
        if (!existingA.includes(`conflicts with: ${b.key}`)) {
          conflicts.set(a.key, [...existingA, ...a.actions, `conflicts with: ${b.key}`])
        }
        const existingB = conflicts.get(b.key) ?? []
        if (!existingB.includes(`conflicts with: ${a.key}`)) {
          conflicts.set(b.key, [...existingB, ...b.actions, `conflicts with: ${a.key}`])
        }
        continue
      }

      // Check if a is prefix of b (with digit pattern support)
      if (keySeqIsPrefix(a.keySeq, b.keySeq)) {
        // a is a prefix of b - both are conflicted
        const existingA = conflicts.get(a.key) ?? []
        if (!existingA.includes(`prefix of: ${b.key}`)) {
          conflicts.set(a.key, [...existingA, ...a.actions, `prefix of: ${b.key}`])
        }
        const existingB = conflicts.get(b.key) ?? []
        if (!existingB.includes(`has prefix: ${a.key}`)) {
          conflicts.set(b.key, [...existingB, ...b.actions, `has prefix: ${a.key}`])
        }
      } else if (keySeqIsPrefix(b.keySeq, a.keySeq)) {
        // b is a prefix of a
        const existingB = conflicts.get(b.key) ?? []
        if (!existingB.includes(`prefix of: ${a.key}`)) {
          conflicts.set(b.key, [...existingB, ...b.actions, `prefix of: ${a.key}`])
        }
        const existingA = conflicts.get(a.key) ?? []
        if (!existingA.includes(`has prefix: ${b.key}`)) {
          conflicts.set(a.key, [...existingA, ...a.actions, `has prefix: ${b.key}`])
        }
      } else if (isPrefix(a.sequence, b.sequence)) {
        // Legacy check for non-pattern sequences
        const existingA = conflicts.get(a.key) ?? []
        if (!existingA.includes(`prefix of: ${b.key}`)) {
          conflicts.set(a.key, [...existingA, ...a.actions, `prefix of: ${b.key}`])
        }
        const existingB = conflicts.get(b.key) ?? []
        if (!existingB.includes(`has prefix: ${a.key}`)) {
          conflicts.set(b.key, [...existingB, ...b.actions, `has prefix: ${a.key}`])
        }
      } else if (isPrefix(b.sequence, a.sequence)) {
        // Legacy check for non-pattern sequences
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
 * Returns both exact matches (isComplete: true) and continuations (isComplete: false).
 *
 * @example
 * ```tsx
 * const keymap = { 'h': 'humidity', 'h \\d+': 'nHours', '2 w': 'twoWeeks' }
 * const pending = parseHotkeyString('h')
 * const completions = getSequenceCompletions(pending, keymap)
 * // Returns:
 * // [
 * //   { nextKeys: '', fullSequence: 'h', actions: ['humidity'], isComplete: true },
 * //   { nextKeys: '⟨##⟩', fullSequence: 'h \\d+', actions: ['nHours'], isComplete: false },
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
    const keySeq = parseKeySeq(hotkeyStr)

    // Skip if pattern is clearly too short (but \d+ can consume multiple keys)
    const hasDigitsPlaceholder = keySeq.some(e => e.type === 'digits')
    if (!hasDigitsPlaceholder && keySeq.length < pendingKeys.length) continue

    // Track how many keySeq elements we've matched
    let keySeqIdx = 0
    let isMatch = true

    for (let i = 0; i < pendingKeys.length && keySeqIdx < keySeq.length; i++) {
      const elem = keySeq[keySeqIdx]

      if (elem.type === 'digits') {
        // \d+ can consume multiple pending digit keys
        if (!/^[0-9]$/.test(pendingKeys[i].key)) {
          isMatch = false
          break
        }
        // Check if next pending key is also a digit (still accumulating)
        // or if we should move to next keySeq element
        if (i + 1 < pendingKeys.length && /^[0-9]$/.test(pendingKeys[i + 1].key)) {
          // Next is also digit, stay on this keySeq element
          continue
        }
        // Either no more pending keys, or next pending is not a digit
        keySeqIdx++
      } else if (elem.type === 'digit') {
        // \d matches exactly one digit
        if (!/^[0-9]$/.test(pendingKeys[i].key)) {
          isMatch = false
          break
        }
        keySeqIdx++
      } else {
        // Regular key - must match exactly (with modifiers)
        const keyElem = elem as { type: 'key'; key: string; modifiers: Modifiers }
        const targetCombo: KeyCombination = { key: keyElem.key, modifiers: keyElem.modifiers }
        if (!keyMatchesPattern(pendingKeys[i], targetCombo)) {
          isMatch = false
          break
        }
        keySeqIdx++
      }
    }

    if (!isMatch) continue

    const actions = Array.isArray(actionOrActions) ? actionOrActions : [actionOrActions]

    if (keySeqIdx === keySeq.length) {
      // Exact match - pending keys fully match this pattern
      completions.push({
        nextKeys: '',
        fullSequence: hotkeyStr,
        display: formatKeySeq(keySeq),
        actions,
        isComplete: true,
      })
    } else {
      // Continuation - more keys needed
      const remainingKeySeq = keySeq.slice(keySeqIdx)
      const nextKeys = formatKeySeq(remainingKeySeq).display

      completions.push({
        nextKeys,
        fullSequence: hotkeyStr,
        display: formatKeySeq(keySeq),
        actions,
        isComplete: false,
      })
    }
  }

  // Sort: complete matches first, then by fullSequence
  completions.sort((a, b) => {
    if (a.isComplete !== b.isComplete) return a.isComplete ? -1 : 1
    return a.fullSequence.localeCompare(b.fullSequence)
  })

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
