import { test, expect } from '@playwright/test'
import { DOC, confirmSubmission, docUrl, resultsPanel, typeInBody } from './helpers'

const SAMPLE_BODY =
  ' Eloise organizes a treasure hunt across the Plaza for the bored children of weekend guests, ' +
  'leaving witty riddles at the concierge desk and the rooftop garden. A 5-minute animated short ' +
  'for kids 6-12, built as a YouTube pilot with a warm, playful tone.'

test.describe('Submit flow (review preview → confirm)', () => {
  test('Run review previews the verdict, then Confirm submission commits', async ({ page }) => {
    await page.goto(docUrl(DOC.rooftop))

    // The draft stub is editable. The inline review panel is not mounted until a review
    // is run (it only renders once there is review content), so there is no panel and no
    // confirm affordance yet — just the draft status and the Run-review action.
    await expect(page.getByRole('button', { name: 'Run review' })).toBeVisible()
    const panel = resultsPanel(page)
    await expect(panel).toHaveCount(0)
    await expect(page.getByText('Draft', { exact: true })).toBeVisible()

    await typeInBody(page, SAMPLE_BODY)
    await page.getByRole('button', { name: 'Run review' }).click()

    // The panel populates with a verdict header and exactly six signal rows.
    await expect(panel).toBeVisible()
    const verdict = panel.getByRole('heading', { level: 2 })
    await expect(verdict).toHaveAttribute('data-verdict', /looks_ready|needs_work|not_ready/)
    await expect(panel.getByText(/of 6 need attention/)).toBeVisible()

    // Six signal rows, one per seeded signal.
    for (const name of [
      'Clarity',
      'Completeness',
      'Brand Safety',
      'Hook Strength',
      'Character Distinctiveness',
      'Franchise Fit',
    ]) {
      await expect(panel.getByText(name, { exact: true })).toBeVisible()
    }
    await expect(panel.locator('[data-signal-id]')).toHaveCount(6)

    // This is a preview only — nothing is submitted yet, so the status is still Draft and
    // the panel offers a Confirm submission action.
    await expect(page.getByText('Draft', { exact: true })).toBeVisible()
    await expect(panel.getByRole('button', { name: 'Confirm submission' })).toBeVisible()

    // Confirm opens the in-panel choose-reviewer view; picking a reviewer there and
    // submitting commits: status advances Draft → Submitted and the confirm affordance
    // disappears (the panel now reflects a snapshot, not a preview).
    await confirmSubmission(page)
    await expect(panel.getByRole('button', { name: 'Confirm submission' })).toHaveCount(0)
  })

  test('Cmd/Ctrl+Enter runs the review, then Confirm submission commits', async ({ page }) => {
    await page.goto(docUrl(DOC.rooftop))
    await typeInBody(page, SAMPLE_BODY)

    // Keyboard shortcut runs the review (the preview), not the button.
    await page.keyboard.press('ControlOrMeta+Enter')

    const panel = resultsPanel(page)
    await expect(panel.locator('[data-signal-id]')).toHaveCount(6)
    await expect(panel.getByText(/of 6 need attention/)).toBeVisible()
    // Still a preview: Draft, with a confirm action awaiting commit.
    await expect(page.getByText('Draft', { exact: true })).toBeVisible()

    // Confirm submission → pick a reviewer → submit commits the keyboard-driven preview.
    await confirmSubmission(page)
  })

  test('empty draft gets an AI-suggested title on confirm', async ({ page }) => {
    await page.goto(docUrl(DOC.rooftop))
    // Clear the title so the submit prefill can fill it.
    const title = page.getByLabel('Title')
    await title.fill('')
    await typeInBody(page, SAMPLE_BODY, true)

    // Run review previews without prefilling; confirm performs the prefill.
    await page.getByRole('button', { name: 'Run review' }).click()
    const panel = resultsPanel(page)
    await expect(panel.locator('[data-signal-id]')).toHaveCount(6)
    // The preview alone does not prefill the title.
    await expect(title).toHaveValue('')

    await confirmSubmission(page)
    // The title is filled from the AI suggestion (no longer empty) once confirmed.
    await expect(title).not.toHaveValue('')
  })
})
