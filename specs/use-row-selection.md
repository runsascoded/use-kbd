# `useRowSelection` — headless multi-row selection (mouse + keyboard)

**Status**: implemented (this session). Landed entirely in use-kbd; nothing in file-tree.

## Origin

Handoff from the `file-tree` session (2026-09-09). `marin-gcs-usage` (mgu) hand-rolled spreadsheet-style multi-row-select in its `SweepPage`, and a same-day mgu spec (`children-table-selection.md`) wants the same for its `ChildrenTable`. use-kbd's own `TableDemo` already hand-rolled the identical state machine. The conclusion: the interaction — mouse *and* keyboard multi-select over an ordered list — belongs in use-kbd as one headless primitive, so mgu can drop its copies and everyone shares one well-understood foundation. The keyboard half must live here regardless (editable bindings in the ShortcutsModal); splitting the state machine across packages to keep the mouse bytes out of a "keyboard" lib is the worse trade.

## What shipped

Two exports, plus a pure helper.

### `useRowSelection(rows, key, options?)` — the core

Headless, table-agnostic. Owns one small state machine and derives the selection from it; imports nothing else from use-kbd, so mouse-only consumers pay no keyboard cost.

- **Model**: an `anchor` and a `cursor` (indices into the current `rows`, or `-1`), plus a `pinned` set of keys carried over from prior selections. The selection is `pinned ∪ keys of [min(anchor,cursor)…max(anchor,cursor)]`.
- **Keys, not indices, identify selection**: `key(row) => string` is stable per row, so the selection survives re-render, re-sort, and paging. `pinned` keys persist even for rows not currently in `rows`.
- **`rows` is whatever slice the caller renders** (e.g. the current page); indices are relative to it.

Returns:

```ts
{
  selected: Set<string>          // pinned ∪ [min(anchor,cursor)…max]
  count: number                  // selected.size
  isSelected(row): boolean
  selectedRows(): T[]            // selected rows, in order
  cursor: number                 // -1 = none
  anchor: number                 // -1 = none
  rowProps(index): {             // zero-dep mouse layer — spread onto <tr>
    className, onClick, onMouseDown, onMouseEnter, onMouseLeave
  }
  select(index): void            // single-select (plain click)
  extendTo(index): void          // extend range, keep anchor (shift-click)
  toggle(index): void            // add/remove disjoint row (meta/ctrl-click)
  moveCursor(target, extend?): void   // target: signed delta | 'first' | 'last'
  selectPage(): void             // select every row currently passed in (⌃A)
  commit(): void                 // freeze the resolved selection into pinned, drop the range
  setCursor(index): void         // place cursor+anchor at index, keep pinned
  clear(): void
}
```

Options: `initialCursor` (default `-1` = nothing selected), `onSelectionChange`, `cursorClassName` (default `'cursor'`), `selectedClassName` (default `'selected'`), `commitOnRowsChange` (default `true`).

**Surviving a change of `rows` (paging / sort / filter)** — `anchor`/`cursor` are indices into the *current* `rows`, so when the caller re-slices `rows` the range would otherwise land on whatever moved into those positions. With `commitOnRowsChange` (default on), a change in the `key(row)` fingerprint of `rows` freezes the active range into `pinned` and resets the cursor, so the selection persists by identity. To also position the cursor on the new rows (a programmatic "jump to row on another page"), call `select`/`setCursor` *after* the change settles (an effect keyed on the page), not in the same update that changes `rows`; `commit()` is the imperative equivalent (pin the resolved selection, drop the range).

The mouse layer is entirely inside `rowProps`: plain click → `select`, shift-click → `extendTo`, meta/ctrl-click → `toggle`; `onMouseEnter`/`Leave` track the hovered row so keyboard nav that starts with no cursor lands on the hovered row. `onMouseDown` calls `preventDefault()` on modified clicks so the browser's own text-selection gesture doesn't extend across rows (plain clicks still select/copy cell text). The imperative methods are memoized (stable identity) — safe to destructure into dep arrays.

### `useRowSelectionKeys(sel, options?)` — optional keyboard skin

Registers move / extend / numeric / first-last / select-all / clear actions through `useActions`, so the bindings show in the ShortcutsModal and stay user-editable like any other use-kbd action. Delegates entirely to the passed `sel`'s methods — mouse layer and keyboard share one state machine. Must be inside a `HotkeysProvider`.

Default bindings (all overridable / disable-able per action, and re-groupable):

| action suffix | keys | effect |
| --- | --- | --- |
| `up` / `down` | `k`/`↑`, `j`/`↓` | `moveCursor(∓1)` |
| `extend-up` / `extend-down` | `⇧k`/`⇧↑`, `⇧j`/`⇧↓` | `moveCursor(∓1, true)` |
| `up-n` / `down-n` | `\d+ k`, `\d+ j` (+ arrows) | `moveCursor(∓n)` |
| `extend-up-n` / `extend-down-n` | `\d+ ⇧k`, `\d+ ⇧j` (+ arrows) | `moveCursor(∓n, true)` |
| `first` / `last` | `⌘↑` / `⌘↓` | `moveCursor('first'|'last')` |
| `extend-first` / `extend-last` | `⌘⇧↑` / `⌘⇧↓` | `moveCursor('first'|'last', true)` |
| `all` | `⌃a` | `selectPage()` |
| `clear` | `esc` | `clear()` |

Options: `enabled`, `numeric` (default true), `idPrefix` (default `'select'`), `group` (default `'Selection'`), `selectionGroup` (defaults to `group`; for `all`/`clear`), `labels`, `bindings` (override or `false` to skip), `hideFromModal`.

### `computeSelected(state, rows, key)` — pure

Resolves `{cursor, anchor, pinned}` against `rows` into a `Set<string>`. Exported for reuse/testing.

## Consumers

- **`site/src/routes/TableDemo.tsx`** — refactored onto both hooks as the proving ground. Removed ~4 selection `useState`s, the `selectedIds` `useMemo`, all bespoke mouse-`onClick` logic, and ~14 bespoke nav/selection `useAction` blocks; the two-column `RowNavRenderer` now references the skin's `nav:*` ids. Sort / page / status / edit actions stay bespoke (not selection concerns).
- **mgu `SweepPage` / `ChildrenTable`** — can now drop their hand-rolled copies and adopt `useRowSelection` (+ `useRowSelectionKeys` where keyboard is wanted). Follow-up in the mgu session.

## Divergence from the original file-tree sketch

The sketch had `toggle(keys, shiftFrom?)`. Delivered as index-based `select` / `extendTo` / `toggle(index)` — that is what the mouse layer needs and what maps cleanly onto the anchor/cursor model; `rowProps` composes them by modifier key so most consumers never call them directly.

## Verification

- lib `tsup` build + `dist` types clean; site `tsc -b` + `eslint` clean.
- Playwright: full `hotkeys.spec.ts` green (behavior-preserving refactor), plus new Data Table Demo tests for shift-click range, ctrl/meta-click toggle, and ⌃A-select-all / esc-clear.

## Follow-ups (not done)

- Optional FT row-seams (`onRowClick` + row class hook) in `@rdub/file-tree` — separate, if-needed; mgu's selection tables aren't FT tables, so not their current need.
- mgu adoption (drop `SweepPage` copy, wire `ChildrenTable`).
