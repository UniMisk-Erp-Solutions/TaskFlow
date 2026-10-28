// Playwright E2E. SAFE BY CONSTRUCTION — these tests can never touch production data:
//   * the app under test is the CI build served by `vite preview` on 127.0.0.1,
//   * its API/Supabase URLs are inert 127.0.0.1:4010 values (see ci/pipeline/config.mjs CI_BUILD_ENV),
//   * every test runs behind a network jail (e2e/fixtures.js) that answers 127.0.0.1:4010 from
//     synthetic fixtures and aborts any other host, and fails if a production host is ever requested.
// This file additionally refuses to start if it is pointed anywhere but loopback or an explicitly
// allow-listed staging host, or if the build env contains a production hostname.
import { defineConfig } from '@playwright/test';

const PRODUCTION_HOSTS = ['taskflow-backend.unimisk.com', 'taskflow-api.unimisk.com'];
const PORT = Number(process.env.E2E_PORT || 4173);
const baseURL = process.env.E2E_BASE_URL || `http://127.0.0.1:${PORT}`;
const host = new URL(baseURL).hostname;
const stagingAllow = (process.env.E2E_ALLOWED_STAGING_HOST || '').toLowerCase();

const isLoopback = host === '127.0.0.1' || host === 'localhost' || host.endsWith('.localhost');
if (!isLoopback && !(stagingAllow && host.toLowerCase() === stagingAllow)) {
  throw new Error(`E2E refused: ${host} is not loopback and not E2E_ALLOWED_STAGING_HOST.`);
}
for (const [k, v] of Object.entries(process.env)) {
  if (/^(VITE_|E2E_)/.test(k) && PRODUCTION_HOSTS.some((h) => String(v).toLowerCase().includes(h))) {
    throw new Error(`E2E refused: ${k} points at a production host.`);
  }
}

export default defineConfig({
  testDir: './e2e',
  timeout: 45_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  workers: Number(process.env.E2E_WORKERS) || 2, // the CI agent has 2 CPUs and 4 GB: more Chromium instances crash it
  forbidOnly: !!process.env.CI,
  retries: 0, // a flaky gate is a broken gate: no silent retries
  reporter: process.env.CI ? [['list'], ['json', { outputFile: '../.ci/playwright.json' }]] : [['list']],
  use: { baseURL, trace: 'retain-on-failure', screenshot: 'only-on-failure', serviceWorkers: 'block', launchOptions: { args: process.env.PLAYWRIGHT_NO_SANDBOX ? ['--no-sandbox', '--disable-dev-shm-usage'] : [] } },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
  webServer: isLoopback ? {
    command: `npx vite preview --host 127.0.0.1 --port ${PORT} --strictPort`,
    url: baseURL,
    reuseExistingServer: false,
    timeout: 60_000,
  } : undefined,
});
