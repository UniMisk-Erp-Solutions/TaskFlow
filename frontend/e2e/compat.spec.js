import { test, expect, expectNoProductionContact } from './fixtures.js';

// Guards the dependency overrides in package.json (nanoid, lodash-es) and the Vite major used to bundle
// them: the whiteboard is the page that loads @excalidraw/excalidraw (and, through it, mermaid and nanoid).
test.describe('dependency compatibility (real browser, synthetic API)', () => {
  test('whiteboard (Excalidraw) loads without runtime errors', async ({ page, api }) => {
    const errors = [];
    // registerSW.js reads `registration.waiting`; the suite blocks service workers (so they cannot bypass the
    // network jail), which makes that pre-existing line throw. It is unrelated to the dependencies under test.
    page.on('pageerror', (e) => { if (!/reading 'waiting'/.test(e.message)) errors.push(e.message); });

    await page.goto('/login');
    await page.getByPlaceholder('you@company.com').fill('e2e-employee@example.test');
    await page.locator('input[type="password"]').first().fill('not-a-real-password');
    await page.locator('button[type="submit"]').click();
    await expect(page).toHaveURL(/\/dashboard/);

    await page.goto('/dashboard/whiteboard');
    await expect(page.locator('.excalidraw').first()).toBeVisible({ timeout: 30_000 });
    await expect(page.locator('canvas').first()).toBeVisible();

    expect(errors, `runtime errors: ${errors.join(' | ')}`).toEqual([]);
    expectNoProductionContact(api);
  });
});
