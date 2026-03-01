# Editable modes

## Implementation status

### Done
- `ModeCustomizations` type with `additions`, `removals`, `userModes` fields
- `UserModeConfig` type
- `addActionToMode` / `removeActionFromMode` in ActionsRegistry (handles arrow groups, action pairs, triplets atomically)
- `getEffectiveMode` for computing effective mode considering customizations
- Persistence to `{storageKey}-modes` in localStorage
- Reset clears mode customizations
- Export/import includes `modeCustomizations`
- Modes section in ShortcutsModal: view mode membership, add/remove actions from modes
- E2e tests for add/remove/persist/reset

### Remaining
- **User-created modes**: `createUserMode` / `deleteUserMode` / `updateUserMode` methods not yet implemented
- **"New mode..." UI**: no inline mode creation flow in ShortcutsModal yet
- **Dynamic mode registration in HotkeysProvider**: user modes in `userModes` storage aren't auto-registered as active modes
- **Delete mode button**: not yet rendered (only developer-defined modes exist currently)

## Problem

Modes in use-kbd are currently developer-defined only: the app author calls `useMode` to register modes and `useAction(..., { mode: 'modeId' })` to assign actions. Users cannot customize modes at all -- they can rebind individual keys, but cannot move an action between modes, create their own modes, or remove actions from a mode.

This matters for apps with rich keyboard interfaces. Consider elvis: it has orbit (bare arrows), pan (shift+arrows), and could have a slice-stepping mode. A user might want:

- "Slice step" mode where arrow keys step through crystallographic slices instead of orbiting
- Move zoom in/out from global into a "zoom mode" so `+`/`-` can be reused elsewhere
- Create a custom "presentation mode" that bundles snap-to-axis actions for quick demo navigation
- Remove an action from a mode they never use, reducing clutter

Currently none of this is possible without code changes.

## Design

### Core model

Modes are sets of action IDs, plus metadata (label, color, activation binding). The current system hardcodes mode membership via the `mode` field on `useAction`. This spec extends it to allow user customization as deltas on top of developer defaults.

#### Developer defaults (unchanged)

```tsx
const navMode = useMode('nav:3d', {
  label: '3D Navigation',
  color: '#4fc3f7',
  defaultBindings: ['g n'],
})

useAction('nav:orbit-left', {
  mode: 'nav:3d',
  defaultBindings: ['arrowleft'],
  ...
})
```

This establishes the **default** mode membership: `nav:orbit-left` belongs to `nav:3d` by default.

#### User customizations (new)

User edits are stored as deltas:

```ts
interface ModeCustomizations {
  /** Actions added to modes by the user (not part of developer defaults) */
  additions: Record<string, string[]>  // modeId -> [actionId, ...]
  /** Actions removed from their default mode by the user */
  removals: Record<string, string[]>   // modeId -> [actionId, ...]
  /** User-created modes */
  userModes: Record<string, UserModeConfig>  // modeId -> config
}

interface UserModeConfig {
  label: string
  color?: string
  /** Activation binding(s) for this mode */
  bindings?: string[]
  /** Actions assigned to this mode */
  actions: string[]
}
```

The effective mode for an action is computed as:

```
effectiveMode(actionId) =
  1. If actionId is in any `removals[mode]`, it has no mode (global)
  2. If actionId is in any `additions[mode]` or `userModes[mode].actions`, use that mode
  3. Fall back to developer-defined `action.mode`
```

An action can appear in at most one mode at a time (it is either in one mode or global). Moving an action to a different mode implicitly removes it from its current mode.

### Persistence

Mode customizations are stored in localStorage under `{storageKey}-modes`:

```json
{
  "additions": {
    "nav:3d": ["nav:zoom-in", "nav:zoom-out"]
  },
  "removals": {
    "nav:3d": ["nav:orbit-down"]
  },
  "userModes": {
    "slice-nav": {
      "label": "Slice Navigation",
      "color": "#ff9800",
      "bindings": ["g s"],
      "actions": ["slice:step-fwd", "slice:step-back", "slice:axis-x", "slice:axis-y", "slice:axis-z"]
    }
  }
}
```

This follows the same delta-from-defaults pattern used for binding customizations (overrides + removedDefaults).

### Resetting

"Reset all" (existing `resetOverrides`) should also clear mode customizations. A separate "Reset modes" option could be added but is not required for the initial implementation.

Export/import (`BindingsExport`) should include mode customizations:

```ts
interface BindingsExport {
  // ...existing fields...
  /** Mode membership customizations (additions, removals, user-created modes) */
  modeCustomizations?: ModeCustomizations
}
```

### UI: mode editing in ShortcutsModal

#### Viewing modes

Modes already render as distinct groups in ShortcutsModal (with colored headers and activation bindings). No change needed for viewing.

#### Editing mode membership

Each action row in ShortcutsModal gains a mode indicator/editor when in editable mode:

- **Mode-scoped actions**: show a small colored pill with the mode label next to the action label. Clicking the pill opens a dropdown/popover with options:
  - Move to a different mode (lists all registered + user-created modes)
  - Make global (remove from mode)
- **Global actions**: show a subtle "+" or mode icon. Clicking opens the same dropdown to assign the action to a mode.

The mode dropdown should also have an option at the bottom: "New mode..." which opens inline creation (label + color picker + optional activation binding).

#### Compact implementation

Rather than a full dropdown, a simpler first pass could be:

1. Right-click (or long-press on mobile) an action row to get a context menu with mode options.
2. Or: a dedicated "Modes" tab/section in ShortcutsModal that shows each mode as a list with drag-to-reorder and add/remove buttons.

The recommended approach is option 2: a modes section at the bottom of ShortcutsModal (or toggled via a tab). This keeps the main shortcut list clean while providing a dedicated editing surface.

#### Modes section layout

```
MODES                                [+ New Mode]
------------------------------------------------------
3D Navigation  [g n]  (#4fc3f7)     [Edit] [Delete]
  - Orbit left    [<]               [x remove]
  - Orbit right   [>]               [x remove]
  - Orbit up      [^]               [x remove]
  - Orbit down    [v]               [x remove]
  + Add action...

Slice Navigation  [g s]  (#ff9800)   [Edit] [Delete]
  - Step forward   [.]              [x remove]
  - Step backward  [,]              [x remove]
  + Add action...
------------------------------------------------------
```

- "Edit" opens inline editing for label/color/activation binding.
- "Delete" only appears for user-created modes. Developer-defined modes cannot be deleted, only emptied.
- "[x remove]" removes an action from the mode (adds to `removals` if it was a developer default, or removes from `additions`/`userModes.actions` if user-added).
- "+ Add action..." opens a small omnibar-like search that filters to global (unassigned) actions, letting the user pick one to add.

### User-created modes

User-created modes need:

1. **Activation binding**: recorded via the existing `useRecordHotkey` mechanism.
2. **Mode behavior**: user modes behave identically to developer modes (Escape exits, actions only fire when mode is active, passthrough defaults to true).
3. **Registration**: `HotkeysProvider` reads `userModes` from the stored customizations and registers them dynamically (no `useMode` call needed in app code).

Since user modes are not associated with any `useMode` hook in app code, `HotkeysProvider` must register them internally:

```tsx
// Inside HotkeysProvider
useEffect(() => {
  const stored = loadModeCustomizations(storageKey)
  for (const [id, config] of Object.entries(stored.userModes)) {
    modesRegistry.register(id, {
      label: config.label,
      color: config.color,
      defaultBindings: config.bindings ?? [],
      toggle: true,
      escapeExits: true,
      passthrough: true,
    })
  }
  return () => {
    for (const id of Object.keys(stored.userModes)) {
      modesRegistry.unregister(id)
    }
  }
}, [storedModeCustomizationsVersion])
```

Activation actions for user modes are registered the same way as developer modes (with the `__mode:` prefix).

### ActionsRegistry changes

The `ActionsRegistry` needs to be aware of mode customizations to compute the effective mode for each action:

```ts
interface ActionsRegistryValue {
  // ...existing fields...

  /** Mode customizations (user edits to mode membership) */
  modeCustomizations: ModeCustomizations
  /** Set mode customizations (persisted) */
  setModeCustomizations: (update: ModeCustomizations | ((prev: ModeCustomizations) => ModeCustomizations)) => void
  /** Get the effective mode for an action (considering customizations) */
  getEffectiveMode: (actionId: string) => string | undefined
  /** Add an action to a mode */
  addActionToMode: (actionId: string, modeId: string) => void
  /** Remove an action from its mode */
  removeActionFromMode: (actionId: string, modeId: string) => void
  /** Create a user mode */
  createUserMode: (id: string, config: UserModeConfig) => void
  /** Delete a user mode */
  deleteUserMode: (id: string) => void
  /** Update a user mode's config */
  updateUserMode: (id: string, config: Partial<UserModeConfig>) => void
}
```

### Effective keymap computation

`HotkeysProvider.effectiveKeymap` already filters actions by mode. It uses `action.config.mode` to determine membership. With this spec, it should instead use `getEffectiveMode(actionId)` which incorporates customizations:

```ts
const filtered = actions.filter(id => {
  const effectiveMode = registry.getEffectiveMode(id)
  if (!effectiveMode) return true                        // global: always include
  if (effectiveMode === activeMode) return true          // active mode: include
  if (id.startsWith(ACTION_MODE_PREFIX)) return true     // mode activators: always
  return false                                           // inactive mode: exclude
})
```

### organizeShortcuts changes

`organizeShortcuts` currently reads `actionRegistry[actionId].mode` to determine which group to render an action under. It should instead read the effective mode (considering customizations). This means `organizeShortcuts` needs access to `getEffectiveMode` or the `modeCustomizations` object.

## Interaction with arrow-key groups (spec 10)

Arrow-key groups (spec 10) interact naturally with editable modes:

- Moving an arrow group to a different mode should move all four actions at once.
- The modes section UI should show arrow groups as a single entry in the mode's action list (e.g., "Orbit [arrows]" rather than four separate entries).
- Removing an arrow group from a mode removes all four direction actions.

This is handled by checking for `arrowGroup` metadata when performing mode membership operations: if the target action has `arrowGroup.groupId`, apply the operation to all four siblings.

## Files

| File | Change |
|---|---|
| `src/types.ts` | Add `ModeCustomizations`, `UserModeConfig` types; extend `BindingsExport` |
| `src/ActionsRegistry.ts` | Add mode customization state, `getEffectiveMode`, mutation methods, persistence |
| `src/ModesRegistry.ts` | Support dynamic registration of user-created modes |
| `src/HotkeysProvider.tsx` | Register user modes, use `getEffectiveMode` in effective keymap |
| `src/ShortcutsModal.tsx` | Mode indicator pills on action rows; modes section for editing membership |
| `src/index.ts` | Export new types |
| `src/styles.css` | Styles for mode pills, modes section, mode editing UI |

## Example use case

An elvis user wants arrow keys to step through crystallographic slices instead of orbiting the 3D camera.

Before (developer defaults):
- Bare arrows: orbit (in global scope, or in a "3D Navigation" mode)
- Shift+arrows: pan

After user customization:
1. User creates a new mode: "Slice Navigation" with activation binding `g s` and color `#ff9800`.
2. User adds `slice:step-fwd`, `slice:step-back`, `slice:axis-x`, `slice:axis-y`, `slice:axis-z` to the new mode.
3. User also adds individual arrow bindings for step-fwd/back within the mode.
4. Now: pressing `g s` activates slice mode, arrows step slices; pressing `g n` (or Escape from slice mode) returns to the default where arrows orbit.

The user's customizations are stored as deltas. If the developer later adds a new action to the "3D Navigation" mode, it appears automatically; the user's customizations layer on top.

## Test plan

1. Default behavior unchanged: actions with `mode` in `useAction` render under their mode group
2. `getEffectiveMode` returns developer default when no customizations exist
3. `addActionToMode` moves a global action into a mode; reflected in ShortcutsModal grouping
4. `removeActionFromMode` removes a developer-default mode assignment; action becomes global
5. Moving an action from mode A to mode B: appears under B, not A
6. User-created mode appears in ShortcutsModal with correct label/color
7. User-created mode's activation binding works (registers `__mode:{id}` action)
8. Escape exits user-created mode (same as developer modes)
9. User mode actions only fire when mode is active
10. Mode customizations persist across page reloads (localStorage)
11. "Reset all" clears mode customizations
12. Export includes `modeCustomizations`; import restores them
13. Arrow-key groups (spec 10): moving a group to a mode moves all four actions
14. Deleting a user mode moves its actions back to global
15. Cannot delete a developer-defined mode (button disabled/hidden)
16. Adding an action already in another mode shows confirmation or auto-removes from previous mode
