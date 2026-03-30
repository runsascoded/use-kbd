# Spec: Omnibar infinite scroll for action results

## Problem
When the omnibar has many matching actions (e.g. 65+ channel actions in a Discord viewer), only 10 are shown (`maxResults` default). The list doesn't overflow because results are truncated before rendering, so there's nothing to scroll. Users see a subset with no indication that more exist.

## Current state
- `maxResults` prop defaults to `10`, truncating the action list before render
- CSS is correct: `.kbd-omnibar-results` has `max-height: 50vh` + `overflow-y: auto`
- **Endpoint pagination exists**: `endpointPagination` / `loadMore` / `IntersectionObserver` already implement scroll-based loading for external data sources — but this only applies to endpoint results, not the built-in action list

## Desired behavior
- First page renders ~25-30 results (enough to fill `50vh` on most screens)
- As the user scrolls near the bottom, more results load automatically (infinite scroll)
- Arrow key navigation past the visible results also triggers loading more
- Scroll position resets when the search query changes
- A subtle count indicator ("25 of 65") or "Scroll for more..." hint when truncated
- `overscroll-behavior: contain` on the results container to prevent scroll leaking to the page behind the modal

## Approach

### Option A: Reuse endpoint pagination pattern
Extend the existing `IntersectionObserver`-based pagination to also cover the built-in action list. The observer already watches sentinel elements at group boundaries — add a sentinel after the last rendered action result, and when it intersects, bump the rendered count.

### Option B: Simple rendered-count state
Track `renderedCount` state (starting at ~25), slice the filtered actions to `renderedCount`, and increment on scroll. Simpler than Option A since actions are already fully computed (no async loading), just gated on how many are rendered.

Option B is probably better since actions are synchronous — no loading spinners or `hasMore` state needed, just a render gate.

### Implementation sketch (Option B)
1. Rename `maxResults` to control the **initial page size** (default ~25), not a hard cap
2. Track `renderedCount` in state, reset to initial page size on query change
3. Attach a scroll handler (or IntersectionObserver on a sentinel `<div>`) to `.kbd-omnibar-results`
4. When near bottom, increment `renderedCount` by another page
5. Show count indicator when `totalMatches > renderedCount`
6. Arrow key navigation: if `selectedIndex` approaches `renderedCount`, bump it

### CSS
- Add `overscroll-behavior: contain` to `.kbd-omnibar-results`
- Consider a thin custom scrollbar (already scoped to `.kbd-omnibar-results`)

## Found by
Discord archive viewer with 65 channels registered as omnibar actions — list extends past viewport, user sees only 10.
