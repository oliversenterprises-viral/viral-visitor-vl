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

/** @type {StaticRoute[]} */
export const REQUIRED_STATIC_ROUTES = [
  // Core
  { url: '/robots.txt', file: 'robots.txt' },
  { url: '/sitemap.xml', file: 'sitemap.xml' },
  { url: '/favicon.svg', file: 'favicon.svg' },
  { url: '/manifest.json', file: 'manifest.json' },
  { url: '/security.txt', file: 'security.txt' },
  { url: '/llms.txt', file: 'llms.txt', note: 'AEO / AI crawlers' },
  { url: '/privacy/', file: 'privacy/index.html' },
  { url: '/terms/', file: 'terms/index.html' },
  { url: '/rules/', file: 'rules/index.html' },

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
  { url: '/go/sponsor/', file: 'go/sponsor/index.html', note: 'Sponsored Featured Partner $29/7 days' },

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
