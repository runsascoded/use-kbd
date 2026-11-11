import type { ActionRegistry } from 'use-kbd'

/**
 * A slide deck's searchable content, modelled on the disky deep-dive deck
 * (`SlideSearch.tsx`): one action per slide, whose body text is `searchText`
 * (searched strictly, never shown as-is), plus actions for slide controls,
 * ranked above slide jumps via `priority`.
 */
export interface Slide {
  id: string
  title: string
  body: string
}

export const SLIDES: Slide[] = [
  { id: 'title', title: 'Disky deep dive', body: 'Where our storage bill goes, and what we can do about it.' },
  { id: 'owners', title: 'Who owns what', body: 'Who owns ⌘⇧/? Each team can create buckets, edit lifecycle rules, and audit its own usage.' },
  { id: 'gcs-bill', title: 'GCS bill', body: 'In July the GCS bill came to $58k gross, but the bill net of credits was $41k after the committed-use discount was applied.' },
  { id: 'lifecycle', title: 'Lifecycle rules', body: 'Objects move to Nearline after 30 days and Coldline after 90, and are deleted after a year.' },
  { id: 'keys', title: 'Credentials', body: 'Service-account keys rotate weekly; humans use short-lived tokens.' },
]

export interface SlideControl {
  id: string
  label: string
}

export const CONTROLS: SlideControl[] = [
  { id: 'net-of-credits', label: '3. GCS bill: net of credits' },
  { id: 'gross', label: '3. GCS bill: gross' },
]

export const slideLabel = (slide: Slide, i: number) => `${i + 1}. ${slide.title}`

/** The same content as a plain registry, for exercising `searchActions` directly. */
export const SLIDE_REGISTRY: ActionRegistry = {
  ...Object.fromEntries(SLIDES.map((s, i) => [`slide:${s.id}`, {
    label: slideLabel(s, i),
    group: 'Slides',
    searchText: s.body,
  }])),
  ...Object.fromEntries(CONTROLS.map(c => [`control:${c.id}`, {
    label: c.label,
    group: 'Controls',
    priority: 1,
  }])),
}
