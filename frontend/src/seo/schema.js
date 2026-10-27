// Builds the list of every indexable route (with its head data, structured data and a plain-text summary) from the content files.
// Used by the build (static page heads, sitemap), by <Seo> in the browser and by the tests.

import { CORE_PAGES, SITE_URL, SITE_NAME, DEFAULT_OG_IMAGE, absoluteUrl } from './siteConfig.js';
import { LANDING_PAGES, BLOG_POSTS, BLOG_INDEX, blogPath } from './seoPages.js';

const organization = {
  '@type': 'Organization',
  '@id': `${SITE_URL}/#organization`,
  name: SITE_NAME,
  url: SITE_URL,
  logo: `${SITE_URL}${DEFAULT_OG_IMAGE}`,
};

const website = {
  '@type': 'WebSite',
  '@id': `${SITE_URL}/#website`,
  url: SITE_URL,
  name: SITE_NAME,
  publisher: { '@id': `${SITE_URL}/#organization` },
};

const softwareApplication = {
  '@type': 'SoftwareApplication',
  name: SITE_NAME,
  url: SITE_URL,
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'Web browser; installable on Android and iOS home screens',
  description: 'Online task management for teams: tasks, Kanban board, calendar, time tracking and approvals.',
  // The Free plan is listed on the public pricing page. There is deliberately no rating: nothing here is invented.
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD', description: 'Free plan' },
};

const breadcrumb = (items) => ({
  '@type': 'BreadcrumbList',
  itemListElement: items.map((item, i) => ({ '@type': 'ListItem', position: i + 1, name: item.name, item: absoluteUrl(item.path) })),
});

const faqPage = (faqs) => ({
  '@type': 'FAQPage',
  mainEntity: faqs.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
});

const withContext = (nodes) => nodes.map((node) => ({ '@context': 'https://schema.org', ...node }));

/** One entry per indexable page. */
export function getSeoRoutes() {
  const routes = [];

  CORE_PAGES.forEach((page) => {
    const schema = page.path === '/'
      ? [organization, website, softwareApplication]
      : [breadcrumb([{ name: 'Home', path: '/' }, { name: page.title.split(/[:|]/)[0].trim(), path: page.path }])];
    routes.push({ ...page, type: 'website', schema: withContext(schema) });
  });

  LANDING_PAGES.forEach((page) => {
    routes.push({
      path: page.path,
      title: page.title,
      description: page.description,
      changefreq: page.changefreq,
      priority: page.priority,
      lastmod: page.lastmod,
      summary: page.intro[0],
      h1: page.h1,
      type: 'website',
      schema: withContext([
        breadcrumb([{ name: 'Home', path: '/' }, { name: page.eyebrow, path: page.path }]),
        faqPage(page.faqs),
      ]),
    });
  });

  routes.push({
    ...BLOG_INDEX,
    summary: BLOG_INDEX.intro,
    type: 'website',
    schema: withContext([breadcrumb([{ name: 'Home', path: '/' }, { name: 'Blog', path: '/blog' }])]),
  });

  BLOG_POSTS.forEach((post) => {
    const path = blogPath(post.slug);
    routes.push({
      path,
      title: post.seoTitle || `${post.title} | TaskFlow`,
      description: post.description,
      changefreq: 'monthly',
      priority: 0.6,
      lastmod: post.date,
      summary: post.intro,
      h1: post.title,
      type: 'article',
      publishedTime: post.date,
      schema: withContext([
        {
          '@type': 'Article',
          headline: post.title,
          description: post.description,
          datePublished: post.date,
          dateModified: post.date,
          image: `${SITE_URL}${DEFAULT_OG_IMAGE}`,
          author: { '@type': 'Organization', name: SITE_NAME, url: SITE_URL },
          publisher: { '@id': `${SITE_URL}/#organization` },
          mainEntityOfPage: absoluteUrl(path),
        },
        breadcrumb([{ name: 'Home', path: '/' }, { name: 'Blog', path: '/blog' }, { name: post.title, path }]),
      ]),
    });
  });

  return routes;
}

export function getRoute(path) {
  const clean = path === '/' ? '/' : path.replace(/\/+$/, '');
  return getSeoRoutes().find((r) => r.path === clean) || null;
}

/** sitemap.xml for every indexable route. */
export function buildSitemapXml() {
  const urls = getSeoRoutes()
    .map((r) => [
      '  <url>',
      `    <loc>${absoluteUrl(r.path)}</loc>`,
      `    <lastmod>${r.lastmod}</lastmod>`,
      `    <changefreq>${r.changefreq}</changefreq>`,
      `    <priority>${Number(r.priority).toFixed(1)}</priority>`,
      '  </url>',
    ].join('\n'))
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}
