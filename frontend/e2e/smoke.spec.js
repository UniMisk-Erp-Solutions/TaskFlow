import { test, expect, expectNoProductionContact } from './fixtures.js';

test.describe('public site + routing', () => {
  test('landing page renders and unknown routes show the 404 page', async ({ page, api }) => {
    await page.goto('/');
    await expect(page.locator('#root')).not.toBeEmpty();
    await page.goto('/definitely/not/a/route');
    // Unknown URLs are no longer redirected to "/" (duplicate-content SEO fix): they show a 404 page.
    await expect(page).toHaveURL(/definitely\/not\/a\/route$/);
    await expect(page.getByText('We could not find that page')).toBeVisible();
    expectNoProductionContact(api);
  });

  test('SPA deep links work on a hard load (Vercel rewrite parity)', async ({ page }) => {
    for (const route of ['/pricing', '/features', '/security']) {
      const res = await page.goto(route);
      expect(res.status(), route).toBe(200);
      await expect(page.locator('#root')).not.toBeEmpty();
    }
  });

});

test.describe('access control', () => {
  test('anonymous visitors cannot open the admin or employee dashboards', async ({ page, api }) => {
    for (const route of ['/admin/overview', '/dashboard/tasks', '/manager/tasks']) {
      await page.goto(route);
      await expect(page, route).toHaveURL(/\/login/);
    }
    expectNoProductionContact(api);
  });
});
