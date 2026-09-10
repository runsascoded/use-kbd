import { useMemo } from 'react'
import type { ActionConfig } from './useAction'
import { useActions } from './useAction'
import type { UseRowSelectionResult } from './useRowSelection'

/** The set of actions {@link useRowSelectionKeys} can register (id suffixes). */
export type RowSelectionKeyAction =
  | 'up' | 'down'
  | 'extend-up' | 'extend-down'
  | 'up-n' | 'down-n'
  | 'extend-up-n' | 'extend-down-n'
  | 'first' | 'last'
  | 'extend-first' | 'extend-last'
  | 'all' | 'clear'

export interface UseRowSelectionKeysOptions {
  /** Whether the bindings are active (default `true`). */
  enabled?: boolean
  /** Register the numeric-prefixed variants (`3j`, `5⇧k`, …). Default `true`. */
  numeric?: boolean
  /** Prefix for the registered action ids (default `'select'` → `select:up`, …). */
  idPrefix?: string
  /** Group for the move/extend actions in the ShortcutsModal (default `'Selection'`). */
  group?: string
  /** Group for select-all / clear (defaults to `group`). */
  selectionGroup?: string
  /** Override the label of any action. */
  labels?: Partial<Record<RowSelectionKeyAction, string>>
  /** Override the bindings of any action, or `false` to not register it. */
  bindings?: Partial<Record<RowSelectionKeyAction, string[] | false>>
  /** Hide the registered actions from the ShortcutsModal (still searchable). */
  hideFromModal?: boolean
}

/** The selection methods the keyboard layer drives (independent of the row type). */
type SelActions = Pick<UseRowSelectionResult<unknown>, 'moveCursor' | 'selectPage' | 'clear'>

interface Spec {
  label: string
  bindings: string[]
  numeric?: boolean
  selection?: boolean
  run: (sel: SelActions, n: number) => void
}

const SPECS: Record<RowSelectionKeyAction, Spec> = {
  'up': { label: 'Row up', bindings: ['k', 'arrowup'], run: sel => sel.moveCursor(-1) },
  'down': { label: 'Row down', bindings: ['j', 'arrowdown'], run: sel => sel.moveCursor(1) },
  'extend-up': { label: 'Extend up', bindings: ['shift+k', 'shift+arrowup'], run: sel => sel.moveCursor(-1, true) },
  'extend-down': { label: 'Extend down', bindings: ['shift+j', 'shift+arrowdown'], run: sel => sel.moveCursor(1, true) },
  'up-n': { label: 'Up N rows', bindings: ['\\d+ k', '\\d+ arrowup'], numeric: true, run: (sel, n) => sel.moveCursor(-n) },
  'down-n': { label: 'Down N rows', bindings: ['\\d+ j', '\\d+ arrowdown'], numeric: true, run: (sel, n) => sel.moveCursor(n) },
  'extend-up-n': { label: 'Extend up N rows', bindings: ['\\d+ shift+k', '\\d+ shift+arrowup'], numeric: true, run: (sel, n) => sel.moveCursor(-n, true) },
  'extend-down-n': { label: 'Extend down N rows', bindings: ['\\d+ shift+j', '\\d+ shift+arrowdown'], numeric: true, run: (sel, n) => sel.moveCursor(n, true) },
  'first': { label: 'First row', bindings: ['meta+arrowup'], run: sel => sel.moveCursor('first') },
  'last': { label: 'Last row', bindings: ['meta+arrowdown'], run: sel => sel.moveCursor('last') },
  'extend-first': { label: 'Select to first', bindings: ['meta+shift+arrowup'], run: sel => sel.moveCursor('first', true) },
  'extend-last': { label: 'Select to last', bindings: ['meta+shift+arrowdown'], run: sel => sel.moveCursor('last', true) },
  'all': { label: 'Select all', bindings: ['ctrl+a'], selection: true, run: sel => sel.selectPage() },
  'clear': { label: 'Deselect all', bindings: ['escape'], selection: true, run: sel => sel.clear() },
}

const ORDER = Object.keys(SPECS) as RowSelectionKeyAction[]

/**
 * Optional keyboard layer for a {@link useRowSelection} instance.
 *
 * Registers move / extend / select-all / clear actions (plus numeric-prefixed
 * variants) through `useActions`, so the bindings appear in the ShortcutsModal
 * and stay user-editable, exactly like any other use-kbd action. Delegates
 * entirely to the passed selection's methods — the mouse layer and this share
 * one state machine. Consumers that only want mouse selection simply don't call
 * this hook.
 *
 * Must be used within a `HotkeysProvider`.
 *
 * @example
 * ```tsx
 * const sel = useRowSelection(rows, r => r.id)
 * useRowSelectionKeys(sel, { group: 'Rows' })
 * ```
 */
export function useRowSelectionKeys<T>(
  sel: UseRowSelectionResult<T>,
  options: UseRowSelectionKeysOptions = {},
): void {
  const {
    enabled = true,
    numeric = true,
    idPrefix = 'select',
    group = 'Selection',
    selectionGroup = group,
    labels,
    bindings,
    hideFromModal,
  } = options

  const bindingsKey = JSON.stringify(bindings)
  const labelsKey = JSON.stringify(labels)

  const actions = useMemo(() => {
    const map: Record<string, ActionConfig> = {}
    for (const action of ORDER) {
      const spec = SPECS[action]
      if (spec.numeric && !numeric) continue
      const override = bindings?.[action]
      if (override === false) continue
      const keys = override ?? spec.bindings
      // `clear` (Escape) is only enabled while something is selected, so with
      // nothing selected the Escape keystroke falls through (to close a modal,
      // drill up a treemap, etc.) instead of being consumed by a no-op clear.
      const actionEnabled = action === 'clear' ? enabled && sel.count > 0 : enabled
      map[`${idPrefix}:${action}`] = {
        label: labels?.[action] ?? spec.label,
        group: spec.selection ? selectionGroup : group,
        defaultBindings: keys,
        enabled: actionEnabled,
        hideFromModal,
        handler: (_e, captures) => spec.run(sel, captures?.[0] ?? 1),
      }
    }
    return map
    // `sel`'s methods are stable; re-registering only on config changes is intended.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, numeric, idPrefix, group, selectionGroup, hideFromModal, bindingsKey, labelsKey, sel])

  useActions(actions)
}
