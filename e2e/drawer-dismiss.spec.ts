import { test, expect } from '@playwright/test'
import { DOC, openReviewPanel, resultsPanel, reviewUrl } from './helpers'

test.describe('Inline review panel (read mode)', () => {
  test('the review panel is an inline, non-modal panel — the editor stays reachable', async ({ page }) => {
    await page.goto(reviewUrl(DOC.midnight))

    // The detail panel is collapsed by default; open it from the meta-row toggle.
    await openReviewPanel(page)
    const panel = resultsPanel(page)
    await expect(panel).toBeVisible()

    // It is an inline side panel, NOT a modal bottom-sheet: no scrim/focus-trap, so the
    // document canvas beside it remains in the a11y tree and reachable while it is open.
    await expect(page.locator('.document-canvas-prose')).toBeVisible()

    // It collapses back to the slim strip via its own close affordance (not a global
    // "Dismiss results" control).
    await expect(panel.getByRole('button', { name: 'Dismiss results' })).toHaveCount(0)
    await panel.getByRole('button', { name: 'Close review details' }).click()
    await expect(resultsPanel(page)).toHaveCount(0)
  })

  test('the looks-ready snapshot shows the verdict header and six signal rows', async ({ page }) => {
    await page.goto(reviewUrl(DOC.midnight))
    await openReviewPanel(page)
    const panel = resultsPanel(page)
    await expect(panel.getByRole('heading', { name: 'Looks ready' })).toBeVisible()
    await expect(panel.getByText('0 of 6 need attention')).toBeVisible()
    await expect(panel.locator('[data-signal-id]')).toHaveCount(6)
  })
})
