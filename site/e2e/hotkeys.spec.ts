import { test, expect } from '@playwright/test'

test.describe('Global Features', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.removeItem('use-kbd-demo')
      localStorage.removeItem('use-kbd-demo-removed')
    })
    await page.goto('/')
  })

  test('can open shortcuts modal with ? key', async ({ page }) => {
    await page.locator('body').click({ position: { x: 10, y: 10 } })

    await page.keyboard.press('?')
    await page.waitForSelector('.kbd-modal', { timeout: 5000 })

    const modal = page.locator('.kbd-modal')
    await expect(modal).toBeVisible()
  })

  test('shortcuts work while modal is open (but not editing)', async ({ page }) => {
    await page.locator('body').click({ position: { x: 10, y: 10 } })

    // Open modal
    await page.keyboard.press('?')
    await page.waitForSelector('.kbd-modal', { timeout: 5000 })
    await expect(page.locator('.kbd-modal')).toBeVisible()

    // Navigate to table with g t sequence while modal is open
    await page.keyboard.press('g')
    await page.waitForTimeout(100)
    await page.keyboard.press('t')
    await page.waitForTimeout(500)

    // Should navigate to table (modal stays open)
    await expect(page).toHaveURL('/table')
    await expect(page.locator('.kbd-modal')).toBeVisible()
  })

  test('can open and close omnibar with Cmd+K', async ({ page }) => {
    await page.locator('body').click({ position: { x: 10, y: 10 } })

    // Open omnibar
    await page.keyboard.press('Meta+k')
    await page.waitForSelector('.kbd-omnibar', { timeout: 5000 })
    await expect(page.locator('.kbd-omnibar')).toBeVisible()

    // Close with Escape
    await page.keyboard.press('Escape')
    await page.waitForTimeout(200)
    await expect(page.locator('.kbd-omnibar')).not.toBeVisible()
  })

  test('can open and use LookupModal with Cmd+Shift+K', async ({ page }) => {
    await page.locator('body').click({ position: { x: 10, y: 10 } })

    // Open lookup modal
    await page.keyboard.press('Meta+Shift+k')
    await page.waitForSelector('.kbd-lookup', { timeout: 5000 })
    await expect(page.locator('.kbd-lookup')).toBeVisible()

    // Should show all shortcuts initially
    const results = page.locator('.kbd-lookup-result')
    await expect(results.first()).toBeVisible()

    // Type 'g' to filter to sequence shortcuts
    await page.keyboard.press('g')
    await page.waitForTimeout(100)

    // Should show filtered results (g h, g t, g c, g a sequences)
    await expect(page.locator('.kbd-lookup-search kbd')).toHaveText('G')

    // Arrow down to navigate
    await page.keyboard.press('ArrowDown')
    await page.waitForTimeout(100)

    // Second result should be selected
    await expect(results.nth(1)).toHaveClass(/selected/)

    // Close with Escape
    await page.keyboard.press('Escape')
    await page.waitForTimeout(100)

    // First Escape clears filter, second closes
    await page.keyboard.press('Escape')
    await page.waitForTimeout(200)
    await expect(page.locator('.kbd-lookup')).not.toBeVisible()
  })

  test('LookupModal can execute action with Enter', async ({ page }) => {
    await page.locator('body').click({ position: { x: 10, y: 10 } })

    // Open lookup modal
    await page.keyboard.press('Meta+Shift+k')
    await page.waitForSelector('.kbd-lookup', { timeout: 5000 })

    // Type 'g t' to filter to table navigation
    await page.keyboard.press('g')
    await page.waitForTimeout(100)
    await page.keyboard.press('t')
    await page.waitForTimeout(100)

    // Press Enter to execute
    await page.keyboard.press('Enter')
    await page.waitForTimeout(500)

    // Should navigate to table
    await expect(page).toHaveURL('/table')
    await expect(page.locator('.kbd-lookup')).not.toBeVisible()
  })

  test('can navigate to Table via g t sequence', async ({ page }) => {
    await page.locator('body').click({ position: { x: 10, y: 10 } })

    await page.keyboard.press('g')
    await page.waitForTimeout(100)
    await page.keyboard.press('t')
    await page.waitForTimeout(1200)

    await expect(page).toHaveURL('/table')
    await expect(page.locator('.data-table-app')).toBeVisible()
  })

  test('can navigate via omnibar search', async ({ page }) => {
    await page.locator('body').click({ position: { x: 10, y: 10 } })

    await page.keyboard.press('Meta+k')
    await page.waitForSelector('.kbd-omnibar', { timeout: 5000 })

    // Search for "canvas"
    await page.keyboard.type('canvas')
    await page.waitForTimeout(200)

    // Should show Canvas result
    await expect(page.locator('.kbd-omnibar-result-label', { hasText: 'Canvas' })).toBeVisible()

    // Press Enter to execute
    await page.keyboard.press('Enter')
    await page.waitForTimeout(300)

    await expect(page).toHaveURL('/canvas')
  })
})

test.describe('Data Table Demo', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.removeItem('use-kbd-demo')
      localStorage.removeItem('use-kbd-demo-removed')
    })
    await page.goto('/table')
  })

  test('keyboard navigation works with j/k', async ({ page }) => {
    await page.locator('body').click({ position: { x: 10, y: 10 } })

    const rows = page.locator('.data-table tbody tr')
    await expect(rows.first()).toHaveClass(/selected/)

    // Press j to move down
    await page.keyboard.press('j')
    await page.waitForTimeout(100)
    await expect(rows.nth(1)).toHaveClass(/selected/)

    // Press k to move up
    await page.keyboard.press('k')
    await page.waitForTimeout(100)
    await expect(rows.first()).toHaveClass(/selected/)
  })

  test('can sort columns with single keys', async ({ page }) => {
    await page.locator('body').click({ position: { x: 10, y: 10 } })

    const firstCell = page.locator('.data-table tbody tr:first-child td:first-child')
    await expect(firstCell).toHaveText('Alpha-1')

    // Press 'n' to sort by name ascending
    await page.keyboard.press('n')
    await page.waitForTimeout(100)
    await expect(firstCell).toHaveText('Alpha-1')

    // Press Shift+N to sort by name descending
    await page.keyboard.press('Shift+n')
    await page.waitForTimeout(100)
    const text = await firstCell.textContent()
    expect(text).toMatch(/^Zeta-/)
  })

  test('shortcuts modal has two-column layout for certain groups', async ({ page }) => {
    await page.locator('body').click({ position: { x: 10, y: 10 } })

    await page.keyboard.press('?')
    await page.waitForSelector('.kbd-modal', { timeout: 5000 })

    // Verify two-column tables exist for Sort, Row Navigation, and Page Navigation
    const tables = page.locator('.kbd-table')
    await expect(tables).toHaveCount(3)

    await page.keyboard.press('Escape')
  })

  test('can edit shortcut in modal', async ({ page }) => {
    await page.locator('body').click({ position: { x: 10, y: 10 } })

    await page.keyboard.press('?')
    await page.waitForSelector('.kbd-modal', { timeout: 5000 })

    // Find editable kbd element with 'N' (sort by name)
    const kbdElement = page.locator('.kbd-kbd.editable', { hasText: 'N' }).first()
    await expect(kbdElement).toBeVisible()

    await kbdElement.click()
    await page.waitForTimeout(100)

    const editingElement = page.locator('.kbd-kbd.editing')
    await expect(editingElement).toBeVisible({ timeout: 2000 })

    // Press new key
    await page.keyboard.press('x')
    await page.waitForTimeout(1200)

    // Should show new key
    await expect(page.locator('.kbd-kbd', { hasText: 'X' })).toBeVisible()
  })

  test('shortcuts disabled while editing binding', async ({ page }) => {
    await page.locator('body').click({ position: { x: 10, y: 10 } })

    await page.keyboard.press('?')
    await page.waitForSelector('.kbd-modal', { timeout: 5000 })

    // Click on a shortcut to start editing
    const kbdElement = page.locator('.kbd-kbd.editable', { hasText: 'N' }).first()
    await kbdElement.click()
    await page.waitForTimeout(100)

    // Should be editing
    await expect(page.locator('.kbd-kbd.editing')).toBeVisible()

    // Try to navigate with 'g t' sequence - should NOT navigate
    await page.keyboard.press('g')
    await page.waitForTimeout(100)

    // The 'g' should be captured by the editing input, not trigger navigation
    // URL should still be /table
    await expect(page).toHaveURL('/table')

    // Cancel editing with Escape
    await page.keyboard.press('Escape')
    await page.waitForTimeout(200)

    // Now try navigation - should work
    await page.keyboard.press('g')
    await page.waitForTimeout(100)
    await page.keyboard.press('c')
    await page.waitForTimeout(500)

    await expect(page).toHaveURL('/canvas')
  })
})

test.describe('Canvas Demo', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.removeItem('use-kbd-demo')
      localStorage.removeItem('use-kbd-demo-removed')
    })
    await page.goto('/canvas')
  })

  test('can switch tools with hotkeys', async ({ page }) => {
    await page.locator('body').click({ position: { x: 10, y: 10 } })

    // Default tool should be pen (✏ is active)
    await expect(page.locator('.tool-btn.active')).toHaveText('✏')

    // Press 'e' to switch to eraser
    await page.keyboard.press('e')
    await page.waitForTimeout(100)
    await expect(page.locator('.tool-btn.active')).toHaveText('⌫')

    // Press 'l' to switch to line
    await page.keyboard.press('l')
    await page.waitForTimeout(100)
    await expect(page.locator('.tool-btn.active')).toHaveText('╱')
  })

  test('can change colors with number keys', async ({ page }) => {
    await page.locator('body').click({ position: { x: 10, y: 10 } })

    // Press '2' for red
    await page.keyboard.press('2')
    await page.waitForTimeout(100)

    // Red color button should be active
    const activeColor = page.locator('.color-btn.active')
    await expect(activeColor).toHaveCSS('background-color', 'rgb(239, 68, 68)')
  })

  test('shortcuts modal shows tool and color shortcuts', async ({ page }) => {
    await page.locator('body').click({ position: { x: 10, y: 10 } })

    await page.keyboard.press('?')
    await page.waitForSelector('.kbd-modal', { timeout: 5000 })

    // Should have Tools group
    await expect(page.locator('.kbd-group', { hasText: 'TOOLS' })).toBeVisible()

    // Should have Colors group
    await expect(page.locator('.kbd-group', { hasText: 'COLORS' })).toBeVisible()
  })

  test('single binding mode: can remove and re-add binding', async ({ page }) => {
    await page.locator('body').click({ position: { x: 10, y: 10 } })

    await page.keyboard.press('?')
    await page.waitForSelector('.kbd-modal', { timeout: 5000 })

    // Find the Pen tool shortcut (P)
    const penAction = page.locator('.kbd-action', { hasText: 'Pen tool' })
    await expect(penAction).toBeVisible()

    // Hover to reveal remove button
    const penKbd = penAction.locator('.kbd-kbd')
    await penKbd.hover()
    await page.waitForTimeout(100)

    // Click remove button
    const removeBtn = penAction.locator('.kbd-remove-btn')
    await removeBtn.click()
    await page.waitForTimeout(200)

    // Should now show add button (no kbd element)
    const addBtn = penAction.locator('.kbd-add-btn')
    await expect(addBtn).toBeVisible()

    // Click add button to re-add binding
    await addBtn.click()
    await page.waitForTimeout(100)

    // Should be in editing mode
    await expect(penAction.locator('.kbd-kbd.editing')).toBeVisible()

    // Press 'p' to reassign
    await page.keyboard.press('p')
    await page.waitForTimeout(1200)

    // Should show P again
    await expect(penAction.locator('.kbd-kbd', { hasText: 'P' })).toBeVisible()
  })
})

test.describe('Calendar Demo', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.removeItem('use-kbd-demo')
      localStorage.removeItem('use-kbd-demo-removed')
    })
    await page.goto('/calendar')
  })

  test('can navigate with vim keys', async ({ page }) => {
    await page.locator('body').click({ position: { x: 10, y: 10 } })

    // Get initially selected date
    const selected = page.locator('.calendar-day.selected')
    await expect(selected).toBeVisible()

    // Press 'l' to move right (next day)
    await page.keyboard.press('l')
    await page.waitForTimeout(100)

    // Selection should have moved
    const newSelected = page.locator('.calendar-day.selected')
    await expect(newSelected).toBeVisible()
  })

  test('can switch view modes', async ({ page }) => {
    await page.locator('body').click({ position: { x: 10, y: 10 } })

    // Default should show month view (calendar grid)
    await expect(page.locator('.calendar-grid')).toBeVisible()

    // Press 'w' for week view
    await page.keyboard.press('w')
    await page.waitForTimeout(100)
    await expect(page.locator('.week-view')).toBeVisible()

    // Press 'd' for day view
    await page.keyboard.press('d')
    await page.waitForTimeout(100)
    await expect(page.locator('.day-view')).toBeVisible()

    // Press 'm' to return to month view
    await page.keyboard.press('m')
    await page.waitForTimeout(100)
    await expect(page.locator('.calendar-grid')).toBeVisible()
  })

  test('can go to today with t key', async ({ page }) => {
    await page.locator('body').click({ position: { x: 10, y: 10 } })

    // Navigate away from today using [ (prev month)
    await page.keyboard.press('[')
    await page.waitForTimeout(100)

    // Press 't' to go back to today
    await page.keyboard.press('t')
    await page.waitForTimeout(100)

    // Today should be both selected and marked as today
    const todayCell = page.locator('.calendar-day.today.selected')
    await expect(todayCell).toBeVisible()
  })
})
