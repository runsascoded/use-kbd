# use-kbd Roadmap

## Implemented

### Built-in Modal Editing UI

Fully implemented in `ShortcutsModal`:

- Tab/Shift+Tab navigation between editable bindings
- Hotkey recording via `useRecordHotkey`
- Real-time conflict detection and warning UI
- Add/remove binding UI with protected binding support
- Export/import bindings as JSON
- Custom group renderers via `groupRenderers` prop

### Advanced Omnibar

Implemented via `useOmnibarEndpoint`:

- Async endpoints (remote API calls with debouncing)
- Sync endpoints (in-memory filtering, instant results)
- Pagination (scroll, buttons, or none)
- Priority-based result ordering
- Number-aware search for digit/float placeholder actions

### Modes

Implemented via `useMode`:

- Sticky shortcut scopes activated via key sequences
- Mode-scoped actions (only active when mode is active)
- Global passthrough for unbound keys
- Mode shadowing (mode actions take priority over globals on shared keys)
- `ModeIndicator` component with configurable position and color
- Omnibar integration with mode badges and auto-activation
- ShortcutsModal groups with colored left border

## Future Ideas

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

### Action Sort Order

**Problem**: Actions sort alphabetically by ID, which can produce unintuitive ordering (e.g., `pagesize:100` before `pagesize:20`).

**Solutions**:
1. Use numeric prefixes in action IDs: `pagesize:1-10`, `pagesize:2-20`
2. Add `sortOrder` or `priority` field to `ActionConfig`
3. Allow groups to specify action order explicitly
