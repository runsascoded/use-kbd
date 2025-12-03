# @rdub/use-hotkeys

React hooks for keyboard shortcuts with runtime editing and key capture.

## Installation

```bash
pnpm add @rdub/use-hotkeys
```

## Usage

### Basic shortcuts

```tsx
import { useHotkeys } from '@rdub/use-hotkeys'

const HOTKEYS = {
  't': 'setTemp',
  'c': 'setCO2',
  'ctrl+s': 'save',
  'shift+?': 'showHelp',
}

function App() {
  useHotkeys(HOTKEYS, {
    setTemp: () => setMetric('temp'),
    setCO2: () => setMetric('co2'),
    save: () => handleSave(),
    showHelp: () => setShowHelp(true),
  })
}
```

### Recording key combinations

```tsx
import { useRecordHotkey } from '@rdub/use-hotkeys'

function KeybindingButton() {
  const { isRecording, startRecording, display, activeKeys } = useRecordHotkey({
    onCapture: (combo, display) => {
      console.log(`Captured: ${display.display}`) // "⌘⇧K" on Mac
      saveBinding(display.id) // "meta+shift+k"
    }
  })

  return (
    <button onClick={() => startRecording()}>
      {isRecording
        ? (activeKeys ? formatCombination(activeKeys).display : 'Press keys...')
        : (display?.display ?? 'Click to set')}
    </button>
  )
}
```

## API

### `useHotkeys(keymap, handlers, options?)`

Register keyboard shortcuts.

- `keymap`: `Record<string, string | string[]>` - maps key combos to action names
- `handlers`: `Record<string, (e: KeyboardEvent) => void>` - maps action names to functions
- `options`:
  - `enabled?: boolean` - enable/disable (default: true)
  - `target?: HTMLElement | Window` - event target (default: window)
  - `preventDefault?: boolean` - prevent default on match (default: true)
  - `stopPropagation?: boolean` - stop propagation on match (default: true)
  - `enableOnFormTags?: boolean` - fire in inputs/textareas (default: false)

### `useRecordHotkey(options?)`

Capture key combinations from user input.

- `options`:
  - `onCapture?: (combo, display) => void` - called when combination captured
  - `onCancel?: () => void` - called when recording cancelled
  - `preventDefault?: boolean` - prevent default during capture (default: true)

Returns:
- `isRecording: boolean`
- `startRecording: () => () => void` - returns cancel function
- `cancel: () => void`
- `combination: KeyCombination | null`
- `display: KeyCombinationDisplay | null`
- `activeKeys: KeyCombination | null` - keys currently held (for live UI feedback)

### Utilities

```tsx
import { formatCombination, normalizeKey, parseCombinationId, isMac } from '@rdub/use-hotkeys'

formatCombination({ key: 'k', modifiers: { meta: true, shift: true, ctrl: false, alt: false }})
// → { display: "⌘⇧K", id: "meta+shift+k" } on Mac
// → { display: "Win+Shift+K", id: "meta+shift+k" } elsewhere

parseCombinationId('ctrl+shift+k')
// → { key: 'k', modifiers: { ctrl: true, shift: true, alt: false, meta: false }}
```

## Key format

Modifier keys: `ctrl`, `alt`, `shift`, `meta` (or `cmd`/`command` on Mac)

Examples:
- `'t'` - just T key
- `'shift+t'` - Shift+T
- `'ctrl+shift+k'` - Ctrl+Shift+K
- `'meta+s'` - Cmd+S on Mac, Win+S elsewhere

## Examples

Projects using `@rdub/use-hotkeys`:

- [runsascoded/awair] – Air quality dashboard with keyboard shortcuts for metric switching

  Press `?` to see the shortcuts modal, or use single keys to switch metrics:
  - `t` / `c` / `h` / `p` / `v` – Temperature / CO₂ / Humidity / PM2.5 / VOC
  - `1` / `3` / `7` / `m` – 1 day / 3 days / 1 week / 1 month time range

[runsascoded/awair]: https://github.com/runsascoded/awair

## See also

[ROADMAP.md](./ROADMAP.md) - planned features including `<ShortcutsModal>` and `<KeybindingEditor>` components.

## License

MIT
