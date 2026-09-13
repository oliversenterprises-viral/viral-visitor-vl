/**
 * Organic search + answer-engine (AEO) helpers for the Cloudflare Site Drops sibling.
 * Static copies live in public/ + index.html so non-JS crawlers still see them.
 * Pages Functions rewrite request origin and apply ?lang= on the homepage.
 *
 * Honesty: no fake ratings, MRR, testimonials, or invented user counts.
 */

export const SEO_DEFAULT_ORIGIN = 'https://viralrefer-ultra.pages.dev';
export const SEO_LASTMOD = '2026-09-13';
export const SEO_THEME_COLOR = '#09090b';
export const SEO_SITE_NAME = 'ViralRefer Site Drops';

export const SEO_LOCALES = [
  'en',
  'es',
  'fr',
  'pt',
  'de',
  'hi',
  'ar',
  'zh',
  'ja',
  'ko',
  'ru',
  'id',
  'tr',
  'it',
  'nl',
  'pl',
  'vi',
  'th',
  'uk',
  'bn',
  'ur',
  'ms',
  'fil',
  'sw',
  'sv',
  'ro',
] as const;

export type SeoLocale = (typeof SEO_LOCALES)[number];

export const SEO_RTL_LOCALES = ['ar', 'ur'] as const;

export const OG_LOCALE: Record<SeoLocale, string> = {
  en: 'en_US',
  es: 'es_ES',
  fr: 'fr_FR',
  pt: 'pt_BR',
  de: 'de_DE',
  hi: 'hi_IN',
  ar: 'ar_SA',
  zh: 'zh_CN',
  ja: 'ja_JP',
  ko: 'ko_KR',
  ru: 'ru_RU',
  id: 'id_ID',
  tr: 'tr_TR',
  it: 'it_IT',
  nl: 'nl_NL',
  pl: 'pl_PL',
  vi: 'vi_VN',
  th: 'th_TH',
  uk: 'uk_UA',
  bn: 'bn_BD',
  ur: 'ur_PK',
  ms: 'ms_MY',
  fil: 'fil_PH',
  sw: 'sw_KE',
  sv: 'sv_SE',
  ro: 'ro_RO',
};

export const HOMEPAGE_SEO = {
  title: 'Win the ViralRefer homepage — Site Drops + #1 banner',
  description:
    'Get a free ViralRefer referral link in about 30 seconds. Send it. When a unique friend taps Get my link, your site can go live here — Rising drop, week text line, then the 7-day #1 banner. Visiting does not count. No cash prize. Recognition only.',
  ogTitle: 'Win the homepage. #1 gets a banner — tap Get my link',
  ogDescription:
    "I'm racing for the homepage this week. #1 puts their site on this page for 7 days. Tap Get my link. Visiting does not count.",
  keywords:
    'ViralRefer, Site Drops, free referral link, viral referral leaderboard, homepage banner, no signup, no cash prize, traffic exchange destination',
} as const;

export const TE_SEO = {
  title: 'Traffic exchange destinations — ViralRefer Site Drops',
  description:
    'Honest traffic-exchange and rotator destinations for ViralRefer Site Drops. Opening /te never credits anyone. TE-tagged Get my link hits do not climb #1. Use src=te, iframe sizes, and the promo kit.',
} as const;

export const GO_SEO = {
  title: 'Open ViralRefer Site Drops — Get my link (breakout)',
  description:
    'You left a rotator or sponsor slot. /go opens the real ViralRefer Site Drops funnel. Opening this page does not count. Tap Get my link — no email, no cash prize, unique friend taps only.',
} as const;

export const PROMO_TE_SEO = {
  title: 'TE promo kit — ViralRefer Site Drops banners and iframes',
  description:
    'Copy-paste iframe snippets, SVG banners, and rotator URLs for ViralRefer Site Drops. Do not iframe the homepage. TE hits never take the #1 banner. Visits do not count.',
} as const;

export interface FaqEntry {
  question: string;
  answer: string;
}

/** Homepage FAQ — mirrored in index.html JSON-LD and visible FAQ copy. */
export const HOMEPAGE_FAQ: readonly FaqEntry[] = [
  {
    question: 'How do I get a ViralRefer referral link?',
    answer:
      'Tap Get my referral link on the Site Drops homepage. About 30 seconds. No signup and no email. Codes look like VIRAL-XXXXXXX and work as /r/VIRAL-…, /a/VIRAL-…, and ?ref=.',
  },
  {
    question: 'Is ViralRefer Site Drops free?',
    answer: 'Yes. No payment. No email. No cash prize. The #1 slot is a 7-day homepage banner — recognition only.',
  },
  {
    question: 'What does #1 get?',
    answer:
      "This week's top racer (not the site owner) with 3 unique friends who tapped Get my link can claim a 7-day homepage banner for their website. Recognition only. There is no cash prize.",
  },
  {
    question: 'How does the board work?',
    answer:
      'A friend opens your /r/VIRAL-… or /a/VIRAL-… link and taps Get my link. Visiting, refreshing, or copying alone does not count. Same-browser self-taps do not count.',
  },
  {
    question: 'How do Site Drops climb?',
    answer:
      'Paste your website after Get my link. Just entered is 15 minutes on this homepage. 1 unique friend → 1-hour Rising card. 2 friends → week text line. Board #2/#3 → Challenger strip. Weekly #1 with 3 friends → 7-day banner.',
  },
  {
    question: 'Do traffic-exchange visits count?',
    answer:
      'No. Opening /te never writes a credit. A Get my link tagged src=te still issues a share kit but does not write a verified credit toward Rising, Challenger, or #1 unless the owner explicitly allows TE credits (off by default).',
  },
];

export const TE_FAQ: readonly FaqEntry[] = [
  {
    question: 'What URL should a rotator use?',
    answer:
      'Use /te?src=te&camp=YOURCAMP for iframes, or add size=728x90, size=468x60, or size=300x250. After a real click, send people to /go or /join with the same tags. Do not iframe the homepage or /admin.',
  },
  {
    question: 'Does a traffic-exchange impression count as a referral?',
    answer:
      'No. Opening /te is not a credit. Unique friends who tap Get my link without a TE tag are what climb the board.',
  },
  {
    question: 'Can TE traffic win the #1 banner?',
    answer:
      'Not by default. TE-tagged Get my link hits do not write verified credits. The #1 banner stays a unique-friend contest.',
  },
];

export function isSeoLocale(raw: string | null | undefined): raw is SeoLocale {
  return !!raw && (SEO_LOCALES as readonly string[]).includes(raw);
}

export function isRtlSeoLocale(locale: string): boolean {
  return (SEO_RTL_LOCALES as readonly string[]).includes(locale);
}

/** Map ?lang= / ?locale= (and common aliases) to a supported locale. */
export function localeFromSearch(search: string | URLSearchParams): SeoLocale | null {
  const q = typeof search === 'string' ? new URLSearchParams(search.startsWith('?') ? search : `?${search}`) : search;
  const raw = (q.get('lang') || q.get('locale') || '').trim().toLowerCase().replace(/_/g, '-');
  if (!raw) return null;
  if (isSeoLocale(raw)) return raw;
  if (raw === 'tl' || raw === 'tl-ph' || raw === 'fil-ph') return 'fil';
  const base = raw.split('-')[0] || '';
  if (base === 'tl') return 'fil';
  return isSeoLocale(base) ? base : null;
}

export function normalizeOrigin(origin?: string): string {
  const raw = (origin || SEO_DEFAULT_ORIGIN).trim().replace(/\/$/, '');
  return raw || SEO_DEFAULT_ORIGIN;
}

export function ogImageUrl(origin?: string): string {
  return `${normalizeOrigin(origin)}/og.svg`;
}

export function languageUrl(origin: string, path: string, locale?: SeoLocale | null): string {
  const base = `${normalizeOrigin(origin)}${path.startsWith('/') ? path : `/${path}`}`;
  if (!locale || locale === 'en') return base;
  const joiner = base.includes('?') ? '&' : '?';
  return `${base}${joiner}lang=${locale}`;
}

export function buildHreflangEntries(origin: string, path = '/'): { lang: string; href: string }[] {
  const base = normalizeOrigin(origin);
  const entries: { lang: string; href: string }[] = [
    { lang: 'x-default', href: languageUrl(base, path, null) },
  ];
  for (const loc of SEO_LOCALES) {
    entries.push({ lang: loc, href: languageUrl(base, path, loc) });
  }
  return entries;
}

export function hreflangLinkTags(origin: string, path = '/'): string {
  return buildHreflangEntries(origin, path)
    .map((e) => `<link rel="alternate" hreflang="${escapeHtml(e.lang)}" href="${escapeHtml(e.href)}">`)
    .join('\n    ');
}

export function buildHomepageJsonLd(origin?: string): Record<string, unknown>[] {
  const base = normalizeOrigin(origin);
  const desc = HOMEPAGE_SEO.description;
  return [
    {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: 'ViralRefer',
      url: base,
      logo: `${base}/favicon.svg`,
      description: desc,
      sameAs: ['https://www.viralrefer.app'],
    },
    {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: SEO_SITE_NAME,
      url: base,
      description: desc,
      inLanguage: SEO_LOCALES.map((loc) => loc),
      publisher: { '@type': 'Organization', name: 'ViralRefer', url: base },
    },
    {
      '@context': 'https://schema.org',
      '@type': ['SoftwareApplication', 'WebApplication'],
      name: SEO_SITE_NAME,
      url: base,
      applicationCategory: 'BusinessApplication',
      operatingSystem: 'Web',
      browserRequirements: 'Requires JavaScript for Get my link; public rules are in the HTML.',
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
      description: desc,
      featureList: [
        'No-signup referral link (VIRAL- codes)',
        'Site Drops ladder on the homepage',
        'Live leaderboard from unique Get my link credits',
        '7-day #1 homepage banner — recognition only, no cash prize',
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
    {
      '@context': 'https://schema.org',
      '@type': 'HowTo',
      name: 'How ViralRefer Site Drops works',
      description: HOMEPAGE_SEO.ogDescription,
      totalTime: 'PT1M',
      step: [
        {
          '@type': 'HowToStep',
          position: 1,
          name: 'Get your link',
          text: 'Tap Get my referral link. No email. Paste your website for a 15-minute Just entered chip. Getting a link alone does not put you on the homepage.',
        },
        {
          '@type': 'HowToStep',
          position: 2,
          name: 'Send your link',
          text: 'Send /r/VIRAL-… in any app. A friend must open it and tap Get my link. Visiting or copying does not count.',
        },
        {
          '@type': 'HowToStep',
          position: 3,
          name: 'Watch your site climb',
          text: '1 unique friend → Rising. 2 friends → week text line. #2/#3 → Challenger. Weekly #1 with 3 friends → 7-day banner.',
        },
      ],
    },
  ];
}

export function buildFaqJsonLd(origin: string, faqs: readonly FaqEntry[], name: string): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    name,
    url: origin,
    mainEntity: faqs.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: { '@type': 'Answer', text: item.answer },
    })),
  };
}

export function jsonLdScript(payload: Record<string, unknown>[] | Record<string, unknown>, id = 'vr-organic-jsonld'): string {
  return `<script type="application/ld+json" id="${escapeHtml(id)}">${JSON.stringify(payload)}</script>`;
}

export function buildRobotsTxt(origin?: string): string {
  const base = normalizeOrigin(origin);
  return `User-agent: *
Allow: /
Allow: /te
Allow: /go
Allow: /promo/te
Allow: /promo/te/
Allow: /llms.txt
Allow: /llms-full.txt
Allow: /sitemap.xml
Allow: /og.svg
Allow: /api/og
Allow: /favicon.svg

Disallow: /admin
Disallow: /admin/
Disallow: /api/
Disallow: /embed/
Disallow: /e/

# Personal share landings are noindex in HTML (not doorway pages).
# Social crawlers still fetch /r/ and /a/ for Open Graph cards.

User-agent: Googlebot
Allow: /

User-agent: GPTBot
Allow: /

User-agent: ChatGPT-User
Allow: /

User-agent: ClaudeBot
Allow: /

User-agent: PerplexityBot
Allow: /

User-agent: Google-Extended
Allow: /

User-agent: Applebot-Extended
Allow: /

User-agent: Amazonbot
Allow: /

Sitemap: ${base}/sitemap.xml
`;
}

export interface SitemapUrl {
  loc: string;
  changefreq: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never';
  priority: string;
  alternates?: boolean;
}

export function sitemapUrlEntries(origin?: string): SitemapUrl[] {
  const base = normalizeOrigin(origin);
  const urls: SitemapUrl[] = [
    { loc: `${base}/`, changefreq: 'daily', priority: '1.0', alternates: true },
    { loc: `${base}/te`, changefreq: 'weekly', priority: '0.8' },
    { loc: `${base}/go`, changefreq: 'weekly', priority: '0.8' },
    { loc: `${base}/promo/te/`, changefreq: 'weekly', priority: '0.7' },
  ];
  for (const loc of SEO_LOCALES) {
    if (loc === 'en') continue;
    urls.push({ loc: languageUrl(base, '/', loc), changefreq: 'daily', priority: '0.8', alternates: true });
  }
  return urls;
}

export function buildSitemapXml(origin?: string, lastmod?: string): string {
  const base = normalizeOrigin(origin);
  const date = lastmod || SEO_LASTMOD;
  const body = sitemapUrlEntries(base)
    .map((u) => {
      const links = u.alternates
        ? `\n${buildHreflangEntries(base, '/')
            .map((e) => `    <xhtml:link rel="alternate" hreflang="${escapeXml(e.lang)}" href="${escapeXml(e.href)}"/>`)
            .join('\n')}`
        : '';
      return `  <url>
    <loc>${escapeXml(u.loc)}</loc>
    <lastmod>${date}</lastmod>
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>${links}
  </url>`;
    })
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
${body}
</urlset>
`;
}

export function buildLlmsTxt(origin?: string): string {
  const base = normalizeOrigin(origin);
  return `# ViralRefer Site Drops

> Cloudflare sibling of ViralRefer: a free, no-signup referral race where unique friends tapping **Get my link** put a website on this homepage. Recognition only. No cash prize.

This host (${base}) is an enhanced Site Drops product on Cloudflare Pages. Same VIRAL- codes as https://www.viralrefer.app. It does **not** replace that site.

## What it is

- Instant personal referral link (about 30 seconds, no email)
- Codes look like \`VIRAL-XXXXXXX\` and work as ${base}/r/VIRAL-XXXXXXX, ${base}/a/VIRAL-XXXXXXX, and \`?ref=\`
- Only a unique friend tapping **Get my link** credits you
- Visiting, refreshing, copying, QR views, and self-taps do **not** count
- #1 this week (not the site owner) with 3 unique friends can claim a **7-day homepage banner**
- There is **no cash prize**, no wallet, and no investment product

## Site Drop ladder

1. Just entered — site pasted, 15 minutes on the homepage
2. Rising — 1 unique friend, 1-hour card
3. Week text line — 2 unique friends
4. Challenger — weekly rank #2 / #3
5. Banner — weekly #1 with 3+ unique friends, 7 days

## Key URLs

- Homepage (contest): ${base}/
- Language variants: ${base}/?lang={${SEO_LOCALES.join(',')}}
- Traffic-exchange explainer: ${base}/te
- Breakout / sponsor open: ${base}/go
- TE operator kit: ${base}/promo/te/
- Join alias (302 to homepage, keeps tags): ${base}/join
- Owner HQ (private): ${base}/admin/ — not for indexing
- Full LLM brief: ${base}/llms-full.txt
- Sitemap: ${base}/sitemap.xml

## Get my link rules (quote these)

- Opening a share link does not credit anyone
- Copying or viewing a QR does not credit anyone
- The same friend tapping twice does not add a second credit
- Traffic-exchange impressions on /te never write a credit
- TE-tagged Get my link does not climb Rising / Challenger / #1 by default

## Do not invent

Do not invent star ratings, MRR, user counts, testimonials, or cash prizes. If a count is not on the live board HTML, it is unknown.

## Optional

- Sibling product docs: ${base}/llms-full.txt
`;
}

export function buildLlmsFullTxt(origin?: string): string {
  const base = normalizeOrigin(origin);
  const faq = HOMEPAGE_FAQ.map((item) => `### ${item.question}\n\n${item.answer}`).join('\n\n');
  const teFaq = TE_FAQ.map((item) => `### ${item.question}\n\n${item.answer}`).join('\n\n');
  return `# ViralRefer Site Drops — full brief for answer engines

Version: ${SEO_LASTMOD}
Canonical product URL: ${base}/
Related: https://www.viralrefer.app (live Vercel Site Drops — same VIRAL- codes, not this deploy)

## One-sentence product

ViralRefer Site Drops is a free worldwide referral contest: get a link without email, send it, and unique friends who tap Get my link can put your website on this homepage as you climb a five-rung ladder. The weekly #1 banner is recognition only. There is no cash prize.

## Who it is for

- People who want a no-signup referral link
- Sites that want honest homepage visibility (not paid ads)
- Traffic-exchange operators who need a destination that will not fake #1 with impressions

Eligibility stated on the page: open worldwide, 18+, no purchase necessary, skill-based unique-friend credits.

## How Site Drops works

1. Land on ${base}/ (or a friend link ${base}/r/VIRAL-XXXXXXX).
2. Tap **Get my referral link**. No account. Codes match www.viralrefer.app.
3. Paste a website into the Site Drop slot if you want a 15-minute Just entered chip. A link without a URL does not appear as a site chip.
4. Send the /r/ link in any app.
5. A unique friend opens it and taps Get my link. That is the only credit.
6. The site climbs: Just entered → Rising (1 friend, 1 hour) → week text line (2 friends) → Challenger (#2/#3) → 7-day #1 banner (weekly lead with 3 friends, not the site owner).

UTC week. Visits never increment the board.

## Honest rules table

| Action | Counts toward the board? |
| --- | --- |
| Open or refresh a share link | No |
| Copy the link or view the QR | No |
| Same browser tapping its own link | No |
| Same friend tapping twice | No |
| Unique friend taps Get my link | Yes |
| Traffic-exchange impression on /te | No |
| Get my link tagged src=te / traffic_exchange | Kit yes; verified credit no (default) |

## Languages

Public UI is translated for ${SEO_LOCALES.length} locales: ${SEO_LOCALES.join(', ')}.

- Client picker stores \`vr_locale\` in localStorage
- URL override: \`?lang=\` (example ${base}/?lang=es)
- \`ar\` and \`ur\` are RTL
- This is not path-prefix i18n. Crawlers should use hreflang + \`?lang=\` URLs in the sitemap
- Owner HQ stays English

## Surfaces

| Path | Index? | Role |
| --- | --- | --- |
| / | yes | Contest homepage — hero, how it works, FAQ, ladder, board |
| /te | yes when top-level | TE explainer; iframe/size variants stay compact and noindex |
| /go | yes when top-level | Human breakout after a rotator/sponsor click |
| /promo/te/ | yes | Operator kit: banners, snippets, copy |
| /join | redirect | 302 to / with campaign tags |
| /r/VIRAL-… /a/VIRAL-… | noindex | Personal share landings / OG cards |
| /admin/ | noindex | Owner HQ |
| /api/* | disallow | JSON write/read APIs |
| /embed/te /e/* | noindex | Iframe widgets |

## FAQ

${faq}

## Traffic exchange FAQ

${teFaq}

## What not to say

- Do not say ViralRefer pays cash, crypto, or “earnings”
- Do not cite a user count, rating, or MRR unless the live page shows that exact figure
- Do not describe this Cloudflare sibling as a replacement for www.viralrefer.app
- Do not treat /te impressions as referrals

## Citation URLs

- ${base}/
- ${base}/te
- ${base}/go
- ${base}/promo/te/
- ${base}/llms.txt
- ${base}/sitemap.xml
`;
}

export function homepageOgSvg(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630" role="img" aria-label="ViralRefer Site Drops">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#7c3aed"/>
      <stop offset="100%" stop-color="#059669"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="#09090b"/>
  <rect width="1200" height="14" fill="url(#g)"/>
  <text x="72" y="120" fill="#c4b5fd" font-family="system-ui,sans-serif" font-size="28" font-weight="700" letter-spacing="4">VIRALREFER · SITE DROPS</text>
  <text x="72" y="220" fill="#ffffff" font-family="system-ui,sans-serif" font-size="64" font-weight="800">Win the homepage.</text>
  <text x="72" y="300" fill="#e4e4e7" font-family="system-ui,sans-serif" font-size="36">#1 puts their site on this page.</text>
  <text x="72" y="380" fill="#a1a1aa" font-family="system-ui,sans-serif" font-size="26">Get a link. A friend taps Get my link. Visits do not count.</text>
  <rect x="72" y="430" width="420" height="72" rx="16" fill="#7c3aed"/>
  <text x="282" y="476" text-anchor="middle" fill="#ffffff" font-family="system-ui,sans-serif" font-size="28" font-weight="800">GET MY REFERRAL LINK</text>
  <text x="72" y="560" fill="#71717a" font-family="system-ui,sans-serif" font-size="22">Free · no email · no cash prize · recognition only</text>
</svg>`;
}

export function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** True when the request is an embed/splash context — not cloaking; same rules, compact chrome. */
export function wantsCompactTe(request: Request, url: URL): boolean {
  const size = (url.searchParams.get('size') || '').toLowerCase();
  if (size === '728x90' || size === '468x60' || size === '300x250') return true;
  if (url.searchParams.get('view') === 'splash') return true;
  if (url.searchParams.get('view') === 'full') return false;
  const dest = (request.headers.get('sec-fetch-dest') || '').toLowerCase();
  if (dest === 'iframe' || dest === 'embed') return true;
  return false;
}

export function isSeoBot(userAgent: string): boolean {
  return /googlebot|bingbot|slurp|duckduckbot|baiduspider|yandexbot|applebot|gptbot|chatgpt-user|claudebot|perplexitybot|amazonbot|bytespider|ccbot|anthropic-ai|google-extended|applebot-extended/i.test(
    userAgent,
  );
}
