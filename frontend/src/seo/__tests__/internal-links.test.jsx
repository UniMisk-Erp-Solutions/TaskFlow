import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Footer } from '../../landing/components/layout/Footer';
import { PAGE_LINKS, PAGE, GUIDE_LINKS } from '../../landing/lib/pageLinks.js';
import { getRoute } from '../schema.js';
import { LANDING_PAGES, BLOG_POSTS } from '../seoPages.js';

const TARGETS = [
  '/about', '/contact', '/docs', '/faq', '/privacy', '/security', '/terms',
  '/task-approval-workflow-software',
  ...BLOG_POSTS.map((p) => `/blog/${p.slug}`),
];

const inbound = () => {
  const map = {};
  const add = (to, from) => { (map[to] ||= new Set()).add(from); };
  for (const [from, links] of Object.entries(PAGE_LINKS)) links.filter(Boolean).forEach((l) => add(l.to, from));
  for (const p of LANDING_PAGES) (p.related || []).forEach((to) => add(to, `/${p.slug || p.path}`));
  for (const p of BLOG_POSTS) (p.related || []).forEach((to) => add(to, `/blog/${p.slug}`));
  return map;
};

describe('internal links', () => {
  it('footer links to every target with descriptive anchor text', () => {
    const { container } = render(<MemoryRouter><Footer /></MemoryRouter>);
    const anchors = [...container.querySelectorAll('a')];
    for (const to of TARGETS) {
      const a = anchors.find((x) => x.getAttribute('href') === to && x.textContent.trim().split(/\s+/).length >= 2);
      expect(a, `footer link to ${to}`).toBeTruthy();
    }
  });

  it('every target has at least 2 distinct contextual inbound pages', () => {
    const map = inbound();
    for (const to of TARGETS) expect((map[to] || new Set()).size, to).toBeGreaterThanOrEqual(2);
  });

  it('related-page links point at real routes', () => {
    for (const links of Object.values(PAGE_LINKS)) for (const l of links) expect(l, 'undefined link').toBeTruthy();
    for (const l of [...Object.values(PAGE), ...GUIDE_LINKS]) expect(getRoute(l.to), l.to).toBeTruthy();
  });
});

describe('plain-HTML fallback (what crawlers without JavaScript see)', () => {
  it('links every public page with descriptive anchor text', async () => {
    const { getSeoRoutes } = await import('../schema.js');
    const { buildNoscript } = await import('../headHtml.js');
    const routes = getSeoRoutes().filter((r) => !r.noindex);
    const html = buildNoscript(routes[0], routes);
    for (const to of TARGETS) {
      const m = html.match(new RegExp(`<a href="[^"]*${to}">([^<]+)</a>`));
      expect(m, `static link to ${to}`).toBeTruthy();
      expect(m[1].trim().split(/\s+/).length, `anchor for ${to}`).toBeGreaterThanOrEqual(2);
    }
  });
});

describe('main heading in the raw HTML', () => {
  it('every indexable page has one h1 in the page body, outside <noscript>', async () => {
    const { getSeoRoutes } = await import('../schema.js');
    const { applySeoToHtml } = await import('../headHtml.js');
    const fs = await import('node:fs');
    const template = fs.readFileSync('index.html', 'utf8');
    for (const route of getSeoRoutes().filter((r) => !r.noindex)) {
      const html = applySeoToHtml(template, route, []);
      const body = html.replace(/<noscript>[\s\S]*?<\/noscript>/g, '');
      expect((body.match(/<h1[ >]/g) || []).length, route.path).toBe(1);
    }
  });
});
