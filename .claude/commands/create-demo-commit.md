# Create or update a `use-kbd-demo` branch in a consumer project

Arguments: $ARGUMENTS

Parse the arguments: first arg is the repo path, second (optional) is the branch name (default: `use-kbd-demo`).

## What this does

Creates a branch with 2 commits on top of the project's main branch:

1. **Remove `use-kbd` completely** — delete all use-kbd imports, components, hooks, config, styles, and the dependency itself
2. **Revert that commit** — the revert is a clean, permalink-able diff showing how to comprehensively add `use-kbd` to the project

A second branch `pre-use-kbd` points at the removal commit. This enables clean compare URLs without `^` or `~1`:

```
https://github.com/<owner>/<repo>/compare/pre-use-kbd...use-kbd-demo
```

## Steps

### 1. Safety checks

- `cd` to the repo path, verify it's a git repo
- Verify the working tree is clean (`git status --porcelain` is empty); abort if not
- Record the current branch to return to later
- Identify the main/default branch (`main` or `master`)

### 2. Find all use-kbd references

Search comprehensively for everything to remove. This includes:

- **Source files** importing from `'use-kbd'` or `'use-kbd/styles.css'`
- **package.json** `use-kbd` dependency entry
- **Lock files** (`pnpm-lock.yaml`) — the use-kbd entry (but don't delete the whole file)
- **`.pnpm-dep-source.json`** — the use-kbd entry if present
- **Config files** referencing use-kbd (CLAUDE.md, README mentions, etc.)
- **Test files** (e2e specs testing keyboard shortcuts)

Read each file to understand the full scope before making changes.

### 3. Create the removal commit

Checkout a temporary branch from the main branch:

```
git checkout -B _use-kbd-demo-wip <main-branch>
```

Remove all use-kbd code:

- Delete files that exist solely for use-kbd (e.g., `hotkeyConfig.ts`, `groupRenderers.tsx`, `useKeyboardShortcuts.ts`, shortcut test files)
- In files with mixed concerns (e.g., `App.tsx`, `main.tsx`), remove only the use-kbd-related code: imports, Provider wrappers, component renders, action registrations, context usage
- Remove the `use-kbd` line from `package.json` dependencies
- Remove the `use-kbd` entry from `.pnpm-dep-source.json` if it exists
- Remove `import 'use-kbd/styles.css'` lines
- Remove use-kbd CSS variable overrides / `_shortcuts.scss` / `_kbd.scss` files
- Do NOT run `pnpm install` or modify `node_modules` — this is a documentation commit, not meant to be built

Stage everything and commit:

```
git add -u  # only tracked file changes
git commit -m "Remove \`use-kbd\` keyboard shortcuts library"
```

If any files were entirely deleted, `git add` them explicitly.

### 4. Revert to create the demo commit

```
git revert HEAD --no-edit
```

Then **amend the revert commit** with a descriptive message. Do NOT use the auto-generated "Revert ..." message. Write a proper commit message:

- **Title**: `Add \`use-kbd\` keyboard shortcuts library`
- **Body**: Summarize what's being integrated — list the key components, number of actions/shortcuts, and major features added. End with a note that it's auto-generated and a link to use-kbd.

Example:

```
Add `use-kbd` keyboard shortcuts library

Integrate use-kbd into <project name>, adding:

- `HotkeysProvider` + `Omnibar` + `ShortcutsModal` + `LookupModal` + `SequenceModal` in app shell
- `SpeedDial` FAB with hover-peek + click-to-pin
- N keyboard actions: <brief list of categories>
- Press-and-hold continuous movement
- `useOmnibarEndpoint` for fuzzy search by <domain-specific terms>
- Dark/light theme CSS variable overrides for use-kbd components

This commit is auto-generated as a demo of adding use-kbd to an existing app.
See: https://github.com/runsascoded/use-kbd
```

Amend with `git commit --amend` using this message.

### 5. Point the branches and clean up

```
git branch -f <branch-name>         # point demo branch at current HEAD (the revert)
git branch -f pre-use-kbd HEAD~1    # point base branch at the removal commit
git checkout <original-branch>      # return to where we were
git branch -D _use-kbd-demo-wip    # delete temp branch
```

If branches already exist, this force-updates them. The temp branch avoids polluting the original branch's history.

### 6. Push the branches

```
git push <remote> <branch-name> --force-with-lease
git push <remote> pre-use-kbd --force-with-lease
```

Detect the remote name (check `git remote` — might be `u`, `origin`, or a single-letter name). Use `--force-with-lease` since these branches are expected to be force-updated periodically.

### 7. Report

Print the compare URL:

```
https://github.com/<owner>/<repo>/compare/pre-use-kbd...<branch-name>
```

And confirm both branches were created/updated.

## Important notes

- The removal commit doesn't need to produce a buildable project — it's only a vehicle to generate a clean revert diff
- Be thorough in finding ALL use-kbd references; grep for `use-kbd`, `useAction`, `useMode`, `useHotkeysContext`, `useOmnibarEndpoint`, `ShortcutsModal`, `Omnibar`, `LookupModal`, `SequenceModal`, `SpeedDial`, `ModeIndicator`, `KbdModal`, `SearchTrigger`, `HotkeysProvider`, `kbd-` (CSS classes)
- Do NOT modify the main branch — all work happens on the temp branch
- Do NOT commit unrelated changes or untracked files
- After finishing, verify `git branch` shows we're back on the original branch
