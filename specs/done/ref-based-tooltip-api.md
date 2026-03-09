# Ref-based `TooltipComponent` API

## Problem

The current `TooltipComponent` contract is `{ title: string; children: ReactNode }` — the tooltip *wraps* the target element. This forces consumers to insert a wrapper DOM node (e.g. `<span>`) around buttons/links, which:

1. **Breaks layout** — SpeedDial uses `column-reverse` flex; an extra `<span>` wrapper disrupts button sizing/spacing
2. **Requires workarounds** — `display: contents` removes the box (so floating-ui has nothing to anchor to), `display: inline-flex` works but consumers must discover this themselves
3. **Couples positioning to wrapping** — tooltip libraries like `@floating-ui/react` need a ref on the anchor element, but the wrapper approach means the ref lands on the wrapper, not the actual button

## Proposed: ref-based API

Instead of wrapping children, pass the tooltip a ref to attach to the target element. The tooltip renders only the floating overlay, not the anchor.

### New contract

```ts
export interface TooltipProps {
  /** Tooltip text */
  title: string
  /** Ref callback to attach to the anchor element */
  anchorRef: React.RefCallback<HTMLElement>
  /** Props to spread onto the anchor element (hover listeners, aria) */
  anchorProps: Record<string, unknown>
}

export type TooltipComponent = ComponentType<TooltipProps>
```

### Internal usage (SpeedDial, ShortcutsModal)

Before (wrapper-based):
```tsx
<Tip title={action.label}>
  <button className={cls} onClick={action.onClick}>
    {action.icon}
  </button>
</Tip>
```

After (ref-based):
```tsx
<>
  <Tip title={action.label} anchorRef={setRef} anchorProps={tipProps} />
  <button ref={setRef} className={cls} onClick={action.onClick} {...tipProps}>
    {action.icon}
  </button>
</>
```

Or, more ergonomically, use a hook internally:

```tsx
function TippedButton({ tip: Tip, title, ...buttonProps }) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null)
  const anchorRef = useCallback((el: HTMLElement | null) => setAnchor(el), [])
  // Tip renders the portal/overlay, anchored to the button via `anchor`
  return (
    <>
      <button ref={anchorRef} {...buttonProps} />
      {anchor && <Tip title={title} anchor={anchor} />}
    </>
  )
}
```

### Simplest variant: element-based anchor

Actually, the simplest API change that avoids the wrapper problem:

```ts
export interface TooltipProps {
  title: string
  /** The anchor element to position relative to */
  anchor: HTMLElement | null
  /** Whether the anchor is currently hovered */
  hovered: boolean
}
```

use-kbd handles hover detection internally (it already knows when buttons are hovered for SpeedDial) and passes the element + hover state. The tooltip component just needs to render a positioned overlay:

```tsx
// Consumer implementation with @floating-ui/react
function MyTooltip({ title, anchor, hovered }: TooltipProps) {
  const { refs, floatingStyles } = useFloating({
    elements: { reference: anchor },
    placement: 'left',
    middleware: [offset(8), flip(), shift()],
  })
  if (!hovered || !anchor) return null
  return (
    <FloatingPortal>
      <div ref={refs.setFloating} style={floatingStyles} className="tooltip">
        {title}
      </div>
    </FloatingPortal>
  )
}
```

This is the cleanest:
- No wrapper node at all
- use-kbd manages hover state (already has `onMouseEnter`/`onMouseLeave` on SD actions)
- Consumer only renders the floating element
- Works with any positioning library

## Migration

### Backwards compatibility

Support both APIs during transition:

```ts
// Detect which API the component uses by checking its prop signature
// Or: use a separate prop name
interface SpeedDialProps {
  /** @deprecated Use TooltipRenderer instead */
  TooltipComponent?: LegacyTooltipComponent  // { title, children }
  /** New ref-based tooltip */
  TooltipRenderer?: TooltipRendererComponent  // { title, anchor, hovered }
}
```

Or just do a breaking change — the old API was only introduced one version ago (the spec we just completed), so there are likely no other consumers yet.

### Default implementation

The default remains native `title` attribute, set directly on the button (no wrapper needed, as it is today without any `TooltipComponent`).

## Scope

- `SpeedDial.tsx` — manage hover state per-action, pass `anchor` + `hovered` to renderer
- `ShortcutsModal.tsx` — same pattern for action label tooltips
- Export new `TooltipProps` / `TooltipRendererComponent` types
- Update existing `TooltipComponent` type or add parallel `TooltipRenderer`

## Decision needed

1. **Breaking change or parallel prop?** Given the `TooltipComponent` wrapper API shipped very recently, a clean break seems fine. Rename to `TooltipRenderer` to signal the API change.
2. **Hover management** — use-kbd handles hover detection internally (simpler for consumers) vs. passing ref+props and letting consumers handle hover (more flexible). Recommend: use-kbd handles it.
