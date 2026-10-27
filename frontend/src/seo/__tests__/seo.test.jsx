import React from 'react';
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

import { SITE_URL, CORE_PAGES } from '../siteConfig.js';
import { LANDING_PAGES, BLOG_POSTS } from '../seoPages.js';
import { getSeoRoutes, getRoute, buildSitemapXml } from '../schema.js';
import { applySeoToHtml, buildHeadTags, SEO_START, SEO_END, NOSCRIPT_MARKER } from '../headHtml.js';
import { applySeo } from '../Seo.jsx';
import SeoLanding from '../../landing/pages/SeoLanding';
import BlogPost, { BlogIndex } from '../../landing/pages/Blog';
import NotFound from '../../landing/pages/NotFound';

const routes = getSeoRoutes();
const root = path.resolve(__dirname, '../../..');

describe('page metadata', () => {
  it('gives every public page a unique title and description of a sensible length', () => {
    expect(new Set(routes.map((r) => r.path)).size).toBe(routes.length);
    expect(new Set(routes.map((r) => r.title)).size).toBe(routes.length);
    expect(new Set(routes.map((r) => r.description)).size).toBe(routes.length);
    routes.forEach((r) => {
      expect(r.title.length, `title of ${r.path}`).toBeLessThanOrEqual(60);
      expect(r.description.length, `description of ${r.path}`).toBeGreaterThanOrEqual(70);
      expect(r.description.length, `description of ${r.path}`).toBeLessThanOrEqual(160);
      expect(r.lastmod).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });

  it('covers the existing pages, the landing pages and the blog', () => {
    expect(routes).toHaveLength(CORE_PAGES.length + LANDING_PAGES.length + 1 + BLOG_POSTS.length);
    ['/', '/features', '/pricing', '/free-task-manager', '/task-management-app', '/online-task-planner', '/blog', '/blog/how-to-prioritize-tasks'].forEach((p) => {
      expect(getRoute(p), p).toBeTruthy();
    });
  });

  it('only links to pages that exist', () => {
    const known = new Set(routes.map((r) => r.path));
    [...LANDING_PAGES, ...BLOG_POSTS].forEach((page) => page.related.forEach((to) => expect(known.has(to), `${to} (from ${page.path || page.slug})`).toBe(true)));
  });

  it('gives every landing page real content: a heading, sections and at least three questions', () => {
    LANDING_PAGES.forEach((p) => {
      expect(p.h1.length).toBeGreaterThan(20);
      expect(p.sections.length).toBeGreaterThanOrEqual(3);
      expect(p.faqs.length).toBeGreaterThanOrEqual(3);
    });
  });
});

describe('structured data', () => {
  it('describes TaskFlow on the home page without inventing ratings', () => {
    const types = getRoute('/').schema.map((s) => s['@type']);
    expect(types).toEqual(['Organization', 'WebSite', 'SoftwareApplication']);
    expect(JSON.stringify(getRoute('/').schema)).not.toMatch(/aggregateRating|reviewCount|ratingValue/);
  });

  it('marks up articles and breadcrumbs, and FAQs that are shown on the landing pages', () => {
    const post = getRoute('/blog/kanban-vs-to-do-list');
    expect(post.schema.map((s) => s['@type'])).toEqual(['Article', 'BreadcrumbList']);
    expect(post.schema[0].datePublished).toBe('2026-10-27');
    const landing = getRoute('/free-task-manager');
    const faq = landing.schema.find((s) => s['@type'] === 'FAQPage');
    expect(faq.mainEntity).toHaveLength(LANDING_PAGES.find((p) => p.path === '/free-task-manager').faqs.length);
  });
});

describe('sitemap and robots', () => {
  it('lists every public page once, with absolute URLs', () => {
    const xml = buildSitemapXml();
    routes.forEach((r) => expect(xml).toContain(`<loc>${r.path === '/' ? `${SITE_URL}/` : `${SITE_URL}${r.path}`}</loc>`));
    expect((xml.match(/<url>/g) || []).length).toBe(routes.length);
    expect(xml).not.toMatch(/\/(login|admin|dashboard|manager|app)</);
  });

  it('keeps the committed public/sitemap.xml in step with the content (run the build or regenerate it if this fails)', () => {
    expect(fs.readFileSync(path.join(root, 'public/sitemap.xml'), 'utf8').replace(/\r\n/g, '\n')).toBe(buildSitemapXml());
  });

  it('lets crawlers into the public site and keeps them out of the app', () => {
    const robots = fs.readFileSync(path.join(root, 'public/robots.txt'), 'utf8');
    expect(robots).toContain(`Sitemap: ${SITE_URL}/sitemap.xml`);
    ['/app', '/admin', '/dashboard', '/manager', '/login'].forEach((p) => expect(robots).toContain(`Disallow: ${p}`));
    ['/features', '/pricing', '/blog', '/free-task-manager'].forEach((p) => expect(robots).not.toContain(`Disallow: ${p}`));
  });
});

describe('static page heads (what crawlers see without running JavaScript)', () => {
  const template = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

  it('index.html has the markers the build fills in, and no render-blocking Google sign-in script', () => {
    expect(template).toContain(SEO_START);
    expect(template).toContain(SEO_END);
    expect(template).toContain(NOSCRIPT_MARKER);
    expect(template).not.toContain('accounts.google.com/gsi/client');
    expect(template).toMatch(/rel="stylesheet"[^>]*media="print"/); // fonts no longer block the first paint
  });

  it('writes a page its own title, canonical, social tags, structured data and a text fallback', () => {
    const route = getRoute('/kanban-board-software');
    const html = applySeoToHtml(template, route, routes.slice(0, 3));
    expect(html).toContain(`<title>${route.title}</title>`);
    expect(html).toContain(`<link rel="canonical" href="${SITE_URL}/kanban-board-software" />`);
    expect(html).toContain('property="og:title"');
    expect(html).toContain('application/ld+json');
    expect(html).toContain(`<h1>${route.h1}</h1>`);
    expect(html).not.toContain(NOSCRIPT_MARKER);
    // exactly one title and one canonical: the defaults were replaced, not duplicated
    expect((html.match(/<title>/g) || []).length).toBe(1);
    expect((html.match(/rel="canonical"/g) || []).length).toBe(1);
  });

  it('escapes quotes and angle brackets so content can never break out of a tag', () => {
    const html = buildHeadTags({ path: '/x', title: 'A "quoted" <b>title</b>', description: 'a & b', schema: [{ '@type': 'Thing', name: '</script><script>alert(1)</script>' }] });
    expect(html).toContain('A &quot;quoted&quot; &lt;b&gt;title&lt;/b&gt;');
    expect(html).not.toContain('</script><script>alert');
  });

  it('marks app screens noindex', () => {
    expect(buildHeadTags({ path: '/login', title: 'TaskFlow', description: 'x', noindex: true })).toContain('noindex, nofollow');
  });

  it('refuses to build from an index.html without the markers', () => {
    expect(() => applySeoToHtml('<html><head></head></html>', routes[0])).toThrow(/markers/);
  });
});

describe('tags set in the browser', () => {
  beforeEach(() => {
    document.head.innerHTML = '';
    document.title = '';
  });

  it('sets title, description, canonical, social tags and replaces structured data on each navigation', () => {
    applySeo(getRoute('/features'));
    expect(document.title).toBe(getRoute('/features').title);
    expect(document.head.querySelector('meta[name="description"]').content).toBe(getRoute('/features').description);
    expect(document.head.querySelector('link[rel="canonical"]').href).toBe(`${SITE_URL}/features`);
    expect(document.head.querySelector('meta[property="og:url"]').content).toBe(`${SITE_URL}/features`);
    expect(document.head.querySelectorAll('script[data-seo="1"]')).toHaveLength(1);

    applySeo(getRoute('/free-task-manager'));
    expect(document.head.querySelectorAll('link[rel="canonical"]')).toHaveLength(1);
    expect(document.head.querySelector('link[rel="canonical"]').href).toBe(`${SITE_URL}/free-task-manager`);
    expect(document.head.querySelectorAll('script[data-seo="1"]')).toHaveLength(2); // breadcrumb + FAQ, the old one is gone
  });

  it('removes the canonical and structured data on app screens and asks search engines to stay away', () => {
    applySeo(getRoute('/'));
    applySeo({ path: '/login', title: 'TaskFlow', description: 'x', noindex: true });
    expect(document.head.querySelector('meta[name="robots"]').content).toBe('noindex, nofollow');
    expect(document.head.querySelector('link[rel="canonical"]')).toBeNull();
    expect(document.head.querySelectorAll('script[data-seo="1"]')).toHaveLength(0);
  });
});

describe('the new pages', () => {
  const renderAt = (url, element, routePath) => render(
    <MemoryRouter initialEntries={[url]}>
      <Routes><Route path={routePath} element={element} /></Routes>
    </MemoryRouter>,
  );

  it('renders each landing page with one h1, its sections and visible FAQs matching the structured data', () => {
    LANDING_PAGES.forEach((page) => {
      cleanup();
      document.head.innerHTML = '';
      renderAt(page.path, <SeoLanding path={page.path} />, page.path);
      expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
      expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(page.h1);
      page.sections.forEach((s) => expect(screen.getByRole('heading', { level: 2, name: s.h2 })).toBeTruthy());
      page.faqs.forEach((f) => expect(screen.getByText(f.q)).toBeTruthy());
      expect(document.title).toBe(page.title);
      expect(screen.getByRole('navigation', { name: 'Breadcrumb' })).toBeTruthy();
    });
  });

  it('renders blog posts as articles with a date and links to related pages', () => {
    const post = BLOG_POSTS[0];
    renderAt(`/blog/${post.slug}`, <BlogPost slug={post.slug} />, '/blog/:slug');
    expect(screen.getByRole('article')).toBeTruthy();
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(post.title);
    expect(document.querySelector('time').getAttribute('datetime')).toBe(post.date);
    expect(screen.getByRole('complementary')).toBeTruthy(); // "Keep reading" links
    expect(document.title).toBe(getRoute(`/blog/${post.slug}`).title);
  });

  it('lists every article on the blog index', () => {
    renderAt('/blog', <BlogIndex />, '/blog');
    BLOG_POSTS.forEach((p) => expect(screen.getByRole('link', { name: p.title })).toBeTruthy());
  });

  it('shows a real not-found page that is kept out of search results', () => {
    document.head.innerHTML = '';
    renderAt('/nope', <NotFound />, '/nope');
    expect(screen.getByRole('heading', { level: 1 }).textContent).toMatch(/could not find/i);
    expect(document.head.querySelector('meta[name="robots"]').content).toBe('noindex, nofollow');
  });
});
