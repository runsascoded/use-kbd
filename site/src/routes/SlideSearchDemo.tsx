import { useMemo, useState } from 'react'
import { Highlight, Omnibar, OmnibarCmdk, useActions, useHotkeysContext } from 'use-kbd'
import type { ActionConfig } from 'use-kbd'
import { CONTROLS, SLIDES, slideLabel } from './slideSearchData'

/**
 * Slide search: each slide's body is `searchText`, so a query matches it only
 * by substrings / word prefixes, and the omnibar shows a snippet explaining the
 * match. Slide controls rank above slide jumps (`priority: 1`).
 *
 * `?renderer=cmdk` uses `<OmnibarCmdk />`; `?renderer=custom` keeps the default
 * chrome but replaces each row via `renderResult`.
 */
export function SlideSearchDemo() {
  const ctx = useHotkeysContext()
  const renderer = new URLSearchParams(location.search).get('renderer') ?? 'default'
  const [current, setCurrent] = useState(0)
  const [netOfCredits, setNetOfCredits] = useState(true)

  useActions(useMemo(() => {
    const actions: Record<string, ActionConfig> = {}
    SLIDES.forEach((s, i) => {
      actions[`slide:${s.id}`] = {
        label: slideLabel(s, i),
        group: 'Slides',
        searchText: s.body,
        handler: () => setCurrent(i),
      }
    })
    for (const c of CONTROLS) {
      actions[`control:${c.id}`] = {
        label: c.label,
        group: 'Controls',
        priority: 1,
        handler: () => { setCurrent(2); setNetOfCredits(c.id === 'net-of-credits') },
      }
    }
    return actions
  }, []))

  const slide = SLIDES[current]
  return (
    <div style={{ padding: 24, maxWidth: 760 }}>
      <h1>Slide search</h1>
      <p>
        Each slide's body text is registered as <code>searchText</code>: it's matched only by substrings or word prefixes, and a matching row shows a snippet of it. Try “credits”, “cred”, or “coldline”.
      </p>
      <p>
        <a href="/slide-search">Default palette</a>{' · '}
        <a href="/slide-search?renderer=custom">Custom rows (<code>renderResult</code>)</a>{' · '}
        <a href="/slide-search?renderer=cmdk">cmdk palette</a>
      </p>
      <button onClick={ctx.openOmnibar}>Search slides</button>
      <section data-testid="slide" style={{ border: '1px solid var(--border-color, #8884)', borderRadius: 8, padding: 16, marginTop: 16 }}>
        <h2>{slideLabel(slide, current)}</h2>
        <p>{slide.body}</p>
        {slide.id === 'gcs-bill' && <p>Showing: <span data-testid="bill-mode">{netOfCredits ? 'net of credits' : 'gross'}</span></p>}
      </section>
      {renderer === 'cmdk'
        ? <OmnibarCmdk />
        : renderer === 'custom'
          ? (
            <Omnibar
              renderResult={(result, { selected }) => {
                const best = result.matches[0]
                return (
                  <span data-testid="custom-row" data-selected={selected}>
                    <Highlight text={result.action.label} ranges={result.labelMatches} />
                    {best && <span className="kbd-omnibar-result-category">{` (${best.field})`}</span>}
                  </span>
                )
              }}
            />
          )
          : <Omnibar />}
    </div>
  )
}
