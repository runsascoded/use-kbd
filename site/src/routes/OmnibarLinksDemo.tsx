import { useMemo, useState } from 'react'
import { Omnibar, OmnibarCmdk, useAction, useActions, useHotkeysContext, useOmnibar, useOmnibarEndpoint } from 'use-kbd'

function HeadlessLinksProbe() {
  const [events, setEvents] = useState<object[]>([])
  const record = (event?: KeyboardEvent) => setEvents(prev => [...prev, {
    key: event?.key,
    metaKey: event?.metaKey,
    ctrlKey: event?.ctrlKey,
    shiftKey: event?.shiftKey,
  }])
  const callback = new URLSearchParams(location.search).has('callback')
  const palette = useOmnibar({
    actions: useMemo(() => ({
      'headless:link': { label: 'Headless link', href: '/omnibar-links?headless=1' },
      'headless:event': { label: 'Headless event' },
    }), []),
    handlers: callback ? undefined : { 'headless:event': record },
    onExecute: callback ? (_id, _captures, event) => record(event) : undefined,
    enabled: false,
  })
  return (
    <section>
      <button onClick={event => palette.execute('headless:link', undefined, event.nativeEvent)}>Run headless link</button>
      <button onClick={event => palette.execute('headless:event', undefined, event.nativeEvent)}>Run headless event</button>
      <button onClick={() => { palette.open(); palette.setQuery('Headless event') }}>Open headless event</button>
      <pre data-testid="headless-events">{JSON.stringify(events)}</pre>
      <output data-testid="headless-open">{String(palette.isOpen)}</output>
    </section>
  )
}

export function OmnibarLinksDemo() {
  const ctx = useHotkeysContext()
  const [events, setEvents] = useState<object[]>([])
  const renderer = new URLSearchParams(location.search).get('renderer') ?? 'default'
  const [destination, setDestination] = useState('initial')
  const record = (event?: KeyboardEvent) => setEvents(prev => [...prev, {
    key: event?.key ?? null,
    metaKey: event?.metaKey ?? false,
    ctrlKey: event?.ctrlKey ?? false,
    shiftKey: event?.shiftKey ?? false,
  }])

  useActions({
    'links:handler': {
      label: 'Link with handler',
      href: () => `/omnibar-links?destination=${location.hash.slice(1) || 'initial'}`,
      defaultBindings: ['h'],
      handler: record,
    },
    'links:only': {
      label: 'Link without handler',
      href: '/omnibar-links?arrived=1',
    },
    'links:event': {
      label: 'Event without URL',
      handler: record,
    },
    'links:param': {
      label: 'Parameter event',
      defaultBindings: ['p \\d+'],
      handler: record,
    },
  })
  useAction('links:state', {
    label: 'Stateful link',
    href: () => `/omnibar-links?state=${destination}`,
    handler: record,
  })
  useOmnibarEndpoint('links', useMemo(() => ({
    filter: (query: string) => ({
      entries: 'remote link'.includes(query.toLowerCase())
        ? [{ id: 'remote', label: 'Remote link', href: '/omnibar-links?remote=1' }]
        : [],
    }),
    minQueryLength: 0,
  }), []))

  return (
    <div style={{ padding: 24, maxWidth: 760 }}>
      <h1>Omnibar links</h1>
      <p>Enter runs a command or follows its link. ⌘Enter opens a background tab; ⌘⇧Enter opens a tab and switches to it; ⇧Enter opens a new window. Use Ctrl instead of ⌘ off macOS. Link clicks support the same modifiers, and middle-click opens a tab.</p>
      <p>
        <a href="/omnibar-links">Default palette</a>{' · '}
        <a href="/omnibar-links?renderer=cmdk">cmdk palette</a>
      </p>
      <button onClick={ctx.openOmnibar}>Open palette</button>
      <button onClick={() => setDestination('updated')}>Update destination</button>
      <pre data-testid="link-events">{JSON.stringify(events)}</pre>
      {renderer === 'headless' ? <HeadlessLinksProbe /> : renderer === 'cmdk' ? <OmnibarCmdk /> : <Omnibar />}
    </div>
  )
}
