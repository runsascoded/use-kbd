# use-kbd

[![npm version](https://img.shields.io/npm/v/use-kbd.svg)](https://www.npmjs.com/package/use-kbd)

Keyboard shortcuts, navigation, omnibar for React apps.

**[📖 Documentation & Demos →][kbd.rbw.sh]**

1. **Drop-in UI components** (`ShortcutsModal`, `Omnibar`, `LookupModal`, `SequenceModal`)
2. **Register functions as "actions"** with `useAction`
3. **Easy theming** with CSS variables

Also in production at [ctbk.dev] and [awair.runsascoded.com].

[kbd.rbw.sh]: https://kbd.rbw.sh

## Inspiration
- macOS (⌘-/) and GDrive (⌥-/) menu search
- [Superhuman] omnibar
- Android searchable settings
- [Vimium] keyboard-driven browsing.

[ctbk.dev]: https://ctbk.dev
[awair.runsascoded.com]: https://awair.runsascoded.com
[Superhuman]: https://superhuman.com
[Vimium]: https://github.com/philc/vimium

## Quick Start

```tsx
import { HotkeysProvider, ShortcutsModal, Omnibar, SequenceModal, useAction } from 'use-kbd'
import 'use-kbd/styles.css'

function App() {
  return (
    <HotkeysProvider>
      {/* Your app content */}
      <Dashboard />
      {/* Drop-in UI components */}
      <ShortcutsModal />
      <Omnibar />
      <SequenceModal />
    </HotkeysProvider>
  )
}

function Dashboard() {
  const { save, exportData } = useDocument()

  useAction('doc:save', {
    label: 'Save document',
    group: 'Document',
    defaultBindings: ['meta+s'],
    handler: save,
  })

  useAction('doc:export', {
    label: 'Export data',
    group: 'Document',
    defaultBindings: ['meta+e'],
    handler: exportData,
  })

  return <Editor />
}
```

Press `?` to see the shortcuts modal, or `⌘K` to open the omnibar.

## Installation

```bash
pnpm add use-kbd
```

## Core Concepts

### Actions

Register any function with `useAction`:

```tsx
useAction('view:toggle-sidebar', {
  label: 'Toggle sidebar',
  group: 'View',
  defaultBindings: ['meta+b', 'meta+\\'],
  keywords: ['panel', 'navigation'],
  handler: () => setSidebarOpen(prev => !prev),
})
```

Actions automatically unregister when the component unmounts—no cleanup needed.

### Sequences

Multi-key sequences like Vim's `g g` (go to top) are supported:

```tsx
useAction('nav:top', {
  label: 'Go to top',
  defaultBindings: ['g g'],  // Press g, then g again
  handler: () => scrollToTop(),
})
```

The `SequenceModal` shows available completions while typing a sequence.

### User Customization

Users can edit bindings in the `ShortcutsModal`. Changes persist to localStorage using the `storageKey` you provide.

## Components

### `<HotkeysProvider>`

Wrap your app to enable the hotkeys system:

```tsx
<HotkeysProvider config={{
  storageKey: 'use-kbd',      // localStorage key for user overrides (default)
  modalTrigger: '?',          // Open shortcuts modal (default; false to disable)
  omnibarTrigger: 'meta+k',   // Open omnibar (default; false to disable)
  sequenceTimeout: 1000,      // ms before sequence times out (default)
}}>
  {children}
</HotkeysProvider>
```

### `<ShortcutsModal>`

Displays all registered actions grouped by category. Users can click bindings to edit them.

```tsx
<ShortcutsModal groups={[
  { id: 'nav', label: 'Navigation' },
  { id: 'edit', label: 'Editing' },
]} />
```

### `<Omnibar>`

Command palette for searching and executing actions:

```tsx
<Omnibar
  placeholder="Type a command..."
  maxResults={10}
/>
```

### `<SequenceModal>`

Shows pending keys and available completions during sequence input. No props needed—it reads from context.

```tsx
<SequenceModal />
```

## Styling

Import the default styles:

```tsx
import 'use-kbd/styles.css'
```

Customize with CSS variables:

```css
.kbd-modal,
.kbd-omnibar,
.kbd-sequence {
  --kbd-bg: #1f2937;
  --kbd-text: #f3f4f6;
  --kbd-border: #4b5563;
  --kbd-accent: #3b82f6;
  --kbd-kbd-bg: #374151;
}
```

Dark mode is automatically applied via `[data-theme="dark"]` or `.dark` selectors.

See [awair's use-kbd-demo branch] for a real-world integration example.

[awair's use-kbd-demo branch]: https://github.com/runsascoded/awair/compare/use-kbd-demo~1...use-kbd-demo

## Low-Level Hooks

For advanced use cases, the underlying hooks are also exported:

### `useHotkeys(keymap, handlers, options?)`

Register shortcuts directly without the provider:

```tsx
useHotkeys(
  { 't': 'setTemp', 'meta+s': 'save' },
  { setTemp: () => setMetric('temp'), save: handleSave }
)
```

### `useRecordHotkey(options?)`

Capture key combinations from user input:

```tsx
const { isRecording, startRecording, display } = useRecordHotkey({
  onCapture: (sequence, display) => saveBinding(display.id),
})
```

### `useEditableHotkeys(defaults, handlers, options?)`

Wraps `useHotkeys` with localStorage persistence and conflict detection.

## License

MIT
