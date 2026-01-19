# use-kbd Roadmap

## Future Ideas

### Built-in Modal Editing UI

Move more generic logic into ShortcutsModal:

1. Tab navigation (focus ring, Arrow/Tab key handling)
2. Hotkey recording (`useRecordHotkey` already exists)
3. Conflict detection and display
4. Add/remove binding UI

Expose customization via `renderGroup` for app-specific layouts.

### Type Safety

1. Generic type params: `defineActions<ActionId, GroupId>`
2. ActionId union type derived from action keys
3. GroupId union type derived from group values
4. Type-safe handler maps

### Key Sequence Rendering

**Problem**: Users may not recognize modifier key icons (⌘, ⌃, ⌥, ⇧).

**Solution**: Support multiple rendering modes:

1. **Icons** (default): `⌘ ↓` - Current SVG icon approach
2. **Short/Emacs**: `C-↓` or `M-↓` - Compact text notation
3. **Full text**: `ctrl down` - Fully spelled out

### Advanced Omnibar

Make the omnibar a universal search/navigation hub with multiple result sources:

```tsx
<Omnibar
  resultProviders={[
    { type: 'actions', priority: 1 },
    { type: 'search', query: async (q) => searchAPI(q), priority: 2 },
  ]}
/>
```

### Action Sort Order

**Problem**: Actions sort alphabetically by ID, which can produce unintuitive ordering (e.g., `pagesize:100` before `pagesize:20`).

**Solutions**:
1. Use numeric prefixes in action IDs: `pagesize:1-10`, `pagesize:2-20`
2. Add `sortOrder` or `priority` field to `ActionConfig`
3. Allow groups to specify action order explicitly
