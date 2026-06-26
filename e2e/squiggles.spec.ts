import { test, expect } from '@playwright/test'
import { DOC, openReviewPanel, resultsPanel, reviewUrl } from './helpers'

test.describe('Inline squiggles & bidirectional focus', () => {
  test('inline signals render squiggles for the seeded risky doc', async ({ page }) => {
    await page.goto(reviewUrl(DOC.haunted))

    // The squiggles render onto the canvas from the snapshot on load — independent of the
    // review detail panel, which is collapsed by default.
    // Two Brand Safety risk squiggles render in the body.
    const squiggles = page.locator('.document-canvas-prose .signal-highlight[data-signal-id="brand_safety"]')
    await expect(squiggles).toHaveCount(2)
    await expect(
      page.locator('.signal-highlight', { hasText: "they're never seen again" }),
    ).toBeVisible()
    await expect(
      page.locator('.signal-highlight', { hasText: 'a rising body count as the hotel empties out' }),
    ).toBeVisible()

    // Each squiggle carries its severity + the rationale tooltip (title attr).
    const first = squiggles.first()
    await expect(first).toHaveAttribute('data-severity', 'risk')
    await expect(first).toHaveAttribute('title', /.+/)
  })

  test('clicking a squiggle focuses its panel row', async ({ page }) => {
    await page.goto(reviewUrl(DOC.haunted))
    await openReviewPanel(page)

    const brandRow = resultsPanel(page).locator('[data-signal-id="brand_safety"]')
    await expect(brandRow).not.toHaveAttribute('data-focused', 'true')

    // Scroll the squiggle up under the sticky header before clicking it.
    const squiggle = page
      .locator('.document-canvas-prose .signal-highlight[data-signal-id="brand_safety"]')
      .first()
    await squiggle.evaluate((el) => el.scrollIntoView({ block: 'start' }))
    await page.mouse.wheel(0, -120)
    await squiggle.click()

    // The Brand Safety panel row becomes focused.
    await expect(brandRow).toHaveAttribute('data-focused', 'true')
  })

  test('clicking a panel flagged phrase emphasizes the matching squiggle', async ({ page }) => {
    await page.goto(reviewUrl(DOC.haunted))
    await openReviewPanel(page)

    // Click the flagged-phrase button inside the Brand Safety row.
    const phraseButton = resultsPanel(page)
      .locator('[data-signal-id="brand_safety"]')
      .getByRole('button', { name: /never seen again/ })
    await phraseButton.click()

    // The matching squiggle gets the transient focus class.
    const focused = page.locator('.signal-highlight.signal-highlight--focus')
    await expect(focused).toBeVisible()
    await expect(focused).toContainText("they're never seen again")
  })
})
