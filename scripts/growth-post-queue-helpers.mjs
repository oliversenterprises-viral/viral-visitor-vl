/**
 * Referral marketing automation — queue helpers (white-hat, compliance-first).
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { resolve, dirname, isAbsolute } from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import { execSync } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
export const ROOT = resolve(__dirname, '..');
export const QUEUE_DIR = resolve(ROOT, 'marketing', 'growth-queue');
export const QUEUE_FILE = resolve(QUEUE_DIR, 'queue.json');

export const SITE = 'https://www.viralrefer.app';
export const RULES_URL = `${SITE}/#rules`;
export const OWNER_CODE = 'VIRAL-97UWEGZ';
export const SHARE_PATH = `/r/${OWNER_CODE}`;
export const TELEGRAM_CHANNEL = '@viralrefer';
export const TELEGRAM_CHANNEL_URL = 'https://t.me/viralrefer';

export const COMPLIANCE_FOOTER =
  'Open worldwide, 18+. No purchase necessary. Free leaderboard — see rules on site.';

export const X_LEADERBOARD_IMAGE = resolve(
  ROOT,
  'marketing/x-launch/viralrefer-x-leaderboard-VIRAL-97UWEGZ.png',
);
export const X_QR_IMAGE = resolve(ROOT, 'marketing/x-launch/viralrefer-qr-VIRAL-97UWEGZ.png');

/** X blocklists viralrefer.app URLs — never put links in tweet text. */
export const X_LINK_POLICY = 'no-url';
export const X_NO_URL_CTA = 'SCAN THE QR image — or search Google: ViralRefer';
export const X_SAFE_BIO =
  'Free referral leaderboard → #1 claims homepage feature | Search Google: ViralRefer | Scan QR on pinned post';

const URL_IN_TEXT_RE = /https?:\/\/|viralrefer\.app|utm_/i;

export function assertNoXUrls(text) {
  if (URL_IN_TEXT_RE.test(text)) {
    throw new Error('X copy must not contain URLs (domain blocklisted on X)');
  }
  return text;
}

/** Tweet body safe for X compose (no links — use QR / Google search CTA). */
export function buildXSafeTweet(body, { hashtags = '#buildinpublic #referral' } = {}) {
  const text = truncateForX(
    `${body.trim()}\n\n${X_NO_URL_CTA}\n\n${hashtags}`.trim(),
  );
  return assertNoXUrls(text);
}

export function loadEnvFile(path) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (!m) continue;
    const key = m[1].trim();
    const val = m[2].trim().replace(/^["']|["']$/g, '');
    if (!process.env[key]) process.env[key] = val;
  }
}

export function loadLocalEnv() {
  loadEnvFile(resolve(ROOT, '.env.local'));
  loadEnvFile(resolve(ROOT, '.env.production.local'));
}

export function buildUtmUrl({
  source = 'x',
  medium = 'social',
  campaign = 'referral-automation',
  content = '',
  path = '',
} = {}) {
  const base = path ? `${SITE}${path.startsWith('/') ? path : `/${path}`}` : `${SITE}/`;
  const params = new URLSearchParams({
    utm_source: source,
    utm_medium: medium,
    utm_campaign: campaign,
  });
  if (content) params.set('utm_content', content);
  return `${base}?${params.toString()}`;
}

/**
 * Owner advertising (Telegram channel, PageRankCafe, LinkedIn, Reddit, directories).
 * Homepage + UTMs → direct landing UX (prize hero). Do NOT use /r/CODE for cold ads.
 */
export function buildOwnerAdUrl({
  source,
  medium = 'social',
  campaign = 'referral-automation',
  content = '',
} = {}) {
  if (!source) throw new Error('buildOwnerAdUrl requires utm_source');
  return buildUtmUrl({ source, medium, campaign, content });
}

/**
 * Iframe-friendly traffic-exchange URL.
 * - path `/embed` → main app embed shell
 * - path `/embed/<slug>/` → dual-mode splash (frame-allowed; CTAs target=_top)
 * See vercel.json + marketing/splash-pages/README.md
 */
export function buildEmbedAdUrl({
  source,
  medium = 'traffic_exchange',
  campaign = 'embed',
  content = 'iframe',
  /** e.g. 'makers' → /embed/makers/ (splash). Empty → /embed main app. */
  splash = '',
} = {}) {
  if (!source) throw new Error('buildEmbedAdUrl requires utm_source');
  const path = splash ? `/embed/${String(splash).replace(/^\/+|\/+$/g, '')}/` : '/embed';
  return buildUtmUrl({ source, medium, campaign, content, path });
}

/** Full-page splash (iframe blocked). Pair with buildEmbedAdUrl({ splash }) for exchanges. */
export function buildSplashAdUrl({
  source,
  medium = 'landing',
  campaign = 'splash',
  content = '',
  splash = 'race',
} = {}) {
  if (!source) throw new Error('buildSplashAdUrl requires utm_source');
  const slug = String(splash || 'race').replace(/^\/+|\/+$/g, '');
  return buildUtmUrl({
    source,
    medium,
    campaign,
    content: content || slug,
    path: `/go/${slug}/`,
  });
}

/** PageRankCafe traffic-exchange listing (paste at https://pagerankcafe.com/links/add). */
export const PAGERANKCAFE_LISTING = {
  title: 'Worldwide Free Leaderboard — Get Your Link in 30 Sec · Homepage Feature',
  titleSticky: '#1 Board Wide Open Worldwide — Free Link in 30 Sec · Homepage Feature',
  url: buildOwnerAdUrl({
    source: 'pagerankcafe',
    medium: 'traffic_exchange',
    campaign: 'link_post',
    content: 'feed',
  }),
  urlSticky: buildOwnerAdUrl({
    source: 'pagerankcafe',
    medium: 'traffic_exchange',
    campaign: 'sticky_link',
    content: '30day',
  }),
  urlEmbed: buildEmbedAdUrl({
    source: 'pagerankcafe',
    content: 'iframe-surf',
  }),
};

/** Traffic Ad Bar listing (paste at https://trafficadbar.com/). */
export const TRAFFICADBAR_LISTING = {
  title: 'Worldwide Free Leaderboard — Get Your Link in 30 Sec · Homepage Feature',
  titleFeatured: '#1 Board Wide Open Worldwide — Free Link in 30 Sec · Homepage Feature',
  url: buildOwnerAdUrl({
    source: 'trafficadbar',
    medium: 'traffic_exchange',
    campaign: 'link_post',
    content: 'feed',
  }),
  urlFeatured: buildOwnerAdUrl({
    source: 'trafficadbar',
    medium: 'traffic_exchange',
    campaign: 'featured_link',
    content: 'boost',
  }),
  urlEmbed: buildEmbedAdUrl({
    source: 'trafficadbar',
    content: 'iframe-surf',
  }),
};

export function appendCompliance(text, { short = false } = {}) {
  const footer = short
    ? 'Worldwide 18+. No purchase necessary.'
    : `${COMPLIANCE_FOOTER} ${RULES_URL}`;
  if (text.includes('Worldwide 18') || text.includes('US 18') || text.includes('18+')) return text;
  return `${text.trim()}\n\n${footer}`;
}

export function truncateForX(text, max = 280) {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).trimEnd()}…`;
}

function serviceKey() {
  const out = execSync('npx supabase projects api-keys --project-ref wqbefjzpgsezzwdrvvua', {
    encoding: 'utf8',
    cwd: ROOT,
  });
  return out.match(/service_role\s*\|\s*(eyJ[^\s|]+)/)[1];
}

const ANON =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndxYmVmanpwZ3Nlenp3ZHJ2dnVhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM5NTMyNDAsImV4cCI6MjA4OTUyOTI0MH0.pVHqeG0sGPgpUlOlskf7rOvnAsdrzrv5govZXcyxEdk';

/** Pull live stats for dynamic copy (read-only). */
export async function fetchGrowthStats() {
  const admin = createClient('https://wqbefjzpgsezzwdrvvua.supabase.co', serviceKey(), {
    auth: { persistSession: false },
  });
  const pub = createClient('https://wqbefjzpgsezzwdrvvua.supabase.co', ANON);

  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
  const [lb, total, uniqRef, eventsRes] = await Promise.all([
    pub.rpc('get_leaderboard', { min_referrals: 0 }),
    pub.rpc('get_total_referral_count'),
    pub.rpc('get_unique_referrer_count'),
    admin
      .from('visitor_events')
      .select('event_name, visitor_id')
      .gte('created_at', weekAgo)
      .limit(5000),
  ]);

  const events = eventsRes.data || [];
  const landingIds = new Set();
  const getLinkIds = new Set();
  for (const e of events) {
    const id = String(e.visitor_id || '').trim();
    if (!id) continue;
    if (e.event_name === 'SiteLanding') landingIds.add(id);
    if (e.event_name === 'GetReferralLink') getLinkIds.add(id);
  }

  const landings = landingIds.size;
  const getLink = getLinkIds.size;
  const getLinkRate = landings > 0 ? getLink / landings : 0;
  const leader = lb.data?.[0];
  const topCount = leader?.referral_count ?? total.data ?? 0;

  return {
    at: new Date().toISOString(),
    landings7d: landings,
    getLink7d: getLink,
    getLinkRatePct: Math.round(getLinkRate * 100),
    totalReferrals: total.data ?? 0,
    uniqueReferrers: uniqRef.data ?? 0,
    leaderCode: leader?.referrer_code ?? OWNER_CODE,
    leaderCount: topCount,
    shareUrl: `${SITE}${SHARE_PATH}`,
  };
}

export function makePostId(platform, slug) {
  const day = new Date().toISOString().slice(0, 10);
  return `${day}-${platform}-${slug}`;
}

/** Seven-day white-hat queue — X/Telegram auto-capable; Reddit/LinkedIn manual. */
export function buildWeekQueue(stats) {
  const link = stats.shareUrl;
  const boardLine =
    stats.uniqueReferrers <= 1
      ? 'Board is wide open — early movers have a real shot at #1.'
      : `${stats.uniqueReferrers} referrers competing — #1 has ${stats.leaderCount} referrals.`;

  const items = [
    {
      id: makePostId('x', 'leaderboard-hook'),
      platform: 'x',
      mode: 'assist',
      xLinkPolicy: X_LINK_POLICY,
      status: 'pending',
      scheduledFor: nextUtcDay(0, 15),
      image: relPath(X_LEADERBOARD_IMAGE),
      imageQr: relPath(X_QR_IMAGE),
      url: link,
      copy: {
        text: buildXSafeTweet(
          `#1 on ViralRefer is still within reach 🏆\n\n` +
            `Worldwide free leaderboard — get your link in ~30 sec, climb the live board, claim a homepage feature.\n\n` +
            `${boardLine}`,
        ),
        bio: X_SAFE_BIO,
      },
      tags: ['leaderboard', 'feature', 'week1', 'x-no-url'],
    },
    {
      id: makePostId('x', 'how-it-works'),
      platform: 'x',
      mode: 'assist',
      xLinkPolicy: X_LINK_POLICY,
      status: 'pending',
      scheduledFor: nextUtcDay(1, 15),
      imageQr: relPath(X_QR_IMAGE),
      url: link,
      copy: {
        text: buildXSafeTweet(
          `Referral marketing without signup walls:\n\n` +
            `1) Get your link (~30 sec)\n` +
            `2) Copy + share anywhere\n` +
            `3) Every visit moves you up the live leaderboard`,
        ),
      },
      tags: ['education', 'week1', 'x-no-url'],
    },
    {
      id: makePostId('linkedin', 'case-study'),
      platform: 'linkedin',
      mode: 'manual',
      status: 'pending',
      scheduledFor: nextUtcDay(2, 14),
      url: buildUtmUrl({
        source: 'linkedin',
        campaign: 'referral-automation',
        content: 'case-study',
      }),
      copy: {
        text:
          `Case study: no-signup referral contests in 2026\n\n` +
          `We built ViralRefer — free worldwide leaderboard, homepage feature for #1 (no cash prize).\n\n` +
          `Last 7 days: ${stats.landings7d} landings, ${stats.getLink7d} links created (${stats.getLinkRatePct}% get-link rate). ` +
          `Biggest leak is step 1 (tap "Get my link") — we're optimizing hero + social proof.\n\n` +
          `If you run community or side-hustle audiences: try the 30-second loop yourself.\n\n` +
          `${buildUtmUrl({ source: 'linkedin', campaign: 'referral-automation', content: 'case-study' })}\n\n` +
          COMPLIANCE_FOOTER,
      },
      tags: ['linkedin', 'manual', 'week1'],
    },
    {
      id: makePostId('x', 'stats-pulse'),
      platform: 'x',
      mode: 'assist',
      xLinkPolicy: X_LINK_POLICY,
      status: 'pending',
      scheduledFor: nextUtcDay(3, 15),
      imageQr: relPath(X_QR_IMAGE),
      url: link,
      copy: {
        text: buildXSafeTweet(
          `ViralRefer pulse (7d): ${stats.landings7d} visitors · ${stats.getLink7d} links · ${stats.totalReferrals} referrals on the board.\n\n` +
            `Free contest — early board still wide open.`,
        ),
      },
      tags: ['stats', 'week1', 'x-no-url'],
    },
    {
      id: makePostId('reddit', 'value-post'),
      platform: 'reddit',
      mode: 'manual',
      status: 'pending',
      scheduledFor: nextUtcDay(4, 16),
      url: buildUtmUrl({ source: 'reddit', campaign: 'referral-automation', content: 'value-post' }),
      copy: {
        text:
          `Title: I built a no-signup referral leaderboard — what I learned about step-1 conversion\n\n` +
          `Body:\n` +
          `Most referral traffic (${stats.landings7d} landings / 7d) arrives via shared links — but only ~${stats.getLinkRatePct}% tap "Get my link." ` +
          `The viral loop dies at step 1, not step 3.\n\n` +
          `ViralRefer is a free worldwide leaderboard: 30-sec link, live board, homepage feature for #1 (18+, no cash prize, rules on site).\n\n` +
          `Happy to share what we're testing (hero social proof, feature-forward CTA) if useful for other builders.\n\n` +
          `${buildUtmUrl({ source: 'reddit', campaign: 'referral-automation', content: 'value-post' })}\n\n` +
          `Post manually to a value-friendly sub — never spam.`,
      },
      tags: ['reddit', 'manual', 'value-first'],
    },
    {
      id: makePostId('telegram', 'channel-broadcast'),
      platform: 'telegram',
      mode: 'api',
      status: 'pending',
      scheduledFor: nextUtcDay(5, 12),
      image: relPath(X_LEADERBOARD_IMAGE),
      url: buildOwnerAdUrl({
        source: 'telegram',
        content: 'channel-broadcast',
      }),
      copy: {
        text: appendCompliance(
          `🏆 ViralRefer worldwide free leaderboard\n\n` +
            `Get your free referral link in ~30 seconds. Every share moves you up the board.\n\n` +
            `#1 → homepage feature (no cash prize)\n\n` +
            `${boardLine}\n\n` +
            buildOwnerAdUrl({
              source: 'telegram',
              content: 'channel-broadcast',
            }),
        ),
      },
      tags: ['telegram', 'week1'],
    },
    {
      id: makePostId('x', 'weekend-cta'),
      platform: 'x',
      mode: 'assist',
      xLinkPolicy: X_LINK_POLICY,
      status: 'pending',
      scheduledFor: nextUtcDay(6, 16),
      imageQr: relPath(X_QR_IMAGE),
      url: link,
      copy: {
        text: buildXSafeTweet(
          `Weekend challenge: can you beat ${stats.leaderCount} referrals on the ViralRefer board?\n\n` +
            `Free · no signup · ~30 seconds to get your link.`,
        ),
      },
      tags: ['weekend', 'week1', 'x-no-url'],
    },
  ];

  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    stats,
    items,
  };
}

function nextUtcDay(dayOffset, hourUtc) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + dayOffset);
  d.setUTCHours(hourUtc, 0, 0, 0);
  return d.toISOString();
}

function relPath(abs) {
  if (!abs) return null;
  return abs.replace(/\\/g, '/').replace(ROOT.replace(/\\/g, '/') + '/', '');
}

export function resolveQueueImage(item) {
  if (!item?.image) return null;
  return isAbsolute(item.image) ? item.image : resolve(ROOT, item.image);
}

export function readQueue() {
  if (!existsSync(QUEUE_FILE)) return null;
  return JSON.parse(readFileSync(QUEUE_FILE, 'utf8'));
}

export function writeQueue(queue) {
  mkdirSync(QUEUE_DIR, { recursive: true });
  writeFileSync(QUEUE_FILE, JSON.stringify(queue, null, 2), 'utf8');
}

export function listPending(queue, { platform } = {}) {
  return (queue?.items || []).filter((item) => {
    if (item.status !== 'pending' && item.status !== 'approved') return false;
    if (platform && item.platform !== platform) return false;
    return true;
  });
}

export function findItem(queue, id) {
  return (queue?.items || []).find((item) => item.id === id) || null;
}

export function updateItemStatus(queue, id, patch) {
  const item = findItem(queue, id);
  if (!item) return false;
  Object.assign(item, patch);
  return true;
}