import { defineConfig, devices } from '@playwright/test';

const BACKEND_PORT = 3000;
const FRONTEND_PORT = 5173;

export default defineConfig({
  testDir: './tests',
  // Serial by default — tests share a single backend process (SQLite in-memory
  // or dev MySQL). Parallel would race on auth / question ordering.
  fullyParallel: false,
  workers: 1,
  // Fail fast in CI, keep local debuggable.
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: `http://localhost:${FRONTEND_PORT}`,
    // Pin browser locale so i18next's language detector picks zh-CN regardless
    // of the host machine — keeps existing Chinese-text assertions stable.
    locale: 'zh-CN',
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: [
    {
      // Backend: if a dev server is already on :3000 (e.g. local MySQL dev),
      // reuse it — unique usernames per test avoid collisions. Otherwise
      // Playwright launches one in NODE_ENV=test (SQLite in-memory, fresh
      // schema each run). dotenv won't overwrite an env var that's already
      // set, so NODE_ENV=test wins over .env's NODE_ENV=development.
      command: 'npm --prefix ../backend run dev',
      port: BACKEND_PORT,
      env: { NODE_ENV: 'test' },
      reuseExistingServer: true,
      timeout: 60_000,
      stdout: 'ignore',
      stderr: 'pipe',
    },
    {
      command: 'npm --prefix ../frontend run dev',
      port: FRONTEND_PORT,
      reuseExistingServer: true,
      timeout: 60_000,
      stdout: 'ignore',
      stderr: 'pipe',
    },
  ],
});
