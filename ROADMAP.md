# use-kbd Roadmap

## Vision

A downstream app should need minimal code to integrate hotkeys:

1. Define a callback factory and action definitions (with handlers referencing callbacks)
2. Provide an app-specific wrapper that sets up callback slots
3. Wire callbacks where runtime state is available
4. Optionally customize group rendering

Everything else comes from the library.

## Current Problems

### 1. Global Static ACTIONS Without Handlers

Static `ACTIONS` can't have handlers because handlers need runtime state:
```tsx
// Can't do this - no access to `l.set()` here
export const ACTIONS = defineActions({
  'left:temp': { handler: () => l.set('temp') }  // ❌
})
```

Current workaround (making handler optional) is backwards.

**Solution**: Factory pattern with callback slots:
```tsx
// hotkeyConfig.ts
export type AwairCallbacks = {
  setLeftMetric: (m: Metric) => void
  // ...
}

export const createActions = (cb: AwairCallbacks) => defineActions({
  'left:temp': {
    label: 'Temperature',
    handler: () => cb.setLeftMetric('temp'),  // ✅
  },
})
```

### 2. ShortcutsModalContent Has Generic Logic

680 lines, but most is reusable:
- Tab navigation between actions
- Recording hotkeys
- Conflict detection
- Add/remove bindings
- Rendering key combos with modifier icons

Only paired-column layout is app-specific.

**Solution**: Library provides complete modal; apps customize via `renderGroup`.

## Target App Integration

### hotkeyConfig.ts
```tsx
import { defineActions } from 'use-kbd'

export type AwairCallbacks = {
  setLeftMetric: (metric: Metric) => void
  setRightMetric: (metric: Metric | 'none') => void
  handleTimeRangeClick: (hours: number) => void
  handleAllClick: () => void
  toggleLatestMode: () => void
  toggleDevice: (pattern: string) => void
  tablePrevPage: () => void
  tableNextPage: () => void
  // ...
}

export const createActions = (cb: AwairCallbacks) => defineActions({
  'left:temp': {
    label: 'Temperature',
    group: 'Left Y-Axis',
    defaultBindings: ['t'],
    handler: () => cb.setLeftMetric('temp'),
  },
  'left:co2': {
    label: 'CO₂',
    group: 'Left Y-Axis',
    defaultBindings: ['c'],
    handler: () => cb.setLeftMetric('co2'),
  },
  'time:1d': {
    label: '1 day',
    group: 'Time Range',
    defaultBindings: ['1', 'd 1'],
    handler: () => cb.handleTimeRangeClick(24),
  },
  // ...
})
```

### AwairHotkeysProvider.tsx
```tsx
import { createContext, useContext, useRef, useMemo } from 'react'
import { HotkeysProvider } from 'use-kbd'
import { createActions, type AwairCallbacks } from './hotkeyConfig'

type CallbacksRef = MutableRefObject<Partial<AwairCallbacks>>
const AwairCallbacksContext = createContext<CallbacksRef | null>(null)

export function AwairHotkeysProvider({ children }: { children: ReactNode }) {
  const callbacksRef = useRef<Partial<AwairCallbacks>>({})

  // Create actions with delegates to ref
  const actions = useMemo(() => createActions({
    setLeftMetric: (m) => callbacksRef.current.setLeftMetric?.(m),
    setRightMetric: (m) => callbacksRef.current.setRightMetric?.(m),
    handleTimeRangeClick: (h) => callbacksRef.current.handleTimeRangeClick?.(h),
    handleAllClick: () => callbacksRef.current.handleAllClick?.(),
    toggleLatestMode: () => callbacksRef.current.toggleLatestMode?.(),
    toggleDevice: (p) => callbacksRef.current.toggleDevice?.(p),
    tablePrevPage: () => callbacksRef.current.tablePrevPage?.(),
    tableNextPage: () => callbacksRef.current.tableNextPage?.(),
  }), [])

  return (
    <AwairCallbacksContext.Provider value={callbacksRef}>
      <HotkeysProvider actions={actions} config={{ storageKey: 'awair-hotkeys' }}>
        {children}
      </HotkeysProvider>
    </AwairCallbacksContext.Provider>
  )
}

export function useAwairCallbacks() {
  const ctx = useContext(AwairCallbacksContext)
  if (!ctx) throw new Error('useAwairCallbacks must be used within AwairHotkeysProvider')
  return ctx
}
```

### App.tsx
```tsx
function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AwairHotkeysProvider>
          <AppContent />
        </AwairHotkeysProvider>
      </ThemeProvider>
    </QueryClientProvider>
  )
}
```

### AppContent.tsx (or useAwairHotkeys.ts hook)
```tsx
function AppContent() {
  const callbacksRef = useAwairCallbacks()
  const { l, r } = useMetrics()
  // ... other state

  // Wire up callbacks
  useEffect(() => {
    callbacksRef.current = {
      setLeftMetric: (m) => l.set(m),
      setRightMetric: (m) => r.set(m),
      handleTimeRangeClick,
      handleAllClick,
      toggleLatestMode: () => setLatestModeIntended(prev => !prev),
      toggleDevice,
      tablePrevPage,
      tableNextPage,
    }
  }, [l, r, handleTimeRangeClick, ...])

  return (
    <>
      <main>
        <AwairChart ... />
      </main>
      {!isOgMode && <ThemeToggle />}
      {!isOgMode && <ShortcutsModal />}  {/* Zero props! */}
      {!isOgMode && <Omnibar />}         {/* Zero props! */}
    </>
  )
}
```

## Implementation Plan

### Phase 1: Library - Built-in Modal Content

Move generic logic from awair's ShortcutsModalContent into library:

1. Tab navigation (focus ring, Arrow/Tab key handling)
2. Hotkey recording (`useRecordHotkey` already exists)
3. Conflict detection and display
4. Add/remove binding UI
5. Key combo rendering with modifier icons

Expose customization:
```tsx
<ShortcutsModal
  renderGroup={(group, actions, defaultRender) => {
    if (group === 'Left Y-Axis' || group === 'Right Y-Axis') {
      return <MetricPairedGroup left={...} right={...} />
    }
    return defaultRender()
  }}
/>
```

### Phase 2: Library - Type Safety

1. Generic type params: `defineActions<ActionId, GroupId>`
2. ActionId union type derived from action keys
3. GroupId union type derived from group values
4. Type-safe handler maps

### Phase 3: App Migration

1. Create `AwairHotkeysProvider` with callback factory pattern
2. Simplify App.tsx to use zero-prop components
3. Extract paired-column layout as the only custom code
4. Remove `useKeyboardShortcuts.ts` (handlers inline in callback wiring)

## Files to Change

### use-kbd (Phase 1)
- `src/ShortcutsModal.tsx` - Built-in editing UI
- `src/components/GroupRenderer.tsx` - Default group rendering
- `src/components/BindingEditor.tsx` - Binding add/edit/remove
- `src/hooks/useTabNavigation.ts` - Focus management

### awair (Phase 3)
- `src/config/hotkeyConfig.ts` - Callback factory pattern
- `src/providers/AwairHotkeysProvider.tsx` - New file
- `src/App.tsx` - Simplified
- `src/hooks/useKeyboardShortcuts.ts` - Deleted or simplified
- `src/components/ShortcutsModalContent.tsx` - Only paired layout

## Future Ideas

### Key Sequence Rendering

**Problem**: Users may not recognize modifier key icons (⌘, ⌃, ⌥, ⇧).

**Solution**: Support multiple rendering modes via a `SequenceRenderer` interface:

1. **Icons** (default): `⌘ ↓` - Current SVG icon approach
2. **Short/Emacs**: `C-↓` or `M-↓` - Compact text notation
3. **Full text**: `ctrl down` - Fully spelled out

Configuration options:
```tsx
// App-level default
<HotkeysProvider config={{ sequenceFormat: 'icons' }}>

// Or per-modal
<ShortcutsModal sequenceFormat="full" />

// Or custom renderer
<ShortcutsModal sequenceRenderer={MyCustomRenderer} />
```

**Tooltips**: Hovering over a key sequence should show a tooltip with the full text version (e.g., "ctrl down"). This helps users learn the icons. Consider:
- Using MUI Tooltip or similar (avoid browser-native tooltips - too slow)
- Allow users to pass a custom `TooltipComponent` prop
- Toggle between icon/text modes on hover vs click (awair "auto-range" pattern)

### Advanced Omnibar / Command Palette

**Goal**: Make the omnibar a universal search/navigation hub, not just action execution.

**Result providers**: The omnibar could support multiple result sources:
```tsx
<Omnibar
  resultProviders={[
    { type: 'actions', priority: 1 },  // Default - registered actions
    { type: 'search', query: async (q) => searchAPI(q), priority: 2 },
    { type: 'links', selector: 'a[data-omnibar]', priority: 3 },
  ]}
/>
```

**Use cases**:
1. **Site navigation**: Register routes as actions (already works!)
2. **Page links**: Auto-register `<a>` elements with `data-omnibar` attribute
3. **Site search**: Integrate with Algolia, Pagefind, or similar search backends
4. **Recent items**: Show recently executed actions or visited pages

**ActionLink component**: A `<Link>` that auto-registers as an omnibar-discoverable action:
```tsx
<ActionLink to="/docs" label="Documentation" keywords={['help', 'guide']}>
  Docs
</ActionLink>
```

### Modal Trigger Button

**Problem**: Users may not know how to open the shortcuts modal.

**Solution**: Provide a pre-built trigger button component:
```tsx
// Lower-right corner popup (awair/ctbk style)
<ShortcutsTrigger position="bottom-right" />

// Or hamburger menu item
<ShortcutsTrigger as="menu-item" />
```

The button could:
- Show on hover in corner (like awair)
- Display the trigger key (`?`) as a hint
- Fade in/out gracefully

### Action Sort Order

**Problem**: Actions within a group sort alphabetically by ID, which can produce unintuitive ordering (e.g., `pagesize:100` before `pagesize:20`).

**Solutions**:
1. Use numeric prefixes in action IDs: `pagesize:1-10`, `pagesize:2-20`
2. Add `sortOrder` or `priority` field to `ActionConfig`
3. Allow groups to specify action order explicitly
