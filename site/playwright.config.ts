import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 120_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  globalSetup: './tests/e2e/global-setup.ts',
  use: { baseURL: 'http://localhost:5174', trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], channel: 'chrome' } },
    { name: 'mobile', use: { ...devices['Pixel 7'], channel: 'chrome' } },
  ],
  webServer: [
    { command: 'npx tsx --env-file=.env.e2e server/index.ts', url: 'http://localhost:8788/api/health/ready', reuseExistingServer: false, timeout: 60_000 },
    { command: 'npx tsx --env-file=.env.e2e server/worker.ts', reuseExistingServer: false, timeout: 60_000, wait: { stdout: /worker ready/ } },
    { command: 'API_PORT=8788 npx vite --port 5174 --strictPort', url: 'http://localhost:5174', reuseExistingServer: false, timeout: 60_000 },
  ],
})
