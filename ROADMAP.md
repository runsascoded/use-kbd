# use-hotkeys Roadmap

## Vision

A downstream app should need minimal code to integrate hotkeys:

1. Define a callback factory and action definitions (with handlers referencing callbacks)
2. Provide an app-specific wrapper that sets up callback slots
3. Wire callbacks where runtime state is available
4. Optionally customize group rendering

Everything else comes from the library.

## Current Problems

### 1. Props Drilling for Modal/Omnibar

App.tsx destructures context values just to pass them to components:
```tsx
const { isModalOpen, closeModal, keymap, ... } = useHotkeysContext()

<ShortcutsModal
  keymap={keymap}
  isOpen={isModalOpen}
  onClose={closeModal}
  ...
/>
<Omnibar
  actions={getActionRegistry(ACTIONS)}
  keymap={keymap}
  isOpen={isOmnibarOpen}
  ...
/>
```

**Solution**: Components should use context internally. Props become optional overrides.

### 2. Global Static ACTIONS Without Handlers

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

### 3. Omnibar Needs `handlersRef` Bridge

Because handlers are registered separately from actions, Omnibar needs a ref to find them:
```tsx
const handlersRef = useRef<Record<string, () => void>>({})
// ... later in useKeyboardShortcuts
handlersRef.current = handlers

<Omnibar
  onExecute={(actionId) => handlersRef.current[actionId]?.()}
/>
```

**Solution**: Handlers live in context. Omnibar uses `executeAction` from context.

### 4. ShortcutsModalContent Has Generic Logic

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
import { defineActions } from '@rdub/use-hotkeys'

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
import { HotkeysProvider } from '@rdub/use-hotkeys'
import { createActions, type AwairCallbacks } from './hotkeyConfig'

type CallbacksRef = React.MutableRefObject<Partial<AwairCallbacks>>
const AwairCallbacksContext = createContext<CallbacksRef | null>(null)

export function AwairHotkeysProvider({ children }: { children: React.ReactNode }) {
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

### Phase 1: Library - Components Use Context (NEXT)

Make ShortcutsModal and Omnibar use context internally:

1. **ShortcutsModal defaults**
   - `isOpen` from `useHotkeysContext().isModalOpen`
   - `onClose` from `useHotkeysContext().closeModal`
   - `keymap` from `useHotkeysContext().keymap`
   - `actions` from `useHotkeysContext().actions`
   - Props become optional overrides

2. **Omnibar defaults**
   - Same pattern
   - `onExecute` uses `useHotkeysContext().executeAction`
   - No more `handlersRef` bridge needed

3. **Update exports**
   - Ensure `executeAction` works with registered handlers

### Phase 2: Library - Built-in Modal Content

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

### Phase 3: Library - Type Safety

1. Generic type params: `defineActions<ActionId, GroupId>`
2. ActionId union type derived from action keys
3. GroupId union type derived from group values
4. Type-safe handler maps

### Phase 4: App Migration

1. Create `AwairHotkeysProvider` with callback factory pattern
2. Simplify App.tsx to use zero-prop components
3. Extract paired-column layout as the only custom code
4. Remove `useKeyboardShortcuts.ts` (handlers inline in callback wiring)

## Files to Change

### use-hotkeys (Phase 1)
- `src/ShortcutsModal.tsx` - Use context for defaults
- `src/Omnibar.tsx` - Use context for defaults, use executeAction
- `src/HotkeysProvider.tsx` - Ensure executeAction uses all handlers

### use-hotkeys (Phase 2)
- `src/ShortcutsModal.tsx` - Built-in editing UI
- `src/components/GroupRenderer.tsx` - Default group rendering
- `src/components/BindingEditor.tsx` - Binding add/edit/remove
- `src/hooks/useTabNavigation.ts` - Focus management

### awair (Phase 4)
- `src/config/hotkeyConfig.ts` - Callback factory pattern
- `src/providers/AwairHotkeysProvider.tsx` - New file
- `src/App.tsx` - Simplified
- `src/hooks/useKeyboardShortcuts.ts` - Deleted or simplified
- `src/components/ShortcutsModalContent.tsx` - Only paired layout
