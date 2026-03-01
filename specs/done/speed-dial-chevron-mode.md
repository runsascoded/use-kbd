# SpeedDial: chevron display modes

## Problem

The SpeedDial renders a separate chevron button above the primary (search) button, with an 8px gap. In apps with dense bottom-right UIs (sliders, controls), this two-button stack creates click-target collisions and takes up too much vertical space. Currently the only workaround is fragile CSS overrides with `!important`.

## Proposed API

Add a `chevronMode` prop to `SpeedDialProps`:

```typescript
interface SpeedDialProps {
  // ...existing props...

  /**
   * How to display the expand/collapse chevron:
   * - 'separate' (default): standalone button above the primary button, current behavior
   * - 'badge': small overlapping badge on the primary button's top edge
   * - 'none': no chevron; expand via hover/long-press only
   */
  chevronMode?: 'separate' | 'badge' | 'none'
}
```

## Behavior by mode

### `'separate'` (default, current behavior)
No changes. Chevron is a 40px circle above the primary button with 8px gap.

### `'badge'`
- Chevron shrinks to ~18px circle
- Overlaps the primary button's top edge (negative margin, z-index above primary)
- Lower opacity (0.5), full opacity on hover
- Gap between items becomes 0
- Still fully clickable to toggle sticky
- When sticky, uses the same accent background but at the smaller badge size

### `'none'`
- Chevron is not rendered
- Expand/collapse only via:
  - Hover (desktop)
  - Long-press on primary button (mobile, already implemented)
  - Click-outside to dismiss sticky (already implemented)

## Implementation

### `SpeedDial.tsx`

1. Accept `chevronMode` prop (default `'separate'`)
2. When `'none'`: skip rendering the chevron `<button>` entirely
3. When `'badge'`: add `kbd-speed-dial-badge` class to the chevron button, and `kbd-speed-dial-badge-mode` class to the container

### `styles.css`

Add styles for badge mode:

```css
/* Badge mode: collapse gap, shrink chevron into primary button edge */
.kbd-speed-dial-badge-mode {
  gap: 0;
}

.kbd-speed-dial-chevron.kbd-speed-dial-badge {
  width: 18px;
  height: 18px;
  font-size: 10px;
  margin-bottom: -12px;
  z-index: 1;
  opacity: 0.5;
}

.kbd-speed-dial-chevron.kbd-speed-dial-badge:hover {
  opacity: 1;
}

.kbd-speed-dial-chevron.kbd-speed-dial-badge.kbd-speed-dial-sticky {
  width: 18px;
  height: 18px;
  font-size: 10px;
}
```

The secondary actions (when expanded) still render above the chevron with normal sizing, since they pop out on hover/sticky and aren't part of the resting footprint.

## Downstream usage (elvis)

```tsx
<SpeedDial actions={speedDialActions} chevronMode="badge" />
```
