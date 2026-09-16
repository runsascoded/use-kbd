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
    <div style={{ padding: 24, maxWidth: 760 }}>
      <h1 id="demo">cmdk Omnibar Spike</h1>
      <p>
        Both widgets below are the <strong>same</strong> <code>&lt;OmnibarCmdk&gt;</code> component,
        fed by the <strong>same</strong> use-kbd action registry (Counter, incl. a param-entry
        action) + a paginated async endpoint (Fruits). cmdk owns the input, list, keyboard-nav
        and a11y; use-kbd owns the registry, endpoints, ranking and ParamEntry.
      </p>
      <p style={{ fontSize: '1.05rem' }}>
        Counter: <strong data-testid="count">{count}</strong>
        {picked && <> · Picked: <strong data-testid="picked">{picked}</strong></>}
      </p>

      <section style={{ marginTop: 28 }}>
        <h2 style={{ fontSize: '1.05rem', marginBottom: 6 }}>1 · Modal palette</h2>
        <p style={{ marginTop: 0, color: 'var(--kbd-fg-secondary, #888)' }}>
          Press <kbd>⌘K</kbd> — the classic command-palette form factor (backdrop + dialog).
        </p>
        <OmnibarCmdk />
      </section>

      <section style={{ marginTop: 28 }} data-testid="inline-section">
        <h2 style={{ fontSize: '1.05rem', marginBottom: 6 }}>2 · Inline / stationary search</h2>
        <p style={{ marginTop: 0, color: 'var(--kbd-fg-secondary, #888)' }}>
          The same palette rendered <strong>inline</strong> (<code>inline</code> prop) — no modal,
          always visible, in the page flow. This is the form factor cmdk makes cheap and the
          hand-rolled modal <code>&lt;Omnibar&gt;</code> does not. Type to filter; scroll for more Fruits.
        </p>
        <div style={{ maxWidth: 460 }}>
          <OmnibarCmdk inline placeholder="Search actions & fruits…" />
        </div>
      </section>

      <ShortcutsModal />
    </div>
  )
}
