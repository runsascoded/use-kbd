/**
 * Test-only demo page with many registered actions for testing infinite scroll.
 * Not linked from navigation — accessed directly via /many-actions.
 *
 * Also used by an e2e that verifies registering an action doesn't re-render
 * unrelated action registrants: each DummyAction records its commit count under
 * `window.__renders[id]`, and the "Register extra action" button mounts one more
 * registrant (a registry version bump). Existing registrants must not re-render.
 */
import { useEffect, useState } from 'react'
import { KbdOmnibar, ShortcutsModal, useAction, useHotkeysContext } from 'use-kbd'

declare global {
  interface Window {
    __renders?: Record<string, number>
  }
}

function recordRender(id: string) {
  const renders = window.__renders ?? (window.__renders = {})
  renders[id] = (renders[id] ?? 0) + 1
}

function DummyAction({ id, label, group }: { id: string; label: string; group: string }) {
  useAction(id, {
    label,
    group,
    handler: () => {},
  })
  // Count commits per action id (runs after every render that commits).
  useEffect(() => { recordRender(id) })
  return null
}

/**
 * Consumes the full hotkeys context, so it re-renders on every registry version
 * bump. The e2e uses its commit count as a deterministic "the version-bump
 * re-render has flushed" signal before asserting the pure registrants above did
 * NOT re-render.
 */
function DisplayProbe() {
  const ctx = useHotkeysContext()
  useEffect(() => { recordRender('__display') })
  return <span data-testid="action-count" hidden>{ctx.registry.actions.size}</span>
}

/** Button that mounts/unmounts an extra registrant, exercising register churn. */
function RegisterExtraToggle() {
  const [mounted, setMounted] = useState(false)
  return (
    <>
      <button id="register-extra" onClick={() => setMounted(m => !m)}>
        {mounted ? 'Unregister extra action' : 'Register extra action'}
      </button>
      {mounted && <DummyAction id="extra-action" label="Extra" group="Tools" />}
    </>
  )
}

const GROUPS = ['Navigation', 'Editing', 'View', 'Tools']

export function ManyActionsDemo() {
  const count = Number(new URLSearchParams(window.location.search).get('n') || '50')
  const actions = Array.from({ length: count }, (_, i) => ({
    id: `test-action-${i}`,
    label: `Action ${i + 1}`,
    group: GROUPS[i % GROUPS.length],
  }))

  return (
    <div id="demo">
      <h1>Many Actions Demo ({count})</h1>
      <p>Press <kbd>?</kbd> for shortcuts, <kbd>⌘K</kbd> for omnibar.</p>
      <RegisterExtraToggle />
      <DisplayProbe />
      {actions.map(a => <DummyAction key={a.id} {...a} />)}
      <ShortcutsModal />
      <KbdOmnibar />
    </div>
  )
}
