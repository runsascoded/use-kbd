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
