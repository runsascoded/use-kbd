# Registry: disabled-key fall-through + register render isolation

**Status**: implemented (this session). Two fixes requested by the `mgu` session, both surfaced by its React render-spy.

## Ask 1 — a disabled action must not consume its key

**Bug**: pressing a disabled action's key still ran `preventDefault()` (and blocked fall-through / co-bound actions). The per-action `enabled` check lived *inside* the `useAction` handler wrapper, which runs *after* `useHotkeys` has already `preventDefault`ed and returned "handled".

**Fix**: the enabled check now happens in `useHotkeys` *before* any `preventDefault`.
- `useHotkeys` gained an `isActionEnabled?: (id) => boolean` option (ref'd so it stays live without re-attaching listeners). Every match/execute path (`tryExecute`, `tryExecuteKeySeq`, the KeySeq match loop, `hasPotentialMatch`, `hasSequenceExtension`) skips actions/entries whose only matching actions are disabled — so a fully-disabled key is neither consumed nor treated as a sequence start; it falls through.
- `HotkeysProvider` passes `registry.isActionEnabled`.
- Live enabled state without re-registration: `ActionsRegistry` gained `setActionEnabled(id, bool)` writing a ref-map (no version bump). `isActionEnabled` reads that first, falling back to the registered config. `useAction`/`useActions` sync it in a small effect keyed on `config.enabled`, so toggling `enabled` never re-registers.

**Test**: `site/e2e/hotkeys.spec.ts` › "a disabled binding does not consume its key (falls through)" — a disabled action bound to `q` leaves `defaultPrevented === false`; an enabled key (`n`) is still consumed. TFFP-verified (fails when the wiring is removed).

## Ask 2 — registering an action must not re-render every registrant

**Bug**: `register`/`unregister` bump a single registry version; `useAction`/`useActions` consumed the full `ActionsRegistryContext`, whose value changes on every bump — so registering one action re-rendered *every* `useAction`/`useActions` caller app-wide (the "latent" churn behind `useRowSelectionKeys`).

**Fix**: a stable API context. `ActionsRegistryApiContext` exposes only the stable `{ register, unregister, setActionEnabled }` (identity never changes after mount). `useAction`/`useActions` consume it instead of the full registry, so version bumps no longer re-render pure registrants. Display consumers that need live `actions`/`keymap`/`conflicts` keep using the full context (`useHotkeysContext`).

**Test**: `site/e2e/hotkeys.spec.ts` › "registering an action does not re-render existing registrants" — mounting an extra registrant on `/many-actions` re-renders the display-probe (full-context consumer) but leaves all existing registrants' commit counts unchanged. TFFP-verified.

## Ask 3 — a keystroke must not re-render every display consumer

**Bug** (mgu spy: "a plain `j` commits with `HotkeysProvider` as an updater"):
`clearPending` ran after every matched keystroke and unconditionally
`setPendingKeys([])` (a fresh array), so even an immediate single-key match
re-rendered `HotkeysProvider` and fanned out through the context to Omnibar,
ShortcutsModal, SpeedDial, etc.

**Fix**: guard the three sequence-state setters (`pendingKeys`,
`isAwaitingSequence`, `timeoutStartedAt`) to return the same reference when
already cleared, so React bails on the no-op update.

**Test**: "a matched single keystroke does not re-render display consumers"
(`?keyProbe` binds a no-op action; DisplayProbe's commit count is unchanged).
TFFP-verified.

**Remaining (follow-up, not done)**: multi-key *sequence* input (`pendingKeys`
legitimately changing) still fans out to all display consumers. Isolating that
needs a keystroke-state context split (BC-sensitive — `useHotkeysContext`
currently exposes `pendingKeys` etc.), so it's deferred pending a decision.

## Ask 4 — gate the built-in Escape/`clear` on a non-empty selection

`useRowSelectionKeys`'s `clear` (Escape) is now `enabled` only while
`sel.count > 0`. Combined with ask 1, Escape with nothing selected falls
through (close a modal, drill up a treemap) instead of a no-op clear that
consumes the key. Consumers can drop bespoke capture-phase Esc listeners.
Test: "Escape falls through when nothing is selected". TFFP-verified.

## Verification

- lib `tsup` build + types clean; lib + site `eslint` 0 errors; site `tsc -b` clean.
- Full Playwright suite green (114 tests), incl. the new tests above.

## For mgu

No npm release — pin the dist SHA via `pds gh use-kbd`. Re-run the render-spy
after pinning to confirm: app-wide re-render on selection churn is gone,
disabled bindings fall through, a plain keystroke no longer re-renders the
display consumers, and Esc with nothing selected reaches the treemap drill-up.
