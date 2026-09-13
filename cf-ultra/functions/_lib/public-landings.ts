import { breakoutUrl, campaignFromSearch } from './campaign';
import { edgeI18nSnippet } from './i18n-edge';
import { isReferralCode } from './engine';
import {
  GO_SEO,
  HOMEPAGE_FAQ,
  PROMO_TE_SEO,
  SEO_THEME_COLOR,
  TE_FAQ,
  TE_SEO,
  buildFaqJsonLd,
  escapeHtml,
  hreflangLinkTags,
  jsonLdScript,
  ogImageUrl,
} from '../../src/lib/organic-seo';

function layout(opts: {
  origin: string;
  path: string;
  title: string;
  description: string;
  canonical: string;
  robots: string;
  body: string;
  jsonLd?: Record<string, unknown> | Record<string, unknown>[];
}): string {
  const image = ogImageUrl(opts.origin);
  const ld = opts.jsonLd ? `\n    ${jsonLdScript(opts.jsonLd)}` : '';
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <title>${escapeHtml(opts.title)}</title>
  <meta name="description" content="${escapeHtml(opts.description)}">
  <meta name="robots" content="${escapeHtml(opts.robots)}">
  <link rel="canonical" href="${escapeHtml(opts.canonical)}">
  ${hreflangLinkTags(opts.origin, opts.path)}
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="ViralRefer">
  <meta property="og:locale" content="en_US">
  <meta property="og:url" content="${escapeHtml(opts.canonical)}">
  <meta property="og:title" content="${escapeHtml(opts.title)}">
  <meta property="og:description" content="${escapeHtml(opts.description)}">
  <meta property="og:image" content="${escapeHtml(image)}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:url" content="${escapeHtml(opts.canonical)}">
  <meta name="twitter:title" content="${escapeHtml(opts.title)}">
  <meta name="twitter:description" content="${escapeHtml(opts.description)}">
  <meta name="twitter:image" content="${escapeHtml(image)}">
  <meta name="theme-color" content="${SEO_THEME_COLOR}">
  <link rel="icon" type="image/svg+xml" href="/favicon.svg">
  <link rel="alternate" type="text/plain" href="${escapeHtml(opts.origin)}/llms.txt" title="llms.txt">
  <style>
    :root { color-scheme: dark; }
    html, body { margin: 0; background: #09090b; color: #f4f4f5; font-family: Inter, ui-sans-serif, system-ui, sans-serif; }
    a { color: #c4b5fd; }
    header { border-bottom: 1px solid rgba(255,255,255,.1); padding: 16px 20px; }
    header a.brand { color: #fff; text-decoration: none; font-weight: 800; letter-spacing: -.03em; }
    nav a { margin-inline-end: 14px; font-size: 14px; }
    main { max-width: 760px; margin: 0 auto; padding: 32px 20px 80px; }
    .kicker { color: #c4b5fd; letter-spacing: .14em; font-size: 11px; font-weight: 800; }
    h1 { font-size: clamp(32px, 6vw, 52px); letter-spacing: -.04em; line-height: 1.05; margin: 10px 0 16px; }
    h2 { font-size: 22px; margin: 36px 0 10px; }
    p, li { color: #d4d4d8; line-height: 1.55; }
    .lead { font-size: 18px; color: #e4e4e7; }
    .cta {
      display: inline-block; margin: 18px 0; padding: 14px 22px; border-radius: 14px; text-decoration: none;
      background: linear-gradient(90deg, #059669, #7c3aed); color: #fff; font-weight: 800;
    }
    .fine { color: #a1a1aa; font-size: 13px; }
    table { width: 100%; border-collapse: collapse; font-size: 14px; }
    th, td { text-align: left; padding: 8px 6px; border-bottom: 1px solid rgba(255,255,255,.08); }
    footer { max-width: 760px; margin: 0 auto; padding: 0 20px 48px; color: #71717a; font-size: 12px; }
  </style>${ld}
</head>
<body>
  <header>
    <a class="brand" href="/">ViralRefer</a>
    <nav>
      <a href="/#how">How</a>
      <a href="/#prize">Feature</a>
      <a href="/#leaderboard">Board</a>
      <a href="/te">Traffic exchange</a>
      <a href="/promo/te/">Promo kit</a>
    </nav>
  </header>
  ${opts.body}
  <footer>
    <p>© 2026 ViralRefer. Skill-based referral contest. No purchase necessary. Open worldwide, 18+. No cash prizes. Unique Get my link credits only.</p>
    <p><a href="/llms.txt">llms.txt</a> · <a href="/sitemap.xml">sitemap</a> · <a href="/">Site Drops homepage</a></p>
  </footer>
  ${edgeI18nSnippet({ picker: false })}
</body>
</html>`;
}

export function teLandingHtml(opts: { origin: string; url: URL }): string {
  const camp = campaignFromSearch(opts.url.searchParams);
  const refRaw = (opts.url.searchParams.get('ref') || '').toUpperCase();
  const ref = isReferralCode(refRaw) ? refRaw : '';
  const open = breakoutUrl(opts.origin, camp, ref || null, opts.url.searchParams);
  const canonical = `${opts.origin}/te`;
  const body = `
  <main>
    <p class="kicker">TRAFFIC EXCHANGE · SITE DROPS</p>
    <h1>Honest rotator destinations. Impressions never take #1.</h1>
    <p class="lead">Use <code>/te</code> when you buy or run hit-exchange traffic to ViralRefer Site Drops. Opening this page does not credit anyone. A friend tapping <strong>Get my link</strong> is the only action that climbs the board.</p>
    <a class="cta" href="${escapeHtml(open)}" target="_top" rel="noopener">Open — Get my link</a>
    <p class="fine">Keep <code>src=te</code> and your campaign tag on the URL. Cookies are optional.</p>

    <h2>Why this page exists</h2>
    <p>Traffic exchanges need a destination that will not turn raw visits into fake leaderboard ranks. ViralRefer Site Drops separates <em>impressions</em> from <em>unique friend locks</em>. Rotators should iframe the compact splash (<code>/te?size=468x60</code>) and send real clicks here or to <a href="/go">/go</a>.</p>

    <h2>Put these in the rotator</h2>
    <table>
      <tr><th>URL</th><th>Use</th></tr>
      <tr><td><code>/te?src=te&amp;camp=YOURCAMP</code></td><td>This explainer or the compact unit when <code>size=</code> is set</td></tr>
      <tr><td><code>/splash?src=te&amp;camp=YOURCAMP</code></td><td>Full-viewport conversion splash (homepage look, noindex)</td></tr>
      <tr><td><code>/te?src=te&amp;size=728x90</code></td><td>Leaderboard iframe</td></tr>
      <tr><td><code>/embed/te?src=te&amp;size=300x250</code></td><td>Box iframe</td></tr>
      <tr><td><code>/go?src=te&amp;camp=YOURCAMP</code></td><td>Same conversion splash as /splash after a click</td></tr>
      <tr><td><code>/join?src=te</code></td><td>302 into the homepage funnel</td></tr>
    </table>
    <p>Do <strong>not</strong> iframe the homepage or Owner HQ. Race traffic: <code>/te?src=te&amp;ref=VIRAL-XXXXXXX</code>.</p>

    <h2>Integrity</h2>
    <ul>
      <li>Opening <code>/te</code> never writes a credit.</li>
      <li>TE-tagged Get my link still issues a share kit, but does not write a verified credit toward Rising, Challenger, or #1 (default).</li>
      <li>The 7-day banner stays a unique-friend contest. Recognition only. No cash prize.</li>
    </ul>

    <h2>FAQ</h2>
    ${TE_FAQ.map((item) => `<h3>${escapeHtml(item.question)}</h3><p>${escapeHtml(item.answer)}</p>`).join('\n    ')}

    <p><a href="/promo/te/">Open the TE promo kit</a> for banners and copy-paste iframe snippets. <a href="/#how">How Site Drops works</a>.</p>
  </main>`;
  return layout({
    origin: opts.origin,
    path: '/te',
    title: TE_SEO.title,
    description: TE_SEO.description,
    canonical,
    robots: 'index, follow, max-image-preview:large',
    body,
    jsonLd: [
      {
        '@context': 'https://schema.org',
        '@type': 'WebPage',
        name: TE_SEO.title,
        url: canonical,
        description: TE_SEO.description,
        isPartOf: { '@type': 'WebSite', name: 'ViralRefer Site Drops', url: opts.origin },
      },
      buildFaqJsonLd(canonical, TE_FAQ, TE_SEO.title),
    ],
  });
}

export function goLandingHtml(opts: { origin: string; url: URL }): string {
  const camp = campaignFromSearch(opts.url.searchParams);
  const refRaw = (opts.url.searchParams.get('ref') || '').toUpperCase();
  const ref = isReferralCode(refRaw) ? refRaw : '';
  const open = breakoutUrl(opts.origin, camp, ref || null, opts.url.searchParams);
  const canonical = `${opts.origin}/go`;
  const body = `
  <main>
    <p class="kicker">BREAKOUT · GET MY LINK</p>
    <h1>You left the rotator. This is the real Site Drops race.</h1>
    <p class="lead"><code>/go</code> is the human landing after a traffic-exchange or sponsor click. Opening it does <strong>not</strong> credit anyone. Tap Get my link on the homepage — no email — then send your /r/ link to a unique friend.</p>
    <a class="cta" href="${escapeHtml(open)}" target="_top" rel="noopener">Continue to Get my link</a>
    <p class="fine">Campaign tags stay on the next URL. Same VIRAL- codes as www.viralrefer.app.</p>

    <h2>What happens next</h2>
    <ol>
      <li>The homepage asks you to get a referral link. About 30 seconds.</li>
      <li>Paste your website if you want a 15-minute Just entered chip.</li>
      <li>Send the link. A friend must tap Get my link. Visits never count.</li>
      <li>Sites climb Rising → week text line → Challenger → the 7-day #1 banner.</li>
    </ol>

    <h2>Why this is not a paid prize page</h2>
    <p>#1 this week (not the site owner) with 3 unique friends can claim a homepage banner for their website. That is recognition only. There is no cash prize, wallet, or investment product.</p>

    <h2>If you run the rotator</h2>
    <p>Keep iframe units on <a href="/te">/te</a> with a <code>size=</code> parameter. Send the click-through here or to <a href="/join">/join</a>. Full snippets live on the <a href="/promo/te/">TE promo kit</a>.</p>

    <h2>FAQ</h2>
    ${HOMEPAGE_FAQ.slice(0, 4)
      .map((item) => `<h3>${escapeHtml(item.question)}</h3><p>${escapeHtml(item.answer)}</p>`)
      .join('\n    ')}
  </main>`;
  return layout({
    origin: opts.origin,
    path: '/go',
    title: GO_SEO.title,
    description: GO_SEO.description,
    canonical,
    robots: 'index, follow, max-image-preview:large',
    body,
    jsonLd: [
      {
        '@context': 'https://schema.org',
        '@type': 'WebPage',
        name: GO_SEO.title,
        url: canonical,
        description: GO_SEO.description,
        isPartOf: { '@type': 'WebSite', name: 'ViralRefer Site Drops', url: opts.origin },
      },
      buildFaqJsonLd(canonical, HOMEPAGE_FAQ.slice(0, 4), GO_SEO.title),
    ],
  });
}

export function promoTeJsonLd(origin: string): Record<string, unknown>[] {
  const url = `${origin}/promo/te/`;
  return [
    {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: PROMO_TE_SEO.title,
      url,
      description: PROMO_TE_SEO.description,
    },
    {
      '@context': 'https://schema.org',
      '@type': 'HowTo',
      name: 'Add ViralRefer Site Drops to a traffic exchange',
      description: PROMO_TE_SEO.description,
      step: [
        {
          '@type': 'HowToStep',
          name: 'Copy a rotator URL',
          text: 'Use /splash?src=te&camp=YOURCAMP for the full conversion page, or /te?src=te&camp=YOURCAMP&size=468x60 for iframes.',
        },
        {
          '@type': 'HowToStep',
          name: 'Paste the iframe',
          text: 'The CTA is a real link with target=_top so a third-party iframe can break out.',
        },
        {
          '@type': 'HowToStep',
          name: 'Send clicks to /go or /join',
          text: 'Do not iframe the homepage. Send human clicks to /splash or /go. TE impressions never take #1.',
        },
      ],
    },
  ];
}
