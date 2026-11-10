import { test, expect } from '@playwright/test'

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
      await expect(page.locator('.kbd-omnibar-new-tab-hint')).toHaveAttribute('aria-label', 'Command+Enter: open in a new tab')
      const [popup] = await Promise.all([
        page.waitForEvent('popup', { timeout: 5000 }),
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
      await page.addInitScript(() => {
        Object.defineProperty(navigator, 'userAgentData', { value: { platform: 'macOS' }, configurable: true })
        localStorage.clear()
        const opened: unknown[][] = []
        Object.assign(window, { __opened: opened })
        window.open = (...args) => { opened.push(args); return null }
      })
      await page.goto(`/omnibar-links?renderer=${renderer}`)
      await page.getByRole('button', { name: 'Open palette' }).click()
      await expect(page.locator('.kbd-omnibar-input')).toBeVisible()
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
      await page.locator('a.kbd-omnibar-result').click({ modifiers: ['Meta'] })
      expect(await page.evaluate(() => Reflect.get(window, '__opened'))).toEqual([
        ['/omnibar-links?remote=1', '_blank', 'noopener'],
      ])
      await expect(page.locator('.kbd-omnibar')).toHaveCount(0)
    })

    test('the new-tab hint follows the selected row and platform', async ({ page }) => {
      await page.locator('.kbd-omnibar-input').fill('Link with handler')
      await expect(page.locator('.kbd-omnibar-new-tab-hint')).toHaveText('↵ new tab')
      await expect(page.locator('.kbd-omnibar-new-tab-hint')).toHaveAttribute('aria-label', 'Command+Enter: open in a new tab')
      await page.locator('.kbd-omnibar-input').fill('Event without URL')
      await expect(page.locator('.kbd-omnibar-new-tab-hint')).toHaveCount(0)
      await page.evaluate(() => Object.defineProperty(navigator, 'userAgentData', { value: { platform: 'Linux' }, configurable: true }))
      await page.locator('.kbd-omnibar-input').fill('Remote link')
      await expect(page.locator('.kbd-omnibar-new-tab-hint')).toHaveText('Ctrl↵ new tab')
    })

    for (const gesture of ['click', 'meta-click', 'middle-click', 'ctrl-click']) {
      test(`${gesture} on a link has the expected execution semantics`, async ({ page }) => {
        if (gesture === 'ctrl-click') {
          await page.evaluate(() => Object.defineProperty(navigator, 'userAgentData', { value: { platform: 'Linux' }, configurable: true }))
        }
        await page.locator('.kbd-omnibar-input').fill('Link with handler')
        const row = page.locator('a.kbd-omnibar-result').filter({ has: page.locator('.kbd-omnibar-result-label', { hasText: /^Link with handler$/ }) })
        await expect(row).toHaveAttribute('href', '/omnibar-links?destination=initial')
        if (gesture === 'ctrl-click') {
          // macOS turns a physical Ctrl-click into a context-menu gesture even
          // with a mocked Linux navigator, so dispatch the Linux click directly.
          await row.dispatchEvent('click', { button: 0, ctrlKey: true })
        } else {
          await row.click({
            button: gesture === 'middle-click' ? 'middle' : 'left',
            modifiers: gesture === 'meta-click' ? ['Meta'] : [],
          })
        }
        expect(await page.evaluate(() => Reflect.get(window, '__opened'))).toEqual(gesture === 'click' ? [] : [
          ['/omnibar-links?destination=initial', '_blank', 'noopener'],
        ])
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
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'userAgentData', { value: { platform: 'macOS' }, configurable: true })
      const opened: unknown[][] = []
      Object.assign(window, { __opened: opened })
      window.open = (...args) => { opened.push(args); return null }
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
