# Fix stale handlers in `useActionPair` / `useActionTriplet`

## Bug

Both `useActionPair` and `useActionTriplet` wrap handler functions inside a `useMemo`, excluding handlers from the dependency array. The comment says "handlers excluded — refs handle staleness in useActions", but this is incorrect: `useActions` updates its `handlersRef` from the `actions` object it receives, and when that object is memoized, the handlers inside it are stale closures from whenever the memo was last recomputed.

In contrast, `useAction` (singular) correctly stores `config.handler` in a ref on every render:
```typescript
const handlerRef = useRef(config.handler)
handlerRef.current = config.handler  // updated every render
```

## Reproduction

Any `useActionPair` handler that closes over changing state will use stale values:
```tsx
const [count, setCount] = useState(0)
useActionPair('counter', {
  label: 'Inc / Dec',
  actions: [
    { defaultBindings: ['='], handler: () => setCount(count + 1) },  // stale `count`
    { defaultBindings: ['-'], handler: () => setCount(count - 1) },  // stale `count`
  ],
})
```
After incrementing once (count=1), pressing `=` again still sees count=0 and sets count=1 again.

## Fix

After the `useMemo`, update the handlers in the memo'd object before passing to `useActions`. The simplest approach: patch the handler references outside the memo.

In `useActionPair.ts`:
```typescript
const actionConfigs = useMemo(() => { ... }, [...])

// Patch fresh handlers — useMemo excludes them to avoid re-registration,
// but useActions needs current references to update its handlerRefs
actionConfigs[`${id}-a`].handler = actionA.handler
actionConfigs[`${id}-b`].handler = actionB.handler
actionConfigs[`${id}-a`].enabled = actionA.enabled ?? enabled
actionConfigs[`${id}-b`].enabled = actionB.enabled ?? enabled

useActions(actionConfigs)
```

Same pattern for `useActionTriplet.ts` with the `-c` entry as well.

This is safe because `useActions` already treats the `actions` object as a source of fresh handler/enabled refs (lines 159-162), and the effect dep only checks structural properties (label, bindings, etc.), not handlers or enabled.

## Discovered in

jc-taxes: switching from individual `useAction` calls to `useActionPair`/`useActionTriplet` caused e2e test failures (year navigation and aggregation mode shortcuts).

Workaround used there: call `useAction` directly with `actionPair`/`actionTriplet` metadata, which gives the same ShortcutsModal grouping without the stale closure issue.
