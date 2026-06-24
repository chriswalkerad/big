import { test, expect } from '@playwright/test'
import { LIBRARY_URL } from './helpers'

test.describe('Project library', () => {
  test('/ redirects to the seeded project library', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveURL(new RegExp(`/p/proj-eloise$`))
    await expect(page.getByRole('heading', { name: 'Eloise at The Plaza' })).toBeVisible()

    // The four seeded documents are present on first load.
    const list = page.getByRole('list').filter({ hasText: 'Eloise and the Midnight' })
    await expect(page.getByRole('link', { name: 'Eloise and the Midnight Room-Service Caper' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'A New Friend at the Plaza' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Eloise and the Haunted Service Elevator' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Rooftop idea' })).toBeVisible()
    expect(await list.getByRole('listitem').count()).toBe(4)
  })

  test('search narrows the list by title and body', async ({ page }) => {
    await page.goto(LIBRARY_URL)
    const search = page.getByRole('searchbox', { name: 'Search documents' })

    // Title match.
    await search.fill('midnight')
    await expect(page.getByRole('link', { name: 'Eloise and the Midnight Room-Service Caper' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'A New Friend at the Plaza' })).toHaveCount(0)

    // Body match ("body count" only appears in the Haunted Elevator body).
    await search.fill('body count')
    await expect(page.getByRole('link', { name: 'Eloise and the Haunted Service Elevator' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Eloise and the Midnight Room-Service Caper' })).toHaveCount(0)

    // No match → empty state.
    await search.fill('zzzznotathing')
    await expect(page.getByText('No matching documents')).toBeVisible()

    // Clearing restores all four.
    await search.fill('')
    await expect(page.getByRole('link', { name: 'Eloise and the Midnight Room-Service Caper' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Rooftop idea' })).toBeVisible()
  })

  test('status filter narrows the list', async ({ page }) => {
    await page.goto(LIBRARY_URL)
    const filter = page.getByRole('combobox', { name: 'Filter by status' })

    // Draft → only the Rooftop stub.
    await filter.selectOption({ label: 'Draft' })
    await expect(page.getByRole('link', { name: 'Rooftop idea' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Eloise and the Midnight Room-Service Caper' })).toHaveCount(0)

    // Changes Requested → only the Haunted Elevator.
    await filter.selectOption({ label: 'Changes Requested' })
    await expect(page.getByRole('link', { name: 'Eloise and the Haunted Service Elevator' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Rooftop idea' })).toHaveCount(0)

    // Clearing the filter restores all four.
    await filter.selectOption({ label: 'All statuses' })
    await expect(page.getByRole('link', { name: 'Eloise and the Midnight Room-Service Caper' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Rooftop idea' })).toBeVisible()
  })

  test('Account breadcrumb opens the project-switcher stub popup', async ({ page }) => {
    await page.goto(LIBRARY_URL)
    await page.getByRole('button', { name: 'Account' }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await expect(dialog.getByText(/switch projects or manage the account/i)).toBeVisible()
  })
})
