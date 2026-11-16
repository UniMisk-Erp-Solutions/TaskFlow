import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../AuthContext', () => ({ useAuth: () => ({ user: null, profile: null }) }));
vi.mock('../../BillingContext', () => ({ useBilling: () => ({ billing: {}, startTrial: () => {}, checkout: () => {}, refresh: () => {} }) }));
vi.mock('../../supabaseClient', () => ({ default: {} }));
vi.mock('../../api', () => ({ default: { get: async () => ({ data: [] }), post: async () => ({ data: {} }) } }));

import { getRoute } from '../schema.js';
import { BLOG_POSTS } from '../seoPages.js';
import Home from '../../landing/pages/Home';
import Features from '../../landing/pages/Features';
import Pricing from '../../landing/pages/Pricing';
import About from '../../landing/pages/About';
import Contact from '../../landing/pages/Contact';
import Security from '../../landing/pages/Security';
import Privacy from '../../landing/pages/Privacy';
import Terms from '../../landing/pages/Terms';
import Docs from '../../landing/pages/Docs';
import Faq from '../../landing/pages/Faq';
import SeoLanding from '../../landing/pages/SeoLanding';
import BlogPost, { BlogIndex } from '../../landing/pages/Blog';

// Every public page: exactly one main heading (h1), and it names the same topic as the page title (in its own words).
const pages = [
  ['/', () => <Home />],
  ['/features', () => <Features />],
  ['/pricing', () => <Pricing />],
  ['/free-task-manager', () => <SeoLanding path="/free-task-manager" />],
  ['/task-management-app', () => <SeoLanding path="/task-management-app" />],
  ['/online-task-planner', () => <SeoLanding path="/online-task-planner" />],
  ['/employee-task-tracking', () => <SeoLanding path="/employee-task-tracking" />],
  ['/kanban-board-software', () => <SeoLanding path="/kanban-board-software" />],
  ['/blog', () => <BlogIndex />],
  ['/faq', () => <Faq />],
  ['/contact', () => <Contact />],
  ['/about', () => <About />],
  ['/docs', () => <Docs />],
  ['/security', () => <Security />],
  ['/privacy', () => <Privacy />],
  ['/terms', () => <Terms />],
  ['/task-approval-workflow-software', () => <SeoLanding path="/task-approval-workflow-software" />],
  ...BLOG_POSTS.map((p) => [`/blog/${p.slug}`, () => <BlogPost slug={p.slug} />]),
];

const STOP = new Set(['a', 'an', 'and', 'the', 'to', 'of', 'for', 'in', 'on', 'with', 'your', 'our', 'how', 'is', 'it', 'at', 'taskflow', 'vs', 'do', 'we', 'you']);
const words = (text) => text.toLowerCase().replace(/[^a-z0-9\s-]/g, ' ').split(/[\s-]+/).filter((w) => w && !STOP.has(w)).map((w) => w.replace(/s$/, ''));

describe('page headings', () => {
  it('covers 27 public pages', () => {
    expect(pages).toHaveLength(27);
  });

  it.each(pages)('%s has one main heading that matches its title', (path, make) => {
    const route = getRoute(path);
    expect(route, path).toBeTruthy();
    const { container } = render(<MemoryRouter>{make()}</MemoryRouter>);
    const headings = [...container.querySelectorAll('h1')];
    cleanup();
    expect(headings, `${path} must have exactly one <h1>`).toHaveLength(1);
    const h1 = headings[0].textContent.replace(/\s+/g, ' ').trim();
    expect(h1.length, `${path} heading is empty`).toBeGreaterThan(3);
    // at least half of the title's topic words appear in the heading
    // a title like "About TaskFlow: why we built…" is matched on the part before the colon
    const headingWords = new Set(words(h1));
    const overlap = (text) => {
      const tw = [...new Set(words(text))];
      return tw.length ? tw.filter((w) => headingWords.has(w)).length / tw.length : 0;
    };
    const best = Math.max(overlap(route.title), overlap(route.title.split(':')[0]));
    expect(best, `${path}: heading "${h1}" vs title "${route.title}"`).toBeGreaterThanOrEqual(0.5);
  });
});
