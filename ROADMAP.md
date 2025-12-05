# use-hotkeys Roadmap

React hooks library for keyboard shortcuts with runtime editing and key capture.

## Current Features (v0.1.0)

### `useHotkeys(keymap, handlers, options?)`
Declarative keyboard shortcut registration:
```tsx
useHotkeys(
  { 't': 'setTemp', 'ctrl+s': 'save', 'shift+?': 'showHelp' },
  { setTemp: () => setMetric('temp'), save: handleSave, showHelp: () => setShowHelp(true) }
)
```

### `useRecordHotkey(options?)`
Capture key combinations from user input:
```tsx
const { isRecording, startRecording, combination, display, activeKeys } = useRecordHotkey({
  onCapture: (combo, display) => console.log(`Captured: ${display.display}`)
})
```

### `useEditableHotkeys(defaults, handlers, options?)`
Wraps `useHotkeys` with editable keybindings and localStorage persistence:
```tsx
const { keymap, setBinding, reset } = useEditableHotkeys(
  { 't': 'setTemp', 'c': 'setCO2' },
  { setTemp: () => setMetric('temp'), setCO2: () => setMetric('co2') },
  { storageKey: 'app-hotkeys' }
)
```

### `<ShortcutsModal>` component
Display keyboard shortcuts in a modal (auto-opens with `?` key):
```tsx
<ShortcutsModal
  keymap={HOTKEYS}
  descriptions={{ 'metric:temp': 'Switch to temperature' }}
  groups={{ metric: 'Metrics', time: 'Time Range' }}
/>
```

### `<KeybindingEditor>` component
UI for editing keybindings with conflict detection:
```tsx
<KeybindingEditor
  keymap={keymap}
  defaults={DEFAULT_KEYMAP}
  descriptions={{ save: 'Save document' }}
  onChange={(action, key) => setBinding(action, key)}
  onReset={() => reset()}
/>
```

### Utilities
- `formatCombination(combo)` - platform-aware display (⌘⇧K on Mac, Ctrl+Shift+K elsewhere)
- `normalizeKey(key)` - canonical key names
- `parseCombinationId(id)` - parse "ctrl+shift+k" back to KeyCombination
- `findConflicts(keymap)` - detect multiple actions bound to same key
- `hasConflicts(keymap)` - check if keymap has any conflicts
- `getConflictsArray(keymap)` - get conflicts as `KeyConflict[]`

## Future Ideas

- **Chord support**: `ctrl+k ctrl+c` (VS Code style sequences)
- **Scope/context**: Different keymaps for different app states
- **Import/export**: JSON format for sharing keybindings
- **Vim-style modes**: Normal/insert mode awareness
