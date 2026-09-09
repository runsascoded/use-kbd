# `useRowSelection`: surviving a change of `rows` (paging / sort), from mgu

From the `marin-gcs-usage` session (2026-09-09), reading `use-row-selection.md` and `src/useRowSelection.ts` (`558ba60`, `11587aa`) for the mgu adoption follow-up. mgu's two tables are **paged** (20/50/100 rows) and sortable, and its selection is meant to survive both — that's why its own copy keyed everything by prefix. One gap blocks the swap; one mechanical thing blocks pinning a build.

## 1. The active range is index-based and outlives the rows it was made on

`anchor` / `cursor` are indices into the *current* `rows`. When the caller re-slices `rows` (next page, a re-sort, a filter), the indices stay and now name different rows, so `computeSelected` selects whatever landed at those positions on the new page — while the previously ranged rows silently drop out (only `pinned` keys survive). `select` / `moveCursor` also reset `pinned` to empty, so a plain click after paging forgets the other pages too (that one is arguably by design; the first is not).

What mgu needs (either is fine; the first is the one that "just works" for every consumer):

- **Auto-commit on a row-set change**: when the set of `key(row)` over `rows` changes identity (not merely re-renders), resolve the current selection and demote it to `pinned`, then set `anchor = cursor = -1`. Detect it with a memoized key-list (`rows.map(key)` joined, or a `Set` equality) so an unchanged page doesn't reset the cursor. The mouse/keyboard state machine is untouched; only the resolve step gains a "rows moved under me" transition.
- or **an explicit `commit()`** (pin the resolved selection, drop the range) that a pager calls before changing pages, plus `setCursor(i)` so a consumer can restore the cursor on the new page. Less magic, one more thing every paged consumer must remember.

A test to pin it: select rows 2–4 on page 1 (shift), go to page 2 → `count` is still 3, `cursor === -1`, nothing on page 2 is selected; `isSelected` is true for the page-1 rows when the caller pages back.

## 2. The dist branch doesn't have the hooks yet

`refs/heads/dist` is `use-kbd@0.13.0-dist.676593a` (the release, before `558ba60`); the CI run for the hook commits died in "Install Playwright browsers" on the Google apt mirror's hash mismatch, and `build-dist` never ran. mgu consumes use-kbd from npm (`^0.12.0`) and would pin a dist SHA via `pds gh use-kbd` (as it does for file-tree) — so it needs a green run, or the `build-dist` job made independent of the e2e job, or a `0.14.0` release once #1 lands.

## mgu's side, once both are in

`site/src/rowSelection.ts` (mgu's copy, ~80 lines, same anchor/cursor model) becomes a thin adapter: `useRowSelection(rows, key, { cursorClassName: 'cur', selectedClassName: 'sel' })` + `useRowSelectionKeys(sel, { idPrefix, group })`, plus two mgu-only actions (`x` toggles the cursor row, `⇧x` the page — `toggle(cursor)` / `selectPage()`+`clear()`) and the header checkbox (`selectPage` / `clear`). Its checkbox column keeps using `toggle(index)`. Then `SweepPage` and `ChildrenTable` drop the copy.

## Resolution (use-kbd session, 2026-09-09)

1. **Done** — `commitOnRowsChange` option (default **on**) freezes the active range into `pinned` by `key` when the `rows` fingerprint changes; plus imperative `commit()` and `setCursor(index)`. TableDemo enables it (default) and selection now survives paging; e2e "selection survives a page turn" pins the exact scenario. For programmatic jump-to-row across pages, select in an effect after the page settles (TableDemo's `navigateToRow` does this).
2. **Done** — CI de-flaked (dropped `--with-deps`, which was aborting on third-party apt mirrors; cache browsers); main is green so `build-dist` republishes a `dist` branch with the hooks. Also unblocked npm publishing via OIDC trusted publishing, so a `0.13.0` (or later) npm release is available too.

mgu's adapter work (drop the `SweepPage`/`ChildrenTable` copies) proceeds on its side.
