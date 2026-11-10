import { test, expect } from '@playwright/test'

const mac = process.platform === 'darwin'
const modifier = mac ? 'Meta' : 'Control'
const gestures = [
  { name: 'modifier+Enter', key: `${modifier}+Enter`, foreground: false, newWindow: false },
  { name: 'modifier+Shift+Enter', key: `${modifier}+Shift+Enter`, foreground: true, newWindow: false },
  { name: 'Shift+Enter', key: 'Shift+Enter', foreground: true, newWindow: true },
  { name: 'modifier-click', modifiers: [modifier], foreground: false, newWindow: false },
  { name: 'modifier+Shift-click', modifiers: [modifier, 'Shift'], foreground: true, newWindow: false },
  { name: 'Shift-click', modifiers: ['Shift'], foreground: true, newWindow: true },
  { name: 'middle-click', modifiers: [], middle: true, foreground: false, newWindow: false },
  { name: 'Shift+middle-click', modifiers: ['Shift'], middle: true, foreground: true, newWindow: false },
] as const

for (const renderer of ['default', 'cmdk']) {
  test.describe(`Omnibar navigation dispositions (${renderer})`, () => {
    test.beforeEach(async ({ page }) => {
      await page.addInitScript(platform => {
        Object.defineProperty(navigator, 'userAgentData', { value: { platform }, configurable: true })
        localStorage.clear()
      }, mac ? 'macOS' : 'Linux')
      await page.goto(`/omnibar-links?renderer=${renderer}`)
      await page.getByRole('button', { name: 'Open palette' }).click()
    })

    for (const gesture of gestures) {
      test(`${gesture.name} opens the intended tab or window`, async ({ page, context, headless }) => {
        await page.locator('.kbd-omnibar-input').fill('Link with handler')
        const sourceSession = await context.newCDPSession(page)
        // Playwright otherwise reports every tab as visible/focused. Actual
        // focus and window identity are checked when this suite runs --headed.
        if (!headless) await sourceSession.send('Emulation.setFocusEmulationEnabled', { enabled: false })
        await page.bringToFront()
        const sourceWindow = await sourceSession.send('Browser.getWindowForTarget')
        const destinationPromise = context.waitForEvent('page', { timeout: 5000 })
        const [destination] = await Promise.all([
          destinationPromise,
          'key' in gesture
            ? page.keyboard.press(gesture.key)
            : page.locator('a.kbd-omnibar-result').filter({ has: page.locator('.kbd-omnibar-result-label', { hasText: /^Link with handler$/ }) }).click({
              button: 'middle' in gesture ? 'middle' : 'left',
              modifiers: [...gesture.modifiers],
            }),
        ])
        await expect(destination).toHaveURL('/omnibar-links?destination=initial')
        await expect(page).toHaveURL(`/omnibar-links?renderer=${renderer}`)
        await expect(page.getByTestId('link-events')).toHaveText('[]')
        await expect(page.locator('.kbd-omnibar')).toHaveCount(0)
        expect(await destination.evaluate(() => window.opener)).toBeNull()
        expect(context.pages()).toEqual([page, destination])
        if (!headless) {
          const destinationSession = await context.newCDPSession(destination)
          await destinationSession.send('Emulation.setFocusEmulationEnabled', { enabled: false })
          const destinationWindow = await destinationSession.send('Browser.getWindowForTarget')
          expect(destinationWindow.windowId !== sourceWindow.windowId).toBe(gesture.newWindow)
          await expect.poll(() => destination.evaluate(() => document.hasFocus())).toBe(gesture.foreground)
        }
        await destination.close()
      })
    }

    for (const key of [`${modifier}+Shift+Enter`, 'Shift+Enter']) {
      test(`remote link supports ${key}`, async ({ page, context }) => {
        await page.locator('.kbd-omnibar-input').fill('Remote link')
        await expect(page.locator('.kbd-omnibar-result')).toHaveText(['Remote link'])
        const [destination] = await Promise.all([
          context.waitForEvent('page', { timeout: 5000 }),
          page.keyboard.press(key),
        ])
        await expect(destination).toHaveURL('/omnibar-links?remote=1')
        await expect(page).toHaveURL(`/omnibar-links?renderer=${renderer}`)
        await expect(page.locator('.kbd-omnibar')).toHaveCount(0)
        expect(await destination.evaluate(() => window.opener)).toBeNull()
        await destination.close()
      })
    }

    test('Shift+Enter on a URL-free action still forwards the event', async ({ page }) => {
      await page.locator('.kbd-omnibar-input').fill('Event without URL')
      await page.keyboard.press('Shift+Enter')
      await expect(page.getByTestId('link-events')).toHaveText('[{"key":"Enter","metaKey":false,"ctrlKey":false,"shiftKey":true}]')
      expect(page.context().pages()).toEqual([page])
    })
  })
}

test.describe('Headless navigation dispositions', () => {
  for (const modifiers of [[modifier, 'Shift'], ['Shift']] as const) {
    test(`explicit execute supports ${modifiers.join('+')}-click`, async ({ page, context }) => {
      await page.addInitScript(platform => {
        Object.defineProperty(navigator, 'userAgentData', { value: { platform }, configurable: true })
      }, mac ? 'macOS' : 'Linux')
      await page.goto('/omnibar-links?renderer=headless')
      const [destination] = await Promise.all([
        context.waitForEvent('page', { timeout: 5000 }),
        page.getByRole('button', { name: 'Run headless link' }).click({ modifiers: [...modifiers] }),
      ])
      await expect(destination).toHaveURL('/omnibar-links?headless=1')
      await expect(page).toHaveURL('/omnibar-links?renderer=headless')
      expect(await destination.evaluate(() => window.opener)).toBeNull()
      await destination.close()
    })
  }
})
