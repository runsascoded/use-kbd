# Float placeholder support (`\f`)

## Problem

Digit placeholders (`\d`, `\d+`) only capture integers. Actions that accept floating-point values (e.g., "set max height to 4.5 km") have no way to express this. The `.` key is treated as a non-digit, which finalizes the in-progress `\d+` and tries to match the next sequence element.

## Proposed syntax

Add a `\f` placeholder that matches a float: one or more digits with an optional single decimal point. The `+` is implicit (a float always requires at least one digit).

```
\f   →  matches: 4, 45, 4.5, 0.25, .5, 123.45
        rejects: ., 4., 4.5.6
```

Leading `.` is shorthand for `0.` (e.g., `.5` → `0.5`).
Trailing `.` with no fractional digits is rejected.

Binding string examples:
```
'h \\f'     →  h 4.5   → captures: [4.5]
'\\f h'     →  .5 h    → captures: [0.5]
```

## Changes

### Types (`src/types.ts`)

Add `'float'` variant to `SeqElem` and `SeqElemState`:

```ts
export type SeqElem =
  | { type: 'key'; key: string; modifiers: Modifiers }
  | { type: 'digit' }
  | { type: 'digits' }
  | { type: 'float' }

export type SeqElemState =
  | { type: 'key'; key: string; modifiers: Modifiers; matched?: true }
  | { type: 'digit'; value?: number }
  | { type: 'digits'; value?: number; partial?: string }
  | { type: 'float'; value?: number; partial?: string }
```

Update `extractCaptures`, `isDigitPlaceholder`, `countPlaceholders` to handle `'float'`.

### Parsing (`src/utils.ts`)

In `parseSeqElem` (line ~330):
```ts
if (str === '\\f') {
  return { type: 'float' }
}
```

Display: `{ display: '#.#', id: '\\f' }` (or `⟨#.#⟩` in sequence display).

Update `hasDigitPlaceholders`, `keySeqToSequence`, `sequenceToKeySeq`, and conflict detection (`elementsConflict`) to treat `float` similarly to `digits`.

### Matching (`src/useHotkeys.ts`)

In `isDigit` vicinity, add:
```ts
function isFloatChar(key: string): boolean {
  return /^[0-9.]$/.test(key)
}
```

In `advanceMatchState`, handle `float` like `digits` but also accept `.`:

- When `currentPattern.type === 'float'` and the incoming key is a digit or `.`: start/accumulate `partial`
- When the incoming key is `.` and `partial` already contains `.`: `failed` (two dots)
- When the incoming key is non-digit-non-dot: finalize with `parseFloat(partial)`
- On finalize, reject if `partial` ends with `.` (e.g., `"4."`) or is empty

In the position-finding loop (lines 183-213), add the `float` case alongside `digits`:
```ts
if (elem.type === 'float' && elem.value === undefined) {
  if (!elem.partial) break
  if (isFloatChar(combo.key)) {
    // Reject second dot
    if (combo.key === '.' && elem.partial.includes('.')) {
      return { status: 'failed' }
    }
    newState[i] = { type: 'float', partial: elem.partial + combo.key }
    return { status: 'partial', state: newState }
  } else {
    // Finalize — reject trailing dot
    if (elem.partial.endsWith('.')) return { status: 'failed' }
    const val = parseFloat(elem.partial)
    if (isNaN(val)) return { status: 'failed' }
    newState[i] = { type: 'float', value: val }
    pos = i + 1
    if (pos >= pattern.length) return { status: 'failed' }
    break
  }
}
```

Also handle the "start" case (line ~228) when `currentPattern.type === 'float'`:
```ts
} else if (currentPattern.type === 'float') {
  if (!isFloatChar(combo.key) || combo.modifiers.ctrl || combo.modifiers.alt || combo.modifiers.meta) {
    return { status: 'failed' }
  }
  newState[pos] = { type: 'float', partial: combo.key }
}
```

Update `isCollectingDigits` to also check `float` elements with `partial` and no `value`.

Update `finalizeDigits` to handle `float` (use `parseFloat`, reject trailing dot).

### Completions (`src/utils.ts`, `getSequenceCompletions`)

The completions logic (line ~774) iterates pending keys against the pattern. Add handling for `float` elements: accumulate digit and `.` keys, finalize on non-matching key.

### Captures type

`captures` stays `number[]` — floats are just numbers in JS. No type change needed.

## Files

| File | Change |
|---|---|
| `src/types.ts` | Add `'float'` to `SeqElem`, `SeqElemState`; update helpers |
| `src/utils.ts` | Parse `\\f`, display, conflict detection, completions |
| `src/useHotkeys.ts` | `advanceMatchState`, `isCollectingDigits`, `finalizeDigits` |
| `src/SequenceModal.tsx` | Display rendering for float placeholder (if different from digits) |
| `src/styles.css` | Possibly update placeholder styling |

## Test cases

```ts
// Basic float
'h \\f'  +  keys('4', '.', '5', 'h')  →  captures: [4.5]

// Integer still works
'h \\f'  +  keys('4', 'h')  →  captures: [4]

// Leading dot (shorthand for 0.N)
'h \\f'  +  keys('.', '5', 'h')  →  captures: [0.5]

// No double dots
'h \\f'  +  keys('4', '.', '5', '.', '2', 'h')  →  failed at second dot

// Trailing dot rejected on finalize
'\\f h'  +  keys('4', '.', 'h')  →  failed ("4." is not a valid float)

// Bare dot rejected on finalize
'\\f h'  +  keys('.', 'h')  →  failed ("." has no digits)
```
