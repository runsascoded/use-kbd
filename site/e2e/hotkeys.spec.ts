import { test, expect } from '@playwright/test'

test.describe('Global Features', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.removeItem('use-kbd-demo')
      localStorage.removeItem('use-kbd-demo-removed')
    })
    await page.goto('/')
    // Wait for React effects to register keyboard listeners
    await expect(page.locator('.kbd-speed-dial-primary')).toBeVisible()
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

  test('SequenceModal hides current page navigation', async ({ page }) => {
    // Navigate to table page
    await page.goto('/table')
    await page.locator('body').click({ position: { x: 10, y: 10 } })

    // Press 'g' to open SequenceModal
    await page.keyboard.press('g')
    await page.waitForSelector('.kbd-sequence', { timeout: 5000 })

    // Should show other navigation options but NOT "Data Table"
    const completions = page.locator('.kbd-sequence-completion')
    await expect(completions).toHaveCount(4) // Home, Canvas, Calendar, + go to page N

    // Verify "Data Table" is not in the list (since we're on /table)
    await expect(page.locator('.kbd-sequence-completion', { hasText: 'Data Table' })).not.toBeVisible()

    // But other nav options should be visible
    await expect(page.locator('.kbd-sequence-completion', { hasText: 'Home' })).toBeVisible()
    await expect(page.locator('.kbd-sequence-completion', { hasText: 'Canvas' })).toBeVisible()
    await expect(page.locator('.kbd-sequence-completion', { hasText: 'Calendar' })).toBeVisible()

    await page.keyboard.press('Escape')
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
    // Wait for React effects to register keyboard listeners
    await expect(page.locator('.kbd-speed-dial-primary')).toBeVisible()
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

    // Should show new key (use .first() to avoid matching the '\f x' binding which also contains 'X')
    await expect(page.locator('.kbd-kbd', { hasText: 'X' }).first()).toBeVisible()
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

  test('omnibar number-aware search shows placeholder actions', async ({ page }) => {
    // Click first row to select it
    const rows = page.locator('.data-table tbody tr')
    await rows.first().click()
    await expect(rows.first()).toHaveClass(/selected/)

    // Open omnibar and type text + number to find placeholder actions
    await page.keyboard.press('Meta+k')
    await page.waitForSelector('.kbd-omnibar', { timeout: 5000 })

    // Type "up n" - this should match "Up N rows"
    await page.keyboard.type('up n')

    // Wait for "Up N rows" to appear in results (with increased timeout for CI)
    await expect(page.getByText('Up N rows', { exact: true })).toBeVisible({ timeout: 10000 })

    // Verify it has the ## placeholder indicator in the binding
    await expect(page.getByText('##').first()).toBeVisible()

    await page.keyboard.press('Escape')
  })

  test('omnibar number-aware search executes with captured value', async ({ page }) => {
    // Click first row to select it
    const rows = page.locator('.data-table tbody tr')
    await rows.first().click()
    await expect(rows.first()).toHaveClass(/selected/)

    // Open omnibar and search for "down 3"
    await page.keyboard.press('Meta+k')
    await page.waitForSelector('.kbd-omnibar', { timeout: 5000 })

    await page.keyboard.type('down 3')
    await page.waitForTimeout(200)

    // Should show "Down N rows" at the top (boosted because of placeholder match)
    const firstResult = page.locator('.kbd-omnibar-result-label').first()
    await expect(firstResult).toHaveText('Down N rows')

    // Press Enter to execute
    await page.keyboard.press('Enter')
    await page.waitForTimeout(200)

    // Should have moved down 3 rows (row 3 should be selected, 0-indexed)
    await expect(rows.nth(3)).toHaveClass(/selected/)
  })

  test('omnibar shows parameter entry for placeholder action without number', async ({ page }) => {
    // Click first row to select it
    const rows = page.locator('.data-table tbody tr')
    await rows.first().click()
    await expect(rows.first()).toHaveClass(/selected/)

    // Open omnibar and search for "down rows" without a number
    await page.keyboard.press('Meta+k')
    await page.waitForSelector('.kbd-omnibar', { timeout: 5000 })

    await page.keyboard.type('down rows')
    await page.waitForTimeout(200)

    // Should show "Down N rows" at the top
    const firstResult = page.locator('.kbd-omnibar-result-label').first()
    await expect(firstResult).toHaveText('Down N rows')

    // Click on "Down N rows" (which has placeholder)
    await firstResult.click()
    await page.waitForTimeout(100)

    // Should show parameter entry UI
    await expect(page.locator('.kbd-omnibar-param-entry')).toBeVisible()
    await expect(page.locator('.kbd-omnibar-param-label', { hasText: 'Down N rows' })).toBeVisible()

    // Enter a value
    await page.keyboard.type('4')
    await page.keyboard.press('Enter')
    await page.waitForTimeout(200)

    // Should have moved down 4 rows
    await expect(rows.nth(4)).toHaveClass(/selected/)
  })

  test('omnibar click execution: Row down moves selection', async ({ page }) => {
    // Simulate mobile-style usage: clicking through omnibar instead of keyboard
    const rows = page.locator('.data-table tbody tr')
    await rows.first().click()
    await expect(rows.first()).toHaveClass(/selected/)

    // Open omnibar via Cmd+K (or could use a click on FAB in real mobile)
    await page.keyboard.press('Meta+k')
    await page.waitForSelector('.kbd-omnibar', { timeout: 5000 })

    // Type to find "Row down"
    await page.keyboard.type('row down')
    await page.waitForTimeout(200)

    // Click on "Row down" result
    const rowDownResult = page.locator('.kbd-omnibar-result-label', { hasText: 'Row down' })
    await expect(rowDownResult).toBeVisible()
    await rowDownResult.click()
    await page.waitForTimeout(200)

    // Should have moved down 1 row (row 1 selected, 0-indexed)
    await expect(rows.nth(1)).toHaveClass(/selected/)
    await expect(rows.first()).not.toHaveClass(/selected/)
  })

  test('omnibar click execution: can execute same action repeatedly', async ({ page }) => {
    // Test that clicking the same action multiple times works
    const rows = page.locator('.data-table tbody tr')
    await rows.first().click()
    await expect(rows.first()).toHaveClass(/selected/)

    // Execute "Row down" 3 times via omnibar clicks
    for (let i = 0; i < 3; i++) {
      await page.keyboard.press('Meta+k')
      await page.waitForSelector('.kbd-omnibar', { timeout: 5000 })

      // Type to find "Row down"
      await page.keyboard.type('row down')
      await page.waitForTimeout(200)

      const rowDownResult = page.locator('.kbd-omnibar-result-label', { hasText: 'Row down' })
      await rowDownResult.click()
      await page.waitForTimeout(200)
    }

    // Should be on row 3 (started at 0, moved down 3 times)
    await expect(rows.nth(3)).toHaveClass(/selected/)
  })

  test('omnibar click execution: recent actions appear first', async ({ page }) => {
    const rows = page.locator('.data-table tbody tr')
    await rows.first().click()

    // Execute "Row down" via omnibar
    await page.keyboard.press('Meta+k')
    await page.waitForSelector('.kbd-omnibar', { timeout: 5000 })
    await page.keyboard.type('row down')
    await page.waitForTimeout(200)
    const rowDownResult = page.locator('.kbd-omnibar-result-label', { hasText: 'Row down' })
    await rowDownResult.click()
    await page.waitForTimeout(200)

    // Open omnibar again with empty query
    await page.keyboard.press('Meta+k')
    await page.waitForSelector('.kbd-omnibar', { timeout: 5000 })

    // "Row down" should be first (as a recent action)
    const firstResult = page.locator('.kbd-omnibar-result-label').first()
    await expect(firstResult).toHaveText('Row down')

    // Click to execute again
    await firstResult.click()
    await page.waitForTimeout(200)

    // Should now be on row 2
    await expect(rows.nth(2)).toHaveClass(/selected/)
  })

  test('omnibar parameter entry: Down 4 rows moves to row 4 (not row 3)', async ({ page }) => {
    // This test reproduces a bug where "Down N rows" was moving N-1 rows
    // User workflow: page loads with row 0 selected by default (no click)
    const rows = page.locator('.data-table tbody tr')

    // Verify row 0 is selected by default (hoveredIndex initializes to 0)
    await expect(rows.first()).toHaveClass(/selected/)

    // Open omnibar WITHOUT clicking on the table first
    await page.keyboard.press('Meta+k')
    await page.waitForSelector('.kbd-omnibar', { timeout: 5000 })

    // Search for "Down N rows"
    await page.keyboard.type('down n')
    await page.waitForTimeout(200)

    // Click on it to trigger parameter entry
    const downNResult = page.getByText('Down N rows', { exact: true })
    await downNResult.click()
    await page.waitForTimeout(100)

    // Enter "4" and confirm
    await expect(page.locator('.kbd-omnibar-param-entry')).toBeVisible()
    await page.keyboard.type('4')
    await page.keyboard.press('Enter')
    await page.waitForTimeout(200)

    // Should be at row 4 (Epsilon-1), NOT row 3 (Delta-1)
    // Row indices: 0=Alpha, 1=Beta, 2=Gamma, 3=Delta, 4=Epsilon
    await expect(rows.nth(4)).toHaveClass(/selected/)
    await expect(rows.nth(3)).not.toHaveClass(/selected/)
  })

  test('clicking SpeedDial to open omnibar does not reset table selection', async ({ page }) => {
    // Bug: clicking the floating search button triggered document click handler
    // which reset hoveredIndex to -1, causing off-by-one errors
    const rows = page.locator('.data-table tbody tr')

    // Select row 2 (Gamma-1) first
    await rows.nth(2).click()
    await expect(rows.nth(2)).toHaveClass(/selected/)

    // Click the SpeedDial primary button (always visible)
    const primaryBtn = page.locator('.kbd-speed-dial-primary')
    await primaryBtn.click()
    await page.waitForTimeout(100)

    // Selection should still be on row 2 (not reset to -1)
    await expect(rows.nth(2)).toHaveClass(/selected/)
  })

  test('omnibar click execution: placeholder action shows param entry on repeat', async ({ page }) => {
    const rows = page.locator('.data-table tbody tr')
    await rows.first().click()

    // First, execute "Down N rows" with parameter entry
    await page.keyboard.press('Meta+k')
    await page.waitForSelector('.kbd-omnibar', { timeout: 5000 })
    await page.keyboard.type('down n rows')
    await page.waitForTimeout(200)
    const downNResult = page.getByText('Down N rows', { exact: true })
    await downNResult.click()
    await page.waitForTimeout(100)

    // Enter parameter
    await expect(page.locator('.kbd-omnibar-param-entry')).toBeVisible()
    await page.keyboard.type('2')
    await page.keyboard.press('Enter')
    await page.waitForTimeout(200)

    // Should be at row 2
    await expect(rows.nth(2)).toHaveClass(/selected/)

    // Now open omnibar again - "Down N rows" should be in recents
    await page.keyboard.press('Meta+k')
    await page.waitForSelector('.kbd-omnibar', { timeout: 5000 })

    // Click on it again (should show param entry, not execute immediately)
    const firstResult = page.locator('.kbd-omnibar-result-label').first()
    await expect(firstResult).toHaveText('Down N rows')
    await firstResult.click()
    await page.waitForTimeout(100)

    // Should show parameter entry again
    await expect(page.locator('.kbd-omnibar-param-entry')).toBeVisible()

    // Enter new value
    await page.keyboard.type('3')
    await page.keyboard.press('Enter')
    await page.waitForTimeout(200)

    // Should be at row 5 (2 + 3)
    await expect(rows.nth(5)).toHaveClass(/selected/)
  })
})

test.describe('Float Placeholder', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.removeItem('use-kbd-demo')
      localStorage.removeItem('use-kbd-demo-removed')
    })
    await page.goto('/table')
    // Wait for React effects to register keyboard listeners
    await expect(page.locator('.kbd-speed-dial-primary')).toBeVisible()
  })

  test('key+float sequence: o then float then Enter executes scale', async ({ page }) => {
    // Select first row and note its value
    const rows = page.locator('.data-table tbody tr')
    await rows.first().click()
    await expect(rows.first()).toHaveClass(/selected/)

    const valueCell = page.locator('.data-table tbody tr:first-child td:nth-child(3)')
    const originalValue = parseInt(await valueCell.textContent() ?? '0', 10)

    // Type "o 2 Enter" to scale by 2 (integer, simpler case)
    await page.keyboard.press('o')
    await page.waitForTimeout(50)
    await page.keyboard.press('2')
    await page.waitForTimeout(50)

    // SequenceModal should be visible with the partial sequence
    const seqModal = page.locator('.kbd-sequence')
    await expect(seqModal).toBeVisible()

    // Press Enter to finalize and execute
    await page.keyboard.press('Enter')
    await page.waitForTimeout(200)

    // Value should be doubled
    const newValue = parseInt(await valueCell.textContent() ?? '0', 10)
    expect(newValue).toBe(Math.round(originalValue * 2))
  })

  test('key+float sequence: o then decimal then Enter executes scale', async ({ page }) => {
    // Select first row and note its value
    const rows = page.locator('.data-table tbody tr')
    await rows.first().click()
    await expect(rows.first()).toHaveClass(/selected/)

    const valueCell = page.locator('.data-table tbody tr:first-child td:nth-child(3)')
    const originalValue = parseInt(await valueCell.textContent() ?? '0', 10)

    // Type "o 0 . 5 Enter" to scale by 0.5
    await page.keyboard.press('o')
    await page.waitForTimeout(50)
    await page.keyboard.press('0')
    await page.waitForTimeout(50)
    await page.keyboard.press('.')
    await page.waitForTimeout(50)
    await page.keyboard.press('5')
    await page.waitForTimeout(50)

    // SequenceModal should show the sequence
    const seqModal = page.locator('.kbd-sequence')
    await expect(seqModal).toBeVisible()

    // Press Enter to finalize and execute
    await page.keyboard.press('Enter')
    await page.waitForTimeout(200)

    // Value should be halved
    const newValue = parseInt(await valueCell.textContent() ?? '0', 10)
    expect(newValue).toBe(Math.round(originalValue * 0.5))
  })

  test('float-first sequence: decimal then x sets value', async ({ page }) => {
    // Select first row
    const rows = page.locator('.data-table tbody tr')
    await rows.first().click()
    await expect(rows.first()).toHaveClass(/selected/)

    // Type "99.5 x" to set value to 100 (rounded)
    await page.keyboard.press('9')
    await page.waitForTimeout(50)
    await page.keyboard.press('9')
    await page.waitForTimeout(50)
    await page.keyboard.press('.')
    await page.waitForTimeout(50)
    await page.keyboard.press('5')
    await page.waitForTimeout(50)

    // SequenceModal should be visible
    const seqModal = page.locator('.kbd-sequence')
    await expect(seqModal).toBeVisible()

    // Press x to finalize float and complete the sequence
    await page.keyboard.press('x')
    await page.waitForTimeout(200)

    // Sequence modal should close (sequence completed)
    await expect(seqModal).not.toBeVisible()

    // Value should now be 100 (Math.round(99.5))
    const valueCell = page.locator('.data-table tbody tr:first-child td:nth-child(3)')
    expect(await valueCell.textContent()).toBe('100')
  })

  test('float-first sequence: integer then x also works', async ({ page }) => {
    // Select first row
    const rows = page.locator('.data-table tbody tr')
    await rows.first().click()
    await expect(rows.first()).toHaveClass(/selected/)

    // Type "42 x" (integer, no dot)
    await page.keyboard.press('4')
    await page.waitForTimeout(50)
    await page.keyboard.press('2')
    await page.waitForTimeout(50)
    await page.keyboard.press('x')
    await page.waitForTimeout(200)

    const valueCell = page.locator('.data-table tbody tr:first-child td:nth-child(3)')
    expect(await valueCell.textContent()).toBe('42')
  })

  test('SequenceModal shows float placeholder completions', async ({ page }) => {
    // Type 'o' to start the "o \f" sequence
    await page.keyboard.press('o')
    await page.waitForTimeout(50)

    const seqModal = page.locator('.kbd-sequence')
    await expect(seqModal).toBeVisible()

    // Should show completions including "Scale values by N"
    await expect(seqModal.locator('.kbd-sequence-actions', { hasText: 'Scale values by N' })).toBeVisible()

    await page.keyboard.press('Escape')
  })

  test('LookupModal shows float placeholder bindings', async ({ page }) => {
    // Open lookup modal
    await page.keyboard.press('Meta+Shift+k')
    await page.waitForSelector('.kbd-lookup', { timeout: 5000 })

    // Should show bindings that include float placeholders
    // Look for the ⟨#.#⟩ display in the results
    await expect(page.locator('.kbd-lookup-result .kbd-kbd', { hasText: '⟨#.#⟩' }).first()).toBeVisible()

    // Type 'o' to filter to the o \f binding
    await page.keyboard.press('o')
    await page.waitForTimeout(100)

    // Should show "Scale values by N" in filtered results
    await expect(page.locator('.kbd-lookup-labels', { hasText: 'Scale values by N' })).toBeVisible()

    await page.keyboard.press('Escape')
    await page.keyboard.press('Escape')
  })

  test('LookupModal filters float bindings when typing dot', async ({ page }) => {
    // Open lookup modal
    await page.keyboard.press('Meta+Shift+k')
    await page.waitForSelector('.kbd-lookup', { timeout: 5000 })

    // Type a digit then dot to filter to float-only patterns
    await page.keyboard.press('1')
    await page.waitForTimeout(50)
    await page.keyboard.press('.')
    await page.waitForTimeout(100)

    // \d+ patterns should be filtered out (dot is not a digit)
    // Only \f patterns should remain
    const results = page.locator('.kbd-lookup-result')
    const count = await results.count()
    expect(count).toBeGreaterThan(0)

    // All remaining results should have float placeholders
    for (let i = 0; i < count; i++) {
      const binding = results.nth(i).locator('.kbd-lookup-binding')
      await expect(binding.locator('.kbd-kbd', { hasText: '⟨#.#⟩' })).toBeVisible()
    }

    await page.keyboard.press('Escape')
    await page.keyboard.press('Escape')
  })

  test('omnibar param entry accepts decimal values for float actions', async ({ page }) => {
    // Select first row
    const rows = page.locator('.data-table tbody tr')
    await rows.first().click()
    await expect(rows.first()).toHaveClass(/selected/)

    const valueCell = page.locator('.data-table tbody tr:first-child td:nth-child(3)')
    const originalValue = parseInt(await valueCell.textContent() ?? '0', 10)

    // Open omnibar and search for "scale"
    await page.keyboard.press('Meta+k')
    await page.waitForSelector('.kbd-omnibar', { timeout: 5000 })

    await page.keyboard.type('scale')
    await page.waitForTimeout(200)

    // Click on "Scale values by N" to trigger param entry
    const scaleResult = page.locator('.kbd-omnibar-result-label', { hasText: 'Scale values by N' })
    await expect(scaleResult).toBeVisible()
    await scaleResult.click()
    await page.waitForTimeout(100)

    // Should show parameter entry
    await expect(page.locator('.kbd-omnibar-param-entry')).toBeVisible()

    // Enter a decimal value
    await page.keyboard.type('1.5')
    await page.keyboard.press('Enter')
    await page.waitForTimeout(200)

    // Value should be scaled by 1.5
    const newValue = parseInt(await valueCell.textContent() ?? '0', 10)
    expect(newValue).toBe(Math.round(originalValue * 1.5))
  })

  test('omnibar number-aware search works with float query', async ({ page }) => {
    // Select first row
    const rows = page.locator('.data-table tbody tr')
    await rows.first().click()
    await expect(rows.first()).toHaveClass(/selected/)

    const valueCell = page.locator('.data-table tbody tr:first-child td:nth-child(3)')
    const originalValue = parseInt(await valueCell.textContent() ?? '0', 10)

    // Open omnibar and search "scale 2.5"
    await page.keyboard.press('Meta+k')
    await page.waitForSelector('.kbd-omnibar', { timeout: 5000 })

    await page.keyboard.type('scale 2.5')
    await page.waitForTimeout(200)

    // Should show "Scale values by N" as top result
    const firstResult = page.locator('.kbd-omnibar-result-label').first()
    await expect(firstResult).toHaveText('Scale values by N')

    // Execute it (number 2.5 captured from query)
    await page.keyboard.press('Enter')
    await page.waitForTimeout(200)

    // Value should be scaled by 2.5
    const newValue = parseInt(await valueCell.textContent() ?? '0', 10)
    expect(newValue).toBe(Math.round(originalValue * 2.5))
  })

  test('backspace during float sequence edits instead of executing', async ({ page }) => {
    // Type "o 1 . 5" to start an o \f sequence
    await page.keyboard.press('o')
    await page.waitForTimeout(50)
    await page.keyboard.press('1')
    await page.waitForTimeout(50)
    await page.keyboard.press('.')
    await page.waitForTimeout(50)
    await page.keyboard.press('5')
    await page.waitForTimeout(50)

    const seqModal = page.locator('.kbd-sequence')
    await expect(seqModal).toBeVisible()
    const seqKeys = page.locator('.kbd-sequence-keys')
    await expect(seqKeys).toContainText('5')

    // Backspace should remove the '5', not execute
    await page.keyboard.press('Backspace')
    await page.waitForTimeout(100)

    // Modal should still be open
    await expect(seqModal).toBeVisible()

    // The '5' should be gone from the sequence display
    const keysText = await seqKeys.textContent()
    // Should still have 'O', '1', '.' but not '5'
    expect(keysText).toContain('O')
    expect(keysText).toContain('1')

    await page.keyboard.press('Escape')
  })

  test('SequenceModal shows completions for partial float with trailing dot', async ({ page }) => {
    // Type "4." — a partial float (trailing dot, mid-accumulation)
    await page.keyboard.press('4')
    await page.waitForTimeout(50)
    await page.keyboard.press('.')
    await page.waitForTimeout(50)

    const seqModal = page.locator('.kbd-sequence')
    await expect(seqModal).toBeVisible()

    // Should show completions; "4." parses as 4, so N is substituted with 4
    await expect(seqModal.locator('.kbd-sequence-actions', { hasText: 'Set values to 4' })).toBeVisible()

    await page.keyboard.press('Escape')
  })

  test('SequenceModal shows completions for leading dot (start of float)', async ({ page }) => {
    // Type "." — leading dot, valid start of a float like .5
    await page.keyboard.press('.')
    await page.waitForTimeout(50)

    const seqModal = page.locator('.kbd-sequence')
    await expect(seqModal).toBeVisible()

    // Should show float-first completions
    await expect(seqModal.locator('.kbd-sequence-actions', { hasText: 'Set values to N' })).toBeVisible()

    await page.keyboard.press('Escape')
  })

  test('SequenceModal shows completions for leading dot with digit', async ({ page }) => {
    // Type ".9" — leading dot followed by digit
    await page.keyboard.press('.')
    await page.waitForTimeout(50)
    await page.keyboard.press('9')
    await page.waitForTimeout(50)

    const seqModal = page.locator('.kbd-sequence')
    await expect(seqModal).toBeVisible()

    // ".9" parses as 0.9, so N is substituted
    await expect(seqModal.locator('.kbd-sequence-actions', { hasText: 'Set values to 0.9' })).toBeVisible()

    await page.keyboard.press('Escape')
  })

  test('trailing dot float finalizes when followed by non-float key', async ({ page }) => {
    // Select first row
    const rows = page.locator('.data-table tbody tr')
    await rows.first().click()
    await expect(rows.first()).toHaveClass(/selected/)

    const valueCell = page.locator('.data-table tbody tr:first-child td:nth-child(3)')

    // Type "4. x" — trailing dot should finalize as 4
    await page.keyboard.press('4')
    await page.waitForTimeout(50)
    await page.keyboard.press('.')
    await page.waitForTimeout(50)
    await page.keyboard.press('x')
    await page.waitForTimeout(200)

    // Value should now be 4 (parseFloat("4.") === 4)
    expect(await valueCell.textContent()).toBe('4')
  })

  test('shortcuts modal shows float placeholder in bindings', async ({ page }) => {
    await page.locator('body').click({ position: { x: 10, y: 10 } })

    await page.keyboard.press('?')
    await page.waitForSelector('.kbd-modal', { timeout: 5000 })

    // Find the "Scale values by N" action row
    const scaleAction = page.locator('.kbd-action', { hasText: 'Scale values by N' })
    await expect(scaleAction).toBeVisible()

    // Its binding should contain a #.# placeholder
    const floatPlaceholder = scaleAction.locator('.kbd-placeholder', { hasText: '#.#' })
    await expect(floatPlaceholder).toBeVisible()

    // Also check the float-first binding "Set values to N"
    const setAction = page.locator('.kbd-action', { hasText: 'Set values to N' })
    await expect(setAction).toBeVisible()
    await expect(setAction.locator('.kbd-placeholder', { hasText: '#.#' })).toBeVisible()

    await page.keyboard.press('Escape')
  })
})

test.describe('Canvas Demo', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.removeItem('use-kbd-demo')
      localStorage.removeItem('use-kbd-demo-removed')
      localStorage.removeItem('use-kbd-demo-recents')
    })
    await page.goto('/canvas')
    // Wait for React effects to register keyboard listeners
    await expect(page.locator('.kbd-speed-dial-primary')).toBeVisible()
  })

  test('omnibar only shows canvas actions, not table actions', async ({ page }) => {
    // Open omnibar
    await page.keyboard.press('Meta+k')
    await page.waitForSelector('.kbd-omnibar', { timeout: 5000 })

    // Search for "row" - should NOT find TableDemo's row navigation actions
    await page.keyboard.type('row')
    await page.waitForTimeout(200)

    // Should show "No matching commands" or only canvas-related results
    // Specifically, should NOT show "Row down" or "Row up" from TableDemo
    const rowDownResult = page.locator('.kbd-omnibar-result-label', { hasText: 'Row down' })
    await expect(rowDownResult).not.toBeVisible()

    const rowUpResult = page.locator('.kbd-omnibar-result-label', { hasText: 'Row up' })
    await expect(rowUpResult).not.toBeVisible()

    await page.keyboard.press('Escape')

    // Search for "sort" - should NOT find TableDemo's sort actions
    await page.keyboard.press('Meta+k')
    await page.waitForSelector('.kbd-omnibar', { timeout: 5000 })
    await page.keyboard.type('sort')
    await page.waitForTimeout(200)

    const sortResult = page.locator('.kbd-omnibar-result-label', { hasText: 'Sort' })
    await expect(sortResult).not.toBeVisible()

    await page.keyboard.press('Escape')
  })

  test('recent actions from other pages do not appear in canvas omnibar', async ({ page }) => {
    // First, go to table and execute an action
    await page.goto('/table')
    const rows = page.locator('.data-table tbody tr')
    await rows.first().click()

    // Execute "Row down" via keyboard
    await page.keyboard.press('j')
    await page.waitForTimeout(100)

    // Now navigate to canvas
    await page.goto('/canvas')
    await page.waitForTimeout(100)

    // Open omnibar - recents should NOT show table actions
    await page.keyboard.press('Meta+k')
    await page.waitForSelector('.kbd-omnibar', { timeout: 5000 })

    // The recents should not show "Row down" since that action doesn't exist here
    const rowDownResult = page.locator('.kbd-omnibar-result-label', { hasText: 'Row down' })
    await expect(rowDownResult).not.toBeVisible()

    await page.keyboard.press('Escape')
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

  test('hideFromModal actions are not shown in shortcuts modal', async ({ page }) => {
    await page.locator('body').click({ position: { x: 10, y: 10 } })

    await page.keyboard.press('?')
    await page.waitForSelector('.kbd-modal', { timeout: 5000 })

    // The hidden "Log state" action should NOT appear in the modal
    await expect(page.locator('.kbd-modal', { hasText: 'Log state' })).not.toBeVisible()
    await expect(page.locator('.kbd-modal', { hasText: 'Debug' })).not.toBeVisible()

    // But regular actions should still appear
    await expect(page.locator('.kbd-modal', { hasText: 'Pen tool' })).toBeVisible()

    await page.keyboard.press('Escape')
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

test.describe('Export/Import Bindings', () => {
  test('can export and import binding customizations', async ({ page }) => {
    // Clear any existing customizations
    await page.addInitScript(() => {
      localStorage.removeItem('use-kbd-demo')
      localStorage.removeItem('use-kbd-demo-removed')
    })
    await page.goto('/table')

    // Step 1: Change a binding (N -> X for sort by name)
    await page.locator('body').click({ position: { x: 10, y: 10 } })
    await page.keyboard.press('?')
    await page.waitForSelector('.kbd-modal', { timeout: 5000 })

    const kbdElement = page.locator('.kbd-kbd.editable', { hasText: 'N' }).first()
    await expect(kbdElement).toBeVisible()
    await kbdElement.click()
    await page.waitForTimeout(100)

    await expect(page.locator('.kbd-kbd.editing')).toBeVisible()
    await page.keyboard.press('x')
    await page.waitForTimeout(100)

    // Press Enter to confirm the binding
    await page.keyboard.press('Enter')
    await page.waitForTimeout(200)

    // Verify editing is complete
    await expect(page.locator('.kbd-kbd.editing')).not.toBeVisible()

    // Verify binding changed (use .first() to avoid matching the '\f x' binding which also contains 'X')
    await expect(page.locator('.kbd-kbd', { hasText: 'X' }).first()).toBeVisible()

    // Step 2: Export the bindings
    const downloadPromise = page.waitForEvent('download')
    await page.locator('.kbd-footer-btn', { hasText: 'Export' }).click()
    const download = await downloadPromise

    // Save the download to a temp file
    const downloadPath = await download.path()
    expect(downloadPath).toBeTruthy()

    // Read the exported content
    const fs = await import('fs/promises')
    const exportedContent = await fs.readFile(downloadPath!, 'utf-8')
    const exportedData = JSON.parse(exportedContent)

    // Verify export structure
    expect(exportedData.version).toBe('0.8.0')
    expect(exportedData.exportedAt).toBeTruthy()
    expect(exportedData.overrides).toBeTruthy()
    expect(exportedData.removedDefaults).toBeTruthy()

    // The custom binding should be in overrides
    expect(exportedData.overrides['x']).toBe('sort:name:asc')

    // Close modal
    await page.keyboard.press('Escape')

    // Step 3: Clear localStorage to simulate fresh profile
    await page.evaluate(() => {
      localStorage.removeItem('use-kbd-demo')
      localStorage.removeItem('use-kbd-demo-removed')
    })
    await page.reload()

    // Step 4: Verify default binding (N) works
    await page.locator('body').click({ position: { x: 10, y: 10 } })

    // Press N - should sort (default binding)
    const firstCell = page.locator('.data-table tbody tr:first-child td:first-child')
    await expect(firstCell).toHaveText('Alpha-1')

    await page.keyboard.press('n')
    await page.waitForTimeout(100)
    await expect(firstCell).toHaveText('Alpha-1') // Already sorted asc

    // Press X - should NOT sort (no binding yet)
    await page.keyboard.press('Shift+n') // First sort desc
    await page.waitForTimeout(100)
    const textAfterShiftN = await firstCell.textContent()
    expect(textAfterShiftN).toMatch(/^Zeta-/)

    await page.keyboard.press('x') // X has no binding yet
    await page.waitForTimeout(100)
    // Should still be Zeta (X didn't do anything)
    await expect(firstCell).toHaveText(textAfterShiftN!)

    // Step 5: Import the exported bindings
    await page.keyboard.press('?')
    await page.waitForSelector('.kbd-modal', { timeout: 5000 })

    // Get the file input and set the file
    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles({
      name: 'test-bindings.json',
      mimeType: 'application/json',
      buffer: Buffer.from(exportedContent),
    })
    await page.waitForTimeout(200)

    // Step 6: Verify imported binding works
    await page.keyboard.press('Escape') // Close modal

    // Now X should sort by name ascending
    await page.keyboard.press('x')
    await page.waitForTimeout(100)
    await expect(firstCell).toHaveText('Alpha-1')
  })

  test('import shows error for invalid JSON', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.removeItem('use-kbd-demo')
      localStorage.removeItem('use-kbd-demo-removed')
    })
    await page.goto('/table')

    await page.locator('body').click({ position: { x: 10, y: 10 } })
    await page.keyboard.press('?')
    await page.waitForSelector('.kbd-modal', { timeout: 5000 })

    // Try to import invalid JSON
    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles({
      name: 'invalid.json',
      mimeType: 'application/json',
      buffer: Buffer.from('not valid json'),
    })
    await page.waitForTimeout(200)

    // Should show error message
    await expect(page.locator('.kbd-import-error')).toBeVisible()

    // Dismiss error
    await page.locator('.kbd-import-error button').click()
    await expect(page.locator('.kbd-import-error')).not.toBeVisible()
  })

  test('import shows error for missing fields', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.removeItem('use-kbd-demo')
      localStorage.removeItem('use-kbd-demo-removed')
    })
    await page.goto('/table')

    await page.locator('body').click({ position: { x: 10, y: 10 } })
    await page.keyboard.press('?')
    await page.waitForSelector('.kbd-modal', { timeout: 5000 })

    // Try to import JSON missing required fields
    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles({
      name: 'incomplete.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify({ version: '0.8.0' })),
    })
    await page.waitForTimeout(200)

    // Should show error message about missing overrides
    await expect(page.locator('.kbd-import-error')).toBeVisible()
    await expect(page.locator('.kbd-import-error')).toContainText('overrides')
  })
})

test.describe('Calendar Demo', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.removeItem('use-kbd-demo')
      localStorage.removeItem('use-kbd-demo-removed')
    })
    await page.goto('/calendar')
    // Wait for React effects to register keyboard listeners
    await expect(page.locator('.kbd-speed-dial-primary')).toBeVisible()
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

  test('arrow key aliases work for navigation', async ({ page }) => {
    // This tests that 'left'/'right'/'up'/'down' aliases work
    // (CalendarDemo uses these aliases in defaultBindings)
    await page.locator('body').click({ position: { x: 10, y: 10 } })

    // Get the text content of selected date panel (shows full date)
    const getSelectedText = () => page.locator('.selected-date-panel h3').textContent()

    const initial = await getSelectedText()

    // Press ArrowRight - should move to next day (binding defined as 'right')
    await page.keyboard.press('ArrowRight')
    await page.waitForTimeout(100)
    const afterRight = await getSelectedText()
    expect(afterRight).not.toBe(initial)

    // Press ArrowLeft - should move back (binding defined as 'left')
    await page.keyboard.press('ArrowLeft')
    await page.waitForTimeout(100)
    const afterLeft = await getSelectedText()
    expect(afterLeft).toBe(initial)
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
