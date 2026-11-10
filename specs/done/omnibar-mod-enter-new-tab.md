# Omnibar: ⌘↵ / Ctrl↵ opens the selected action in a new tab

## Motivation

From disky (cw.oa.dev): its omnibar has page-jump actions ("This page on gcs.oa.dev/scans", "This page on dev: …"). To offer "…in a new tab" it registers a second, duplicate action per target ("This page on dev ↗: …", bound to `G ⇧ D`), which doubles the result list. The browser convention is a modifier on the same gesture: ⌘-click / Ctrl-click / middle-click opens a link in a new tab. The omnibar should follow it: **⌘↵ (macOS) / Ctrl↵ (elsewhere) on a selected result opens it in a new tab**, when the result has a URL.

Today it can't be done app-side either: `useOmnibar`'s `executeWithCaptures` calls the handler with a synthetic `new KeyboardEvent('keydown', { key: 'Enter' })`, so the handler never sees the real modifiers. Both the `Omnibar` and `useOmnibar` `Enter` cases call `execute()` with no event.

## Design

1. **`ActionConfig.href?: string | (() => string)`**: an action's URL, read lazily (disky's targets depend on `location.href` at execute time). With `href` set:
   - **↵ / click**: run `handler` if there is one, else `location.assign(href)`. (`handler` is optional when `href` is set.)
   - **⌘↵ / Ctrl↵, ⌘-click / Ctrl-click / middle-click**: open a background tab, never the handler. The omnibar closes, the same as on ↵.
   - **⌘⇧↵ / Ctrl⇧↵, ⌘⇧-click / Ctrl⇧-click / ⇧middle-click**: open and switch to a new tab.
   - **⇧↵ / ⇧-click**: open a normal browser window. Keyboard variants use link activation with `rel="noopener"`; actual modified clicks retain their native default action. Browser preferences can override focus/window placement.
   - Hotkey bindings are unchanged: a binding still runs the handler. An app that wants a new-tab hotkey keeps a separate action (disky's `G ⇧ D`), or binds a modifier variant itself.
2. **Remote entries**: `OmnibarLinkEntry` (`href`) gets the same ⌘↵ behavior. `OmnibarActionEntry` with no `href` is unchanged.
3. **No `href`**: ⌘↵ behaves like ↵ (today's behavior) and passes the **real** event to the handler (replacing the synthetic one), so handlers can still branch on `e.metaKey` / `e.ctrlKey` themselves. Click execution passes the click's `MouseEvent`, or a synthesized event that carries its modifiers.
4. **Hint**: when the selected result has an `href`, the results footer shows `⌘↵ new tab`, `⌘⇧↵ switch`, and `⇧↵ new window` (`Ctrl` replaces `⌘` off macOS, using the lib's existing platform-modifier rendering). Nothing is shown otherwise.
5. **Rows as links**: render rows with an `href` as `<a href>` (the click handler still drives ↵ semantics), so hover shows the URL and native middle-click / ⌘-click work without extra code.

Both the built-in `<Omnibar>` and `OmnibarCmdk` get this, plus `useOmnibar`'s headless `execute(actionId?, captures?, event?)`. The new trailing `event` param is optional, so existing callers are unaffected.

## Tests

- ↵ on an `href` + `handler` action runs the handler. ⌘↵ activates a link with the new-tab modifier and `rel="noopener"`, and not the handler. Ctrl↵ does the same off macOS.
- An `href`-only action: ↵ → `location.assign(href)`, ⌘↵ → background-tab link activation.
- A lazy `href` is read at execute time, not at registration.
- No `href`: the handler receives an event with `metaKey: true` on ⌘↵.
- A remote `OmnibarLinkEntry` with ⌘↵ opens a new tab.
- The hint shows only when the selection has an `href`.
- Headful browser checks distinguish background tabs, foreground tabs, and normal browser windows; headless checks cover navigation and opener isolation. Include native modifier-click and middle-click variants, both renderers, and remote links.

## Downstream (disky)

Once released: `SiteKbd.tsx`'s peer / prod↔dev actions gain `href: () => peerHref(…, location.href)` and drop their handlers. The duplicate "↗" omnibar entries go away; the `G ⇧ D` new-tab hotkey stays as a hotkey-only action, or becomes ⌘↵ on the one entry.

## Implementation (2026-11-10)

- Added `ActionHref`, optional `ActionConfig.handler`, and live URL getters in both registration hooks. URL closures are read again at execution; they can change on a render without re-registering the action. Handler-free actions navigate with `location.assign`, including when executed directly through the registry.
- `useOmnibar.execute(actionId?, captures?, event?)` accepts a native keyboard or mouse event (`OmnibarExecutionEvent`). A URL plus the platform's new-tab modifier, middle-click, or Shift opens a new browsing context without invoking the handler or execution callbacks. Keyboard/headless execution activates a temporary anchor with the gesture's modifiers and `target="_blank" rel="noopener"`. Modifier alone requests a background tab, modifier+Shift a foreground tab, and Shift alone a normal window. Ordinary execution preserves handlers and callbacks. Headless URL entries navigate without requiring callbacks. Parameter entry retains the initiating event.
- Native keyboard events now pass through the palette, provider, and registry to handlers. Mouse events become `KeyboardEvent`s with the same modifiers, preserving the existing handler type. Direct hotkeys retain their handler semantics.
- Both renderers use a shared result-row component: URL rows are anchors with an actual `href` and `rel="noopener"`. Ordinary clicks execute through the hook; modified clicks and middle-clicks keep their native default action. Lazy URLs refresh before activation, and palette closing is deferred until after native link activation so unmounting does not cancel navigation. cmdk retains its option roles, selection, and arrow-key navigation. The selected-link footer shows all three keyboard gestures using the existing Command/Shift icons (Ctrl text off macOS).
- Added `/omnibar-links` and `/omnibar-links?renderer=cmdk` demos, plus a headless execution probe at `?renderer=headless`; documented the API in the README. Consumer changes and publication remain separate work.
- The site's shared `ActionLink` registers `href: to`, so existing Navigation actions (including Canvas from `/table`) support these gestures and ordinary Enter retains client-side navigation.
- Link text inherits ordinary command-row color by default, including hover, with a muted decorative ↗ SVG at the right edge. `--kbd-omnibar-link-color` and `--kbd-omnibar-link-indicator-color` customize row/arrow colors; `.kbd-omnibar-link-indicator { display: none; }` hides the arrow while preserving the link and footer hint. Prose links retain their own color/underline rules.
- Tests: 70 navigation/style cases across `site/e2e/omnibar-links.spec.ts` and `site/e2e/omnibar-dispositions.spec.ts` cover both renderers, headless execution, real destination pages, opener isolation, lazy/current URLs, URL-only actions, ordinary handlers, remote links, hints, empty lists, parameter entry, direct hotkeys, and CSS customization. Native click tests use the real OS modifier, while keyboard request tests also cover simulated platforms. Shift+Enter and Shift-click regressions failed before implementation. A serial `--headed` run additionally checks distinct window IDs and destination focus with Playwright's focus emulation disabled; headless mode cannot establish those properties.
- Visual verification: desktop, mobile, and cmdk screenshots were reviewed in isolated Chromium; the footer fits and wraps without horizontal overflow. The live Chrome DevTools connector could not attach, so this is automated browser verification rather than a claim about the user's existing Chrome profile.
- Final checks: library ESM/CJS/declarations build, site TypeScript, library lint (warnings only), and targeted site/test lint pass. All 70 navigation/style cases passed in the full run; a dedicated serial headful run passed all 22 cases present at that point, including the complete focus/window matrix. The full serial suite was 212/214: existing float-sequence tests "SequenceModal shows float placeholder completions" and "SequenceModal shows completions for leading dot (start of float)" failed to show the sequence panel, then each passed 3/3 isolated reruns. An earlier parallel run also had initial-keystroke failures in existing sequence tests, which passed isolated repeats. The matching engine and those test assertions were not changed here.
