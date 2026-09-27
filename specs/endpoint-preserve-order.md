# Endpoint option: keep the endpoint's result order

## Problem
`useOmnibar` re-scores every async endpoint entry with `fuzzyMatch` (label ×3, keywords ×2, description ×1.5), then sorts by `(priority desc, score desc)` (`src/useOmnibar.ts`, the `processed.sort(...)` near the end of the endpoint-results memo). An endpoint that already ranks its results server-side has no way to keep that ranking.

Concrete case ([nj-crashes] ⌘K road search, `www/src/map/roads/useRoadSearch.ts`): the endpoint returns roads matching the query ordered by crash count, but the omnibar re-sorts them by fuzzy label score:
- "kennedy": ROUTE 501 (aka Kennedy Blvd, 26,799 crashes) sorts **last**, below Kennedy St, Hackensack (108), because the match is on an alias, not the label.
- "west side": Duncan Ave (aka WEST SIDE AVE, 137 crashes) sorts above W Side Ave (872).

## Proposal
Add an endpoint config option, e.g.:

```ts
type EndpointConfig = {
  // …existing
  /** How to order this endpoint's entries: `'score'` (default) re-ranks by the omnibar's fuzzy score; `'none'` keeps the order the endpoint returned. */
  sort?: 'score' | 'none'
}
```

With `sort: 'none'`:
- Entries keep their fetched order (stable, by index), still grouped by endpoint `priority` against other endpoints.
- Still compute `labelMatches` for highlighting, but don't filter or re-rank on the score.

Implementation sketch: record each entry's index when building `processed`, and in the comparator, after `priority`, use `a.index - b.index` when both entries come from the same endpoint and that endpoint has `sort: 'none'`.

## Tests
- An endpoint with `sort: 'none'` returning `[B, A]`, where A has the better fuzzy score, renders `[B, A]`.
- The default (`'score'`) behaviour is unchanged.
- Mixed endpoints: `priority` ordering across endpoints is still respected.

## Consumer
Once released (or via `pds l use-kbd`), [nj-crashes] sets `sort: 'none'` on its "Roads" endpoint.

[nj-crashes]: https://github.com/hudcostreets/nj-crashes
