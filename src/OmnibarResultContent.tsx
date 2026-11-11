import { Fragment, type ReactNode } from 'react'
import { snippet } from './utils'
import type { FieldMatch, MatchField } from './types'

/**
 * Render `text` with its matched `ranges` wrapped in `<mark>` (class
 * `kbd-omnibar-match`), e.g. a result's `labelMatches`, or a `FieldMatch`.
 */
export function Highlight({ text, ranges, className = 'kbd-omnibar-match' }: {
  text: string
  ranges?: Array<[number, number]>
  className?: string
}) {
  if (!ranges?.length) return <>{text}</>
  const parts: ReactNode[] = []
  let pos = 0
  for (const [start, end] of ranges) {
    if (start > pos) parts.push(text.slice(pos, start))
    parts.push(<mark key={start} className={className}>{text.slice(start, end)}</mark>)
    pos = end
  }
  if (pos < text.length) parts.push(text.slice(pos))
  return <>{parts.map((p, i) => <Fragment key={i}>{p}</Fragment>)}</>
}

/** Fields whose matches the default rows explain with a snippet line. */
export const SNIPPET_FIELDS: MatchField[] = ['searchText', 'description', 'keyword']

/**
 * The match a result row should explain: its best match, when that isn't in
 * the label (a label match is already visible, highlighted) and is in one of
 * `fields`.
 */
export function contextMatch(matches: FieldMatch[], fields: MatchField[] = SNIPPET_FIELDS): FieldMatch | undefined {
  if (matches.some(m => m.field === 'label')) return undefined
  return matches.find(m => fields.includes(m.field))
}

/**
 * The default row's second line: a highlighted snippet of the field that
 * matched, when the label didn't (e.g. "…net of **credits** was $41k…").
 */
export function ResultSnippet({ matches, fields, radius }: {
  matches: FieldMatch[]
  fields?: MatchField[]
  radius?: number
}) {
  const match = contextMatch(matches, fields)
  if (!match) return null
  const s = snippet(match.text, match.ranges, { radius })
  return (
    <span className="kbd-omnibar-result-snippet" data-field={match.field}>
      <Highlight text={s.text} ranges={s.ranges} />
    </span>
  )
}

/** Default row content: highlighted label, plus a snippet line for non-label matches. */
export function ResultMain({ label, labelMatches, matches, fields }: {
  label: string
  labelMatches: Array<[number, number]>
  matches: FieldMatch[]
  fields?: MatchField[]
}) {
  return (
    <span className="kbd-omnibar-result-main">
      <span className="kbd-omnibar-result-label"><Highlight text={label} ranges={labelMatches} /></span>
      <ResultSnippet matches={matches} fields={fields} />
    </span>
  )
}
