# SpeedDial: fix mobile tap-to-toggle

## Bug

On mobile (touch devices), the SpeedDial gets stuck open after tapping the chevron to expand.

### Root cause

`isExpanded = isSticky || isHovered`. On touch devices:
1. Tapping the chevron fires `onClick` → `setIsSticky(true)` (opens)
2. The tap also fires `mouseenter` → `setIsHovered(true)`
3. Tapping chevron again fires `onClick` → `setIsSticky(false)`
4. But `mouseleave` never fires (no mouse cursor to leave), so `isHovered` stays `true`
5. `isExpanded` remains `true` because `isHovered` is still set

### Fix

Suppress `isHovered` on touch devices. Options:

**A. Clear `isHovered` on any touch interaction:**
```ts
const handleChevronClick = useCallback(() => {
  setIsSticky(s => !s)
  setIsHovered(false) // ensure hover doesn't keep it open
}, [])
```

**B. Track touch vs mouse input:**
```ts
const isTouchRef = useRef(false)
// On touchstart anywhere in container, mark as touch
// Only set isHovered on mouseenter if !isTouchRef.current
// Reset isTouchRef after a timeout (to handle hybrid devices)
```

Option A is simpler and sufficient.

### Also

The outside-click handler for dismissal (`touchstart` on document) works correctly — the issue is purely that `isHovered` prevents collapse when sticky is toggled off.
