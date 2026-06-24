import { test, expect } from '@playwright/test'
import { DOC, reviewUrl } from './helpers'

test.describe('Reviewer flow (read mode)', () => {
  test('changing the review status updates the control', async ({ page }) => {
    await page.goto(reviewUrl(DOC.newFriend))

    const statusControl = page.getByRole('button', { name: 'Change review status' })
    await expect(statusControl).toContainText('Submitted')

    await statusControl.click()
    await page.getByRole('menuitem', { name: 'In Review' }).click()

    await expect(statusControl).toContainText('In Review')
  })

  test('Approve opens the destination picker and records routing', async ({ page }) => {
    await page.goto(reviewUrl(DOC.newFriend))

    await page.getByRole('button', { name: 'Change review status' }).click()
    await page.getByRole('menuitem', { name: 'Approved' }).click()

    // The destination picker opens, defaulting to Digital Test.
    const picker = page.getByRole('dialog', { name: 'Choose a destination' })
    await expect(picker).toBeVisible()
    await expect(picker.getByRole('radio', { name: 'Digital Test' })).toBeChecked()

    // Pick a different destination and confirm.
    await picker.getByRole('radio', { name: 'Animation' }).check()
    await picker.getByRole('button', { name: 'Approve' }).click()

    // Status becomes Approved and the routing note reflects the choice.
    await expect(page.getByRole('button', { name: 'Change review status' })).toContainText('Approved')
    await expect(page.getByText(/Routed to/)).toContainText('Animation')
  })

  test('a copy-link affordance is present in read mode', async ({ page }) => {
    await page.goto(reviewUrl(DOC.midnight))
    await expect(page.getByRole('button', { name: 'Copy link' })).toBeVisible()
  })
})
