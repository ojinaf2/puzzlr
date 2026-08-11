/* ===================== SITEMAP GENERATOR =====================

   Writes public/sitemap.xml from the game registry. Wired into `npm run build`
   so it cannot go stale: add a game to src/games/index.jsx and its URL appears
   on the next build without anyone remembering to do anything.

   The registry is JSX and node cannot import it, so the ids are read with a
   regex rather than by evaluating the module. If that ever stops matching, the
   count check at the bottom fails the build loudly instead of quietly
   publishing a sitemap that is missing half the site.                      */

import { readFileSync, writeFileSync } from 'fs';

const SITE = "https://playpuzzlr.com";
const registry = new URL('../src/games/index.jsx', import.meta.url);
const out = new URL('../public/sitemap.xml', import.meta.url);

const src = readFileSync(registry, 'utf8');
const ids = [...src.matchAll(/^\s*id: "([a-z0-9]+)"/gm)].map((m) => m[1]);
const declared = (src.match(/^\s*\{$/gm) || []).length;

if (!ids.length) {
  console.error('build-sitemap: no game ids found in the registry — has its format changed?');
  process.exit(1);
}
if (declared && declared !== ids.length) {
  console.error(`build-sitemap: found ${ids.length} ids but ${declared} entries — the regex is missing games.`);
  process.exit(1);
}

const today = new Date().toISOString().slice(0, 10);
const url = (loc, priority) =>
  `  <url>\n    <loc>${loc}</loc>\n    <lastmod>${today}</lastmod>\n    <priority>${priority}</priority>\n  </url>`;

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${[url(`${SITE}/`, "1.0"), ...ids.map((id) => url(`${SITE}/${id}`, "0.8"))].join('\n')}
</urlset>
`;

writeFileSync(out, xml);
console.log(`sitemap: ${ids.length + 1} urls (${ids.join(', ')})`);
