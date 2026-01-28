# use-kbd

[![npm version](https://img.shields.io/npm/v/use-kbd.svg)](https://www.npmjs.com/package/use-kbd)

Omnibars, editable hotkeys, search, and keyboard-navigation for React apps.

**[📖 Documentation & Demos →][kbd.rbw.sh]**

Also in production at [ctbk.dev] and [awair.runsascoded.com].

[kbd.rbw.sh]: https://kbd.rbw.sh
[ctbk.dev]: https://ctbk.dev
[awair.runsascoded.com]: https://awair.runsascoded.com

## Quick Start

```bash
npm install use-kbd  # or: pnpm add use-kbd
```

```tsx
import { HotkeysProvider, ShortcutsModal, Omnibar, LookupModal, SequenceModal, useAction } from 'use-kbd'
import 'use-kbd/styles.css'

function App() {
  return (
    <HotkeysProvider>
      <Dashboard />
      <ShortcutsModal />  {/* "?" modal: view/edit key-bindings */}
      <Omnibar />         {/* "⌘K" omnibar: search and select actions */}
      <LookupModal />     {/* "⌘⇧K": look up actions by key-binding */}
      <SequenceModal />   {/* Inline display for key-sequences in progress */}
    </HotkeysProvider>
  )
}

function Dashboard() {
  const { save } = useDocument()  // Function to expose via hotkeys / omnibar

  // Wrap function as "action", with keybinding(s) and omnibar keywords
  useAction('doc:save', {
    label: 'Save document',
    group: 'Document',
    defaultBindings: ['meta+s'],
    handler: save,
  })

  return <Editor />
}
```

### Basic steps

1. **Drop-in UI components**:
   - `ShortcutsModal`: view/edit key-bindings
   - `Omnibar`: search and select actions
   - `LookupModal`: look up actions by key-binding
   - `SequenceModal`: autocomplete multi-key sequences
2. **Register functions as "actions"** with `useAction`
3. **Easy theming** with CSS variables

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

Conditionally disable actions with `enabled`:

```tsx
useAction('doc:save', {
  label: 'Save',
  defaultBindings: ['meta+s'],
  enabled: hasUnsavedChanges,  // Action hidden when false
  handler: save,
})
```

Protect essential bindings from removal with `protected`:

```tsx
useAction('app:shortcuts', {
  label: 'Show shortcuts',
  defaultBindings: ['?'],
  protected: true,  // Users can add bindings, but can't remove this one
  handler: () => openShortcutsModal(),
})
```

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

### Key Aliases

For convenience, common key names have shorter aliases:

| Alias | Key |
|-------|-----|
| `left`, `right`, `up`, `down` | Arrow keys |
| `esc` | `escape` |
| `del` | `delete` |
| `return` | `enter` |
| `pgup`, `pgdn` | `pageup`, `pagedown` |

```tsx
useAction('nav:prev', {
  label: 'Previous item',
  defaultBindings: ['left', 'h'],  // 'left' = 'arrowleft'
  handler: () => selectPrev(),
})
```

### User Customization

Users can edit bindings in the `ShortcutsModal`. Changes persist to localStorage using the `storageKey` you provide.

#### Export/Import Bindings

Users can export their customized bindings as JSON and import them in another browser or device:

```tsx
<ShortcutsModal editable />  // Shows Export/Import buttons
```

The exported JSON contains:
- `version` – Library version for compatibility
- `overrides` – Custom key→action bindings
- `removedDefaults` – Default bindings the user removed

Programmatic access via the registry:

```tsx
const { registry } = useHotkeysContext()

// Export current customizations
const data = registry.exportBindings()

// Import (replaces current customizations)
registry.importBindings(data)
```

Customize the footer with `footerContent`:

```tsx
<ShortcutsModal
  editable
  footerContent={({ exportBindings, importBindings, resetBindings }) => (
    <div className="my-custom-footer">
      <button onClick={exportBindings}>Download</button>
      <button onClick={importBindings}>Upload</button>
    </div>
  )}
/>
```

Pass `footerContent={null}` to hide the footer entirely.

## Components

### `<HotkeysProvider>`

Wrap your app to enable the hotkeys system:

```tsx
<HotkeysProvider config={{
  storageKey: 'use-kbd',      // localStorage key for user overrides (default)
  sequenceTimeout: Infinity,  // ms before sequence times out (default: no timeout)
  disableConflicts: false,    // Disable keys with multiple actions (default: false)
  enableOnTouch: false,       // Enable hotkeys on touch devices (default: false)
}}>
  {children}
</HotkeysProvider>
```

Note: Modal/omnibar trigger bindings are configured via component props (`defaultBinding`), not provider config.

### `<ShortcutsModal>`

Displays all registered actions grouped by category. Users can click bindings to edit them on desktop.

```tsx
<ShortcutsModal
  editable                    // Enable editing, Export/Import buttons
  groups={{ nav: 'Navigation', edit: 'Editing' }}
  hint="Click any shortcut to customize"
/>
```

### `<Omnibar>`

Command palette for searching and executing actions:

```tsx
<Omnibar
  placeholder="Type a command..."
  maxResults={10}
/>
```

### `<LookupModal>`

Browse and filter shortcuts by typing key sequences. Press `⌘⇧K` (default) to open.

```tsx
<LookupModal defaultBinding="meta+shift+k" />
```

Open programmatically with pre-filled keys via context:

```tsx
const { openLookup } = useHotkeysContext()

// Open with "g" already typed (shows all "g ..." sequences)
openLookup([{ key: 'g', modifiers: { ctrl: false, alt: false, shift: false, meta: false } }])
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

## Mobile Support

While keyboard shortcuts are primarily a desktop feature, use-kbd provides solid mobile UX out of the box. **[Try the demos on your phone →][kbd.rbw.sh]**

**What works on mobile:**

- **Omnibar search** – Tap the search icon or `⌘K` badge to open, then search and execute actions
- **LookupModal** – Browse shortcuts by typing on the virtual keyboard
- **ShortcutsModal** – View all available shortcuts (editing disabled since there's no physical keyboard)
- **Back button/swipe** – Native gesture closes modals
- **Responsive layouts** – All components adapt to small screens

**Demo-specific features:**

- [Table demo][table-demo] – Tap search icon in the floating controls to open omnibar
- [Canvas demo][canvas-demo] – Touch-to-draw support alongside keyboard shortcuts

[table-demo]: https://kbd.rbw.sh/table
[canvas-demo]: https://kbd.rbw.sh/canvas

For apps that want keyboard shortcuts on desktop but still need the omnibar/search on mobile, this covers the common case without extra configuration.

## Patterns

### ActionLink

Make navigation links discoverable in the omnibar by registering them as actions. Here's a reference implementation for react-router:

```tsx
import { useEffect, useRef } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useMaybeHotkeysContext } from 'use-kbd'

interface ActionLinkProps {
  to: string
  label?: string
  group?: string
  keywords?: string[]
  defaultBinding?: string
  children: React.ReactNode
}

export function ActionLink({
  to,
  label,
  group = 'Navigation',
  keywords,
  defaultBinding,
  children,
}: ActionLinkProps) {
  const ctx = useMaybeHotkeysContext()
  const navigate = useNavigate()
  const location = useLocation()

  const isActive = location.pathname === to
  const effectiveLabel = label ?? (typeof children === 'string' ? children : to)
  const actionId = `nav:${to}`

  // Use ref to avoid re-registration on navigate change
  const navigateRef = useRef(navigate)
  navigateRef.current = navigate

  useEffect(() => {
    if (!ctx?.registry) return

    ctx.registry.register(actionId, {
      label: effectiveLabel,
      group,
      keywords,
      defaultBindings: defaultBinding ? [defaultBinding] : [],
      handler: () => navigateRef.current(to),
      enabled: !isActive,  // Hide from omnibar when on current page
    })

    return () => ctx.registry.unregister(actionId)
  }, [ctx?.registry, actionId, effectiveLabel, group, keywords, defaultBinding, isActive, to])

  return <Link to={to}>{children}</Link>
}
```

Usage:
```tsx
<ActionLink to="/docs" keywords={['help', 'guide']}>Documentation</ActionLink>
<ActionLink to="/settings" defaultBinding="g s">Settings</ActionLink>
```

Adapt for Next.js, TanStack Router, or other routers by swapping the router hooks.

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

## Inspiration

- macOS and GDrive menu search
- [Superhuman] omnibar
- [Vimium] keyboard-driven browsing
- Android searchable settings

[Superhuman]: https://superhuman.com
[Vimium]: https://github.com/philc/vimium

## License

MIT
