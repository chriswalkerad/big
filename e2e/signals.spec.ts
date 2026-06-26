import { test, expect } from '@playwright/test'

const SIGNALS_URL = '/settings/signals'

test.describe('Signal admin CRUD', () => {
  test('lists the six seeded signals', async ({ page }) => {
    await page.goto(SIGNALS_URL)
    const list = page.getByRole('list', { name: 'Signals' })
    await expect(list).toBeVisible()
    for (const name of [
      'Clarity',
      'Completeness',
      'Brand Safety',
      'Hook Strength',
      'Character Distinctiveness',
      'Franchise Fit',
    ]) {
      await expect(list.getByText(name, { exact: true })).toBeVisible()
    }
  })

  test('creates a new signal that persists across reload', async ({ page }) => {
    await page.goto(SIGNALS_URL)
    await page.getByRole('button', { name: 'New Signal' }).click()

    const form = page.getByRole('form', { name: 'Create signal' })
    await form.getByLabel('Name').fill('Originality')
    await form.getByLabel('Prompt').fill('Judge whether the concept feels fresh and not derivative. Score 0-100.')
    await form.getByLabel(/Threshold/).fill('60')
    // Mode is the shared Select (a listbox of options), not a native <select>: open it
    // from its labelled trigger and pick the option.
    await form.getByRole('button', { name: /Mode/ }).click()
    await page.getByRole('option', { name: 'Document' }).click()
    await form.getByRole('button', { name: 'Create signal' }).click()

    const list = page.getByRole('list', { name: 'Signals' })
    await expect(list.getByText('Originality', { exact: true })).toBeVisible()

    // Persisted through StorageRepository: still there after a reload.
    await page.reload()
    await expect(page.getByRole('list', { name: 'Signals' }).getByText('Originality', { exact: true })).toBeVisible()
  })

  test('edits a signal and persists the change', async ({ page }) => {
    await page.goto(SIGNALS_URL)
    await page.getByRole('button', { name: 'Edit Clarity' }).click()

    const form = page.getByRole('form', { name: 'Edit signal' })
    const threshold = form.getByLabel(/Threshold/)
    // Thresholds are on a 0–100 scale; Clarity seeds at 70.
    await expect(threshold).toHaveValue('70')
    await threshold.fill('90')
    await form.getByRole('button', { name: 'Save changes' }).click()

    // Reload and re-open to confirm the new threshold persisted.
    await page.reload()
    await expect(
      page.getByRole('list', { name: 'Signals' }).getByText('threshold 90'),
    ).toBeVisible()
  })

  test('deletes a signal only after confirmation', async ({ page }) => {
    await page.goto(SIGNALS_URL)
    await page.getByRole('button', { name: 'Delete Franchise Fit' }).click()

    // A confirmation dialog appears before anything is removed.
    const confirm = page.getByRole('dialog')
    await expect(confirm.getByRole('heading', { name: 'Delete signal' })).toBeVisible()
    await confirm.getByRole('button', { name: 'Delete' }).click()

    // The signal is gone, and stays gone after reload.
    const list = page.getByRole('list', { name: 'Signals' })
    await expect(list.getByText('Franchise Fit', { exact: true })).toHaveCount(0)
    await page.reload()
    await expect(
      page.getByRole('list', { name: 'Signals' }).getByText('Franchise Fit', { exact: true }),
    ).toHaveCount(0)
  })
})
