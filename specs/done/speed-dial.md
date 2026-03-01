# `SpeedDial` FAB component

## Problem

`MobileFAB` is a single button that opens the omnibar or lookup modal. It's mobile-only by default, hides on scroll, and provides no way to discover other actions (shortcuts modal, theme toggle, links, etc.). Desktop users get nothing — consumers have to build their own FAB or toolbar separately.

The jc-taxes project evolved a `SpeedDial` that solves this: a unified FAB for all screen sizes with a hover-peek + click-to-pin interaction model and expandable secondary actions. Two of its four buttons (`search` → omnibar, `shortcuts` → modal) are directly wired to `use-kbd` context. The other two (GitHub link, theme toggle) are app-specific but extremely common patterns.

This belongs in `use-kbd` as a configurable component that supersedes `MobileFAB`.

## Design

### Interaction model: hover-peek + click-to-pin

Two independent expansion states, `isHovered` and `isSticky`:

```
isExpanded = isHovered || isSticky
```

- **Hover** (desktop): `onMouseEnter` expands, `onMouseLeave` collapses (unless sticky)
- **Click chevron**: toggles `isSticky` — stays open after mouse leaves
- **Click outside**: clears `isSticky`
- **Long-press primary** (touch): toggles `isSticky`

The chevron visually distinguishes the two states:
- Hover-only: transparent background, `opacity: 0.7`
- Sticky: filled background + shadow, full opacity (looks "pinned")

### Layout (column-reverse, bottom-right)

```
  [custom N  ]   ← extra actions (expanded)
  ...
  [custom 1  ]
  [shortcuts ⌨]   ← built-in: ctx.openModal()
  [search   🔍]   ← built-in: ctx.openOmnibar()
  [▲/▼]           ← chevron (always visible)
```

The two built-in buttons (search, shortcuts) are always present. Custom actions render above them. Search is at the bottom (most important, closest to thumb on mobile).

Wait — actually, looking at the jc-taxes impl, the primary search button is at the very bottom (below the chevron), and the chevron sits between primary and secondary actions. That's the better layout:

```
  [custom N  ]   ← extra actions (expanded)
  ...
  [shortcuts ⌨]   ← built-in secondary
  [▲/▼]           ← chevron (always visible)
  [🔍]            ← primary: always visible, opens omnibar
```

## API

```tsx
interface SpeedDialAction {
  /** Icon element (e.g. <FaGithub />) */
  icon: React.ReactNode
  /** Accessible label */
  label: string
  /** Click handler. If `href` is set, this is ignored. */
  onClick?: () => void
  /** Renders as an <a> instead of <button> */
  href?: string
  /** For links: opens in new tab (default: true for external hrefs) */
  external?: boolean
}

interface SpeedDialProps {
  /**
   * Extra action buttons rendered above the built-in ones.
   * Order: first item = closest to built-in buttons, last = top of stack.
   */
  actions?: SpeedDialAction[]
  /**
   * Whether to show the built-in shortcuts button (default: true).
   * Set false if your app doesn't use ShortcutsModal.
   */
  shortcuts?: boolean
  /**
   * Long-press duration in ms to toggle sticky on touch (default: 400).
   */
  longPressDuration?: number
  /**
   * Positioning (default: { bottom: 20, right: 20 }).
   */
  position?: { bottom?: number; right?: number; left?: number; top?: number }
  /** Custom CSS class for the outermost container */
  className?: string
}
```

### Usage

```tsx
import { SpeedDial } from 'use-kbd'
import { FaGithub } from 'react-icons/fa'
import { MdDarkMode, MdLightMode } from 'react-icons/md'

function App() {
  const { actualTheme, toggleTheme } = useTheme()
  return (
    <>
      {/* ... app content ... */}
      <SpeedDial
        actions={[
          {
            icon: actualTheme === 'dark' ? <MdDarkMode /> : <MdLightMode />,
            label: `Theme: ${actualTheme}`,
            onClick: toggleTheme,
          },
          {
            icon: <FaGithub />,
            label: 'View on GitHub',
            href: 'https://github.com/my/repo',
          },
        ]}
      />
    </>
  )
}
```

Minimal usage (just search + shortcuts, no custom actions):

```tsx
<SpeedDial />
```

## Implementation

### New file: `src/SpeedDial.tsx`

The component uses `useMaybeHotkeysContext` (like `MobileFAB`) so it degrades gracefully outside a `HotkeysProvider`.

Internal state:
- `isSticky: boolean` — toggled by chevron click, long-press, cleared by click-outside
- `isHovered: boolean` — set by `onMouseEnter`/`onMouseLeave`
- `isExpanded = isSticky || isHovered`

Click-outside uses a container `ref` + `document.contains(target)` guard to handle React re-renders that detach the event target from the DOM (e.g. theme toggle re-rendering the tree causes `target.closest()` to fail on the orphaned node).

Long-press uses non-passive `touchstart` listener (via `useEffect` + `addEventListener`) since React's `onTouchStart` is passive by default and can't `preventDefault`.

### Responsive sizing

Use CSS custom properties with defaults, so consumers can override:

```css
:root {
  --kbd-fab-size: 48px;         /* primary button */
  --kbd-fab-size-sm: 40px;      /* secondary buttons */
  --kbd-fab-font: 22px;
  --kbd-fab-font-sm: 18px;
}

@media (max-width: 768px) {
  :root {
    --kbd-fab-size: 44px;
    --kbd-fab-size-sm: 38px;
    --kbd-fab-font: 20px;
    --kbd-fab-font-sm: 17px;
  }
}
```

### CSS classes

All styling via CSS classes (not inline styles), using `kbd-` prefix consistent with the rest of `use-kbd`:

| Class | Element |
|---|---|
| `.kbd-speed-dial` | Container (fixed, column-reverse) |
| `.kbd-speed-dial-primary` | Search button |
| `.kbd-speed-dial-chevron` | Chevron toggle |
| `.kbd-speed-dial-chevron-sticky` | Added when sticky (filled bg) |
| `.kbd-speed-dial-action` | Secondary action buttons |
| `.kbd-speed-dial-expanded` | Added to container when expanded |

### Built-in icons

The search button reuses `SearchIcon` from `SearchTrigger.tsx`. The shortcuts button and chevron use inline SVGs (no `react-icons` dependency — `use-kbd` shouldn't require it). Simple keyboard and chevron icons:

```tsx
function KeyboardIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" style={{ width: '1em', height: '1em' }}>
      <path d="M20 5H4c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm-9 3h2v2h-2V8zm0 3h2v2h-2v-2zM8 8h2v2H8V8zm0 3h2v2H8v-2zm-1 2H5v-2h2v2zm0-3H5V8h2v2zm9 7H8v-2h8v2zm0-4h-2v-2h2v2zm0-3h-2V8h2v2zm3 3h-2v-2h2v2zm0-3h-2V8h2v2z"/>
    </svg>
  )
}

function ChevronUpIcon() { /* ... */ }
function ChevronDownIcon() { /* ... */ }
```

## Relationship to existing components

### `MobileFAB` → deprecated

`SpeedDial` fully supersedes `MobileFAB`:

| `MobileFAB` feature | `SpeedDial` equivalent |
|---|---|
| `target="omnibar"` | Built-in (always present) |
| `target="lookup"` | Could add as built-in toggle, or pass as custom action |
| `visibility="auto"` | Not needed; always visible, hover interaction is a no-op on touch |
| `hideOnScroll` | Drop for now (SpeedDial is always visible); could add later |
| `icon` | Primary always uses `SearchIcon` |

Deprecate `MobileFAB` with a console warning pointing to `SpeedDial`. Keep exporting for BC, remove in next major.

### `SearchTrigger` → keep

`SearchTrigger` remains useful for embedding search into custom toolbars/menus. It's a headless-ish trigger, not a positioned FAB. Complementary, not redundant.

## Files

| File | Change |
|---|---|
| `src/SpeedDial.tsx` | New component |
| `src/styles.css` | Add `.kbd-speed-dial-*` classes, CSS custom properties |
| `src/index.ts` | Export `SpeedDial`, `SpeedDialProps`, `SpeedDialAction` |
| `src/MobileFAB.tsx` | Add deprecation notice in JSDoc |

## Test plan

1. Default (`<SpeedDial />`): search + shortcuts buttons, chevron between
2. Hover container → expands (secondary actions visible), leave → collapses
3. Click chevron → sticky (chevron gains filled style), leave → stays open
4. Click chevron again → un-sticky
5. Click outside while sticky → collapses
6. Click search → opens omnibar (expanded or not)
7. Click shortcuts → opens ShortcutsModal
8. Long-press search (touch) → toggles sticky
9. Custom `actions` render above built-ins in order
10. `actions` with `href` render as `<a>`, with `onClick` render as `<button>`
11. `shortcuts={false}` hides the keyboard shortcuts button
12. Theme toggle (custom action) works repeatedly without collapsing
13. No `react-icons` in bundle — all icons are inline SVGs
14. Works outside `HotkeysProvider` (renders nothing, like `MobileFAB`)
