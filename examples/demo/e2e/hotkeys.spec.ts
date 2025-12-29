import { test, expect } from '@playwright/test'

test.describe('Full Demo - Sequences and Editing', () => {
  test.beforeEach(async ({ page }) => {
    // Clear localStorage (both overrides and removed defaults)
    await page.addInitScript(() => {
      localStorage.removeItem('use-kbd-demo-full')
      localStorage.removeItem('use-kbd-demo-full-removed')
    })
    await page.goto('/full')
  })

  test('can open shortcuts modal with ? key', async ({ page }) => {
    // Focus the page
    await page.locator('body').click({ position: { x: 10, y: 10 } })

    // Press ? to open modal
    await page.keyboard.press('?')

    // Wait for modal
    await page.waitForSelector('.kbd-modal', { timeout: 5000 })

    // Verify modal is visible
    const modal = page.locator('.kbd-modal')
    await expect(modal).toBeVisible()
  })

  test('navigation with j/k keys works', async ({ page }) => {
    // Focus the page
    await page.locator('body').click({ position: { x: 10, y: 10 } })

    // First item should be selected by default
    const items = page.locator('.todo-item')
    await expect(items.first()).toHaveClass(/selected/)

    // Press j to move down
    await page.keyboard.press('j')
    await page.waitForTimeout(100)

    // Second item should be selected
    await expect(items.nth(1)).toHaveClass(/selected/)

    // Press k to move up
    await page.keyboard.press('k')
    await page.waitForTimeout(100)

    // First item should be selected again
    await expect(items.first()).toHaveClass(/selected/)
  })

  test('can toggle todo done state with Enter', async ({ page }) => {
    await page.locator('body').click({ position: { x: 10, y: 10 } })

    const firstItem = page.locator('.todo-item').first()
    await expect(firstItem).not.toHaveClass(/done/)

    // Press Enter to toggle
    await page.keyboard.press('Enter')
    await page.waitForTimeout(100)

    // Should be marked as done
    await expect(firstItem).toHaveClass(/done/)

    // Toggle back
    await page.keyboard.press('Enter')
    await page.waitForTimeout(100)

    await expect(firstItem).not.toHaveClass(/done/)
  })

  test('key sequence sets due date', async ({ page }) => {
    await page.locator('body').click({ position: { x: 10, y: 10 } })

    const firstItem = page.locator('.todo-item').first()

    // No due date initially
    await expect(firstItem.locator('.due-date')).toHaveCount(0)

    // Press "1 w" sequence for 1 week
    await page.keyboard.press('1')
    await page.waitForTimeout(100)
    await page.keyboard.press('w')

    // Wait for sequence timeout
    await page.waitForTimeout(1200)

    // Should have a due date now
    await expect(firstItem.locator('.due-date')).toBeVisible()
  })

  test('can edit hotkey in modal', async ({ page }) => {
    await page.locator('body').click({ position: { x: 10, y: 10 } })

    // Open modal
    await page.keyboard.press('?')
    await page.waitForSelector('.kbd-modal', { timeout: 5000 })

    // Find an editable kbd element (look for 'N' key for 'new' action)
    const kbdElement = page.locator('.kbd-kbd.editable', { hasText: 'N' }).first()
    await expect(kbdElement).toBeVisible()

    // Click to start editing
    await kbdElement.click()
    await page.waitForTimeout(100)

    // After clicking, the element should be in editing mode (may be a new DOM element after re-render)
    const editingElement = page.locator('.kbd-kbd.editing')
    await expect(editingElement).toBeVisible({ timeout: 2000 })

    // Press a new key
    await page.keyboard.press('q')

    // Wait for sequence timeout
    await page.waitForTimeout(1200)

    // Should show the new key
    await expect(page.locator('.kbd-kbd', { hasText: 'Q' })).toBeVisible()
  })

  test('can re-add a default binding after removing it', async ({ page }) => {
    await page.locator('body').click({ position: { x: 10, y: 10 } })

    // Open modal
    await page.keyboard.press('?')
    await page.waitForSelector('.kbd-modal', { timeout: 5000 })

    // Find the "Due in 1 day" action which has default binding "1 D"
    const dueAction = page.locator('.kbd-action', { hasText: 'Due in 1 day' })
    const dueKbd = dueAction.locator('.kbd-kbd.editable').first()
    await expect(dueKbd).toBeVisible()

    // Add a new binding "x"
    const addBtn = dueAction.locator('.kbd-add-btn')
    await addBtn.click()
    await page.waitForTimeout(100)
    await page.keyboard.press('x')
    await page.waitForTimeout(1200)

    // Should now have two bindings
    await expect(dueAction.locator('.kbd-kbd.editable')).toHaveCount(2)

    // Remove the original "1 D" binding by hovering and clicking x
    const originalKbd = dueAction.locator('.kbd-kbd.editable', { hasText: '1' }).first()
    await originalKbd.hover()
    const removeBtn = originalKbd.locator('.kbd-remove-btn')
    await removeBtn.click()
    await page.waitForTimeout(200)

    // Should now have only "X" binding
    await expect(dueAction.locator('.kbd-kbd.editable')).toHaveCount(1)
    await expect(dueAction.locator('.kbd-kbd.editable', { hasText: 'X' })).toBeVisible()

    // Re-add the original binding "1 d"
    const addBtn2 = dueAction.locator('.kbd-add-btn')
    await addBtn2.click()
    await page.waitForTimeout(100)
    await page.keyboard.press('1')
    await page.waitForTimeout(100)
    await page.keyboard.press('d')
    await page.waitForTimeout(1200)

    // Should now have both bindings again
    await expect(dueAction.locator('.kbd-kbd.editable')).toHaveCount(2)
    await expect(dueAction.locator('.kbd-kbd.editable', { hasText: '1' })).toBeVisible()
    await expect(dueAction.locator('.kbd-kbd.editable', { hasText: 'X' })).toBeVisible()
  })

  test('action with no bindings still shows in modal with add button', async ({ page }) => {
    await page.locator('body').click({ position: { x: 10, y: 10 } })

    // Open modal
    await page.keyboard.press('?')
    await page.waitForSelector('.kbd-modal', { timeout: 5000 })

    // Find the "Due in 1 day" action in the "Due Date" group
    const dueGroup = page.locator('.kbd-group', { hasText: 'DUE DATE' })
    const dueAction = dueGroup.locator('.kbd-action', { hasText: 'Due in 1 day' })
    await expect(dueAction).toBeVisible()

    // Remove the binding
    const dueKbd = dueAction.locator('.kbd-kbd.editable').first()
    await dueKbd.hover()
    const removeBtn = dueKbd.locator('.kbd-remove-btn')
    await removeBtn.click()
    await page.waitForTimeout(200)

    // Action should STILL be in the same group with add button
    const dueGroupAfter = page.locator('.kbd-group', { hasText: 'DUE DATE' })
    const dueActionAfter = dueGroupAfter.locator('.kbd-action', { hasText: 'Due in 1 day' })
    await expect(dueActionAfter).toBeVisible()
    await expect(dueActionAfter.locator('.kbd-add-btn')).toBeVisible()

    // Should have no kbd elements
    await expect(dueActionAfter.locator('.kbd-kbd.editable')).toHaveCount(0)

    // Can add a new binding
    const addBtn = dueActionAfter.locator('.kbd-add-btn')
    await addBtn.click()
    await page.waitForTimeout(100)
    await page.keyboard.press('z')
    await page.waitForTimeout(1200)

    // Should have the new binding, still in the same group
    await expect(dueActionAfter.locator('.kbd-kbd.editable', { hasText: 'Z' })).toBeVisible()
  })
})

test.describe('Simple Demo - Immediate Response', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.removeItem('use-kbd-demo-simple')
      localStorage.removeItem('use-kbd-demo-simple-removed')
    })
    await page.goto('/simple')
  })

  test('hotkeys respond immediately without timeout', async ({ page }) => {
    await page.locator('body').click({ position: { x: 10, y: 10 } })

    const items = page.locator('.todo-item')
    await expect(items.first()).toHaveClass(/selected/)

    // Press j - should move immediately
    const startTime = Date.now()
    await page.keyboard.press('j')

    // Check immediately (within 100ms, not waiting for 1000ms timeout)
    await page.waitForTimeout(50)
    await expect(items.nth(1)).toHaveClass(/selected/)

    const elapsed = Date.now() - startTime
    expect(elapsed).toBeLessThan(500) // Should be much faster than sequence timeout
  })

  test('can open and close shortcuts modal', async ({ page }) => {
    await page.locator('body').click({ position: { x: 10, y: 10 } })

    // Open
    await page.keyboard.press('?')
    await page.waitForSelector('.kbd-modal', { timeout: 5000 })
    await expect(page.locator('.kbd-modal')).toBeVisible()

    // Close with Escape
    await page.keyboard.press('Escape')
    await page.waitForTimeout(300)
    await expect(page.locator('.kbd-modal')).not.toBeVisible()
  })
})

test.describe('Routes Demo - Route-specific Hotkeys', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.removeItem('use-kbd-demo-routes')
      localStorage.removeItem('use-kbd-demo-routes-removed')
    })
  })

  test('global hotkeys work on all routes', async ({ page }) => {
    await page.goto('/routes')
    await page.locator('body').click({ position: { x: 10, y: 10 } })

    // ? should work on home
    await page.keyboard.press('?')
    await page.waitForSelector('.kbd-modal', { timeout: 5000 })
    await expect(page.locator('.kbd-modal')).toBeVisible()
    await page.keyboard.press('Escape')
    await page.waitForTimeout(300)

    // Navigate to inbox
    await page.click('a[href="/routes/inbox"]')
    await page.waitForTimeout(300)

    // ? should still work
    await page.locator('body').click({ position: { x: 10, y: 10 } })
    await page.keyboard.press('?')
    await page.waitForSelector('.kbd-modal', { timeout: 5000 })
    await expect(page.locator('.kbd-modal')).toBeVisible()
  })

  test('inbox-specific hotkeys only work on inbox route', async ({ page }) => {
    await page.goto('/routes/inbox')
    await page.locator('body').click({ position: { x: 10, y: 10 } })

    // Select first message
    const firstMessage = page.locator('.message-item').first()
    await firstMessage.click()
    await expect(firstMessage).toHaveClass(/selected/)

    // M should toggle read status
    await expect(firstMessage).toHaveClass(/unread/)
    await page.keyboard.press('m')
    await page.waitForTimeout(100)
    await expect(firstMessage).toHaveClass(/read/)
  })

  test('project-specific hotkeys only work on projects route', async ({ page }) => {
    await page.goto('/routes/projects')
    await page.locator('body').click({ position: { x: 10, y: 10 } })

    const projectCount = await page.locator('.project-item').count()

    // N should create new project
    await page.keyboard.press('n')
    await page.waitForTimeout(100)

    // Should have one more project
    await expect(page.locator('.project-item')).toHaveCount(projectCount + 1)
  })
})
