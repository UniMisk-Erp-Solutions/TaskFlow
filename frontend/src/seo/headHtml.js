// Turns a route's SEO data into the HTML that goes in <head> (and a plain-text <noscript> fallback), so search engines and link
// previews get the right title, description, canonical, social tags and structured data without running any JavaScript.
// index.html contains two marker comments that this replaces; the same data is applied again in the browser by <Seo>.

import { SITE_NAME, DEFAULT_OG_IMAGE, SITE_URL, absoluteUrl } from './siteConfig.js';

export const SEO_START = '<!--seo:start-->';
export const SEO_END = '<!--seo:end-->';
export const NOSCRIPT_MARKER = '<!--seo:noscript-->';

export const escapeHtml = (value) =>
  String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// JSON inside <script> must not be able to close the tag.
const safeJson = (data) => JSON.stringify(data).replace(/</g, '\\u003c');

export function buildHeadTags(route) {
  const url = absoluteUrl(route.path);
  const image = route.image ? absoluteUrl(route.image) : `${SITE_URL}${DEFAULT_OG_IMAGE}`;
  const robots = route.noindex ? 'noindex, nofollow' : 'index, follow, max-image-preview:large';
  const tags = [
    `<title>${escapeHtml(route.title)}</title>`,
    `<meta name="description" content="${escapeHtml(route.description)}" />`,
    `<meta name="robots" content="${robots}" />`,
    `<link rel="canonical" href="${url}" />`,
    `<meta property="og:site_name" content="${SITE_NAME}" />`,
    `<meta property="og:type" content="${route.type === 'article' ? 'article' : 'website'}" />`,
    `<meta property="og:title" content="${escapeHtml(route.title)}" />`,
    `<meta property="og:description" content="${escapeHtml(route.description)}" />`,
    `<meta property="og:url" content="${url}" />`,
    `<meta property="og:image" content="${image}" />`,
    `<meta name="twitter:card" content="summary" />`,
    `<meta name="twitter:title" content="${escapeHtml(route.title)}" />`,
    `<meta name="twitter:description" content="${escapeHtml(route.description)}" />`,
    `<meta name="twitter:image" content="${image}" />`,
  ];
  if (route.publishedTime) tags.push(`<meta property="article:published_time" content="${route.publishedTime}" />`);
  (route.schema || []).forEach((node) => tags.push(`<script type="application/ld+json" data-seo="1">${safeJson(node)}</script>`));
  return tags.join('\n    ');
}

/** Plain content for visitors and crawlers that do not run JavaScript. Replaced as soon as the app loads. */
export function buildNoscript(route, navRoutes = []) {
  const links = navRoutes.map((r) => `<li><a href="${absoluteUrl(r.path)}">${escapeHtml(r.title.split(/[:|]/)[0].trim())}</a></li>`).join('');
  return [
    '<noscript>',
    '<main style="max-width:720px;margin:40px auto;padding:0 16px;font-family:system-ui,sans-serif;line-height:1.5">',
    `<h1>${escapeHtml(route.h1 || route.title)}</h1>`,
    `<p>${escapeHtml(route.summary || route.description)}</p>`,
    `<p>${SITE_NAME} needs JavaScript to run the app. Browse the main pages:</p>`,
    `<ul>${links}</ul>`,
    '</main>',
    '</noscript>',
  ].join('');
}

/** Applies a route's head tags and noscript fallback to the built index.html. */
export function applySeoToHtml(template, route, navRoutes = []) {
  const start = template.indexOf(SEO_START);
  const end = template.indexOf(SEO_END);
  if (start < 0 || end < start) throw new Error('index.html is missing the <!--seo:start--> / <!--seo:end--> markers');
  let html = `${template.slice(0, start + SEO_START.length)}\n    ${buildHeadTags(route)}\n    ${template.slice(end)}`;
  html = html.replace(NOSCRIPT_MARKER, buildNoscript(route, navRoutes));
  return html;
}
