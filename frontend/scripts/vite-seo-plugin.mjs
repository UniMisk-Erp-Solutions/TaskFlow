// Vite plugin: after `vite build`, writes
//   dist/index.html            with the home page's own head (title, description, canonical, social tags, structured data)
//   dist/<route>/index.html    one copy per public page, each with its own head and a plain-text <noscript> fallback
//   dist/sitemap.xml           every public page
// so it works however the build is started (`npm run build` or `vite build`). Set SEO_PRERENDER=0 to skip the per-page files.

import fs from 'node:fs';
import path from 'node:path';
import { getSeoRoutes, buildSitemapXml } from '../src/seo/schema.js';
import { applySeoToHtml } from '../src/seo/headHtml.js';

export function seoBuildPlugin() {
  let outDir = 'dist';
  return {
    name: 'taskflow-seo',
    apply: 'build',
    configResolved(config) {
      outDir = path.resolve(config.root, config.build.outDir);
    },
    closeBundle() {
      const indexPath = path.join(outDir, 'index.html');
      if (!fs.existsSync(indexPath)) return;
      const template = fs.readFileSync(indexPath, 'utf8');
      const routes = getSeoRoutes();
      const nav = routes.filter((r) => ['/', '/features', '/pricing', '/task-management-app', '/free-task-manager', '/online-task-planner', '/kanban-board-software', '/employee-task-tracking', '/blog'].includes(r.path));

      const home = routes.find((r) => r.path === '/');
      fs.writeFileSync(indexPath, applySeoToHtml(template, home, nav));

      if (process.env.SEO_PRERENDER !== '0') {
        routes.filter((r) => r.path !== '/').forEach((route) => {
          const dir = path.join(outDir, ...route.path.split('/').filter(Boolean));
          fs.mkdirSync(dir, { recursive: true });
          fs.writeFileSync(path.join(dir, 'index.html'), applySeoToHtml(template, route, nav));
        });
      }
      fs.writeFileSync(path.join(outDir, 'sitemap.xml'), buildSitemapXml());
      console.log(`[seo] wrote ${process.env.SEO_PRERENDER === '0' ? 1 : routes.length} page heads and sitemap.xml (${routes.length} URLs)`);
    },
  };
}
