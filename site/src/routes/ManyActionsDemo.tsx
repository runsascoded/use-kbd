/**
 * Test-only demo page with many registered actions for testing infinite scroll.
 * Not linked from navigation — accessed directly via /many-actions.
 */
import { KbdOmnibar, ShortcutsModal, useAction } from 'use-kbd'

function DummyAction({ id, label, group }: { id: string; label: string; group: string }) {
  useAction(id, {
    label,
    group,
    handler: () => {},
  })
  return null
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
      {actions.map(a => <DummyAction key={a.id} {...a} />)}
      <ShortcutsModal />
      <KbdOmnibar />
    </div>
  )
}
