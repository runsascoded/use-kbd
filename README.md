# @rdub/use-hotkeys

[![npm version](https://img.shields.io/npm/v/@rdub/use-hotkeys.svg)](https://www.npmjs.com/package/@rdub/use-hotkeys)

React library for keyboard-accessible web applications with:

1. **Drop-in UI components** (`ShortcutsModal`, `Omnibar`, `SequenceModal`) at the App level
2. **Minimal-boilerplate action registration** via `useAction` hook, colocated with handlers
3. **CSS variables** for easy theming customization
4. **Sensible defaults** with configuration for common patterns

## Philosophy

Keyboard navigation and action discoverability on the web are underutilized. This library aims to make keyboard-first UX as easy to implement as it should be—inspired by macOS's ⌘/ action search, Android's settings search, and Vimium's keyboard-driven browsing.

## Quick Start

```tsx
import { HotkeysProvider, ShortcutsModal, Omnibar, SequenceModal, useAction } from '@rdub/use-hotkeys'
import '@rdub/use-hotkeys/styles.css'

function App() {
  return (
    <HotkeysProvider config={{ storageKey: 'my-app' }}>
      <Dashboard />
      <ShortcutsModal />
      <Omnibar placeholder="Search actions..." />
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
pnpm add @rdub/use-hotkeys
```

## Core Concepts

### Actions

Actions are registered where they're handled using `useAction`:

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
  storageKey: 'my-app',      // localStorage key for user overrides
  modalTrigger: '?',          // Open shortcuts modal (false to disable)
  omnibarTrigger: 'meta+k',   // Open omnibar (false to disable)
  sequenceTimeout: 1000,      // ms before sequence times out
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
import '@rdub/use-hotkeys/styles.css'
```

Customize with CSS variables:

```css
.hotkeys-modal,
.hotkeys-omnibar,
.hotkeys-sequence {
  --hk-bg: #1f2937;
  --hk-text: #f3f4f6;
  --hk-border: #4b5563;
  --hk-accent: #3b82f6;
  --hk-kbd-bg: #374151;
}
```

Or use `[data-theme="dark"]` / `.dark` selectors for dark mode.

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

## Examples

- [runsascoded/awair](https://github.com/runsascoded/awair) – Air quality dashboard with full keyboard navigation

## License

MIT
