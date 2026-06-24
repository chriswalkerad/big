import { test, expect } from '@playwright/test'
import { DOC, docUrl, resultsPanel, typeInBody } from './helpers'

const BODY =
  ' Eloise stages a surprise birthday breakfast for the night doorman, recruiting the kitchen ' +
  'staff and a very sleepy bellhop. A warm 6-minute animated short for kids 6-12, built as a YouTube pilot.'

/** Submit the draft stub so it has a snapshot to drift from. */
async function submitDraft(page: import('@playwright/test').Page) {
  await page.goto(docUrl(DOC.rooftop))
  await typeInBody(page, BODY)
  await page.getByRole('button', { name: 'Submit' }).click()
  await expect(resultsPanel(page)).toBeVisible()
  await expect(page.getByText('Submitted', { exact: true })).toBeVisible()
}

test.describe('Version drift', () => {
  test('editing a submitted doc surfaces the drift indicator with Resubmit/Unsubmit', async ({ page }) => {
    await submitDraft(page)

    // No drift yet.
    await expect(page.getByRole('status').filter({ hasText: 'Edited since submit' })).toHaveCount(0)

    // Edit the body → drift indicator appears.
    await typeInBody(page, ' One more sentence to create drift from the submitted snapshot.')
    const drift = page.getByRole('status').filter({ hasText: 'Edited since submit' })
    await expect(drift).toBeVisible()
    await expect(drift.getByRole('button', { name: 'Resubmit' })).toBeVisible()
    await expect(drift.getByRole('button', { name: 'Unsubmit' })).toBeVisible()
  })

  test('Resubmit re-runs the review and keeps the status Submitted', async ({ page }) => {
    await submitDraft(page)
    await typeInBody(page, ' Extra drift text for the resubmit path.')

    const drift = page.getByRole('status').filter({ hasText: 'Edited since submit' })
    await drift.getByRole('button', { name: 'Resubmit' }).click()

    // The drawer updates with a fresh review (six rows) and status stays Submitted.
    await expect(resultsPanel(page).locator('[data-signal-id]')).toHaveCount(6)
    await expect(page.getByText('Submitted', { exact: true })).toBeVisible()
    // After resubmit the snapshot matches the body again → drift clears.
    await expect(drift).toHaveCount(0)
  })

  test('Unsubmit clears the review, hides the drawer, and returns to Draft', async ({ page }) => {
    await submitDraft(page)
    await typeInBody(page, ' Extra drift text for the unsubmit path.')

    const drift = page.getByRole('status').filter({ hasText: 'Edited since submit' })
    await drift.getByRole('button', { name: 'Unsubmit' }).click()

    // Drawer closes, status back to Draft, drift indicator gone.
    await expect(resultsPanel(page)).toBeHidden()
    await expect(page.getByText('Draft', { exact: true })).toBeVisible()
    await expect(drift).toHaveCount(0)
  })
})
