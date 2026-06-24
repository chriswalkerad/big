import { test, expect } from '@playwright/test'
import { DOC, resultsPanel, reviewUrl } from './helpers'

test.describe('Inline review panel (read mode)', () => {
  test('the review panel is always present (no dismiss / Escape affordance)', async ({ page }) => {
    await page.goto(reviewUrl(DOC.midnight))
    const panel = resultsPanel(page)
    await expect(panel).toBeVisible()

    // The panel is inline, not a dismissable bottom sheet: there is no close button and
    // Escape does not hide it.
    await expect(panel.getByRole('button', { name: 'Dismiss results' })).toHaveCount(0)
    await page.keyboard.press('Escape')
    await expect(panel).toBeVisible()
  })

  test('the looks-ready snapshot shows the verdict header and six signal rows', async ({ page }) => {
    await page.goto(reviewUrl(DOC.midnight))
    const panel = resultsPanel(page)
    await expect(panel).toBeVisible()
    await expect(panel.getByRole('heading', { name: 'Looks ready' })).toBeVisible()
    await expect(panel.getByText('0 of 6 need attention')).toBeVisible()
    await expect(panel.locator('[data-signal-id]')).toHaveCount(6)
  })
})
