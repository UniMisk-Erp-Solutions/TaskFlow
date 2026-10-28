// Network jail + synthetic API for every E2E test.
import { test as base, expect } from '@playwright/test';

export const PRODUCTION_HOSTS = ['taskflow-backend.unimisk.com', 'taskflow-api.unimisk.com'];
const MOCK_ORIGIN = 'http://127.0.0.1:4010';

// Synthetic identities — not real people, accounts or credentials.
export const FIXTURE_EMPLOYEE = { id: '00000000-0000-4000-8000-000000000001', email: 'e2e-employee@example.test', full_name: 'E2E Employee', role: 'employee', org_id: '00000000-0000-4000-8000-0000000000aa', status: 'active', onboarding_completed: true };

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
/** Unsigned, obviously fake JWT with a far-future expiry; only the mocked API ever sees it. */
export const fakeJwt = () => `${b64({ alg: 'none', typ: 'JWT' })}.${b64({ sub: FIXTURE_EMPLOYEE.id, exp: 4102444800, role: 'authenticated', aud: 'authenticated' })}.e2e`;

const json = (route, status, body) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

export const test = base.extend({
  // Per-test mutable behaviour: tests override handlers to script failure scenarios.
  api: async ({}, use) => { await use({ login: 'ok', violations: [], blocked: [], calls: [] }); }, // eslint-disable-line no-empty-pattern

  page: async ({ page, api }, use) => {
    await page.route('**/*', async (route) => {
      const url = new URL(route.request().url());
      const host = url.hostname.toLowerCase();

      if (url.origin === MOCK_ORIGIN) {
        const p = url.pathname.replace(/^\/api/, '');
        api.calls.push(`${route.request().method()} ${p}`);
        if (p === '/auth/login' && route.request().method() === 'POST') {
          if (api.login === 'invalid') return json(route, 401, { error: 'Invalid login credentials' });
          if (api.login === 'down') return route.abort('connectionrefused');
          return json(route, 200, { user: { id: FIXTURE_EMPLOYEE.id, email: FIXTURE_EMPLOYEE.email }, session: { access_token: fakeJwt(), refresh_token: 'e2e-refresh', expires_in: 3600, token_type: 'bearer', user: { id: FIXTURE_EMPLOYEE.id, email: FIXTURE_EMPLOYEE.email } } });
        }
        if (p === '/auth/v1/user') return json(route, 200, { id: FIXTURE_EMPLOYEE.id, email: FIXTURE_EMPLOYEE.email, aud: 'authenticated', role: 'authenticated' });
        if (p === '/auth/me') return json(route, 200, FIXTURE_EMPLOYEE);
        if (p === '/rest/v1/whiteboards' && route.request().method() === 'GET') {
          // Synthetic whiteboard: PostgREST returns one object for maybeSingle(), a list otherwise.
          const board = { id: 'wb-e2e-main', name: 'E2E board', is_main: true, visibility: 'public', owner_id: FIXTURE_EMPLOYEE.id, created_at: '2026-10-27T00:00:00Z', scene: { elements: [] } };
          const single = String(route.request().headers().accept || '').includes('vnd.pgrst.object');
          return json(route, 200, single ? board : [board]);
        }
        if (route.request().method() === 'GET') return json(route, 200, []);
        return json(route, 200, {});
      }

      if (host === '127.0.0.1' || host === 'localhost') return route.continue();

      // Anything else is outside the jail: never let it reach the network.
      if (PRODUCTION_HOSTS.some((h) => host.includes(h))) api.violations.push(url.href);
      api.blocked.push(url.href);
      return route.abort('blockedbyclient');
    });
    await use(page);
  },
});

export { expect };

/** Asserts the jail was never asked for a production host. Call at the end of a test. */
export function expectNoProductionContact(api) {
  expect(api.violations, `production hosts were contacted: ${api.violations.join(', ')}`).toEqual([]);
}
