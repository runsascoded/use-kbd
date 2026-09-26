# Per-entry labels for action pairs / triplets

## Problem

`useActionPair` (and manual `useAction(..., { actionPair })` registrations) derive each member's label as `` `${label} a` `` / `` `${label} b` ``. `ShortcutsModal` strips the suffix (`/\s+[ab]$/i`) to render one collapsed row, but the omnibar lists members individually, so users see e.g. **"Previous / Next year b"** — meaningless outside the modal.

Observed in jc-taxes (`www/src/useKeyboardShortcuts.ts`): searching "year" in the omnibar shows `Previous / Next year b  ]`.

## Proposal

1. `ActionPairEntry` / `ActionTripletEntry` gain an optional `label` (the member's own name, e.g. "Previous year" / "Next year").
2. The pair/triplet `label` stays the collapsed-row label for `ShortcutsModal` ("Previous / Next year").
3. Registered member configs carry both: `label` = entry label (fallback: current `${label} a|b`), plus `actionPair.label` / `actionTriplet.label` = the group label.
4. `ShortcutsModal` uses `actionPair.label` when present (fallback: current suffix-strip of `entries[0].label`).
5. Omnibar / `searchActions` / `LookupModal` show the member `label` (so "Next year  ]"), and match on the group label as a keyword too.

Manual registrations (`useAction` with `actionPair: { pairId, index }`) should be able to pass `actionPair: { pairId, index, label }` for the same effect.

## Back-compat

All new fields optional; absent → current behavior.

## Tests

- Modal: pair with entry labels renders a single row labelled with the pair label.
- Omnibar search: members render their entry labels; searching the pair label finds both.

## Implementation (done)

- New exported types `ActionPairMeta { pairId, index, label? }` / `ActionTripletMeta { tripletId, index, label? }`, replacing the inline object types that were duplicated between `ActionConfig` (`useAction.ts`) and `ActionDefinition` (`types.ts`).
- `ActionPairEntry` / `ActionTripletEntry` gain optional `label`. `useActionPair` / `useActionTriplet` register each member with `label: entry.label ?? `${label} a|b|c`` and always set `actionPair.label` / `actionTriplet.label` to the group label.
- `ShortcutsModal`: collapsed-row label = `actionPair.label` / `actionTriplet.label` when present, else the old suffix-strip of the first member's label (so manual registrations without `label` are unchanged).
- `searchActions`: the group label is matched as an extra keyword, so searching "Previous / Next year" finds every member. Member display in omnibar / `LookupModal` / conflict tooltips just uses the member `label` — no changes needed there.
- Manual registrations: `useAction(id, { label: 'Grow', actionPair: { pairId, index: 1, label: 'Shrink / Grow' } })` works the same way.

e2e (`/many-actions?pairProbe`: a `useActionPair` year pair, a `useActionTriplet`, and a manual `useAction` pair): "Action pair / triplet entry labels" — modal rows show group labels; omnibar lists members by their own labels (pair + triplet); searching a group-label-only string finds all members (hook + manual). TFFP: all 5 failed pre-fix (members showed as "… a/b/c"; manual group label unsearchable, modal showed "Shrink").
