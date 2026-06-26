import { test, expect, type Page } from '@playwright/test'
import { DOC, confirmSubmission, docUrl, resultsPanel, typeInBody } from './helpers'

const BODY =
  ' Eloise stages a surprise birthday breakfast for the night doorman, recruiting the kitchen ' +
  'staff and a very sleepy bellhop. A warm 6-minute animated short for kids 6-12, built as a YouTube pilot.'

/**
 * Submit the draft stub so it has a snapshot to drift from. The submit is now three
 * steps: Run review produces a preview, Confirm submission opens an in-panel
 * choose-reviewer view, and submitting there with the chosen reviewer commits it
 * (Draft → Submitted). There is no post-submit celebration overlay to dismiss.
 */
async function submitDraft(page: Page) {
  await page.goto(docUrl(DOC.rooftop))
  await typeInBody(page, BODY)
  await page.getByRole('button', { name: 'Run review' }).click()

  const panel = resultsPanel(page)
  await expect(panel.locator('[data-signal-id]')).toHaveCount(6)
  await confirmSubmission(page)
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
    await expect(panel.getByRole('button', { name: 'Confirm submission' })).toBeVisible()
    await expect(page.getByText('Submitted', { exact: true })).toBeVisible()

    // Confirming (pick a reviewer → submit) replaces the snapshot with the current body
    // and keeps the status Submitted; the snapshot now matches the body → drift clears.
    await confirmSubmission(page)
    await expect(drift).toHaveCount(0)
  })

  test('Unsubmit clears the review, tears down the panel, and returns to Draft', async ({ page }) => {
    await submitDraft(page)
    await typeInBody(page, ' Extra drift text for the unsubmit path.')

    const drift = page.getByRole('status').filter({ hasText: 'Edited since submit' })
    await drift.getByRole('button', { name: 'Unsubmit' }).click()

    // Unsubmit clears the snapshot review entirely: the inline panel (which only mounts
    // while there is review content) unmounts, the status returns to Draft, and the drift
    // indicator is gone.
    await expect(resultsPanel(page)).toHaveCount(0)
    await expect(page.getByText('Draft', { exact: true })).toBeVisible()
    await expect(drift).toHaveCount(0)
  })
})
