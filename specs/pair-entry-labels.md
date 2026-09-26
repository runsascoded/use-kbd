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
