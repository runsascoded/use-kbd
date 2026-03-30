# Spec: Drop `debug` dependency

## Problem
`debug` is CJS-only, which breaks Vite dev when consumers use `pds l kb` (local workspace link). Vite tries to import `debug` as ESM and fails:

```
Uncaught SyntaxError: The requested module 'debug/src/browser.js'
does not provide an export named 'default'
```

This doesn't affect `pds gh kb` (dist branch) since `debug` gets inlined by the bundler, but it's a friction point for local development.

## Proposed fix
Replace `debug` with a minimal inline helper. `use-kbd` is browser-only and only uses `debug` for conditional console logging with namespace filtering. That can be done in ~10 lines:

```ts
function makeDebug(namespace: string) {
  return (...args: unknown[]) => {
    try {
      const pattern = localStorage.getItem('debug') || ''
      if (!pattern) return
      // Support wildcards: "use-kbd:*" matches "use-kbd:omnibar"
      const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$')
      if (regex.test(namespace)) {
        console.log(`%c${namespace}`, 'color: #888', ...args)
      }
    } catch {}
  }
}
```

Usage stays the same:
```ts
const debug = makeDebug('use-kbd:omnibar')
debug('opened', { query })
```

## Changes
1. Remove `debug` and `@types/debug` from `package.json`
2. Add `src/debug.ts` with the inline helper
3. Update all `import debug from 'debug'` → `import { makeDebug } from './debug'`
4. Grep for all `debug(` call sites — should just need the namespace string, no API change

## Found by
marin-bot Discord viewer using `pds l kb` for local use-kbd development hit the CJS/ESM incompatibility during Vite dev.
