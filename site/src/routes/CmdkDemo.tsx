/**
 * SPIKE demo (cmdk-delegation): mounts <OmnibarCmdk /> (cmdk-backed palette)
 * with registered actions (incl. a param-entry action), an async paginated
 * endpoint, and recents — to compare against the hand-rolled <Omnibar />.
 * Open with ⌘K.
 */
import { useMemo, useState } from 'react'
import { OmnibarCmdk, ShortcutsModal, useAction, useOmnibarEndpoint } from 'use-kbd'
import type { EndpointPagination, EndpointResponse } from 'use-kbd'
import 'use-kbd/styles.css'

// 40 synthetic "fruits" so the endpoint paginates (pageSize 8, scroll mode).
const FRUITS = Array.from({ length: 40 }, (_, i) => `Fruit-${String(i + 1).padStart(2, '0')}`)

export function CmdkDemo() {
  const [count, setCount] = useState(0)
  const [picked, setPicked] = useState<string | null>(null)

  useAction('cmdk:inc', { label: 'Increment', group: 'Counter', defaultBindings: ['+'], handler: () => setCount(c => c + 1) })
  useAction('cmdk:dec', { label: 'Decrement', group: 'Counter', defaultBindings: ['-'], handler: () => setCount(c => c - 1) })
  useAction('cmdk:reset', { label: 'Reset counter', group: 'Counter', defaultBindings: ['0'], handler: () => setCount(0) })
  // Placeholder binding → selecting from the palette (no number given) prompts
  // for a value via ParamEntry.
  useAction('cmdk:setN', {
    label: 'Set counter to N',
    description: 'e.g. s 42',
    group: 'Counter',
    defaultBindings: ['s \\d+'],
    handler: (_e, captures) => { const n = captures?.[0]; if (n !== undefined) setCount(n) },
  })

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
    pageSize: 8,
    pagination: 'scroll',
  }), []))

  return (
    <div style={{ padding: 24 }}>
      <h1 id="demo">cmdk Omnibar Spike</h1>
      <p>Press <kbd>⌘K</kbd> for the cmdk-backed palette. Actions (Counter, incl. param entry) + paginated async endpoint (Fruits).</p>
      <p>Counter: <strong>{count}</strong>{picked && <> · Picked: <strong>{picked}</strong></>}</p>
      <OmnibarCmdk />
      <ShortcutsModal />
    </div>
  )
}
