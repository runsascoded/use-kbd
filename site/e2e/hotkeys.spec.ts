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

  test('shortcuts work while modal is open, modal closes on sequence', async ({ page }) => {
    await page.locator('body').click({ position: { x: 10, y: 10 } })

    // Open modal
    await page.keyboard.press('?')
    await page.waitForSelector('.kbd-modal', { timeout: 5000 })
    await expect(page.locator('.kbd-modal')).toBeVisible()

    // Navigate to table with g t sequence while modal is open
    await page.keyboard.press('g')
    await page.waitForTimeout(100)

    // Modal should close when sequence starts (so SequenceModal can show)
    await expect(page.locator('.kbd-modal')).not.toBeVisible()

    await page.keyboard.press('t')
    await page.waitForTimeout(500)

    // Should navigate to table
    await expect(page).toHaveURL('/table')
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

  test('LookupModal shows digit placeholder shortcuts when typing digit', async ({ page }) => {
    // Navigate to table page which has digit placeholder shortcuts
    await page.goto('/table')
    await page.locator('body').click({ position: { x: 10, y: 10 } })

    // Open lookup modal
    await page.keyboard.press('Meta+Shift+k')
    await page.waitForSelector('.kbd-lookup', { timeout: 5000 })

    // Type a digit - should show shortcuts with ## placeholder
    await page.keyboard.press('3')
    await page.waitForTimeout(100)

    // Should show results (digit placeholder patterns like ## j)
    const results = page.locator('.kbd-lookup-result')
    await expect(results.first()).toBeVisible()
    await expect(page.locator('.kbd-lookup-empty')).not.toBeVisible()

    await page.keyboard.press('Escape')
  })

  test('SequenceModal shows digit placeholder completions', async ({ page }) => {
    // Navigate to table page which has digit placeholder shortcuts
    await page.goto('/table')
    await page.locator('body').click({ position: { x: 10, y: 10 } })

    // Type a digit to start a sequence
    await page.keyboard.press('5')
    await page.waitForSelector('.kbd-sequence', { timeout: 5000 })

    // Should show completions like "j → Down N rows"
    const completions = page.locator('.kbd-sequence-completion')
    await expect(completions.first()).toBeVisible()

    await page.keyboard.press('Escape')
  })

  test('SequenceModal arrow keys navigate completions without firing page actions', async ({ page }) => {
    // Navigate to table page and select a row
    await page.goto('/table')
    const rows = page.locator('.data-table tbody tr')
    await rows.first().click()
    await expect(rows.first()).toHaveClass(/selected/)

    // Type a digit to open sequence modal
    await page.keyboard.press('5')
    await page.waitForSelector('.kbd-sequence', { timeout: 5000 })

    // Arrow down should navigate completions, NOT move table selection
    await page.keyboard.press('ArrowDown')
    await page.waitForTimeout(100)

    // First row should still be selected (arrow didn't fire page action)
    await expect(rows.first()).toHaveClass(/selected/)

    // Second completion should now be selected in the modal
    const completions = page.locator('.kbd-sequence-completion')
    await expect(completions.nth(1)).toHaveClass(/selected/)

    await page.keyboard.press('Escape')
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
    // Click first row to select it and focus the table
    const rows = page.locator('.data-table tbody tr')
    await rows.first().click()
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

  test('numeric navigation moves by N rows', async ({ page }) => {
    // Click first row to select it and focus the table
    const rows = page.locator('.data-table tbody tr')
    await rows.first().click()
    await expect(rows.first()).toHaveClass(/selected/)

    // Type "5j" to move down 5 rows
    await page.keyboard.press('5')
    await page.waitForTimeout(50)
    await page.keyboard.press('j')
    await page.waitForTimeout(100)
    await expect(rows.nth(5)).toHaveClass(/selected/)

    // Type "3k" to move up 3 rows (should be at row 2)
    await page.keyboard.press('3')
    await page.waitForTimeout(50)
    await page.keyboard.press('k')
    await page.waitForTimeout(100)
    await expect(rows.nth(2)).toHaveClass(/selected/)
  })

  test('numeric extend selection selects N rows', async ({ page }) => {
    // Click first row to select it
    const rows = page.locator('.data-table tbody tr')
    await rows.first().click()
    await expect(rows.first()).toHaveClass(/selected/)

    // Type "3" then Shift+J to extend selection down 3 rows
    await page.keyboard.press('3')
    await page.waitForTimeout(50)
    await page.keyboard.press('Shift+j')
    await page.waitForTimeout(100)

    // Rows 0, 1, 2, 3 should be selected (anchor at 0, cursor at 3)
    await expect(rows.nth(0)).toHaveClass(/selected/)
    await expect(rows.nth(1)).toHaveClass(/selected/)
    await expect(rows.nth(2)).toHaveClass(/selected/)
    await expect(rows.nth(3)).toHaveClass(/selected/)
    // Row 4 should NOT be selected
    await expect(rows.nth(4)).not.toHaveClass(/selected/)
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

  test('backspace during digit sequence edits instead of executing', async ({ page }) => {
    // Click first row to select and establish cursor position
    const rows = page.locator('.data-table tbody tr')
    await rows.first().click()
    await expect(rows.first()).toHaveClass(/selected/)

    // Get initial cursor position
    const initialId = await rows.first().getAttribute('data-row-id')

    // Type '1 2' to start a digit sequence (for \d+ j pattern)
    await page.keyboard.press('1')
    await page.waitForTimeout(50)
    await page.keyboard.press('2')
    await page.waitForTimeout(50)

    // SequenceModal should be showing with "1 2"
    const seqModal = page.locator('.kbd-sequence')
    await expect(seqModal).toBeVisible()
    const seqKeys = page.locator('.kbd-sequence-keys')
    await expect(seqKeys).toContainText('1')
    await expect(seqKeys).toContainText('2')

    // Press backspace - should edit sequence to just "1", NOT execute
    await page.keyboard.press('Backspace')
    await page.waitForTimeout(100)

    // Modal should still be open with just "1"
    await expect(seqModal).toBeVisible()
    // The sequence should now be just "1" (the "2" was removed)
    const keysText = await seqKeys.textContent()
    expect(keysText).not.toContain('2')

    // Cursor should still be on the same row (action was NOT executed)
    // If backspace incorrectly executed, we'd have moved down 12 rows
    const currentlySelected = page.locator('tr.selected')
    const currentId = await currentlySelected.first().getAttribute('data-row-id')
    expect(currentId).toBe(initialId)

    // Now press Escape to cancel
    await page.keyboard.press('Escape')
    await expect(seqModal).not.toBeVisible()
  })

  test('g N Enter goes to page N', async ({ page }) => {
    // Verify we start on page 1
    const pageInfo = page.locator('.pagination-controls')
    await expect(pageInfo).toContainText('1–20 of 1000')

    // Type "g 1 0" then Enter to go to page 10
    await page.keyboard.press('g')
    await page.waitForTimeout(50)
    await page.keyboard.press('1')
    await page.waitForTimeout(50)
    await page.keyboard.press('0')
    await page.waitForTimeout(50)

    // SequenceModal should show "Go to page 10"
    const seqModal = page.locator('.kbd-sequence')
    await expect(seqModal).toBeVisible()

    // Press Enter to execute
    await page.keyboard.press('Enter')
    await page.waitForTimeout(100)

    // Modal should close
    await expect(seqModal).not.toBeVisible()

    // Should now be on page 10 (showing rows 181-200)
    await expect(pageInfo).toContainText('181–200 of 1000')
  })

  test('SequenceModal shows modifier icons for key combos', async ({ page }) => {
    // Start a sequence with 'g' (which has partial matches like 'g t', 'g \d+')
    await page.keyboard.press('g')
    await page.waitForTimeout(50)

    // SequenceModal should be visible
    const seqModal = page.locator('.kbd-sequence')
    await expect(seqModal).toBeVisible()

    // Now press Ctrl+X - an invalid key combo that doesn't match any pattern
    // This will show "No matching shortcuts" but should display the modifier icon
    await page.keyboard.press('Control+x')
    await page.waitForTimeout(50)

    // The modal should still be visible (showing "No matching shortcuts")
    await expect(seqModal).toBeVisible()

    // The sequence keys section should contain a modifier icon SVG (for ctrl)
    const modifierIcon = seqModal.locator('.kbd-sequence-keys .kbd-modifier-icon')
    await expect(modifierIcon).toBeVisible()

    // Verify it's actually an SVG element (not just text with the class)
    const tagName = await modifierIcon.evaluate(el => el.tagName.toLowerCase())
    expect(tagName).toBe('svg')

    // Should show "No matching shortcuts" message
    await expect(seqModal.locator('.kbd-sequence-empty')).toBeVisible()

    // Press Escape and test modifier icons in completions list
    await page.keyboard.press('Escape')
    await expect(seqModal).not.toBeVisible()

    // Press a digit to show completions with modifier keys (like Shift+K, Shift+J)
    await page.keyboard.press('3')
    await page.waitForTimeout(50)
    await expect(seqModal).toBeVisible()

    // Completions should include Shift+K and Shift+J which should have modifier icons
    const completionModifierIcon = seqModal.locator('.kbd-sequence-completions .kbd-modifier-icon')
    await expect(completionModifierIcon.first()).toBeVisible()

    // Verify it's an SVG
    const completionTagName = await completionModifierIcon.first().evaluate(el => el.tagName.toLowerCase())
    expect(completionTagName).toBe('svg')

    // Press Escape to cancel
    await page.keyboard.press('Escape')
    await expect(seqModal).not.toBeVisible()
  })

  test('omnibar shows endpoint results with empty query (minQueryLength: 0)', async ({ page }) => {
    await page.locator('body').click({ position: { x: 10, y: 10 } })

    // Open omnibar without typing anything
    await page.keyboard.press('Meta+k')
    await page.waitForSelector('.kbd-omnibar', { timeout: 5000 })

    // Wait for endpoint results to load (minQueryLength: 0 means they appear immediately)
    await page.waitForTimeout(500)

    // Table rows should appear with their group label
    await expect(page.locator('.kbd-omnibar-result-category', { hasText: 'Table Rows' }).first()).toBeVisible()
    await expect(page.locator('.kbd-omnibar-result-label', { hasText: 'Alpha-1' })).toBeVisible()
  })

  test('sync filter endpoint shows instant results', async ({ page }) => {
    await page.locator('body').click({ position: { x: 10, y: 10 } })

    // Open omnibar
    await page.keyboard.press('Meta+k')
    await page.waitForSelector('.kbd-omnibar', { timeout: 5000 })

    // Type "active" to filter - sync endpoint should respond instantly
    await page.keyboard.type('active')
    await page.waitForTimeout(100) // Minimal wait - sync should be near-instant

    // Quick Filters group should appear (from sync filter endpoint)
    await expect(page.locator('.kbd-omnibar-result-category', { hasText: 'Quick Filters' }).first()).toBeVisible()
    await expect(page.locator('.kbd-omnibar-result-label', { hasText: 'Filter: active' })).toBeVisible()

    // Click the filter to apply it
    await page.locator('.kbd-omnibar-result-label', { hasText: 'Filter: active' }).click()
    await page.waitForTimeout(200)

    // Omnibar should close and table should be filtered
    await expect(page.locator('.kbd-omnibar')).not.toBeVisible()

    // Verify table only shows active rows (status is in 2nd column)
    const statusCell = page.locator('.data-table tbody tr:first-child td:nth-child(2)')
    await expect(statusCell).toContainText('active')
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
