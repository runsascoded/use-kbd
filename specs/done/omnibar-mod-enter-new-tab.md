# Omnibar: ⌘↵ / Ctrl↵ opens the selected action in a new tab

## Motivation

From disky (cw.oa.dev): its omnibar has page-jump actions ("This page on gcs.oa.dev/scans", "This page on dev: …"). To offer "…in a new tab" it registers a second, duplicate action per target ("This page on dev ↗: …", bound to `G ⇧ D`), which doubles the result list. The browser convention is a modifier on the same gesture: ⌘-click / Ctrl-click / middle-click opens a link in a new tab. The omnibar should follow it: **⌘↵ (macOS) / Ctrl↵ (elsewhere) on a selected result opens it in a new tab**, when the result has a URL.

Today it can't be done app-side either: `useOmnibar`'s `executeWithCaptures` calls the handler with a synthetic `new KeyboardEvent('keydown', { key: 'Enter' })`, so the handler never sees the real modifiers. Both the `Omnibar` and `useOmnibar` `Enter` cases call `execute()` with no event.

## Design

1. **`ActionConfig.href?: string | (() => string)`**: an action's URL, read lazily (disky's targets depend on `location.href` at execute time). With `href` set:
   - **↵ / click**: run `handler` if there is one, else `location.assign(href)`. (`handler` is optional when `href` is set.)
   - **⌘↵ / Ctrl↵, ⌘-click / Ctrl-click / middle-click**: `window.open(href(), '_blank', 'noopener')`, never the handler. The omnibar closes, the same as on ↵.
   - Hotkey bindings are unchanged: a binding still runs the handler. An app that wants a new-tab hotkey keeps a separate action (disky's `G ⇧ D`), or binds a modifier variant itself.
2. **Remote entries**: `OmnibarLinkEntry` (`href`) gets the same ⌘↵ behavior. `OmnibarActionEntry` with no `href` is unchanged.
3. **No `href`**: ⌘↵ behaves like ↵ (today's behavior) and passes the **real** event to the handler (replacing the synthetic one), so handlers can still branch on `e.metaKey` / `e.ctrlKey` themselves. Click execution passes the click's `MouseEvent`, or a synthesized event that carries its modifiers.
4. **Hint**: when the selected result has an `href`, the results footer (or the selected row's right edge) shows `⌘↵ new tab` (`Ctrl↵` off macOS, using the lib's existing platform-modifier rendering). Nothing is shown otherwise.
5. **Rows as links**: render rows with an `href` as `<a href>` (the click handler still drives ↵ semantics), so hover shows the URL and native middle-click / ⌘-click work without extra code.

Both the built-in `<Omnibar>` and `OmnibarCmdk` get this, plus `useOmnibar`'s headless `execute(actionId?, captures?, event?)`. The new trailing `event` param is optional, so existing callers are unaffected.

## Tests

- ↵ on an `href` + `handler` action runs the handler. ⌘↵ calls `window.open(href, '_blank', 'noopener')` (stubbed) and not the handler. Ctrl↵ does the same on a non-mac `navigator.platform`.
- An `href`-only action: ↵ → `location.assign(href)`, ⌘↵ → `window.open`.
- A lazy `href` is read at execute time, not at registration.
- No `href`: the handler receives an event with `metaKey: true` on ⌘↵.
- A remote `OmnibarLinkEntry` with ⌘↵ opens a new tab.
- The hint shows only when the selection has an `href`.

## Downstream (disky)

Once released: `SiteKbd.tsx`'s peer / prod↔dev actions gain `href: () => peerHref(…, location.href)` and drop their handlers. The duplicate "↗" omnibar entries go away; the `G ⇧ D` new-tab hotkey stays as a hotkey-only action, or becomes ⌘↵ on the one entry.

## Implementation (2026-11-10)

- Added `ActionHref`, optional `ActionConfig.handler`, and live URL getters in both registration hooks. URL closures are read again at execution; they can change on a render without re-registering the action. Handler-free actions navigate with `location.assign`, including when executed directly through the registry.
- `useOmnibar.execute(actionId?, captures?, event?)` accepts a native keyboard or mouse event (`OmnibarExecutionEvent`). A URL plus the platform's new-tab modifier, or a middle-click, calls `window.open(url, '_blank', 'noopener')` and closes the palette without invoking the handler or execution callbacks. Ordinary execution preserves handlers and callbacks. Headless URL entries navigate without requiring callbacks. Parameter entry retains the initiating event.
- Native keyboard events now pass through the palette, provider, and registry to handlers. Mouse events become `KeyboardEvent`s with the same modifiers, preserving the existing handler type. Direct hotkeys retain their handler semantics.
- Both renderers use a shared result-row component: URL rows are anchors with an actual `href`; click and auxclick execute through the same hook as Enter, preventing duplicate native navigation. cmdk retains its option roles, selection, and arrow-key navigation. The selected URL row enables a footer hint with the existing Command icon on macOS or `Ctrl` text elsewhere.
- Added `/omnibar-links` and `/omnibar-links?renderer=cmdk` demos, plus a headless execution probe at `?renderer=headless`; documented the API in the README. Consumer changes and publication remain separate work.
- Added 42 exact-output browser tests across both renderers and the headless API: modifiers, clicks, URL-only actions, remote links, default navigation, lazy/current closures, hints, empty result lists, parameter entry, and unchanged direct hotkeys. The initial modifier/event regressions failed against the old code before implementation. Ctrl-click is dispatched explicitly for the simulated Linux case because native macOS Ctrl-click produces a context menu regardless of a mocked navigator.
- Verification: library ESM/CJS/declarations build; site TypeScript build; library lint (warnings only) and targeted demo/test lint; full Playwright suite, 186/186 passing with two workers. Native Chrome confirmed the default palette's anchor rows and selected-link hint at `http://m3:3752/omnibar-links`; cmdk and headless behavior were exercised by Playwright. The Chrome DevTools MCP could not attach, and native keyboard verification was interrupted by Vimium/user activity, so new-tab execution is covered by the automated browser assertions rather than claimed as a completed manual Chrome check.
- Demo integration follow-up: the site's shared `ActionLink` now registers `href: to`, so existing Navigation actions (including Canvas from `/table`) support new-tab execution. Four additional browser tests cover actual popup tabs, `opener === null`, the original tab staying on its route, and ordinary Enter retaining client-side navigation in both renderers. Both new-tab cases failed before the wiring fix; all 46 omnibar link tests pass afterward. Site types and targeted lint pass. Chrome MCP attachment remained unavailable and native automation reported concurrent user changes, so the follow-up was verified through Playwright's actual browser tabs.
