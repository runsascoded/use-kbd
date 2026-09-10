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

## Verification

- lib `tsup` build + types clean; lib + site `eslint` 0 errors; site `tsc -b` clean.
- Full Playwright suite green (111 tests), incl. the two new tests above.

## For mgu

No npm release — pin the dist SHA via `pds gh use-kbd`. Re-run the render-spy after pinning to confirm the app-wide re-render on selection churn is gone and disabled bindings fall through.
