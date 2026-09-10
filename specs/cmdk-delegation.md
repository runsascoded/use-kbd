# Delegate omnibar internals to `cmdk` (speculative)

**Status**: exploratory / not committed. Worth trying on a branch before deciding.

## Motivation

use-kbd's omnibar has grown into three overlapping responsibilities:

1. **Palette UI/UX primitives** — input, results list, item rendering, keyboard nav, filter/rank.
2. **Action-registry bridge** — turning registered actions + endpoint results into palette entries; rendering keybinding hints; kicking off `ParamEntry` flows.
3. **Batteries-included default** — the mounted `<Omnibar />` that ships with the library.

(1) is what [`cmdk`](https://github.com/pacocoursey/cmdk) does, and does well — it's the same primitive set (`<Command.Root|Input|List|Item|Group|Empty>`), mature (~16k stars), a11y-conscious, and powers Vercel/Linear/Raycast-web. Rebuilding it ourselves is partial NIH and ongoing maintenance weight that doesn't differentiate use-kbd.

(2) and (3) are the actual differentiators: the tight coupling to the action registry, hotkey-hint rendering inside items, mode-aware filtering, endpoint registration, and ParamEntry are what make use-kbd's omnibar useful **beyond** a generic palette.

Downstream pressure is pushing toward a more flexible API — consumers want custom omnibars (e.g. inline/persistent pickers, map-brushing on item hover, richer item rendering with icons/previews, multi-instance omnibars bound to different key sequences). Building those on a hand-rolled internal renderer means re-implementing every cmdk primitive we need. Building them on cmdk means consumers get a well-understood, documented foundation.

## Proposal (speculative)

### Keep public API stable for existing users

Outward-facing exports stay the same:
- `<Omnibar />`, `OmnibarProps`, `OmnibarRenderProps`
- `useOmnibar`, `useOmnibarEndpoint`
- `OmnibarEndpointsRegistry`, endpoint types, entry types

Existing consumers (e.g. awair, ctbk, apvd) should see no behavior change beyond the caveats below.

### Internally, `<Omnibar />` becomes a cmdk wrapper

The built-in palette's hand-rolled input/list/keyboard-nav code gets replaced with cmdk primitives. The action-registry + endpoint bridge stays — it just feeds cmdk instead of an internal renderer.

### Net-new headless exports (opt-in)

Expose compound primitives for consumers who want custom palettes:

```tsx
import { Omnibar, useOmnibarState } from 'use-kbd'

const state = useOmnibarState({
  id: 'stations',
  endpoints: ['stations'],
  openOn: '/',
  onHighlight: entry => mapRef.current?.brush(entry.lat, entry.lng),
  onSelect: entry => navigate(`/s/${entry.id}`),
})

<Omnibar.Root state={state}>
  <Omnibar.Input placeholder="Search stations..." />
  <Omnibar.List>
    {state.results.map((e, i) => (
      <Omnibar.Item key={e.id} entry={e} index={i}>
        <StationIcon lat={e.lat} />
        <span>{e.name}</span>
        <Kbd binding={e.hotkey} />
      </Omnibar.Item>
    ))}
  </Omnibar.List>
</Omnibar.Root>
```

`<Omnibar.*>` are cmdk primitives + pre-wired use-kbd hooks:
- Action-registry integration (`<Omnibar.Item>` can auto-derive `onSelect` from an action ID).
- Hotkey hint rendering (`<Kbd>` lookups the action's current binding).
- Endpoint subscription (item results flow from registered endpoints, filtered by `endpoints` prop).
- `onHighlight` callback fires on keyboard-nav or mouse hover — enables map brushing, live previews, rich secondary panes.
- Multi-instance: each `useOmnibarState({ id })` registers independently, with its own open state and keybinding.

### What this is NOT

- Not a rewrite of use-kbd's action registry, keybinding management, sequences, modes, SpeedDial, KbdModal, or ShortcutsModal. Those remain hand-rolled — they're genuinely use-kbd-unique.
- Not a deprecation of `<Omnibar />`. It stays, just reimplemented internally.

## Caveats (to investigate on the branch)

1. **DOM structure changes** — anyone styling into the omnibar's internal DOM (selectors like `.kbd-omnibar-list > div`) will break. Mitigations: keep equivalent class names on the cmdk primitives via `className` props, or ship as a major version bump.

2. **Filter/rank semantics may differ** — cmdk's default scoring is fuzzy-ish; use-kbd's current ranking prioritizes starts-with matches. Fix: pass a custom `filter` prop to cmdk preserving existing behavior. Needs a parity-test suite.

3. **Keyboard-nav edge cases** — wrap-around, empty list, escape handling, `⌘K` toggle while open, focus restoration on close. All need parity tests before merging.

4. **New peer dep: `cmdk`** — small (~8 KB gzipped, MIT, React ≥16.8). Adds a transitive dep boundary.

5. **Accessibility** — likely an improvement (cmdk has solid aria hygiene). Verify with axe-core.

6. **cmdk's `<Command.Item>` selection model** — uses string-keyed `value` internally. Endpoint entries need stable string IDs; verify our entry types already have those.

7. **Provider interaction** — cmdk's `<Command.Root>` provides its own context. use-kbd's `HotkeysProvider` is separate; `<Omnibar.Root>` should nest them correctly.

8. **ParamEntry flow** — when an action needs a captured arg, use-kbd currently transitions the omnibar into param-entry mode. Verify this flow can be preserved with cmdk, or factor it out as a layer above.

## Suggested branch plan

1. Branch: `cmdk-delegation`.
2. Add `cmdk` as a dep. Leave existing `<Omnibar />` in place.
3. Build a *parallel* implementation: `<OmnibarCmdk />` (or similar internal name) that mounts cmdk primitives wired to the same action-registry + endpoints as `<Omnibar />`.
4. Write parity tests (keyboard-nav, filter/rank, ParamEntry, endpoint switching).
5. Dogfood in a consumer repo (`apvd` or `ctbk`) by swapping `<Omnibar />` for `<OmnibarCmdk />` locally.
6. Compare feel, bundle size, a11y, CSS migration cost.
7. Decide: merge (replacing `<Omnibar />`'s internals), ship side-by-side, or drop.
8. If merging, decide: same major version (if DOM-compat adapters work) or bump to `1.0`.

## Related: custom omnibars (independent of cmdk decision)

Even without adopting cmdk, the downstream need for `onHighlight` + multi-instance + custom item rendering is real. If the cmdk branch doesn't pan out, those features still need to land somewhere — likely as new props/hooks on the existing `<Omnibar />` (less leverage, more maintenance).

The cmdk approach makes those features come mostly-free via cmdk's primitives; the hand-rolled approach requires building each ourselves.

## Open questions

- Does cmdk support registering multiple independent palette instances cleanly? (Likely yes via `<Command.Root>` scoping, but needs verification.)
- Can cmdk's filter prop accept a full async/ranked result set (e.g. debounced server search), or only synchronous filter-over-children? (Endpoints with async sources matter for use-kbd.)
- How does cmdk handle "loading" / "error" states per endpoint? use-kbd's endpoints can be async.
- What's the story for nested groups (e.g. "Actions" > "Navigation" > items)?
- How mobile-friendly is cmdk's default nav compared to SpeedDial + omnibar today?

## See also

- `cmdk`: https://github.com/pacocoursey/cmdk — canonical headless command palette
- `downshift`: https://github.com/downshift-js/downshift — older combobox primitives (more general, less palette-specific)
- `ariakit` composite widgets: https://ariakit.org/components/composite — a11y primitives that overlap with cmdk

## Spike results (cmdk-delegation branch)

Implemented steps 1-3 of the branch plan as a working proof:

- **`cmdk@1.1.1`** added (external in the tsup build; `from 'cmdk'`, ~8 KB gz, not bundled — lib CJS +6 KB from `OmnibarCmdk` source only).
- **`src/OmnibarCmdk.tsx`** — a parallel palette on cmdk primitives (`Command` / `Command.Input` / `Command.List` / `Command.Group` / `Command.Item` / `Command.Empty`) fed by the **same `useOmnibar`** bridge (action registry + endpoints) and `ctx.executeAction`. `shouldFilter={false}` so use-kbd's ranking + async endpoints drive results; cmdk owns input, list, keyboard-nav, and a11y (`role="combobox"`, `[cmdk-item]`, `[cmdk-group-heading]`).
- **`site/src/routes/CmdkDemo.tsx`** (`/cmdk`) — Counter actions + an async Fruits endpoint.

**CIC (RACx, http://localhost:3752/cmdk)** — ⌘K opens it; it lists the full action registry (Navigation/Counter/builtins, with binding chips) and the async **Fruits** group; typing `grape` narrows to the one endpoint result (refetch + rank through cmdk); selecting it fires the entry `handler` (`Picked: Grape`) and closes. Confirmed working end-to-end.

**Verdict: promising — cmdk cleanly backs the palette UI while the registry/endpoint bridge is untouched.** The hard part (feeding cmdk from async, ranked, registry-driven results) works with `shouldFilter={false}`.

**Not yet wired (the parity work, steps 4-7)** — each is a known gap, not a blocker:
- ParamEntry flow (capture a numeric arg mid-palette).
- Endpoint pagination / infinite-scroll (`loadMore`, scroll sentinel).
- Sequence completions view (SequenceModal-style) and recents highlighting.
- Mode-scoped filtering nuances.
- CSS parity: the spike reuses `kbd-omnibar*` classes loosely; a real migration needs the DOM-compat adapter (or a major bump), per Caveat 1.

**Recommendation**: worth pursuing to a full parity pass + a dogfood swap in a consumer (apvd/ctbk) before deciding merge-vs-drop. Kept on this branch, off `main`.
