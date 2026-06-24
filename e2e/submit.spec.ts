import { test, expect } from '@playwright/test'
import { DOC, docUrl, drawer, typeInBody } from './helpers'

const SAMPLE_BODY =
  ' Eloise organizes a treasure hunt across the Plaza for the bored children of weekend guests, ' +
  'leaving witty riddles at the concierge desk and the rooftop garden. A 5-minute animated short ' +
  'for kids 6-12, built as a YouTube pilot with a warm, playful tone.'

test.describe('Submit flow', () => {
  test('Submit button runs the review and slides up the results drawer', async ({ page }) => {
    await page.goto(docUrl(DOC.rooftop))

    // The draft stub is editable and has no drawer yet.
    await expect(page.getByRole('button', { name: 'Submit' })).toBeVisible()
    await expect(drawer(page)).toBeHidden()

    await typeInBody(page, SAMPLE_BODY)
    await page.getByRole('button', { name: 'Submit' }).click()

    // Drawer slides up with a verdict header and exactly six signal rows.
    const d = drawer(page)
    await expect(d).toBeVisible()
    const verdict = d.getByRole('heading', { level: 2 })
    await expect(verdict).toHaveAttribute('data-verdict', /looks_ready|needs_work|not_ready/)
    await expect(d.getByText(/of 6 need attention/)).toBeVisible()

    // Six signal rows, one per seeded signal.
    for (const name of [
      'Clarity',
      'Completeness',
      'Brand Safety',
      'Hook Strength',
      'Character Distinctiveness',
      'Franchise Fit',
    ]) {
      await expect(d.getByText(name, { exact: true })).toBeVisible()
    }
    await expect(d.locator('[data-signal-id]')).toHaveCount(6)

    // Status advances draft → Submitted.
    await expect(page.getByText('Submitted', { exact: true })).toBeVisible()
  })

  test('Cmd/Ctrl+Enter submits the document', async ({ page }) => {
    await page.goto(docUrl(DOC.rooftop))
    await typeInBody(page, SAMPLE_BODY)

    // Keyboard shortcut, not the button.
    await page.keyboard.press('ControlOrMeta+Enter')

    const d = drawer(page)
    await expect(d).toBeVisible()
    await expect(d.locator('[data-signal-id]')).toHaveCount(6)
    await expect(d.getByText(/of 6 need attention/)).toBeVisible()
  })

  test('empty draft gets an AI-suggested title and themes on submit', async ({ page }) => {
    await page.goto(docUrl(DOC.rooftop))
    // Clear the title so prefill can fill it.
    const title = page.getByLabel('Title')
    await title.fill('')
    await typeInBody(page, SAMPLE_BODY, true)
    await page.getByRole('button', { name: 'Submit' }).click()

    await expect(drawer(page)).toBeVisible()
    // The title is filled from the AI suggestion (no longer empty).
    await expect(title).not.toHaveValue('')
  })
})
