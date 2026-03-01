# Competitor Shortcuts UI Screenshots

Collect screenshots of other apps' keyboard shortcuts UIs to contrast with `use-kbd`'s features in docs/marketing. Most are static, non-editable lists — use-kbd's editable bindings, omnibar search, modes, arrow groups, and action pairs are a step change.

## Captured Screenshots

### Gmail (`gmail-kbd.png`)
- Dense two-column wall of shortcuts on dark background
- No search, no editing, no grouping hierarchy — flat dump
- Has sequences (`g i`, `g s`, etc.) but no visual separation between sequence keys
- "Open in a new window" link, "Close" button — that's it for UI
- Must be enabled via Settings toggle before shortcuts work at all
- Support page: https://support.google.com/mail/answer/6594?hl=en

### GitHub (`github-kbd.png`)
- Two-column grouped layout: "Repositories" (left), "Site-wide shortcuts" (right), "Pull request list" (below)
- Sequences shown as separate `kbd` elements (`G` `C`) — cleaner than Gmail
- Multiple bindings shown with "or" (e.g., `O` or `↵`)
- Not editable, no search
- "View all keyboard shortcuts" link at bottom
- Separate command palette (Ctrl+K / Cmd+K) — but it's disconnected from the shortcuts modal

### Google Drive (`drive-kbd.png`)
- Cleanest of the three: has a **search bar** (rare!)
- Grouped by category ("Selection" visible)
- Arrow keys rendered as icons inside `kbd` elements
- Not editable despite having search
- "View all in help center" link to external page
- Support page: https://support.google.com/drive/answer/2563044

## Still To Capture

### Google Products
- **Google Docs** (Tools → Keyboard shortcuts): categorized list, not editable.
- **Google Sheets** (same): similar to Docs.
- **Google Calendar** (`?`): compact list.
- **YouTube** (`?` or Shift+?): simple overlay.
- **Google Maps** (`?`): minimal.

### Jupyter
- **JupyterLab**: Settings → Advanced Settings Editor → Keyboard Shortcuts. Editable via JSON config, not inline UI. Has a searchable list in the settings panel.
- **Jupyter Notebook (classic)**: Help → Keyboard Shortcuts. Simple list, not editable in UI.

### Other Notable Examples
- **VS Code** (Cmd+K Cmd+S): full editable keybindings UI with search, conflict detection. The gold standard — but it's a desktop app, not a web component.
- **Figma** (`?`): categorized shortcuts, not editable.
- **Notion** (`?`): simple list.
- **Slack** (Cmd+/): categorized, not editable.
- **Linear** (`?`): clean modal, not editable.
- **Twitter/X**: `?` for shortcuts list.

## Key Differentiators to Highlight

| Feature | Gmail | GitHub | Drive | use-kbd |
|---|---|---|---|---|
| View shortcuts | Flat wall | Grouped columns | Grouped + search | Grouped, collapsible |
| Edit bindings | No | No | No | Click-to-edit inline |
| Search/filter | No | No | Yes (filter only) | Omnibar + fuzzy search |
| Sequences | Yes (`g i`) | Yes (`G` `C`) | No | Full support, live preview |
| Conflict detection | No | No | No | Real-time warnings |
| Import/Export | No | No | No | JSON export/import |
| Modes | No | No | No | User-editable mode groups |
| Arrow groups | No | No | No | Compact 4-direction rows |
| Action pairs/triplets | No | No | No | Collapsed rows with `/` |
| Digit placeholders | No | No | No | `\d`, `\d+`, `\f` with tooltips |
| Multiple bindings | Some | "or" notation | Some | Click `+` to add more |

## Notes

- Drive is the closest to having a real UX (search bar), but it's filter-only (not fuzzy), and still read-only.
- GitHub's command palette (Cmd+K) is conceptually similar to use-kbd's omnibar, but it's completely separate from the shortcuts modal — you can't see/edit shortcuts from the palette or vice versa.
- Gmail requires a Settings toggle to enable shortcuts at all; use-kbd shortcuts are always active.
- None of these support customization without going to a separate settings page or external documentation.

## Status

- Screenshots at `docs/screenshots/{gmail,github,drive}-kbd.png`
- Comparison table added to README.md
- More products could still be captured (see "Still To Capture" above)
