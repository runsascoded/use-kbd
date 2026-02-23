# Group Names Mapping for Registered Groups

## Problem

The `groups` prop on `ShortcutsModal` allows renaming groups for display, but it only works for groups derived from action ID prefixes, not for groups explicitly set via the `group` property in `useAction`.

### Current Behavior

```tsx
// In use-kbd's ShortcutsModal.tsx, built-in actions use:
useAction('shortcuts:show', {
  label: 'Show shortcuts',
  group: 'Global',  // This becomes both the key AND display name
  ...
})

// User tries to rename it:
<ShortcutsModal groups={{ Global: 'General' }} />

// Result: Still displays "GLOBAL", not "General"
```

The issue is in `organizeShortcuts()`:

```typescript
const getGroupName = (actionId: string): string => {
  // First, check if action has a registered group in the registry
  const registeredGroup = actionRegistry?.[actionId]?.group
  if (registeredGroup) return registeredGroup  // ← Returns 'Global' directly, bypasses groupNames

  // Fall back to parsing actionId prefix and looking up in groupNames
  const { group: groupKey } = parseActionId(actionId)
  return groupNames?.[groupKey] ?? groupKey  // ← groupNames only used here
}
```

When an action has an explicit `group` property, it's returned directly without checking `groupNames`.

## Proposed Solution

Apply the `groupNames` mapping to ALL groups, whether derived from action ID prefix or explicitly registered:

```typescript
const getGroupName = (actionId: string): string => {
  let groupKey: string

  // First, check if action has a registered group in the registry
  const registeredGroup = actionRegistry?.[actionId]?.group
  if (registeredGroup) {
    groupKey = registeredGroup
  } else {
    // Fall back to parsing actionId prefix
    groupKey = parseActionId(actionId).group
  }

  // Apply groupNames mapping to ALL groups
  return groupNames?.[groupKey] ?? groupKey
}
```

## Expected Behavior After Fix

```tsx
<ShortcutsModal groups={{ Global: 'General', playback: 'Playback' }} />

// Built-in actions with `group: 'Global'` now display under "GENERAL"
// User actions with `group: 'playback'` display under "PLAYBACK"
```

## Affected Files

- `src/ShortcutsModal.tsx`: Update `getGroupName()` function in `organizeShortcuts()`

## Testing

1. Verify built-in actions (Show shortcuts, Command palette) can be renamed via `groups` prop
2. Verify user actions with explicit `group` property can be renamed
3. Verify actions without explicit `group` (using actionId prefix) still work
4. Verify ungrouped actions still appear correctly
