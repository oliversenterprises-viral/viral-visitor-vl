/**
 * Canonical list of static URLs that must never 404 on production.
 *
 * - file: path under repo `public/` (directory routes use index.html)
 * - url: path on https://www.viralrefer.app
 *
 * Keep this list updated whenever you add a partner splash, tool, or public asset page.
 * Enforced by: scripts/smoke-static-routes.mjs (and deploy:prod preflight).
 */

/** @typedef {{ url: string, file: string, note?: string }} StaticRoute */

/**
 * Live www.viralrefer.app guide pages (hub + 20 articles).
 * Zip is the original Site Drops code to match — not the product.
 * Must stay as real files under public/guides so /guides/ never SPA-falls to the homepage.
 */
/** @type {StaticRoute[]} */
export const REQUIRED_GUIDE_PAGES = [
  { url: '/guides/', file: 'guides/index.html', note: 'guides hub' },
  { url: '/guides/site-drops/', file: 'guides/site-drops/index.html', note: 'Site Drop ladder' },
  { url: '/guides/no-signup-referral/', file: 'guides/no-signup-referral/index.html' },
  { url: '/guides/how-referrals-count/', file: 'guides/how-referrals-count/index.html' },
  { url: '/guides/homepage-banner/', file: 'guides/homepage-banner/index.html' },
  { url: '/guides/why-visits-dont-count/', file: 'guides/why-visits-dont-count/index.html' },
  { url: '/guides/operator-cannot-win/', file: 'guides/operator-cannot-win/index.html' },
  { url: '/guides/share-without-spam/', file: 'guides/share-without-spam/index.html' },
  { url: '/guides/no-email-referral-loop/', file: 'guides/no-email-referral-loop/index.html' },
  { url: '/guides/promoter-vs-racer/', file: 'guides/promoter-vs-racer/index.html' },
  { url: '/guides/skill-action-not-hit/', file: 'guides/skill-action-not-hit/index.html' },
  { url: '/guides/get-website-on-homepage/', file: 'guides/get-website-on-homepage/index.html' },
  { url: '/guides/copying-is-not-a-send/', file: 'guides/copying-is-not-a-send/index.html' },
  { url: '/guides/weekly-reset/', file: 'guides/weekly-reset/index.html' },
  { url: '/guides/claim-7-day-banner/', file: 'guides/claim-7-day-banner/index.html' },
  { url: '/guides/featured-partner-vs-race/', file: 'guides/featured-partner-vs-race/index.html' },
  { url: '/guides/traffic-exchanges-dont-count/', file: 'guides/traffic-exchanges-dont-count/index.html' },
  { url: '/guides/english-default/', file: 'guides/english-default/index.html' },
  { url: '/guides/paste-website-not-the-race/', file: 'guides/paste-website-not-the-race/index.html' },
  { url: '/guides/self-taps-dont-count/', file: 'guides/self-taps-dont-count/index.html' },
  { url: '/guides/referral-software-compared/', file: 'guides/referral-software-compared/index.html' },
];

/** @type {StaticRoute[]} */
export const REQUIRED_STATIC_ROUTES = [
  // Core
  { url: '/robots.txt', file: 'robots.txt' },
  { url: '/sitemap.xml', file: 'sitemap.xml' },
  { url: '/favicon.svg', file: 'favicon.svg' },
  { url: '/manifest.json', file: 'manifest.json' },
  { url: '/security.txt', file: 'security.txt' },
  { url: '/llms.txt', file: 'llms.txt', note: 'AEO / AI crawlers' },
  {
    url: '/google163d31ba24216edd.html',
    file: 'google163d31ba24216edd.html',
    note: 'Google Search Console',
  },
  { url: '/privacy/', file: 'privacy/index.html' },
  { url: '/terms/', file: 'terms/index.html' },
  { url: '/rules/', file: 'rules/index.html' },

  // Guides hub + 20 Site Drops articles (live destination; zip is match reference)
  ...REQUIRED_GUIDE_PAGES,
  { url: '/guides/promoter-vs-racer.md', file: 'guides/promoter-vs-racer.md' },
  { url: '/guides/no-email-referral-loop.md', file: 'guides/no-email-referral-loop.md' },
  { url: '/guides/skill-action-not-hit.md', file: 'guides/skill-action-not-hit.md' },

  // Tools hub
  { url: '/tools/', file: 'tools/index.html' },
  { url: '/tools/share-generator.html', file: 'tools/share-generator.html' },
  { url: '/tools/viral-calculator.html', file: 'tools/viral-calculator.html' },
  { url: '/tools/7-day-launch.html', file: 'tools/7-day-launch.html' },
  { url: '/tools/utm-builder.html', file: 'tools/utm-builder.html' },
  { url: '/tools/traffic-refer-kit.html', file: 'tools/traffic-refer-kit.html' },
  { url: '/tools/hook-bank.html', file: 'tools/hook-bank.html' },

  // Partner / splash directory
  { url: '/go/', file: 'go/index.html' },

  // Full-page splash (social / ads)
  { url: '/go/makers/', file: 'go/makers/index.html' },
  { url: '/go/race/', file: 'go/race/index.html' },
  { url: '/go/feature/', file: 'go/feature/index.html' },
  { url: '/go/challenge/', file: 'go/challenge/index.html' },
  { url: '/go/herculist/', file: 'go/herculist/index.html' },
  { url: '/go/adsboard/', file: 'go/adsboard/index.html' },
  { url: '/go/affiliates/', file: 'go/affiliates/index.html' },

  // Iframe-safe embed variants (traffic exchanges)
  { url: '/embed/makers/', file: 'embed/makers/index.html' },
  { url: '/embed/race/', file: 'embed/race/index.html' },
  { url: '/embed/feature/', file: 'embed/feature/index.html' },
  { url: '/embed/challenge/', file: 'embed/challenge/index.html' },
  { url: '/embed/herculist/', file: 'embed/herculist/index.html' },
  { url: '/embed/adsboard/', file: 'embed/adsboard/index.html' },
  { url: '/embed/ads/', file: 'embed/ads/index.html', note: 'ads iframe wrapper' },
];

export const PROD_ORIGIN = 'https://www.viralrefer.app';
