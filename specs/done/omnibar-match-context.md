# Omnibar: match context (snippets), match quality, priority, and per-row rendering

From the disky deep-dive deck (`~/c/oa/disky-deep-dive`, `react/SlideSearch.tsx`, use-kbd 0.13.0), 2026-10-18. The deck registers one action per slide, plus actions for the slides' controls (e.g. "4. GCS bill: net of credits"). Ryan typed "credits" and got 12 unrelated slides, with no indication of why each matched.

## Problems

1. **Scattered subsequence matches.** `fuzzyMatch` (`src/utils.ts`) greedily matches the query as a subsequence of each field. Over a 160-char `description`, nearly any 7-letter query finds c…r…e…d…i…t…s somewhere. The deck now drops `description` for that reason, but a long body text is exactly what a slide or page search wants to match.
2. **Greedy, not best, alignment.** A field containing "credits" verbatim at index 80 can score lower than a scattered match starting at index 0, because the greedy scan commits to the first `c`.
3. **No per-field match info.** `ActionSearchResult` has `labelMatches` only. A renderer can't show which field matched (description, keyword, group) or where.
4. **No priority.** No way to rank one class of actions (the deck's controls) above another (slide jumps) at equal match quality.
5. **Rendering is all or nothing.** `<Omnibar>`'s `children` render prop replaces the whole UI, input and keyboard handling included. There's no way to customize just a result row while keeping the default chrome.

## Asks

### Matching

- **Best alignment:** score each field by its best alignment, not the greedy first one. At minimum, prefer an exact contiguous substring, or a word-prefix run, anywhere in the field over a scattered match.
- **Field-sized strictness:** an option (per action field, or a global `matchMode`) to require contiguous or word-prefix matches in long fields. For example, `searchText` (below) matches only by substrings or word prefixes of each query term, never by scattered subsequences.
- **`searchText?: string` on `ActionConfig`:** long body text that is searched (strictly, as above) but never displayed as-is. It's distinct from `description`, which is short display text.

### Results

```ts
interface ActionSearchResult {
  // existing: id, action, bindings, score, labelMatches, …
  matches: Array<{ field: 'label' | 'description' | 'searchText' | 'keyword' | 'group' | 'id', text: string, ranges: Array<[number, number]>, score: number }>
}
```

- Plus an exported helper: `snippet(text, ranges, { radius = 40, ellipsis = '…' }) → { text, ranges }`. It returns a window around the best range, with ranges re-based onto the window, for rendering "…the July bill net of **credits** was…".

### Ranking

- `ActionConfig.priority?: number` (default 0) as a tie-breaker, or an additive boost, applied after match quality. Document which it is.
- Optionally a per-group default (`groupPriority` on the provider config), so "Controls" can outrank "Slides" without setting it on every action.

### Rendering (headless first, good defaults)

- `<Omnibar renderResult={(result, { selected, query }) => ReactNode}>`: replaces just the row content; the default chrome, input and keyboard handling stay.
- **Default row:** label (with highlights), group, bindings, and, when the best match isn't in the label, a dimmed second line with the snippet and its highlighted ranges. That covers the deck's need with no custom code.
- **Fully headless:** `useOmnibar` (already exported) returns `results` with `matches`, plus the selection, execute and close functions. Document it as the headless API, with an example that builds a custom palette.

## Tests

- `fuzzyMatch` / best alignment: "credits" against "… net of credits …" yields one contiguous range at the right offset, with a higher score than the scattered alignment.
- `searchText` strictness: "credits" does **not** match "Who owns ⌘⇧/? … create … edit … its …", while "cred" matches "credits" as a word prefix. Assert the exact result id lists.
- `matches` / `snippet`: exact `{ field, ranges }` for a fixture registry, and exact snippet text and ranges for a long field.
- `priority`: at an equal match score, a higher priority sorts first. Assert the exact id order.

## Consumer

`~/c/oa/disky-deep-dive/react/SlideSearch.tsx`: would give each slide its plain text as `searchText` and its controls `priority: 1`, then rely on the default snippet line.

## Implementation (done)

- **Best alignment:** `fuzzyMatch` tries every alignment start (each occurrence of the query's first character) and keeps the best-scoring greedy alignment, so a contiguous occurrence anywhere beats an earlier scattered one. Exact- and prefix-match bonuses are unchanged.
- **Strictness:** `strictMatch(query, text)` (exported) requires each whitespace-separated term to occur as a substring; it prefers word-start, then whole-word, then earliest occurrences. It applies to `searchText` only; no global `matchMode` was added, since `description` stays short display text and `searchText` covers long bodies.
- **`searchText`** on `ActionConfig` / `ActionDefinition`, weighted like `description` (×1.5).
- **`matches: FieldMatch[]`** on `ActionSearchResult` and `RemoteOmnibarResult`, best weighted score first. Only the best keyword is reported. `matches` is empty for recents and for number-only placeholder queries. Labels that don't match now get empty `labelMatches`; the old greedy scan returned partial ranges.
- **`snippet(text, ranges, { radius = 40, ellipsis = '…' })`** centers on the longest range (earliest on ties) and trims both ends to word boundaries.
- **`priority`** is an additive score boost. `ActionConfig.priority` already existed, documented as "conflict resolution" but unused, so it now means omnibar ranking, consistent with endpoint `priority`. `groupPriority` was skipped; consumers can set `priority` per action.
- **Rendering:** `renderResult` / `renderRemoteResult` (`(result, { selected, query })`) on both `<Omnibar>` and `<OmnibarCmdk>`. The default row is `.kbd-omnibar-result-main`: the highlighted label (`mark.kbd-omnibar-match`) plus a `.kbd-omnibar-result-snippet` line when the best match isn't the label and is in `searchText` / `description` / `keyword`. Remote rows already show `description`, so they show only keyword snippets. Also exported: `Highlight`, `ResultSnippet`, `contextMatch`, `SNIPPET_FIELDS`. Match styling uses `--kbd-omnibar-match-{bg,color,weight,decoration,decoration-color}`.
- **Demo:** `/slide-search`, with `?renderer=custom` and `?renderer=cmdk`. Tests: `site/e2e/match-context.spec.ts`, whose pure-function tests import `use-kbd` directly in the Playwright runner.
