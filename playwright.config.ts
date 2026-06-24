import { defineConfig, devices } from '@playwright/test'

/**
 * Playwright e2e config for Creative Review Workspace (EPIC 17 QA / BIG-21).
 *
 * The app is zero-config and deterministic (MockProvider, no env vars). Each test
 * runs in Playwright's own isolated browser context, so localStorage starts empty
 * and StorageRepository re-seeds the four seed docs + six signals per test — no
 * cross-test contamination, no pollution of a real browser profile.
 *
 * `webServer.reuseExistingServer` is true so we attach to whatever `next dev` is
 * already serving on :3000 instead of failing on a busy port; if none is running,
 * Playwright starts one.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1,
  workers: process.env.CI ? 1 : undefined,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: true,
    timeout: 120_000,
  },
})
