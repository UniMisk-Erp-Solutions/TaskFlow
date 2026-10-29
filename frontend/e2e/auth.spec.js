import { test, expect, expectNoProductionContact } from './fixtures.js';

async function fillLogin(page) {
  await page.goto('/login');
  await page.getByPlaceholder('you@company.com').fill('e2e-employee@example.test');
  await page.locator('input[type="password"]').first().fill('not-a-real-password');
  await page.locator('button[type="submit"]').click();
}

test.describe('login (synthetic API)', () => {
  test('valid synthetic employee reaches the employee dashboard', async ({ page, api }) => {
    await fillLogin(page);
    await expect(page).toHaveURL(/\/dashboard/);
    expect(api.calls).toContain('POST /auth/login');
    expectNoProductionContact(api);
  });

  test('FAILURE: rejected credentials show an error and stay on /login', async ({ page, api }) => {
    api.login = 'invalid';
    await fillLogin(page);
    await expect(page.locator('.form-error')).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
    expectNoProductionContact(api);
  });

  test('FAILURE: API outage shows an error instead of hanging or crashing', async ({ page, api }) => {
    api.login = 'down';
    await fillLogin(page);
    await expect(page.locator('.form-error')).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });
});
