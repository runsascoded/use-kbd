# `useRowSelection`: select / deselect arbitrary keys (`setKeys`)

## Why

`useRowSelection(rows, key)` can only change the selection through indices into `rows` (`select`, `toggle`, `extendTo`, `selectPage`, …). `pinned` already holds keys for rows not currently passed in, but nothing lets a caller *put* keys there, or take them out.

Consumer: disky's gcs deployment, `/staged` (`site/src/StagedPage.tsx`). The page lists staged prefixes grouped into batches; each batch is a collapsible, paginated table (20 rows a page; one batch has 4,558 rows). `rows` is only the rows rendered right now — expanded batches, current page each — so the keyboard skin and the mouse layer address what's on screen. Wanted:

- a checkbox on each batch's header, shown even when the batch is collapsed, that selects / deselects **every** row of that batch (all pages);
- the page-level "select all" checkbox reflecting and toggling every staged row, not just the rendered ones (today, with every batch collapsed, it shows unchecked over 197 selected rows and clicking it does nothing, since `rows` is empty).

Neither is expressible with index-based methods. Passing every row as `rows` instead would put the keyboard cursor on hidden rows.

## API

```ts
interface UseRowSelectionResult<T> {
  // …
  /** Select (`on = true`) or deselect (`on = false`) rows by key, whether or
   *  not they are in `rows`. Freezes the active range into `pinned` first (as
   *  `commit` does), then adds / removes `keys`; the cursor and anchor drop. */
  setKeys: (keys: Iterable<string>, on: boolean) => void
}
```

Implementation sketch (stable callback, same shape as `commit`):

```ts
const setKeys = useCallback((keys: Iterable<string>, on: boolean) => {
  setState(prev => {
    const pinned = computeSelected(prev, rowsRef.current, keyRef.current)
    for (const k of keys) on ? pinned.add(k) : pinned.delete(k)
    return { cursor: -1, anchor: -1, pinned }
  })
}, [])
```

Notes:
- Dropping the cursor matches `commit` / `toggle`-deselect; callers wanting a cursor can `setCursor` after.
- `selected` / `count` / `isSelected` already resolve over `pinned`, so off-`rows` keys count and report correctly with no other change. (`selectedRows()` stays `rows`-scoped; document that it only returns rows present in `rows`.)
- Optional nicety, not needed by the consumer: `selectPage` could be re-expressed as `setKeys(rows.map(key), true)` minus the existing replace-pinned semantics — leave `selectPage` as-is (BC).

## Tests

In the existing `useRowSelection` tests:
1. `setKeys(['x', 'y'], true)` with `rows` not containing them → `selected` = {x, y}, `count` 2; then passing rows that include `x` → `isSelected(x)` true and its `rowProps(i).className` has the selected class.
2. Active range a..c over rows [a, b, c, d], then `setKeys(['z'], true)` → `selected` = {a, b, c, z}, `cursor` -1.
3. `setKeys(['b', 'z'], false)` after (2) → {a, c}.
4. `setKeys([], true)` is a no-op on `selected` (but commits the range — assert `cursor` -1).

## Delivery

Land on `main`, let npm-dist build the `dist` branch, and report the dist SHA; disky's gcs `site/package.json` pins use-kbd by GitHub SHA.

## Implementation (done)

- `setKeys(keys, on)` on `UseRowSelectionResult`, as sketched: stable callback; computes the resolved selection (freezing the active range like `commit`), adds / removes `keys`, drops cursor + anchor. `selectedRows()` is now documented as `rows`-scoped (off-`rows` keys are in `selected`).
- Tests: this repo has no unit-test runner (Playwright e2e only), so the four cases run against a gated probe, `/many-actions?selProbe` (rows `[a, b, c, d]`, optionally with `x` prepended; buttons per scenario). e2e "useRowSelection setKeys": (1) `setKeys([x, y], true)` → `x,y`, count 2, and `x`'s row gets the `selected` class once it's in `rows`; (2) range a..c + `setKeys([z], true)` → `a,b,c,z`, cursor -1; (3) + `setKeys([b, z], false)` → `a,c`; (4) range a..c + `setKeys([], true)` → `a,b,c`, cursor -1. TFFP: all 4 failed before the method existed.
- Also: `src/useRowSelection.ts` contained a literal NUL byte (`join('<NUL>')` in the row fingerprint, from the paging change), which made `grep` / `file` / `git diff` treat it as binary. Replaced with the `'\0'` escape (same string at runtime).
