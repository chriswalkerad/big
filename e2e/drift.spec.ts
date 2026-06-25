import { test, expect, type Page } from '@playwright/test'
import { DOC, docUrl, resultsPanel, typeInBody } from './helpers'

const BODY =
  ' Eloise stages a surprise birthday breakfast for the night doorman, recruiting the kitchen ' +
  'staff and a very sleepy bellhop. A warm 6-minute animated short for kids 6-12, built as a YouTube pilot.'

/** Dismiss the post-confirm GREENLIGHT celebration overlay so it stops covering the page. */
async function dismissCelebration(page: Page) {
  // The celebration is a full-screen role="dialog" that auto-dismisses; Escape skips it.
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog', { name: 'Submission confirmed' })).toHaveCount(0)
}

/**
 * Submit the draft stub so it has a snapshot to drift from. The submit is now two steps:
 * Run review produces a preview, then Confirm submission commits it (Draft → Submitted).
 */
async function submitDraft(page: Page) {
  await page.goto(docUrl(DOC.rooftop))
  await typeInBody(page, BODY)
  await page.getByRole('button', { name: 'Run review' }).click()

  const panel = resultsPanel(page)
  await expect(panel.locator('[data-signal-id]')).toHaveCount(6)
  await panel.getByRole('button', { name: 'Confirm submission' }).click()

  await expect(page.getByText('Submitted', { exact: true })).toBeVisible()
  await dismissCelebration(page)
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

  test('Resubmit re-runs the review preview; confirming keeps the status Submitted', async ({ page }) => {
    await submitDraft(page)
    await typeInBody(page, ' Extra drift text for the resubmit path.')

    const drift = page.getByRole('status').filter({ hasText: 'Edited since submit' })
    // Resubmit re-runs the review as a preview — the snapshot is not yet replaced, so the
    // drift indicator is still present and the panel offers a fresh Confirm submission.
    await drift.getByRole('button', { name: 'Resubmit' }).click()

    const panel = resultsPanel(page)
    await expect(panel.locator('[data-signal-id]')).toHaveCount(6)
    const confirm = panel.getByRole('button', { name: 'Confirm submission' })
    await expect(confirm).toBeVisible()
    await expect(page.getByText('Submitted', { exact: true })).toBeVisible()

    // Confirming replaces the snapshot with the current body and keeps status Submitted.
    await confirm.click()
    await expect(page.getByText('Submitted', { exact: true })).toBeVisible()
    await dismissCelebration(page)
    // The snapshot now matches the body again → drift clears.
    await expect(drift).toHaveCount(0)
  })

  test('Unsubmit clears the review, empties the panel, and returns to Draft', async ({ page }) => {
    await submitDraft(page)
    await typeInBody(page, ' Extra drift text for the unsubmit path.')

    const drift = page.getByRole('status').filter({ hasText: 'Edited since submit' })
    await drift.getByRole('button', { name: 'Unsubmit' }).click()

    // The inline panel stays mounted but clears back to its empty placeholder, the status
    // returns to Draft, and the drift indicator is gone.
    const panel = resultsPanel(page)
    await expect(panel.getByText('No review yet.')).toBeVisible()
    await expect(panel.locator('[data-signal-id]')).toHaveCount(0)
    await expect(page.getByText('Draft', { exact: true })).toBeVisible()
    await expect(drift).toHaveCount(0)
  })
})
