import { useEffect } from 'react';
import { SITE_NAME, SITE_URL, DEFAULT_OG_IMAGE, absoluteUrl } from './siteConfig.js';
import { getRoute } from './schema.js';

function setMeta(kind, key, content) {
  let el = document.head.querySelector(`meta[${kind}="${key}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(kind, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function setCanonical(href) {
  let el = document.head.querySelector('link[rel="canonical"]');
  if (!href) { el?.remove(); return; }
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', 'canonical');
    document.head.appendChild(el);
  }
  el.setAttribute('href', href);
}

function setJsonLd(nodes) {
  document.head.querySelectorAll('script[data-seo="1"]').forEach((n) => n.remove());
  (nodes || []).forEach((node) => {
    const el = document.createElement('script');
    el.type = 'application/ld+json';
    el.setAttribute('data-seo', '1');
    el.textContent = JSON.stringify(node).replace(/</g, '\\u003c');
    document.head.appendChild(el);
  });
}

/** Writes a route's title, description, canonical, social tags and structured data into <head>. Exported for tests. */
export function applySeo(route) {
  const url = absoluteUrl(route.path);
  const image = route.image ? absoluteUrl(route.image) : `${SITE_URL}${DEFAULT_OG_IMAGE}`;
  document.title = route.title;
  setMeta('name', 'description', route.description);
  setMeta('name', 'robots', route.noindex ? 'noindex, nofollow' : 'index, follow, max-image-preview:large');
  setCanonical(route.noindex ? null : url);
  setMeta('property', 'og:site_name', SITE_NAME);
  setMeta('property', 'og:type', route.type === 'article' ? 'article' : 'website');
  setMeta('property', 'og:title', route.title);
  setMeta('property', 'og:description', route.description);
  setMeta('property', 'og:url', url);
  setMeta('property', 'og:image', image);
  setMeta('name', 'twitter:card', 'summary');
  setMeta('name', 'twitter:title', route.title);
  setMeta('name', 'twitter:description', route.description);
  setMeta('name', 'twitter:image', image);
  setJsonLd(route.noindex ? [] : route.schema);
}

/** <Seo route={...} /> for a hand-made route object, or <Seo path="/features" /> to use the configured one. */
export default function Seo({ path, route }) {
  const data = route || getRoute(path);
  useEffect(() => {
    if (data) applySeo(data);
  }, [data]);
  return null;
}

/** App screens (login, dashboards): keep them out of search results. */
export function NoIndex({ title = 'TaskFlow' }) {
  useEffect(() => {
    applySeo({ path: '/', title, description: 'TaskFlow task management app.', noindex: true });
  }, [title]);
  return null;
}
