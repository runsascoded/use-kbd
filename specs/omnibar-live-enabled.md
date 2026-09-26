# Omnibar / `searchActions` should use live `enabled` state

## Problem

`useAction`'s `enabled` is tracked out-of-band: toggling it calls `setActionEnabled` (no registry version bump), and the keydown path and `LookupModal` read it via `isActionEnabled`. But `actionRegistry` (`src/ActionsRegistry.ts`, the `useMemo` keyed on `actionsVersion`) snapshots `enabled: config.enabled` at registration time, and the omnibar's `searchActions` (`src/utils.ts`, `if (action.enabled === false) continue`) plus the sequence-completion filter (`src/utils.ts`, `actionRegistry[id]?.enabled !== false`) read that snapshot.

So an action whose `enabled` changes after registration shows the wrong state in the omnibar until something else bumps `actionsVersion`.

Observed in jc-taxes (`www/src/useKeyboardShortcuts.ts`): "Previous year" / "Next year" with `enabled: yearIdx > 0` / `enabled: yearIdx < last`. They registered before the URL year resolved (`yearIdx = -1` → prev disabled, next enabled). At `?y=26` (last year), searching "year" in the omnibar shows only "Next year" (actually disabled) and omits "Previous year" (actually enabled). `⌘⇧K` lookup is correct, since it uses `isActionEnabled`.

## Proposal

- `searchActions` (and the sequence-completion filter) take an optional `isEnabled?: (id: string) => boolean`; the omnibar passes `registry.isActionEnabled`. Fallback: the current `action.enabled` check.
- Since `isActionEnabled` is ref-backed (no re-render on toggle), the omnibar should recompute results when it opens and on each query change. That is already the case for query changes; make sure opening recomputes too, not a memo keyed only on `actionsVersion`.
- Optionally drop `enabled` from the `ActionRegistry` snapshot entirely, or document it as "initial".

## Tests

- Register an action with `enabled: false`, then flip it to `true` via re-render (no re-registration); open the omnibar and search: the action appears. Reverse case: it disappears.
