import { test, expect, type Page } from '@playwright/test'
import { fuzzyMatch, searchActions, snippet } from 'use-kbd'
import type { ActionRegistry, ActionSearchResult } from 'use-kbd'
import { SLIDE_REGISTRY } from '../src/routes/slideSearchData'

const BILL = SLIDE_REGISTRY['slide:gcs-bill'].searchText!
const CREDITS = BILL.indexOf('credits')

const ids = (query: string, registry: ActionRegistry = SLIDE_REGISTRY) =>
  searchActions(query, registry).map(r => r.id)
const fieldMatches = (results: ActionSearchResult[]) =>
  results.map(r => ({ id: r.id, matches: r.matches.map(({ field, text, ranges }) => ({ field, text, ranges })) }))

test.describe('fuzzyMatch best alignment', () => {
  test('prefers a contiguous occurrence over the greedy scattered one', () => {
    const text = 'Cached reads edit its stats, net of credits'
    const at = text.indexOf('credits')
    const m = fuzzyMatch('credits', text)
    expect(m.ranges).toEqual([[at, at + 7]])
    // The scattered alignment alone (text before the contiguous occurrence) scores lower
    const scattered = fuzzyMatch('credits', text.slice(0, at))
    expect(scattered.matched).toBe(true)
    expect(m.score).toBeGreaterThan(scattered.score)
  })

  test('unchanged for a prefix match', () => {
    expect(fuzzyMatch('gcs', 'GCS bill').ranges).toEqual([[0, 3]])
  })
})

test.describe('searchActions: searchText, matches, priority', () => {
  test('searchText never matches scattered subsequences', () => {
    // "Who owns ⌘⇧/? … create … edit … its …" contains c…r…e…d…i…t…s, but not "credits"
    expect(ids('credits')).toEqual(['control:net-of-credits', 'slide:gcs-bill'])
  })

  test('searchText matches word prefixes', () => {
    // The control also matches by id, and gets its priority boost
    expect(ids('cred')).toEqual(['control:net-of-credits', 'slide:keys', 'slide:gcs-bill'])
  })

  test('searchText requires every query term', () => {
    expect(ids('bill credits')).toEqual(['control:net-of-credits', 'slide:gcs-bill'])
    expect(ids('bill coldline')).toEqual([])
  })

  test('matches report each matched field, best first', () => {
    expect(fieldMatches(searchActions('credits', SLIDE_REGISTRY))).toEqual([
      {
        id: 'control:net-of-credits',
        matches: [
          { field: 'label', text: '3. GCS bill: net of credits', ranges: [[20, 27]] },
          { field: 'id', text: 'control:net-of-credits', ranges: [[15, 22]] },
        ],
      },
      { id: 'slide:gcs-bill', matches: [{ field: 'searchText', text: BILL, ranges: [[CREDITS, CREDITS + 7]] }] },
    ])
    const [bill] = searchActions('gcs', { 'slide:gcs-bill': SLIDE_REGISTRY['slide:gcs-bill'] })
    expect(fieldMatches([bill])).toEqual([{
      id: 'slide:gcs-bill',
      matches: [
        { field: 'label', text: '3. GCS bill', ranges: [[3, 6]] },
        { field: 'searchText', text: BILL, ranges: [[12, 15]] },
        { field: 'id', text: 'slide:gcs-bill', ranges: [[6, 9]] },
      ],
    }])
  })

  test('keyword and description matches carry their text', () => {
    const registry: ActionRegistry = {
      kw: { label: 'Zoom', keywords: ['magnify', 'enlarge'] },
      desc: { label: 'Pan', description: 'Move the view to enlarge context' },
    }
    expect(fieldMatches(searchActions('enlarge', registry))).toEqual([
      { id: 'kw', matches: [{ field: 'keyword', text: 'enlarge', ranges: [[0, 7]] }] },
      { id: 'desc', matches: [{ field: 'description', text: 'Move the view to enlarge context', ranges: [[17, 24]] }] },
    ])
  })

  test('priority ranks equal matches', () => {
    expect(ids('same', { a: { label: 'Same' }, b: { label: 'Same' } })).toEqual(['a', 'b'])
    expect(ids('same', { a: { label: 'Same' }, b: { label: 'Same', priority: 1 } })).toEqual(['b', 'a'])
    expect(ids('same', { a: { label: 'Same', priority: -1 }, b: { label: 'Same' } })).toEqual(['b', 'a'])
  })
})

test.describe('snippet', () => {
  test('windows around the best range, at word boundaries, re-basing ranges', () => {
    expect(snippet(BILL, [[CREDITS, CREDITS + 7]])).toEqual({
      text: '…to $58k gross, but the bill net of credits was $41k after the committed-use…',
      ranges: [[36, 43]],
    })
    expect(snippet(BILL, [[12, 15], [CREDITS, CREDITS + 7]], { radius: 20 })).toEqual({
      text: '…the bill net of credits was $41k after the…',
      ranges: [[17, 24]],
    })
    expect(snippet(BILL, [[CREDITS, CREDITS + 7]], { radius: 20, ellipsis: '...' })).toEqual({
      text: '...the bill net of credits was $41k after the...',
      ranges: [[19, 26]],
    })
  })

  test('short text is returned whole', () => {
    expect(snippet('net of credits', [[7, 14]])).toEqual({ text: 'net of credits', ranges: [[7, 14]] })
  })
})

const openSearch = async (page: Page, path: string, query: string) => {
  await page.addInitScript(() => localStorage.clear())
  await page.goto(path)
  await page.getByRole('button', { name: 'Search slides' }).click()
  await page.locator('.kbd-omnibar-input').fill(query)
}

for (const path of ['/slide-search', '/slide-search?renderer=cmdk']) {
  test.describe(`Omnibar match context rows (${path})`, () => {
    test('highlights label matches and shows a snippet for body matches', async ({ page }) => {
      await openSearch(page, path, 'credits')
      const rows = page.locator('.kbd-omnibar-result')
      await expect(rows.locator('.kbd-omnibar-result-label')).toHaveText(['3. GCS bill: net of credits', '3. GCS bill'])
      await expect(rows.nth(0).locator('.kbd-omnibar-result-label mark')).toHaveText(['credits'])
      await expect(rows.nth(0).locator('.kbd-omnibar-result-snippet')).toHaveCount(0)
      await expect(rows.nth(1).locator('.kbd-omnibar-result-label mark')).toHaveCount(0)
      await expect(rows.nth(1).locator('.kbd-omnibar-result-snippet')).toHaveText('…to $58k gross, but the bill net of credits was $41k after the committed-use…')
      await expect(rows.nth(1).locator('.kbd-omnibar-result-snippet mark')).toHaveText(['credits'])
    })

    test('executing a body-matched slide jumps to it', async ({ page }) => {
      await openSearch(page, path, 'coldline')
      await expect(page.locator('.kbd-omnibar-result .kbd-omnibar-result-label')).toHaveText(['4. Lifecycle rules'])
      await page.keyboard.press('Enter')
      await expect(page.getByTestId('slide').locator('h2')).toHaveText('4. Lifecycle rules')
    })
  })
}

test.describe('Omnibar renderResult', () => {
  test('replaces row content, keeping the default chrome and keyboard handling', async ({ page }) => {
    await openSearch(page, '/slide-search?renderer=custom', 'credits')
    const rows = page.getByTestId('custom-row')
    await expect(rows).toHaveText(['3. GCS bill: net of credits (label)', '3. GCS bill (searchText)'])
    await expect(rows.nth(0)).toHaveAttribute('data-selected', 'true')
    await expect(rows.nth(1)).toHaveAttribute('data-selected', 'false')
    await expect(page.locator('.kbd-omnibar-result-snippet')).toHaveCount(0)
    await page.keyboard.press('ArrowDown')
    await expect(rows.nth(1)).toHaveAttribute('data-selected', 'true')
    await page.keyboard.press('ArrowUp')
    await page.keyboard.press('Enter')
    await expect(page.getByTestId('bill-mode')).toHaveText('net of credits')
  })
})
