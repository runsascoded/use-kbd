import { test, expect } from '@playwright/test'

const nativeModifier = process.platform === 'darwin' ? 'Meta' : 'Control'
const macHint = 'Command+Enter: open in a new tab; Command+Shift+Enter: open and switch to a new tab; Shift+Enter: open in a new window'

/** Inspect synthetic navigation requests; separate integration cases open real tabs/windows. */
function trackNavigationRequests() {
  const opened: string[][] = []
  Object.assign(window, { __opened: opened })
  document.addEventListener('click', event => {
    const link = event.target
    if (link instanceof HTMLAnchorElement && link.target === '_blank') {
      opened.push([link.getAttribute('href') ?? '', link.target, link.rel])
      event.preventDefault()
    }
  }, true)
}

for (const path of ['/table', '/omnibar-links?renderer=cmdk']) {
  test.describe(`Demo navigation links (${path})`, () => {
    test.beforeEach(async ({ page }) => {
      await page.addInitScript(() => {
        Object.defineProperty(navigator, 'userAgentData', { value: { platform: 'macOS' }, configurable: true })
        localStorage.clear()
      })
      await page.goto(path)
      await page.locator('.kbd-speed-dial-primary').click()
      await page.locator('.kbd-omnibar-input').fill('Canvas')
    })

    test('Command+Enter opens the navigation URL in an actual new tab', async ({ page }) => {
      await expect(page.locator('.kbd-omnibar-result')).toHaveAttribute('href', '/canvas')
      await expect(page.locator('.kbd-omnibar-new-tab-hint')).toHaveAttribute('aria-label', macHint)
      const [popup] = await Promise.all([
        page.context().waitForEvent('page', { timeout: 5000 }),
        page.keyboard.press('Meta+Enter'),
      ])
      await expect(popup).toHaveURL('/canvas')
      expect(await popup.evaluate(() => window.opener)).toBeNull()
      await expect(page).toHaveURL(path)
      await expect(page.locator('.kbd-omnibar')).toHaveCount(0)
      await popup.close()
    })

    test('plain Enter keeps client-side navigation in the current tab', async ({ page }) => {
      await page.evaluate(() => Object.assign(window, { __navigationProbe: 'same document' }))
      await page.keyboard.press('Enter')
      await expect(page).toHaveURL('/canvas')
      expect(await page.evaluate(() => Reflect.get(window, '__navigationProbe'))).toBe('same document')
      expect(page.context().pages()).toEqual([page])
    })
  })
}

for (const renderer of ['default', 'cmdk']) {
  test.describe(`Omnibar links (${renderer})`, () => {
    test.beforeEach(async ({ page }) => {
      await page.addInitScript(trackNavigationRequests)
      await page.addInitScript(() => {
        Object.defineProperty(navigator, 'userAgentData', { value: { platform: 'macOS' }, configurable: true })
        localStorage.clear()
      })
      await page.goto(`/omnibar-links?renderer=${renderer}`)
      await page.getByRole('button', { name: 'Open palette' }).click()
      await expect(page.locator('.kbd-omnibar-input')).toBeVisible()
    })

    test('link rows use neutral text and a configurable subtle indicator', async ({ page }) => {
      const row = (label: string) => page.locator('.kbd-omnibar-result').filter({
        has: page.locator('.kbd-omnibar-result-label', { hasText: new RegExp(`^${label}$`) }),
      })
      const link = row('Link with handler')
      const command = row('Event without URL')
      const textColor = await command.evaluate(el => getComputedStyle(el).color)
      const indicator = link.locator('.kbd-omnibar-link-indicator')

      await expect(link).toHaveCSS('color', textColor)
      await expect(link).toHaveCSS('text-decoration-line', 'none')
      await expect(indicator).toBeVisible()
      await expect(indicator).toHaveAttribute('aria-hidden', 'true')
      await expect(command.locator('.kbd-omnibar-link-indicator')).toHaveCount(0)
      await link.hover()
      await expect(link).toHaveCSS('color', textColor)
      await expect(link).toHaveCSS('text-decoration-line', 'none')
      const secondaryColor = await page.locator('.kbd-omnibar-new-tab-hint').evaluate(el => getComputedStyle(el).color)
      await expect(indicator).toHaveCSS('color', secondaryColor)

      await page.addStyleTag({ content: '.kbd-omnibar { --kbd-omnibar-link-color: rgb(123, 45, 67); --kbd-omnibar-link-indicator-color: rgb(76, 54, 32); }' })
      await expect(link).toHaveCSS('color', 'rgb(123, 45, 67)')
      await expect(indicator).toHaveCSS('color', 'rgb(76, 54, 32)')
      await expect(command).toHaveCSS('color', textColor)
      await page.addStyleTag({ content: '.kbd-omnibar-link-indicator { display: none; }' })
      await expect(indicator).not.toBeVisible()
      await expect(link).toHaveAttribute('href', '/omnibar-links?destination=initial')
    })

    test('Enter runs the handler and forwards the actual keyboard event', async ({ page }) => {
      await page.locator('.kbd-omnibar-input').fill('Link with handler')
      await page.keyboard.press('Enter')
      await expect(page.getByTestId('link-events')).toHaveText('[{"key":"Enter","metaKey":false,"ctrlKey":false,"shiftKey":false}]')
      expect(await page.evaluate(() => Reflect.get(window, '__opened'))).toEqual([])
      await expect(page.locator('.kbd-omnibar')).toHaveCount(0)
    })

    test('Meta+Enter opens the lazy URL at execution time without running its handler', async ({ page }) => {
      await page.locator('.kbd-omnibar-input').fill('Link with handler')
      await page.evaluate(() => { location.hash = 'updated' })
      await page.keyboard.press('Meta+Enter')
      expect(await page.evaluate(() => Reflect.get(window, '__opened'))).toEqual([
        ['/omnibar-links?destination=updated', '_blank', 'noopener'],
      ])
      await expect(page.getByTestId('link-events')).toHaveText('[]')
      await expect(page.locator('.kbd-omnibar')).toHaveCount(0)
    })

    test('Ctrl+Enter opens a new tab off macOS', async ({ page }) => {
      await page.evaluate(() => Object.defineProperty(navigator, 'userAgentData', { value: { platform: 'Linux' }, configurable: true }))
      await page.locator('.kbd-omnibar-input').fill('Link with handler')
      await page.keyboard.press('Control+Enter')
      expect(await page.evaluate(() => Reflect.get(window, '__opened'))).toEqual([
        ['/omnibar-links?destination=initial', '_blank', 'noopener'],
      ])
      await expect(page.getByTestId('link-events')).toHaveText('[]')
    })

    test('a URL-free handler receives modifiers instead of opening a tab', async ({ page }) => {
      await page.locator('.kbd-omnibar-input').fill('Event without URL')
      await page.keyboard.press('Meta+Enter')
      await expect(page.getByTestId('link-events')).toHaveText('[{"key":"Enter","metaKey":true,"ctrlKey":false,"shiftKey":false}]')
      expect(await page.evaluate(() => Reflect.get(window, '__opened'))).toEqual([])
    })

    test('Enter on an empty result list does not execute a stale selection', async ({ page }) => {
      await page.locator('.kbd-omnibar-input').fill('Link with handler')
      await expect(page.locator('.kbd-omnibar-new-tab-hint')).toBeVisible()
      await page.locator('.kbd-omnibar-input').fill('zzzzzzzzzz')
      await expect(page.locator('.kbd-omnibar-result')).toHaveCount(0)
      await page.keyboard.press('Meta+Enter')
      expect(await page.evaluate(() => Reflect.get(window, '__opened'))).toEqual([])
      await expect(page.getByTestId('link-events')).toHaveText('[]')
      await expect(page.locator('.kbd-omnibar')).toHaveCount(1)
    })

    test('parameter entry retains the initiating event modifiers', async ({ page }) => {
      await page.locator('.kbd-omnibar-input').fill('Parameter event')
      await page.keyboard.press('Meta+Enter')
      await page.locator('.kbd-omnibar-param-input').fill('42')
      await page.keyboard.press('Enter')
      await expect(page.getByTestId('link-events')).toHaveText('[{"key":"Enter","metaKey":true,"ctrlKey":false,"shiftKey":false}]')
      await expect(page.locator('.kbd-omnibar')).toHaveCount(0)
    })

    test('useAction resolves a fresh URL closure after a render', async ({ page }) => {
      await page.keyboard.press('Escape')
      await page.getByRole('button', { name: 'Update destination' }).click()
      await page.getByRole('button', { name: 'Open palette' }).click()
      await page.locator('.kbd-omnibar-input').fill('Stateful link')
      await page.keyboard.press('Meta+Enter')
      expect(await page.evaluate(() => Reflect.get(window, '__opened'))).toEqual([
        ['/omnibar-links?state=updated', '_blank', 'noopener'],
      ])
      await expect(page.getByTestId('link-events')).toHaveText('[]')
    })

    test('Enter follows a handler-free URL', async ({ page }) => {
      await page.locator('.kbd-omnibar-input').fill('Link without handler')
      await page.keyboard.press('Enter')
      await expect(page).toHaveURL('/omnibar-links?arrived=1')
    })

    test('a handler-free URL can open in a new tab', async ({ page }) => {
      await page.locator('.kbd-omnibar-input').fill('Link without handler')
      await page.keyboard.press('Meta+Enter')
      expect(await page.evaluate(() => Reflect.get(window, '__opened'))).toEqual([
        ['/omnibar-links?arrived=1', '_blank', 'noopener'],
      ])
      await expect(page.locator('.kbd-omnibar')).toHaveCount(0)
    })

    test('remote links open in a new tab', async ({ page }) => {
      await page.locator('.kbd-omnibar-input').fill('Remote link')
      await expect(page.locator('.kbd-omnibar-result')).toHaveText(['Remote link'])
      await page.keyboard.press('Meta+Enter')
      expect(await page.evaluate(() => Reflect.get(window, '__opened'))).toEqual([
        ['/omnibar-links?remote=1', '_blank', 'noopener'],
      ])
      await expect(page.locator('.kbd-omnibar')).toHaveCount(0)
    })

    test('Enter follows a remote link in the current tab', async ({ page }) => {
      await page.locator('.kbd-omnibar-input').fill('Remote link')
      await expect(page.locator('.kbd-omnibar-result')).toHaveText(['Remote link'])
      await page.keyboard.press('Enter')
      await expect(page).toHaveURL('/omnibar-links?remote=1')
    })

    test('a modified remote click opens exactly one tab', async ({ page }) => {
      await page.locator('.kbd-omnibar-input').fill('Remote link')
      const [destination] = await Promise.all([
        page.context().waitForEvent('page'),
        page.locator('a.kbd-omnibar-result').click({ modifiers: [nativeModifier] }),
      ])
      await expect(destination).toHaveURL('/omnibar-links?remote=1')
      expect(page.context().pages()).toEqual([page, destination])
      expect(await destination.evaluate(() => window.opener)).toBeNull()
      expect(await page.evaluate(() => Reflect.get(window, '__opened'))).toEqual([])
      await expect(page.locator('.kbd-omnibar')).toHaveCount(0)
      await destination.close()
    })

    test('the new-tab hint follows the selected row and platform', async ({ page }) => {
      await page.locator('.kbd-omnibar-input').fill('Link with handler')
      await expect(page.locator('.kbd-omnibar-navigation-hint')).toHaveText(['↵ new tab', '↵ switch', '↵ new window'])
      await expect(page.locator('.kbd-omnibar-new-tab-hint')).toHaveAttribute('aria-label', macHint)
      await page.locator('.kbd-omnibar-input').fill('Event without URL')
      await expect(page.locator('.kbd-omnibar-new-tab-hint')).toHaveCount(0)
      await page.evaluate(() => Object.defineProperty(navigator, 'userAgentData', { value: { platform: 'Linux' }, configurable: true }))
      await page.locator('.kbd-omnibar-input').fill('Remote link')
      await expect(page.locator('.kbd-omnibar-navigation-hint')).toHaveText(['Ctrl↵ new tab', 'Ctrl↵ switch', '↵ new window'])
      await expect(page.locator('.kbd-omnibar-new-tab-hint')).toHaveAttribute('aria-label', 'Ctrl+Enter: open in a new tab; Ctrl+Shift+Enter: open and switch to a new tab; Shift+Enter: open in a new window')
    })

    for (const gesture of ['click', 'modifier-click', 'middle-click']) {
      test(`${gesture} on a link has the expected execution semantics`, async ({ page }) => {
        await page.locator('.kbd-omnibar-input').fill('Link with handler')
        const row = page.locator('a.kbd-omnibar-result').filter({ has: page.locator('.kbd-omnibar-result-label', { hasText: /^Link with handler$/ }) })
        await expect(row).toHaveAttribute('href', '/omnibar-links?destination=initial')
        if (gesture === 'click') {
          await row.click()
        } else {
          await page.evaluate(() => { location.hash = 'updated' })
          const [destination] = await Promise.all([
            page.context().waitForEvent('page'),
            row.click({
              button: gesture === 'middle-click' ? 'middle' : 'left',
              modifiers: gesture === 'modifier-click' ? [nativeModifier] : [],
            }),
          ])
          await expect(destination).toHaveURL('/omnibar-links?destination=updated')
          expect(page.context().pages()).toEqual([page, destination])
          expect(await destination.evaluate(() => window.opener)).toBeNull()
          await destination.close()
        }
        expect(await page.evaluate(() => Reflect.get(window, '__opened'))).toEqual([])
        await expect(page.getByTestId('link-events')).toHaveText(gesture === 'click'
          ? '[{"key":"Enter","metaKey":false,"ctrlKey":false,"shiftKey":false}]'
          : '[]')
        await expect(page.locator('.kbd-omnibar')).toHaveCount(0)
      })
    }

    test('clicking a URL-free row forwards click modifiers', async ({ page }) => {
      await page.locator('.kbd-omnibar-input').fill('Event without URL')
      await page.locator('.kbd-omnibar-result').click({ modifiers: ['Meta', 'Shift'] })
      await expect(page.getByTestId('link-events')).toHaveText('[{"key":"Enter","metaKey":true,"ctrlKey":false,"shiftKey":true}]')
    })

    test('direct hotkeys still run the handler', async ({ page }) => {
      await page.keyboard.press('Escape')
      await page.locator('h1').click()
      await page.keyboard.press('h')
      await expect(page.getByTestId('link-events')).toHaveText('[{"key":"h","metaKey":false,"ctrlKey":false,"shiftKey":false}]')
      expect(await page.evaluate(() => Reflect.get(window, '__opened'))).toEqual([])
    })
  })
}

test.describe('Headless omnibar execution events', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(trackNavigationRequests)
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'userAgentData', { value: { platform: 'macOS' }, configurable: true })
    })
    await page.goto('/omnibar-links?renderer=headless')
  })

  test('explicit execute with a modified click opens a link without callbacks', async ({ page }) => {
    await page.getByRole('button', { name: 'Run headless link' }).click({ modifiers: ['Meta'] })
    expect(await page.evaluate(() => Reflect.get(window, '__opened'))).toEqual([
      ['/omnibar-links?headless=1', '_blank', 'noopener'],
    ])
  })

  test('explicit execute follows a URL with no handler or callbacks', async ({ page }) => {
    await page.getByRole('button', { name: 'Run headless link' }).click()
    await expect(page).toHaveURL('/omnibar-links?headless=1')
  })

  test('a handler-map entry receives click modifiers', async ({ page }) => {
    await page.getByRole('button', { name: 'Run headless event' }).click({ modifiers: ['Meta'] })
    await expect(page.getByTestId('headless-events')).toHaveText('[{"key":"Enter","metaKey":true,"ctrlKey":false,"shiftKey":false}]')
  })

  test('the callback path receives the actual global keydown event', async ({ page }) => {
    await page.goto('/omnibar-links?renderer=headless&callback=1')
    await page.getByRole('button', { name: 'Open headless event' }).click()
    await page.locator('h1').click()
    await expect(page.getByTestId('headless-open')).toHaveText('true')
    await page.keyboard.press('Meta+Enter')
    await expect(page.getByTestId('headless-events')).toHaveText('[{"key":"Enter","metaKey":true,"ctrlKey":false,"shiftKey":false}]')
    await expect(page.getByTestId('headless-open')).toHaveText('false')
  })
})
