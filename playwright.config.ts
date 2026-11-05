import { defineConfig, devices } from '@playwright/test'

// E2E tests run against a production build that points at a fake Supabase
// host. Every Supabase request is intercepted in e2e/mock.ts, so no real
// project or network access is needed.
const PORT = 4174

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  use: { baseURL: `http://localhost:${PORT}` },
  webServer: {
    command: `vite build --outDir dist-e2e && vite preview --outDir dist-e2e --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: false,
    env: {
      VITE_SUPABASE_URL: 'http://mock-supabase.test',
      VITE_SUPABASE_ANON_KEY: 'test-anon-key',
      VITE_PUBLIC_BASE_URL: '',
    },
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile-webkit', use: { ...devices['iPhone 13'] } },
  ],
})
