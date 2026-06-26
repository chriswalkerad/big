import { test, expect } from '@playwright/test'
import { LIBRARY_URL } from './helpers'

test.describe('Project library', () => {
  test('/ redirects to the seeded project library', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveURL(new RegExp(`/p/proj-eloise$`))
    await expect(page.getByRole('heading', { name: 'Eloise at The Plaza' })).toBeVisible()

    // The seeded documents are present on first load. The document list is the only list
    // whose rows link to an existing document (`/d/<id>`); the rail's "Compose" links to
    // `/d/new`, which we exclude, so the remaining `/d/` links are exactly the library
    // rows (eight seeded docs).
    await expect(page.getByRole('link', { name: 'Eloise and the Midnight Room-Service Caper' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'A New Friend at the Plaza' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Eloise and the Haunted Service Elevator' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Rooftop idea' })).toBeVisible()
    const docLinks = page.locator(`main a[href*="/d/"]:not([href$="/d/new"])`)
    expect(await docLinks.count()).toBe(8)
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
    // The status filter is the shared Select (a listbox of options), not a native
    // <select>: its trigger's accessible name is "Filter by status <current value>".
    const filter = page.getByRole('button', { name: /Filter by status/ })

    const pick = async (label: string) => {
      await filter.click()
      await page.getByRole('option', { name: label, exact: true }).click()
    }

    // Draft → only the Rooftop stub.
    await pick('Draft')
    await expect(page.getByRole('link', { name: 'Rooftop idea' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Eloise and the Midnight Room-Service Caper' })).toHaveCount(0)

    // Changes Requested → only the Haunted Elevator.
    await pick('Changes Requested')
    await expect(page.getByRole('link', { name: 'Eloise and the Haunted Service Elevator' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Rooftop idea' })).toHaveCount(0)

    // Clearing the filter (the "All" sentinel) restores all four.
    await pick('All')
    await expect(page.getByRole('link', { name: 'Eloise and the Midnight Room-Service Caper' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Rooftop idea' })).toBeVisible()
  })

  test('the left-rail Account control opens the project-switcher stub dialog', async ({ page }) => {
    await page.goto(LIBRARY_URL)
    // Account moved out of the old breadcrumb into the left-nav rail; it opens the same
    // account/project-switcher stub dialog.
    await page.getByRole('button', { name: 'Account' }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await expect(dialog.getByText(/switch projects or manage the account/i)).toBeVisible()
  })
})
