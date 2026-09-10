/**
 * SPIKE demo (cmdk-delegation): mounts <OmnibarCmdk /> (cmdk-backed palette)
 * with a few registered actions + one async endpoint, so it can be compared
 * against the hand-rolled <Omnibar /> on the other routes. Open with ⌘K.
 */
import { useMemo, useState } from 'react'
import { OmnibarCmdk, ShortcutsModal, useAction, useOmnibarEndpoint } from 'use-kbd'
import type { EndpointPagination, EndpointResponse } from 'use-kbd'
import 'use-kbd/styles.css'

const FRUITS = ['Apple', 'Banana', 'Cherry', 'Date', 'Elderberry', 'Fig', 'Grape', 'Honeydew', 'Kiwi', 'Lemon', 'Mango', 'Nectarine', 'Orange', 'Papaya', 'Quince']

export function CmdkDemo() {
  const [count, setCount] = useState(0)
  const [picked, setPicked] = useState<string | null>(null)

  useAction('cmdk:inc', { label: 'Increment', group: 'Counter', defaultBindings: ['+'], handler: () => setCount(c => c + 1) })
  useAction('cmdk:dec', { label: 'Decrement', group: 'Counter', defaultBindings: ['-'], handler: () => setCount(c => c - 1) })
  useAction('cmdk:reset', { label: 'Reset counter', group: 'Counter', defaultBindings: ['0'], handler: () => setCount(0) })

  // Async endpoint: search fruits (exercises the registry+endpoint bridge under cmdk).
  useOmnibarEndpoint('fruits', useMemo(() => ({
    fetch: async (query: string, _signal: AbortSignal, pagination: EndpointPagination): Promise<EndpointResponse> => {
      await new Promise(r => setTimeout(r, 60))
      const q = query.toLowerCase()
      const matches = FRUITS.filter(f => f.toLowerCase().includes(q))
      const page = matches.slice(pagination.offset, pagination.offset + pagination.limit)
      return {
        entries: page.map(f => ({ id: `fruit-${f}`, label: f, group: 'Fruits', handler: () => setPicked(f) })),
        total: matches.length,
        hasMore: pagination.offset + pagination.limit < matches.length,
      }
    },
    group: 'Fruits',
    minQueryLength: 0,
    pageSize: 20,
  }), []))

  return (
    <div style={{ padding: 24 }}>
      <h1 id="demo">cmdk Omnibar Spike</h1>
      <p>Press <kbd>⌘K</kbd> for the cmdk-backed palette. Actions (Counter) + async endpoint (Fruits).</p>
      <p>Counter: <strong>{count}</strong>{picked && <> · Picked: <strong>{picked}</strong></>}</p>
      <OmnibarCmdk />
      <ShortcutsModal />
    </div>
  )
}
