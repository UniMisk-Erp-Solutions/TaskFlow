# SEO: how it works and how to extend it

All public (indexable) pages are described in one place, `frontend/src/seo/`:

| File | What it holds |
| --- | --- |
| `siteConfig.js` | Site URL, default text and the existing marketing pages (title, description, `lastmod`). |
| `seoPages.js` | The search landing pages and the blog articles (content, FAQs, related links). |
| `schema.js` | Builds every route's structured data (Organization, WebSite, SoftwareApplication, Article, BreadcrumbList, FAQPage) and `sitemap.xml`. |
| `headHtml.js` | Turns a route into the `<head>` tags and a plain-text `<noscript>` fallback. |
| `Seo.jsx` | Applies the same tags in the browser when someone navigates, and marks app screens `noindex`. |

## What the build does

`vite build` (through `scripts/vite-seo-plugin.mjs`) writes, next to the normal bundle:

- `dist/index.html` with the home page's own head.
- `dist/<page>/index.html` for every public page, each with its own title, description, canonical, social tags and structured data.
- `dist/sitemap.xml` with every public page.

Set `SEO_PRERENDER=0` to skip the per-page files. The browser-side `<Seo>` still sets the tags, which is what Google reads after it runs the page.

`frontend/public/sitemap.xml` is a committed copy; a test fails if it drifts from the content. Regenerate it with:

```bash
cd frontend
node -e "import('./src/seo/schema.js').then(m => require('fs').writeFileSync('public/sitemap.xml', m.buildSitemapXml()))"
```

## Adding a landing page or a blog post

1. Add an entry to `LANDING_PAGES` or `BLOG_POSTS` in `seoPages.js` (for a post also set `seoTitle`, 60 characters at most including " | TaskFlow").
2. Update `lastmod` / `date` to the day it changes.
3. Regenerate `public/sitemap.xml` (command above) and run `npm test`. The tests check title and description length, unique titles, working related links and that the sitemap is current.

Landing pages get their route automatically; blog posts are served at `/blog/<slug>`.

## Rules the content follows

- Claims about TaskFlow describe things the app does, or repeat the public pricing page. Re-check the Free plan details in `free-task-manager` whenever the pricing page changes.
- No ratings, user counts or ranking claims.
- App screens (`/login`, `/app`, `/admin`, `/dashboard`, `/manager`) are `noindex` and disallowed in `robots.txt`.
