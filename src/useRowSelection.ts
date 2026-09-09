import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { MouseEvent as ReactMouseEvent } from 'react'

/**
 * A cursor move target: a signed delta (rows to move, e.g. `-1`, `+5`),
 * or one of the sentinels `'first'` / `'last'`.
 */
export type MoveTarget = number | 'first' | 'last'

/** Internal anchor/cursor/pinned tuple. Exported for testing the pure transitions. */
export interface RowSelectionState {
  /** Moving end of the active range (index into the current rows), or -1 for none. */
  cursor: number
  /** Fixed end of the active range (index into the current rows), or -1 for none. */
  anchor: number
  /** Keys carried over from prior selections, preserved while extending a range. */
  pinned: Set<string>
}

export interface UseRowSelectionOptions {
  /** Initial cursor/anchor index. Default `-1` (nothing selected). */
  initialCursor?: number
  /** Called whenever the resolved selection changes. */
  onSelectionChange?: (selected: Set<string>) => void
  /** Class applied to the cursor row by `rowProps` (default `'cursor'`). */
  cursorClassName?: string
  /** Class applied to selected rows by `rowProps` (default `'selected'`). */
  selectedClassName?: string
}

/** Props to spread onto a row element for the zero-dependency mouse layer. */
export interface RowSelectionRowProps {
  className: string
  onClick: (e: ReactMouseEvent) => void
  onMouseDown: (e: ReactMouseEvent) => void
  onMouseEnter: () => void
  onMouseLeave: () => void
}

export interface UseRowSelectionResult<T> {
  /** Resolved selection: `pinned ∪ keys of [min(anchor,cursor)…max(anchor,cursor)]`. */
  selected: Set<string>
  /** `selected.size`. */
  count: number
  /** Whether a given row is currently selected. */
  isSelected: (row: T) => boolean
  /** Rows (in order) that are currently selected. */
  selectedRows: () => T[]
  /** Moving end of the active range (index), or -1. */
  cursor: number
  /** Fixed end of the active range (index), or -1. */
  anchor: number
  /** Props for the mouse layer (click / shift-click / meta-click, hover tracking). */
  rowProps: (index: number) => RowSelectionRowProps
  /** Single-select the row at `index` (clears pinned; plain click). */
  select: (index: number) => void
  /** Extend the active range to `index`, keeping the anchor (shift-click). */
  extendTo: (index: number) => void
  /** Toggle the row at `index` in/out of the selection (meta/ctrl-click). */
  toggle: (index: number) => void
  /** Move the cursor by a delta (or to first/last); `extend` keeps the anchor. */
  moveCursor: (target: MoveTarget, extend?: boolean) => void
  /** Select every row currently passed in (e.g. ⌃A over the visible page). */
  selectPage: () => void
  /** Clear the entire selection. */
  clear: () => void
}

/** Resolve `state` against the current `rows` into a set of selected keys. Pure. */
export function computeSelected<T>(
  state: RowSelectionState,
  rows: readonly T[],
  key: (row: T) => string,
): Set<string> {
  const selected = new Set(state.pinned)
  const { cursor, anchor } = state
  if (cursor >= 0 && anchor >= 0) {
    const lo = Math.min(cursor, anchor)
    const hi = Math.max(cursor, anchor)
    for (let i = lo; i <= hi; i++) {
      const row = rows[i]
      if (row !== undefined) selected.add(key(row))
    }
  }
  return selected
}

/**
 * Headless, table-agnostic multi-row selection over an ordered list.
 *
 * Owns one small state machine — an `anchor`, a `cursor`, and a `pinned` set —
 * from which the selection is derived: `pinned ∪ [min(anchor,cursor)…max]`. It
 * ships a zero-dependency mouse layer (`rowProps`) and imperative methods that a
 * keyboard skin (see {@link useRowSelectionKeys}) or custom actions drive. The
 * hook itself imports nothing from the rest of use-kbd, so mouse-only consumers
 * pay no keyboard cost.
 *
 * `rows` is whatever slice the caller renders (e.g. the current page); indices
 * are relative to it, while the selection is tracked by stable `key(row)` so it
 * survives re-render. `pinned` keys persist even for rows not currently present.
 *
 * @example
 * ```tsx
 * const sel = useRowSelection(pageRows, r => String(r.id))
 * useRowSelectionKeys(sel) // optional keyboard layer
 * return rows.map((r, i) => <tr key={r.id} {...sel.rowProps(i)}>…</tr>)
 * ```
 */
export function useRowSelection<T>(
  rows: readonly T[],
  key: (row: T) => string,
  options: UseRowSelectionOptions = {},
): UseRowSelectionResult<T> {
  const {
    initialCursor = -1,
    onSelectionChange,
    cursorClassName = 'cursor',
    selectedClassName = 'selected',
  } = options

  const [state, setState] = useState<RowSelectionState>(() => ({
    cursor: initialCursor,
    anchor: initialCursor,
    pinned: new Set<string>(),
  }))

  // Refs keep the imperative methods stable (empty deps) and free of stale
  // closures over `rows` / `key`, which callers routinely pass inline.
  const rowsRef = useRef(rows)
  rowsRef.current = rows
  const keyRef = useRef(key)
  keyRef.current = key
  // Last row the mouse was over, for keyboard nav that starts with no cursor.
  const mouseHoverRef = useRef(-1)

  const selected = useMemo(
    () => computeSelected(state, rows, keyRef.current),
    [state, rows],
  )

  const onChangeRef = useRef(onSelectionChange)
  onChangeRef.current = onSelectionChange
  useEffect(() => {
    onChangeRef.current?.(selected)
  }, [selected])

  const select = useCallback((index: number) => {
    setState({ cursor: index, anchor: index, pinned: new Set() })
  }, [])

  const extendTo = useCallback((index: number) => {
    setState(prev => ({
      cursor: index,
      anchor: prev.anchor >= 0 ? prev.anchor : index,
      pinned: prev.pinned,
    }))
  }, [])

  const toggle = useCallback((index: number) => {
    setState(prev => {
      const rows = rowsRef.current
      const row = rows[index]
      if (row === undefined) return prev
      const k = keyRef.current(row)
      const current = computeSelected(prev, rows, keyRef.current)
      if (current.has(k)) {
        // Deselect: demote the whole selection to pinned, minus this row.
        const pinned = new Set(current)
        pinned.delete(k)
        return { cursor: -1, anchor: -1, pinned }
      }
      // Add: pin the current selection, start a fresh range at this row.
      return { cursor: index, anchor: index, pinned: new Set(current) }
    })
  }, [])

  const moveCursor = useCallback((target: MoveTarget, extend = false) => {
    setState(prev => {
      const len = rowsRef.current.length
      if (len === 0) return prev
      const clamp = (i: number) => Math.max(0, Math.min(len - 1, i))
      const resolve = (from: number) =>
        target === 'first' ? 0
          : target === 'last' ? len - 1
            : clamp(from + target)

      // No cursor yet: the first move places it (at the hovered row, or 0, or
      // an explicit first/last) and absorbs any delta.
      if (prev.cursor < 0) {
        const mh = mouseHoverRef.current
        const place =
          target === 'first' ? 0
            : target === 'last' ? len - 1
              : mh >= 0 ? mh : 0
        if (extend) {
          return { cursor: place, anchor: prev.anchor >= 0 ? prev.anchor : place, pinned: prev.pinned }
        }
        return { cursor: place, anchor: place, pinned: new Set() }
      }

      const next = resolve(prev.cursor)
      if (extend) {
        return { cursor: next, anchor: prev.anchor >= 0 ? prev.anchor : prev.cursor, pinned: prev.pinned }
      }
      return { cursor: next, anchor: next, pinned: new Set() }
    })
  }, [])

  const selectPage = useCallback(() => {
    setState(() => {
      const k = keyRef.current
      return { cursor: -1, anchor: -1, pinned: new Set(rowsRef.current.map(k)) }
    })
  }, [])

  const clear = useCallback(() => {
    setState({ cursor: -1, anchor: -1, pinned: new Set() })
  }, [])

  const isSelected = useCallback(
    (row: T) => selected.has(key(row)),
    [selected, key],
  )

  const selectedRows = useCallback(
    () => rows.filter(row => selected.has(key(row))),
    [rows, selected, key],
  )

  const rowProps = useCallback((index: number): RowSelectionRowProps => {
    const row = rows[index]
    const on = row !== undefined && selected.has(key(row))
    const className = [
      state.cursor === index ? cursorClassName : '',
      on ? selectedClassName : '',
    ].filter(Boolean).join(' ')
    return {
      className,
      onClick: (e: ReactMouseEvent) => {
        if (e.shiftKey) extendTo(index)
        else if (e.metaKey || e.ctrlKey) toggle(index)
        else select(index)
      },
      // Suppress the browser's own text-selection gesture on modified clicks
      // (shift/meta/ctrl+mousedown otherwise extends the DOM text selection),
      // while leaving plain clicks free to select and copy cell text.
      onMouseDown: (e: ReactMouseEvent) => {
        if (e.shiftKey || e.metaKey || e.ctrlKey) e.preventDefault()
      },
      onMouseEnter: () => { mouseHoverRef.current = index },
      onMouseLeave: () => { mouseHoverRef.current = -1 },
    }
  }, [rows, selected, key, state.cursor, cursorClassName, selectedClassName, extendTo, toggle, select])

  return {
    selected,
    count: selected.size,
    isSelected,
    selectedRows,
    cursor: state.cursor,
    anchor: state.anchor,
    rowProps,
    select,
    extendTo,
    toggle,
    moveCursor,
    selectPage,
    clear,
  }
}
