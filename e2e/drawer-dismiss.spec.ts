import { test, expect } from '@playwright/test'
import { DOC, drawer, reviewUrl } from './helpers'

test.describe('Results drawer dismissal', () => {
  test('Escape closes the drawer', async ({ page }) => {
    await page.goto(reviewUrl(DOC.midnight))
    const d = drawer(page)
    await expect(d).toBeVisible()

    await page.keyboard.press('Escape')
    await expect(d).toBeHidden()
  })

  test('the close button closes the drawer', async ({ page }) => {
    await page.goto(reviewUrl(DOC.midnight))
    const d = drawer(page)
    await expect(d).toBeVisible()

    await d.getByRole('button', { name: 'Dismiss results' }).click()
    await expect(d).toBeHidden()
  })

  test('the looks-ready snapshot shows the verdict header and six signal rows', async ({ page }) => {
    await page.goto(reviewUrl(DOC.midnight))
    const d = drawer(page)
    await expect(d).toBeVisible()
    await expect(d.getByRole('heading', { name: 'Looks ready' })).toBeVisible()
    await expect(d.getByText('0 of 6 need attention')).toBeVisible()
    await expect(d.locator('[data-signal-id]')).toHaveCount(6)
  })
})
