# SpeedDial: Extend `position` prop to support all corners

## Context

Currently `SpeedDialProps.position` only accepts `{ bottom?: number; right?: number }`. Consumers that want to place the SpeedDial on the left side must use CSS class overrides with `!important` to fight the inline `right` style.

## Change

Extend `SpeedDialProps.position` to accept all four edges:

```ts
position?: { top?: number; bottom?: number; left?: number; right?: number }
```

Only one of `top`/`bottom` and one of `left`/`right` should be set. Default remains `{ bottom: 20, right: 20 }`.

### Implementation

In `SpeedDial.tsx`, the inline style (currently hardcoded `bottom` + `right`) should resolve the position from the prop:

```ts
const bottom = position?.bottom
const top = position?.top
const right = position?.right
const left = position?.left
// Default: bottom-right
const verticalProp = top != null ? 'top' : 'bottom'
const verticalVal = top ?? bottom ?? 20
const horizontalProp = left != null ? 'left' : 'right'
const horizontalVal = left ?? right ?? 20
```

Then apply in the container style:
```ts
style={{
  position: 'fixed',
  [verticalProp]: `calc(${verticalVal}px + env(safe-area-inset-${verticalProp}, 0px))`,
  [horizontalProp]: `${horizontalVal}px`,
}}
```

This removes the need for CSS `!important` overrides in consumers.

## Motivation

`jc-taxes` app has a corner-pinning feature (`?sp=tl|tr|bl|br`) that moves all chrome (settings panel, SpeedDial, attribution) to any corner. Currently requires a `.speed-dial-left` CSS hack to override SpeedDial's inline `right` style.
