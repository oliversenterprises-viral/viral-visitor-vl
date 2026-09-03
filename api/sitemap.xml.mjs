/**
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
    { loc: `${ORIGIN}/`, changefreq: 'daily', priority: '1.0' },
    { loc: `${ORIGIN}/tools/`, changefreq: 'weekly', priority: '0.9' },
    { loc: `${ORIGIN}/tools/share-generator.html`, changefreq: 'monthly', priority: '0.8' },
    { loc: `${ORIGIN}/tools/viral-calculator.html`, changefreq: 'monthly', priority: '0.8' },
    { loc: `${ORIGIN}/tools/7-day-launch.html`, changefreq: 'monthly', priority: '0.8' },
    { loc: `${ORIGIN}/tools/utm-builder.html`, changefreq: 'monthly', priority: '0.75' },
    { loc: `${ORIGIN}/tools/traffic-refer-kit.html`, changefreq: 'monthly', priority: '0.8' },
    { loc: `${ORIGIN}/tools/hook-bank.html`, changefreq: 'monthly', priority: '0.75' },
    { loc: `${ORIGIN}/rules/`, changefreq: 'monthly', priority: '0.7' },
    { loc: `${ORIGIN}/privacy/`, changefreq: 'monthly', priority: '0.5' },
    { loc: `${ORIGIN}/terms/`, changefreq: 'monthly', priority: '0.5' },
    { loc: `${ORIGIN}/go/makers/`, changefreq: 'weekly', priority: '0.75' },
    { loc: `${ORIGIN}/go/race/`, changefreq: 'weekly', priority: '0.75' },
    { loc: `${ORIGIN}/go/feature/`, changefreq: 'weekly', priority: '0.75' },
    { loc: `${ORIGIN}/go/challenge/`, changefreq: 'weekly', priority: '0.7' },
    { loc: `${ORIGIN}/go/herculist/`, changefreq: 'weekly', priority: '0.75' },
    { loc: `${ORIGIN}/go/adsboard/`, changefreq: 'weekly', priority: '0.7' },
    { loc: `${ORIGIN}/go/sponsor/`, changefreq: 'weekly', priority: '0.75' },
    { loc: `${ORIGIN}/llms.txt`, changefreq: 'monthly', priority: '0.4' },
  ];
  const body = urls
    .map(
      (u) => `  <url>
    <loc>${escapeXml(u.loc)}</loc>
    <lastmod>${date}</lastmod>
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`,
    )
    .join('\n');
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${body}
</urlset>
`;
  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=86400');
  res.status(200).send(xml);
}
