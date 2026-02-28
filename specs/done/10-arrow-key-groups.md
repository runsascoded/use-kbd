# Arrow-key groups

## Problem

Actions that use the four arrow keys with a shared modifier (e.g., orbit left/right/up/down on bare arrows, pan left/right/up/down on shift+arrows) currently appear as four separate rows in ShortcutsModal. This wastes vertical space and obscures the relationship between the four directions. Worse, when a user wants to rebind "orbit" from bare arrows to alt+arrows, they must edit four bindings individually.

### Current state in elvis

```tsx
useAction('nav:orbit-left',  { label: 'Orbit left',  group: 'Camera', defaultBindings: ['arrowleft'],         handler: ... })
useAction('nav:orbit-right', { label: 'Orbit right', group: 'Camera', defaultBindings: ['arrowright'],        handler: ... })
useAction('nav:orbit-up',    { label: 'Orbit up',    group: 'Camera', defaultBindings: ['arrowup'],           handler: ... })
useAction('nav:orbit-down',  { label: 'Orbit down',  group: 'Camera', defaultBindings: ['arrowdown'],         handler: ... })

useAction('nav:pan-left',    { label: 'Pan left',    group: 'Camera', defaultBindings: ['shift+arrowleft'],   handler: ... })
useAction('nav:pan-right',   { label: 'Pan right',   group: 'Camera', defaultBindings: ['shift+arrowright'],  handler: ... })
useAction('nav:pan-up',      { label: 'Pan up',      group: 'Camera', defaultBindings: ['shift+arrowup'],     handler: ... })
useAction('nav:pan-down',    { label: 'Pan down',    group: 'Camera', defaultBindings: ['shift+arrowdown'],   handler: ... })
```

In ShortcutsModal this produces 8 rows under "Camera", each showing a single arrow key. The intent -- "arrows orbit, shift+arrows pan" -- is not visually obvious.

## Design

### Registration API

A new `useArrowGroup` hook registers four actions as a cohesive group:

```tsx
import { useArrowGroup } from 'use-kbd'

useArrowGroup('nav:orbit', {
  label: 'Orbit',
  group: 'Camera',
  defaultModifiers: [],  // bare arrows
  handlers: {
    left:  (e) => { startMovement('orbit-left');  if (orbitDeg > 0) snapCamera(...) },
    right: (e) => { startMovement('orbit-right'); if (orbitDeg > 0) snapCamera(...) },
    up:    (e) => { startMovement('orbit-up');    if (orbitDeg > 0) snapCamera(...) },
    down:  (e) => { startMovement('orbit-down');  if (orbitDeg > 0) snapCamera(...) },
  },
})

useArrowGroup('nav:pan', {
  label: 'Pan',
  group: 'Camera',
  defaultModifiers: ['shift'],
  handlers: {
    left:  (e) => { startMovement('pan-left');  ... },
    right: (e) => { startMovement('pan-right'); ... },
    up:    (e) => { startMovement('pan-up');    ... },
    down:  (e) => { startMovement('pan-down');  ... },
  },
})
```

#### `useArrowGroup` config

```ts
interface ArrowGroupConfig {
  /** Display label for the group row in ShortcutsModal */
  label: string
  /** Group for organizing in modal */
  group?: string
  /** Mode this arrow group belongs to */
  mode?: string
  /** Description (tooltip) */
  description?: string
  /** Default modifier keys applied to all four arrow bindings (e.g., ['shift'], ['alt', 'shift']). Empty array = bare arrows. */
  defaultModifiers: ModifierName[]
  /** Handler per direction */
  handlers: {
    left:  ActionHandler
    right: ActionHandler
    up:    ActionHandler
    down:  ActionHandler
  }
  /** Whether actions are currently enabled (default: true) */
  enabled?: boolean
  /** Search keywords */
  keywords?: string[]
  /** Additional per-direction bindings (e.g., { left: ['h'], right: ['l'] }) */
  extraBindings?: Partial<Record<Direction, string[]>>
}

type ModifierName = 'ctrl' | 'alt' | 'shift' | 'meta'
```

#### What `useArrowGroup` does internally

1. Registers four actions using `useAction`:
   - `{id}-left` with `defaultBindings: ['{modifiers}+arrowleft']`
   - `{id}-right` with `defaultBindings: ['{modifiers}+arrowright']`
   - `{id}-up` with `defaultBindings: ['{modifiers}+arrowup']`
   - `{id}-down` with `defaultBindings: ['{modifiers}+arrowdown']`
2. Marks each action with metadata indicating it belongs to an arrow group:
   ```ts
   // New optional field on ActionDefinition
   arrowGroup?: {
     groupId: string      // e.g., 'nav:orbit'
     direction: 'left' | 'right' | 'up' | 'down'
   }
   ```
3. All four actions share the same `group`, `mode`, `description`, `enabled`, and `keywords`.

### Backwards compatibility

Registering four individual `useAction` calls (as today) still works. The arrow-group display and editing features only activate when `arrowGroup` metadata is present. Existing apps continue to render four individual rows.

Apps can migrate incrementally: replace four `useAction` calls with one `useArrowGroup` to get the grouped display and editing behavior.

### ShortcutsModal: compact display

When `organizeShortcuts` encounters actions with `arrowGroup` metadata, it collapses them into a single row instead of four.

Display layout for one arrow-group row:

```
  Orbit    [Shift] + [<] [>] [^] [v]
```

Where `[<] [>] [^] [v]` are rendered as the four arrow-key icons (using the existing `Left`, `Right`, `Up`, `Down` components from `KeyIcons.tsx`), and the modifier prefix (if any) is shown once before all four.

The label comes from `ArrowGroupConfig.label`. The four individual action labels ("Orbit left", "Orbit right", etc.) are still available in omnibar search and tooltips, but the modal row shows only the group label.

If the group's four actions have inconsistent modifiers (e.g., the user rebound orbit-left to alt+arrowleft but orbit-right is still bare arrowright), the row falls back to showing four separate sub-entries with their individual bindings, with a warning indicator that the group is "split". This should be visually distinct (e.g., dimmed or italicized group label, individual bindings listed explicitly).

### ShortcutsModal: grouped editing

When the user clicks the binding area of an arrow-group row to edit:

1. The recording UI captures only the **modifier** portion: the user presses modifier key(s) (or just Enter/timeout for bare arrows).
2. On capture, all four bindings update at once:
   - `{captured-modifiers}+arrowleft`
   - `{captured-modifiers}+arrowright`
   - `{captured-modifiers}+arrowup`
   - `{captured-modifiers}+arrowdown`
3. Conflict detection checks all four resulting bindings. If any of the four would conflict, the conflict warning names the specific direction(s) that conflict.

The recording prompt should indicate that the user is setting modifiers for an arrow group, e.g., "Press modifier keys for Orbit arrows..." or "Hold modifiers, then press Enter".

#### Recording behavior

The `useRecordHotkey` hook (or a new arrow-group-specific variant) needs to handle this differently from normal recording:

- Normal recording: capture any key combo (modifiers + a trigger key).
- Arrow-group recording: capture only modifiers (no trigger key needed, since the trigger is always the four arrow keys). The user holds their desired modifier(s) and presses Enter (or a timeout fires) to confirm.
- Pressing an arrow key during arrow-group recording should also confirm, using the modifiers currently held. This gives natural feedback: "I hold shift, press left arrow" confirms shift+arrows.
- Pressing any non-modifier, non-arrow, non-Enter key cancels.

### Persistence

User overrides for arrow groups are stored the same as today: four individual key -> action entries in the overrides/removedDefaults objects. The grouping is purely a UI/registration concern; storage stays flat.

When importing/exporting bindings, arrow-group bindings appear as four individual entries. This is simpler and stays backwards-compatible.

## Types

### New fields on `ActionDefinition` (`types.ts`)

```ts
interface ActionDefinition {
  // ...existing fields...

  /** Arrow-key group metadata. Set by useArrowGroup, not by consumers directly. */
  arrowGroup?: {
    groupId: string
    direction: 'left' | 'right' | 'up' | 'down'
  }
}
```

### New hook (`useArrowGroup.ts`)

```ts
function useArrowGroup(id: string, config: ArrowGroupConfig): void
```

### ShortcutEntry discriminated union (`ShortcutsModal.tsx`)

`ShortcutGroup.shortcuts` uses a discriminated union `ShortcutEntry = ActionShortcut | ArrowGroupShortcut`:

```ts
interface ActionShortcut { type: 'action'; actionId: string; label: string; ... }
interface ArrowGroupShortcut { type: 'arrowGroup'; groupId: string; label: string; actionIds: Record<Direction, string>; modifierPrefix: string; extraBindings: ...; }
```

`organizeShortcuts` post-processing collapses complete quads (all 4 directions) into a single `ArrowGroupShortcut` entry. The `ArrowGroupRow` component renders it compactly with modifier icons + 4 arrow icons.

Arrow group modifier-only editing is handled directly in `ShortcutsModal` via a dedicated `useEffect` (not `useRecordHotkey`), since the recording behavior is fundamentally different (modifier-only, confirm with Enter or arrow key).

## Files

| File | Change |
|---|---|
| `src/types.ts` | Add `arrowGroup` to `ActionDefinition` |
| `src/useArrowGroup.ts` | New hook |
| `src/ShortcutsModal.tsx` | Collapse arrow-group rows, arrow-group editing UI |
| `src/useAction.ts` | Add `arrowGroup` to `ActionConfig`, add to deps |
| `src/ActionsRegistry.ts` | Pass through `arrowGroup` metadata to `actionRegistry` |
| `src/index.ts` | Export `useArrowGroup`, `ArrowGroupConfig` |
| `src/styles.css` | Styles for compact arrow-group row |
| `src/TwoColumnRenderer.tsx` | Filter to `type: 'action'` entries for bindings map |
| `site/src/routes/CanvasDemo.tsx` | Convert 4 pan actions to `useArrowGroup` |
| `site/e2e/hotkeys.spec.ts` | Update mode test, add Arrow Groups test suite |

## Test plan

1. `useArrowGroup` registers four actions with correct IDs (`{id}-left`, etc.)
2. Each action gets the correct default binding (`{modifiers}+arrow{dir}`)
3. ShortcutsModal shows a single row for each arrow group
4. Arrow-group row displays modifier prefix + four arrow icons
5. Clicking the arrow-group row enters modifier-only recording
6. Pressing shift+Enter during recording sets shift+arrow{dir} for all four
7. Pressing alt+arrowleft during recording sets alt+arrow{dir} for all four
8. Pressing Enter alone during recording sets bare arrow{dir} for all four
9. Conflict detection covers all four resulting bindings
10. Inconsistent bindings (user edited one direction individually) shows split display
11. Four individual `useAction` calls (no `arrowGroup`) still render as four rows (BC)
12. Omnibar search finds individual directions (e.g., searching "orbit left" finds `nav:orbit-left`)
13. Export/import treats arrow groups as four individual bindings
14. Arrow groups inside modes work correctly (mode metadata propagated to all four actions)
