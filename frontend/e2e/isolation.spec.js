import { test, expect } from './fixtures.js';

// Proves the jail itself works — if this ever fails, no other E2E result can be trusted.
test.describe('production isolation', () => {
  test('a request to a production host is aborted and recorded (never reaches the network)', async ({ page, api }) => {
    await page.goto('/');
    const outcome = await page.evaluate(async () => {
      try { await fetch('https://taskflow-backend.unimisk.com/functions/v1/api/', { mode: 'no-cors' }); return 'reached'; } catch { return 'blocked'; }
    });
    expect(outcome).toBe('blocked');
    expect(api.violations).toHaveLength(1);
    api.violations.length = 0; // expected here; other tests assert this stays empty
  });

  test('arbitrary external hosts are blocked too', async ({ page, api }) => {
    await page.goto('/');
    const outcome = await page.evaluate(async () => {
      try { await fetch('https://example.org/', { mode: 'no-cors' }); return 'reached'; } catch { return 'blocked'; }
    });
    expect(outcome).toBe('blocked');
    expect(api.blocked.some((u) => u.startsWith('https://example.org'))).toBe(true);
  });

  test('config refuses a production base URL', async () => {
    const { spawnSync } = await import('node:child_process');
    const r = spawnSync(process.execPath, ['-e', "import('./playwright.config.js')"], {
      env: { ...process.env, E2E_BASE_URL: 'https://taskflow-backend.unimisk.com' }, encoding: 'utf8',
    });
    expect(r.status).not.toBe(0);
    expect(r.stderr).toMatch(/E2E refused/);
  });

  test('config refuses a production API URL in the environment', async () => {
    const { spawnSync } = await import('node:child_process');
    const r = spawnSync(process.execPath, ['-e', "import('./playwright.config.js')"], {
      env: { ...process.env, VITE_API_URL: 'https://taskflow-backend.unimisk.com/api' }, encoding: 'utf8',
    });
    expect(r.status).not.toBe(0);
    expect(r.stderr).toMatch(/production host/);
  });
});
