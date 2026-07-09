/**
 * Organic search (Google) snippets — robots/sitemap helpers, JSON-LD, homepage meta.
 * Static copies live in index.html + public/ for non-JS crawlers; this module keeps DRY + runtime fixes.
 */

import { parseRefFromLocation } from './referral-url';

export const SEO_SITE_ORIGIN = 'https://www.viralrefer.app';

export const HOMEPAGE_SEO = {
  title: 'ViralRefer • Free Referral Leaderboard',
  description:
    'Get your free ViralRefer link in 30 seconds — no signup. Share it and climb the live leaderboard. #1 can claim a homepage feature for their site.',
  keywords:
    'referral program, viral marketing, free referral link, live leaderboard, homepage feature, no signup',
} as const;

export interface FaqEntry {
  question: string;
  answer: string;
}

/** FAQ content mirrored in index.html JSON-LD for rich-result eligibility. */
export const HOMEPAGE_FAQ: readonly FaqEntry[] = [
  {
    question: 'How do I get a ViralRefer referral link?',
    answer:
      'Click "Get my referral link" on the homepage. You receive a unique trackable link in about 30 seconds — free, with no signup or email required.',
  },
  {
    question: 'Is ViralRefer free to use?',
    answer:
      'Yes. ViralRefer is completely free. There is no payment, no email signup, and no catch — just copy your link and share it.',
  },
  {
    question: 'What does the #1 referrer get?',
    answer:
      'The top referrer on the live leaderboard can claim a homepage banner feature for their website after verification (minimum referrals as shown on site). There is no cash prize.',
  },
  {
    question: 'How does the ViralRefer leaderboard work?',
    answer:
      'Every person who signs up through your unique referral link counts toward your total. Share on X, WhatsApp, LinkedIn, Telegram, SMS, or anywhere — then watch your rank climb on the live board.',
  },
] as const;

export function buildHomepageJsonLd(origin = SEO_SITE_ORIGIN): Record<string, unknown>[] {
  const base = origin.replace(/\/$/, '');
  return [
    {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: 'ViralRefer',
      url: base,
      description: HOMEPAGE_SEO.description,
      inLanguage: 'en-US',
      publisher: { '@type': 'Organization', name: 'ViralRefer', url: base },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: 'ViralRefer',
      url: base,
      logo: `${base}/favicon.svg`,
      description: HOMEPAGE_SEO.description,
    },
    {
      '@context': 'https://schema.org',
      '@type': 'WebApplication',
      name: 'ViralRefer',
      url: base,
      applicationCategory: 'BusinessApplication',
      operatingSystem: 'Web',
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
      description: HOMEPAGE_SEO.description,
    },
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: HOMEPAGE_FAQ.map((item) => ({
        '@type': 'Question',
        name: item.question,
        acceptedAnswer: { '@type': 'Answer', text: item.answer },
      })),
    },
  ];
}

export function buildSitemapXml(origin = SEO_SITE_ORIGIN, lastmod?: string): string {
  const base = origin.replace(/\/$/, '');
  const date = lastmod || new Date().toISOString().slice(0, 10);
  const urls = [
    { loc: `${base}/`, changefreq: 'daily', priority: '1.0' },
    { loc: `${base}/#how`, changefreq: 'weekly', priority: '0.8' },
    { loc: `${base}/#leaderboard`, changefreq: 'daily', priority: '0.9' },
    { loc: `${base}/#prize`, changefreq: 'weekly', priority: '0.7' },
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
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${body}
</urlset>
`;
}

export function buildRobotsTxt(origin = SEO_SITE_ORIGIN): string {
  const base = origin.replace(/\/$/, '');
  return `User-agent: *
Allow: /

User-agent: Googlebot
Allow: /

Disallow: /api/

Sitemap: ${base}/sitemap.xml
`;
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function upsertLinkRel(doc: Document, rel: string, href: string): void {
  let el = doc.querySelector(`link[rel="${rel}"]`) as HTMLLinkElement | null;
  if (!el) {
    el = doc.createElement('link');
    el.rel = rel;
    doc.head.appendChild(el);
  }
  el.href = href;
}

function upsertJsonLd(doc: Document, id: string, payload: Record<string, unknown>[]): void {
  let el = doc.getElementById(id) as HTMLScriptElement | null;
  if (!el) {
    el = doc.createElement('script');
    el.id = id;
    el.type = 'application/ld+json';
    doc.head.appendChild(el);
  }
  el.textContent = JSON.stringify(payload.length === 1 ? payload[0] : payload);
}

/** Homepage-only: canonical URL, JSON-LD refresh, optional Google Search Console verification. */
export function initOrganicSeo(loc: Location = location, doc: Document = document): void {
  if (parseRefFromLocation(loc)) return;

  const canonical = `${SEO_SITE_ORIGIN.replace(/\/$/, '')}/`;
  upsertLinkRel(doc, 'canonical', canonical);

  const graphs = buildHomepageJsonLd();
  upsertJsonLd(doc, 'vr-organic-jsonld', graphs);

  const verify = import.meta.env.VITE_GOOGLE_SITE_VERIFICATION as string | undefined;
  if (verify && verify.trim()) {
    let meta = doc.querySelector('meta[name="google-site-verification"]') as HTMLMetaElement | null;
    if (!meta) {
      meta = doc.createElement('meta');
      meta.name = 'google-site-verification';
      doc.head.appendChild(meta);
    }
    meta.content = verify.trim();
  }
}