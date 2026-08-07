#!/usr/bin/env node
/**
 * Prepare tools-only prod ship: safe vercel rewrite + sitemap (no Relay).
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// vercel: start from HEAD snapshot if present, else current
let vercelRaw;
try {
  vercelRaw = readFileSync('C:/Users/olive/AppData/Local/Temp/vercel-head.json', 'utf8');
} catch {
  vercelRaw = readFileSync(resolve(ROOT, 'vercel.json'), 'utf8');
}
const vercel = JSON.parse(vercelRaw);
const last = vercel.rewrites[vercel.rewrites.length - 1];
last.source =
  '/((?!api/|go/|embed/|tools/|assets/|favicon\\.svg|robots\\.txt|sitemap\\.xml|manifest\\.json|llms\\.txt|security\\.txt|version\\.json|icons\\.svg).*)';
// Keep HEAD CSP headers (do not introduce Relay frame-ancestors *)
writeFileSync(resolve(ROOT, 'vercel.json'), `${JSON.stringify(vercel, null, 2)}\n`);
console.log('vercel rewrite:', last.source);

const toolUrls = [
  ['https://www.viralrefer.app/tools/', 'weekly', '0.9'],
  ['https://www.viralrefer.app/tools/share-generator.html', 'monthly', '0.8'],
  ['https://www.viralrefer.app/tools/viral-calculator.html', 'monthly', '0.8'],
  ['https://www.viralrefer.app/tools/7-day-launch.html', 'monthly', '0.8'],
  ['https://www.viralrefer.app/tools/utm-builder.html', 'monthly', '0.75'],
  ['https://www.viralrefer.app/tools/traffic-refer-kit.html', 'monthly', '0.8'],
  ['https://www.viralrefer.app/tools/hook-bank.html', 'monthly', '0.75'],
];

const base = [
  ['https://www.viralrefer.app/', 'daily', '1.0'],
  ...toolUrls,
  ['https://www.viralrefer.app/#how', 'weekly', '0.8'],
  ['https://www.viralrefer.app/#leaderboard', 'daily', '0.9'],
  ['https://www.viralrefer.app/#prize', 'weekly', '0.7'],
  ['https://www.viralrefer.app/go/makers/', 'weekly', '0.75'],
  ['https://www.viralrefer.app/go/race/', 'weekly', '0.75'],
  ['https://www.viralrefer.app/go/feature/', 'weekly', '0.75'],
  ['https://www.viralrefer.app/go/challenge/', 'weekly', '0.7'],
];

const urlsXml = base
  .map(
    ([loc, cf, pr]) => `  <url>
    <loc>${loc}</loc>
    <changefreq>${cf}</changefreq>
    <priority>${pr}</priority>
  </url>`,
  )
  .join('\n');

writeFileSync(
  resolve(ROOT, 'public/sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urlsXml}
  <!-- /embed/* splash variants are iframe-only; omit from sitemap (noindex preference) -->
</urlset>
`,
);
console.log('sitemap urls:', base.length);

// api/sitemap.xml.mjs — tools entries only (no /relay)
const api = `/**
 * Dynamic sitemap fallback — mirrors public/sitemap.xml (fresh lastmod).
 */

const ORIGIN = 'https://www.viralrefer.app';

function escapeXml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export default function handler(_req, res) {
  const date = new Date().toISOString().slice(0, 10);
  const urls = [
    { loc: \`\${ORIGIN}/\`, changefreq: 'daily', priority: '1.0' },
    { loc: \`\${ORIGIN}/tools/\`, changefreq: 'weekly', priority: '0.9' },
    { loc: \`\${ORIGIN}/tools/share-generator.html\`, changefreq: 'monthly', priority: '0.8' },
    { loc: \`\${ORIGIN}/tools/viral-calculator.html\`, changefreq: 'monthly', priority: '0.8' },
    { loc: \`\${ORIGIN}/tools/7-day-launch.html\`, changefreq: 'monthly', priority: '0.8' },
    { loc: \`\${ORIGIN}/tools/utm-builder.html\`, changefreq: 'monthly', priority: '0.75' },
    { loc: \`\${ORIGIN}/tools/traffic-refer-kit.html\`, changefreq: 'monthly', priority: '0.8' },
    { loc: \`\${ORIGIN}/tools/hook-bank.html\`, changefreq: 'monthly', priority: '0.75' },
    { loc: \`\${ORIGIN}/#how\`, changefreq: 'weekly', priority: '0.8' },
    { loc: \`\${ORIGIN}/#leaderboard\`, changefreq: 'daily', priority: '0.9' },
    { loc: \`\${ORIGIN}/#prize\`, changefreq: 'weekly', priority: '0.7' },
    { loc: \`\${ORIGIN}/go/makers/\`, changefreq: 'weekly', priority: '0.75' },
    { loc: \`\${ORIGIN}/go/race/\`, changefreq: 'weekly', priority: '0.75' },
    { loc: \`\${ORIGIN}/go/feature/\`, changefreq: 'weekly', priority: '0.75' },
    { loc: \`\${ORIGIN}/go/challenge/\`, changefreq: 'weekly', priority: '0.7' },
  ];
  const body = urls
    .map(
      (u) => \`  <url>
    <loc>\${escapeXml(u.loc)}</loc>
    <lastmod>\${date}</lastmod>
    <changefreq>\${u.changefreq}</changefreq>
    <priority>\${u.priority}</priority>
  </url>\`,
    )
    .join('\\n');
  const xml = \`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
\${body}
</urlset>
\`;
  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=86400');
  res.status(200).send(xml);
}
`;
writeFileSync(resolve(ROOT, 'api/sitemap.xml.mjs'), api);
console.log('api/sitemap.xml.mjs written');
