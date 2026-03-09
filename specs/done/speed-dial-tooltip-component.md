# SpeedDial: `TooltipComponent` prop

## Context

`SpeedDial` action buttons currently render native `title` attributes for tooltips (lines 243, 257 in `SpeedDial.tsx`). These are slow to appear, unstyled, and inconsistent with apps that use `@floating-ui/react` or similar tooltip libraries.

`ShortcutsModal` already accepts a `TooltipComponent` prop for its digit-placeholder tooltips. SpeedDial should follow the same pattern.

## Requested from

[hudson-transit](https://github.com/hccs-org/hub-bound-travel) — uses `@floating-ui/react` for all toggle tooltips, wants SD buttons to match.

## Changes

### `SpeedDialProps`

Add optional `TooltipComponent` prop:

```ts
export interface SpeedDialProps {
  // ...existing props...
  /** Custom tooltip wrapper. Accepts { title, children } props.
   *  Default renders native title attribute. */
  TooltipComponent?: ComponentType<{ title: string; children: ReactNode }>
}
```

### `SpeedDial` component

1. Accept `TooltipComponent` in destructured props
2. Define a default fallback that renders `title` attribute (current behavior):
   ```ts
   const Tip = TooltipComponent ?? (({ title, children }: { title: string; children: ReactNode }) => (
     <span title={title}>{children}</span>
   ))
   ```
3. Wrap each action button/link with `<Tip title={action.label}>`:
   ```tsx
   // Instead of:
   <button ... title={action.label}>{action.icon}</button>

   // Render:
   <Tip title={action.label}>
     <button ... aria-label={action.label}>{action.icon}</button>
   </Tip>
   ```
4. Remove `title={action.label}` from the `<button>` and `<a>` elements (the `Tip` wrapper handles it now). Keep `aria-label`.

### Also wrap

- The primary button (with `ariaLabel` text)
- The chevron button (with "Expand/Collapse actions" text)

These currently only have `aria-label`, no visible tooltip at all.

## Placement hint

SD buttons stack vertically, so tooltip placement should default to `'left'` (or whichever side faces away from the viewport edge). The `TooltipComponent` contract is just `{ title, children }` — placement is the consumer's responsibility. Document this in the JSDoc:

```ts
/** Custom tooltip wrapper for action buttons.
 *  Recommended placement: opposite the SD's viewport edge (typically 'left').
 *  Receives { title: string, children: ReactNode }. */
```

## Consumer usage (hudson-transit example)

```tsx
import { useFloating, useHover, useInteractions, offset, flip, shift, FloatingPortal } from '@floating-ui/react'

function SDTooltip({ title, children }: { title: string; children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const { refs, floatingStyles, context } = useFloating({
    open, onOpenChange: setOpen,
    placement: 'left',
    middleware: [offset(8), flip(), shift({ padding: 8 })],
  })
  const hover = useHover(context, { delay: { open: 300, close: 0 } })
  const { getReferenceProps, getFloatingProps } = useInteractions([hover])
  return (
    <>
      <span ref={refs.setReference} {...getReferenceProps()}>{children}</span>
      {open && (
        <FloatingPortal>
          <div ref={refs.setFloating} className="sd-tooltip" style={floatingStyles} {...getFloatingProps()}>
            {title}
          </div>
        </FloatingPortal>
      )}
    </>
  )
}

<SpeedDial actions={sdActions} TooltipComponent={SDTooltip} />
```

## Scope

- Only `SpeedDial.tsx` changes
- No new dependencies
- Backwards compatible (default behavior unchanged)
- Export `SpeedDialProps` already includes the new optional prop
