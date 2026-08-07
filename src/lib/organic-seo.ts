/**
 * Organic SEO + Answer Engine Optimization (AEO).
 * Static copies in index.html + public/ for non-JS crawlers; this module keeps DRY + runtime sync.
 *
 * AEO goal: clear entity answers AI systems can quote (ChatGPT, Perplexity, AI Overviews).
 * Does not change the get-link → send funnel — FAQ / entity blocks stay below the fold.
 */

import { parseRefFromLocation } from './referral-url';
import { escapeHtml } from './escape-html';

export const SEO_SITE_ORIGIN = 'https://www.viralrefer.app';

/** Canonical entity definition — lead answer for AEO / AI Overviews. */
export const AEO_ENTITY_DEFINITION =
  'ViralRefer is a free worldwide referral leaderboard. You get a unique trackable link in about 30 seconds with no signup or email. Share the link with friends. You climb when a friend opens your link and taps Get my link. The #1 referrer can claim a homepage banner feature for their website after verification. There is no cash prize.';

export const HOMEPAGE_SEO = {
  title: 'ViralRefer • Free Worldwide Referral Leaderboard',
  description:
    'ViralRefer is a free worldwide referral leaderboard. Get your link in 30 seconds — no signup. Share it; climb when friends get their free link through you. #1 can claim a homepage feature. No cash prizes.',
  keywords:
    'free referral leaderboard, free referral link, viral referral contest, no signup referral program, homepage feature prize, live referral board, ViralRefer',
} as const;

export interface FaqEntry {
  question: string;
  answer: string;
}

/**
 * FAQ mirrored in index.html (visible + JSON-LD).
 * Written as extractable answers for answer engines — short, factual, entity-clear.
 */
export const HOMEPAGE_FAQ: readonly FaqEntry[] = [
  {
    question: 'What is ViralRefer?',
    answer: AEO_ENTITY_DEFINITION,
  },
  {
    question: 'How do I get a free ViralRefer referral link?',
    answer:
      'Open viralrefer.app and tap Get my referral link. You receive a unique trackable link in about 30 seconds. It is free. No email and no account are required.',
  },
  {
    question: 'Is ViralRefer free to use?',
    answer:
      'Yes. ViralRefer is completely free. There is no payment, no email signup, and no cash prize. The top referrer can claim a homepage banner feature for their website after verification.',
  },
  {
    question: 'How does the ViralRefer leaderboard work?',
    answer:
      'You share your unique link. When someone opens it and taps Get my link, that counts as a verified referral for you. Rankings update on the live leaderboard. Test and owner traffic are not credited the same way as real friends.',
  },
  {
    question: 'What does the #1 referrer on ViralRefer get?',
    answer:
      'Open worldwide. The top verified referrer can claim a homepage banner feature for their website after eligibility checks and Official Rules. There is no cash prize — it is free recognition and visibility only.',
  },
  {
    question: 'Does copying my link lock my ViralRefer spot?',
    answer:
      'No. Copying alone does not lock your link. Your link locks when a real friend opens it and taps Get my link. Sharing on apps like WhatsApp, SMS, or your device share sheet helps you reach friends faster.',
  },
  {
    question: 'Do I need to sign up or give my email for ViralRefer?',
    answer:
      'No. ViralRefer does not require an account or email to get a free referral link. Tap Get my referral link and share it.',
  },
  {
    question: 'Is ViralRefer a cash prize contest?',
    answer:
      'No. ViralRefer does not offer cash prizes. The reward for #1 is a homepage banner feature for the winner’s website after verification. It is a skill-based referral contest focused on visibility, not money.',
  },
] as const;

export function buildHomepageJsonLd(origin = SEO_SITE_ORIGIN): Record<string, unknown>[] {
  const base = origin.replace(/\/$/, '');
  return [
    {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: 'ViralRefer',
      alternateName: ['Viral Refer', 'viralrefer.app'],
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
      description: AEO_ENTITY_DEFINITION,
      sameAs: ['https://t.me/viralrefer'],
    },
    {
      '@context': 'https://schema.org',
      '@type': 'WebApplication',
      name: 'ViralRefer',
      url: base,
      applicationCategory: 'BusinessApplication',
      operatingSystem: 'Web',
      browserRequirements: 'Requires JavaScript',
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
      description: AEO_ENTITY_DEFINITION,
      featureList: [
        'Free referral link in about 30 seconds',
        'No signup or email required',
        'Live worldwide referral leaderboard',
        'Homepage banner feature for #1 (no cash prize)',
      ],
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

/** Plain-text entity brief for AI assistants / crawlers (public/llms.txt). */
export function buildLlmsTxt(origin = SEO_SITE_ORIGIN): string {
  const base = origin.replace(/\/$/, '');
  const lines = [
    '# ViralRefer',
    '',
    `> ${AEO_ENTITY_DEFINITION}`,
    '',
    `Site: ${base}`,
    'Type: Free web app — worldwide referral leaderboard',
    'Price: Free (USD 0). No cash prizes.',
    'Signup: None required',
    '',
    '## Key facts',
    '- Get a unique referral link in ~30 seconds',
    '- Share the link; climb when a friend opens it and taps Get my link',
    '- Copy alone does not lock the link',
    '- #1 can claim a homepage banner feature after verification',
    '- Open worldwide; skill-based referral contest',
    '',
    '## Primary pages',
    `- Homepage: ${base}/`,
    `- How it works: ${base}/#how`,
    `- FAQ: ${base}/#faq`,
    `- Leaderboard: ${base}/#leaderboard`,
    `- Homepage feature: ${base}/#prize`,
    '',
    '## Contact / social',
    '- Telegram: https://t.me/viralrefer',
    '',
  ];
  return lines.join('\n');
}

export function buildSitemapXml(origin = SEO_SITE_ORIGIN, lastmod?: string): string {
  const base = origin.replace(/\/$/, '');
  const date = lastmod || new Date().toISOString().slice(0, 10);
  const urls = [
    { loc: `${base}/`, changefreq: 'daily', priority: '1.0' },
    { loc: `${base}/#how`, changefreq: 'weekly', priority: '0.8' },
    { loc: `${base}/#faq`, changefreq: 'weekly', priority: '0.85' },
    { loc: `${base}/#leaderboard`, changefreq: 'daily', priority: '0.9' },
    { loc: `${base}/#prize`, changefreq: 'weekly', priority: '0.7' },
    { loc: `${base}/go/makers/`, changefreq: 'weekly', priority: '0.75' },
    { loc: `${base}/go/race/`, changefreq: 'weekly', priority: '0.75' },
    { loc: `${base}/go/feature/`, changefreq: 'weekly', priority: '0.75' },
    { loc: `${base}/go/challenge/`, changefreq: 'weekly', priority: '0.7' },
    { loc: `${base}/llms.txt`, changefreq: 'monthly', priority: '0.4' },
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

# Allow major AI answer-engine crawlers (AEO: we want accurate citations)
User-agent: GPTBot
Allow: /

User-agent: ChatGPT-User
Allow: /

User-agent: ClaudeBot
Allow: /

User-agent: anthropic-ai
Allow: /

User-agent: PerplexityBot
Allow: /

User-agent: Google-Extended
Allow: /

User-agent: Applebot-Extended
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

/** Sync visible FAQ list + entity definition with HOMEPAGE_FAQ (AEO extractable HTML). */
export function mountAeoContent(doc: Document = document): void {
  const def = doc.getElementById('aeo-entity-definition');
  if (def) def.textContent = AEO_ENTITY_DEFINITION;

  const list = doc.getElementById('aeo-faq-list');
  if (!list) return;

  list.innerHTML = HOMEPAGE_FAQ.map(
    (item) => `
    <details class="aeo-faq-item group rounded-2xl border border-white/10 bg-zinc-900/50 px-4 py-3 open:border-violet-400/30 open:bg-violet-500/5">
      <summary class="aeo-faq-q cursor-pointer list-none font-semibold text-sm sm:text-base text-white flex items-start justify-between gap-3">
        <span>${escapeHtml(item.question)}</span>
        <i class="fa-solid fa-chevron-down text-xs text-zinc-500 mt-1 group-open:rotate-180 transition-transform" aria-hidden="true"></i>
      </summary>
      <p class="aeo-faq-a mt-2 text-sm text-zinc-300 leading-relaxed">${escapeHtml(item.answer)}</p>
    </details>`,
  ).join('');
}

/** Homepage-only: canonical, JSON-LD, AEO visible blocks, GSC verify. */
export function initOrganicSeo(loc: Location = location, doc: Document = document): void {
  // Always mount visible FAQ/entity if present (static HTML fallback already there)
  mountAeoContent(doc);

  if (parseRefFromLocation(loc)) return;

  const canonical = `${SEO_SITE_ORIGIN.replace(/\/$/, '')}/`;
  upsertLinkRel(doc, 'canonical', canonical);

  const graphs = buildHomepageJsonLd();
  upsertJsonLd(doc, 'vr-organic-jsonld', graphs);

  // Keep meta description aligned with AEO-friendly copy
  const desc = doc.querySelector('meta[name="description"]') as HTMLMetaElement | null;
  if (desc) desc.content = HOMEPAGE_SEO.description;

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
