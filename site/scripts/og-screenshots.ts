#!/usr/bin/env -S npx tsx
/**
 * Take screenshots for the og:image mosaic.
 * Requires dev server running on port 5174.
 *
 * Showcases use-kbd library components:
 *   og-omnibar.png — command palette with search results
 *   og-modal.png   — keyboard shortcuts modal
 *
 * Composited into 1200x630 mosaic by scripts/compose-og.sh
 */
import { chromium } from '@playwright/test'

const BASE = 'http://localhost:5174'

type Page = Awaited<ReturnType<Awaited<ReturnType<typeof chromium.launch>>['newPage']>>

async function scrollTo(page: Page, selector: string, offset = 16) {
  await page.evaluate(({ selector, offset }) => {
    const el = document.querySelector(selector)
    if (el) window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - offset)
  }, { selector, offset })
}

async function main() {
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext()

  await context.addInitScript(() => {
    localStorage.clear()
  })

  // 1. Omnibar with search results (left panel, ~60%)
  // 718 + 4gap + 478 = 1200
  {
    const page = await context.newPage()
    await page.setViewportSize({ width: 718, height: 630 })
    await page.goto(`${BASE}/table?theme=dark`, { waitUntil: 'networkidle' })
    await scrollTo(page, '#demo')
    await page.waitForTimeout(300)

    // Open omnibar with Cmd+K
    await page.keyboard.press('Meta+k')
    await page.waitForSelector('.kbd-omnibar', { timeout: 5000 })
    await page.waitForTimeout(300)

    await page.screenshot({ path: 'public/screenshots/og-omnibar.png' })
    console.log('Saved: og-omnibar.png')
    await page.close()
  }

  // 2. Shortcuts modal (right panel, ~40%)
  {
    const page = await context.newPage()
    await page.setViewportSize({ width: 478, height: 630 })
    await page.goto(`${BASE}/table?theme=dark`, { waitUntil: 'networkidle' })
    await scrollTo(page, '#demo')
    await page.waitForTimeout(300)

    await page.keyboard.press('?')
    await page.waitForSelector('.kbd-modal', { timeout: 5000 })
    await page.waitForTimeout(300)

    await page.screenshot({ path: 'public/screenshots/og-modal.png' })
    console.log('Saved: og-modal.png')
    await page.close()
  }

  await browser.close()
}

main()
