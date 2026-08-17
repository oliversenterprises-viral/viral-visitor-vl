#!/usr/bin/env node
/**
 * Last-24h ViralRefer pulse — read-only.
 * Used by Nova Superpower automation nova-viralrefer-pulse.
 * Reports landings, unique visitors, get-link, shares, referrals.
 * Does not deploy. Does not post.
 */
import { createClient } from '@supabase/supabase-js';
import { execSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveAdminActionSecret, loadLocalEnv } from './admin-secret-from-env.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const URL =
  process.env.SUPABASE_URL ||
  process.env.VITE_SUPABASE_URL ||
  'https://wqbefjzpgsezzwdrvvua.supabase.co';
const ANON =
  process.env.SUPABASE_ANON_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndxYmVmanpwZ3Nlenp3ZHJ2dnVhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM5NTMyNDAsImV4cCI6MjA4OTUyOTI0MH0.pVHqeG0sGPgpUlOlskf7rOvnAsdrzrv5govZXcyxEdk';

loadLocalEnv();

const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
const sinceIso = since.toISOString();

function serviceKey() {
  const envKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  if (envKey) return envKey;
  const out = execSync('npx supabase projects api-keys --project-ref wqbefjzpgsezzwdrvvua', {
    encoding: 'utf8',
    cwd: ROOT,
    timeout: 25_000,
    windowsHide: true,
  });
  const m = out.match(/service_role\s*\|\s*(eyJ[^\s|]+)/);
  if (!m) throw new Error('Could not resolve service_role key');
  return m[1];
}

async function viaPublicRpcs() {
  const pub = createClient(URL, ANON);
  const [getLink, total, uniq, lb] = await Promise.all([
    pub.rpc('get_public_get_link_stats', { p_hours: 24 }),
    pub.rpc('get_total_referral_count'),
    pub.rpc('get_unique_referrer_count'),
    pub.rpc('get_leaderboard', { min_referrals: 0 }),
  ]);
  const payload = getLink.data && typeof getLink.data === 'object' ? getLink.data : {};
  return {
    getLinkEvents: Number(payload.events) || 0,
    uniqueGetLink: Number(payload.unique_people) || 0,
    verifiedReferrals: total.data ?? null,
    uniqueReferrers: uniq.data ?? null,
    leaderboardTop: (lb.data || []).slice(0, 5),
    errors: {
      getLink: getLink.error?.message || null,
      total: total.error?.message || null,
    },
  };
}

function pct(num, den) {
  if (!den) return '—';
  return `${((num / den) * 100).toFixed(1)}%`;
}

function countBy(rows, key) {
  const out = {};
  for (const row of rows) {
    const k = String(row[key] || '(none)');
    out[k] = (out[k] || 0) + 1;
  }
  return Object.entries(out)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([name, count]) => ({ name, count }));
}

async function viaAdmin() {
  const admin = createClient(URL, serviceKey(), { auth: { persistSession: false } });
  const pub = createClient(URL, ANON);

  const [
    eventsRes,
    sharesRes,
    refsRes,
    totalRes,
    uniqRes,
    lbRes,
    landingsAll,
    getLinkAll,
  ] = await Promise.all([
    admin
      .from('visitor_events')
      .select('event_name, visitor_id, country_code, ref_code, utm_source, created_at')
      .gte('created_at', sinceIso)
      .limit(8000),
    admin.from('shares').select('platform, referrer_code, created_at').gte('created_at', sinceIso).limit(4000),
    admin.from('referrals').select('referrer_code, created_at').gte('created_at', sinceIso).limit(4000),
    pub.rpc('get_total_referral_count'),
    pub.rpc('get_unique_referrer_count'),
    pub.rpc('get_leaderboard', { min_referrals: 0 }),
    admin.from('visitor_events').select('*', { count: 'exact', head: true }).eq('event_name', 'SiteLanding'),
    admin.from('visitor_events').select('*', { count: 'exact', head: true }).eq('event_name', 'GetReferralLink'),
  ]);

  if (eventsRes.error) throw new Error(`visitor_events: ${eventsRes.error.message}`);
  if (sharesRes.error) throw new Error(`shares: ${sharesRes.error.message}`);
  if (refsRes.error) throw new Error(`referrals: ${refsRes.error.message}`);

  const events = eventsRes.data || [];
  const shares = sharesRes.data || [];
  const referrals = refsRes.data || [];

  const byEvent = {};
  for (const e of events) {
    byEvent[e.event_name] = (byEvent[e.event_name] || 0) + 1;
  }

  const uniqueVisitors = new Set(events.filter((e) => e.visitor_id).map((e) => e.visitor_id)).size;
  const landings = byEvent.SiteLanding || 0;
  const getLink = byEvent.GetReferralLink || 0;
  const copyLink = byEvent.CopyReferralLink || 0;
  const shareEvents = byEvent.ShareReferral || 0;
  const uniqueGetLink = new Set(
    events.filter((e) => e.event_name === 'GetReferralLink' && e.visitor_id).map((e) => e.visitor_id),
  ).size;
  const referredLandings = events.filter((e) => e.event_name === 'SiteLanding' && e.ref_code).length;

  return {
    source: 'service_role',
    landings,
    uniqueVisitors,
    getLink,
    uniqueGetLink,
    copyLink,
    shareEvents,
    sharesTable: shares.length,
    referrals: referrals.length,
    referredLandings,
    byEvent,
    topCountries: countBy(events, 'country_code'),
    topUtm: countBy(
      events.filter((e) => e.event_name === 'SiteLanding'),
      'utm_source',
    ),
    sharePlatforms: countBy(shares, 'platform'),
    allTime: {
      siteLandings: landingsAll.count,
      getReferralLink: getLinkAll.count,
      verifiedReferrals: totalRes.data ?? null,
      uniqueReferrers: uniqRes.data ?? null,
      leaderboardTop: (lbRes.data || []).slice(0, 5),
    },
    errors: {
      events: eventsRes.error?.message || null,
      shares: sharesRes.error?.message || null,
      referrals: refsRes.error?.message || null,
    },
  };
}

async function viaAdminActionFallback() {
  const secret = resolveAdminActionSecret();
  const res = await fetch(`${URL}/functions/v1/admin-action`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${ANON}`,
      apikey: ANON,
      'x-admin-secret': secret,
    },
    body: JSON.stringify({ action: 'get_visitor_stats' }),
  });
  const json = await res.json();
  if (!json.success || !Array.isArray(json.data)) {
    throw new Error(json.error || `admin-action ${res.status}`);
  }
  const cutoff = since.getTime();
  const events = json.data.filter((e) => {
    const t = Date.parse(e.created_at || '');
    return Number.isFinite(t) && t >= cutoff;
  });
  const byEvent = {};
  for (const e of events) {
    byEvent[e.event_name] = (byEvent[e.event_name] || 0) + 1;
  }
  return {
    source: 'admin-action (last 1000 events, 24h filter applied client-side)',
    landings: byEvent.SiteLanding || 0,
    uniqueVisitors: new Set(events.filter((e) => e.visitor_id).map((e) => e.visitor_id)).size,
    getLink: byEvent.GetReferralLink || 0,
    uniqueGetLink: new Set(
      events.filter((e) => e.event_name === 'GetReferralLink' && e.visitor_id).map((e) => e.visitor_id),
    ).size,
    copyLink: byEvent.CopyReferralLink || 0,
    shareEvents: byEvent.ShareReferral || 0,
    sharesTable: null,
    referrals: null,
    referredLandings: events.filter((e) => e.event_name === 'SiteLanding' && e.ref_code).length,
    byEvent,
    topCountries: countBy(events, 'country_code'),
    topUtm: countBy(
      events.filter((e) => e.event_name === 'SiteLanding'),
      'utm_source',
    ),
    sharePlatforms: [],
    allTime: null,
    errors: { note: 'Fallback: shares table + referrals not included' },
  };
}

let publicSnap = null;
try {
  publicSnap = await viaPublicRpcs();
} catch (err) {
  publicSnap = { error: String(err?.message || err) };
}

let data;
let fallbackNote = null;
try {
  data = await viaAdmin();
} catch (err) {
  fallbackNote = String(err?.message || err);
  try {
    data = await viaAdminActionFallback();
  } catch (err2) {
    const uniqueGetLink = publicSnap?.uniqueGetLink || 0;
    const getLink = publicSnap?.getLinkEvents || 0;
    data = {
      source: 'public RPCs only',
      landings: null,
      uniqueVisitors: null,
      getLink,
      uniqueGetLink,
      copyLink: null,
      shareEvents: null,
      sharesTable: null,
      referrals: null,
      referredLandings: null,
      byEvent: { GetReferralLink: getLink },
      topCountries: [],
      topUtm: [],
      sharePlatforms: [],
      allTime: publicSnap
        ? {
            siteLandings: null,
            getReferralLink: getLink,
            verifiedReferrals: publicSnap.verifiedReferrals,
            uniqueReferrers: publicSnap.uniqueReferrers,
            leaderboardTop: publicSnap.leaderboardTop,
          }
        : null,
      errors: { primary: fallbackNote, fallback: String(err2?.message || err2) },
    };
  }
}

const report = {
  at: new Date().toISOString(),
  site: 'https://www.viralrefer.app',
  window: { hours: 24, since: sinceIso },
  ...data,
  rates: {
    getLinkOfLandings: pct(data.getLink, data.landings),
    uniqueGetLinkOfVisitors: pct(data.uniqueGetLink, data.uniqueVisitors),
    shareEventsOfGetLink: pct(data.shareEvents, data.getLink),
    referralsOfShares:
      data.sharesTable != null ? pct(data.referrals || 0, data.sharesTable || 0) : '—',
  },
};

console.log('=== ViralRefer last-24h pulse ===');
console.log(`As of: ${report.at}`);
console.log(`Window: last 24 hours (since ${sinceIso})`);
console.log(`Source: ${data.source}`);
if (fallbackNote) console.log(`Note: primary path failed (${fallbackNote}); used fallback`);
console.log('');
const junkSources = (data.topUtm || []).filter((p) =>
  /rotate4all|trafficadbar|hits4pay|hitleap|trafficexchange|traffup|herculist|pagerankcafe|leadsleap/i.test(
    p.name,
  ),
);
const junkLandings = junkSources.reduce((s, p) => s + p.count, 0);
if (data.landings && junkLandings / data.landings >= 0.5) {
  console.log(
    `Quality warning: ${junkLandings}/${data.landings} landings look like exchange/rotator traffic (${junkSources.map((p) => p.name).join(', ')}). Treat get-link rate as polluted.`,
  );
  console.log('');
}

console.log('Funnel (last 24h)');
console.log(`  Landings:          ${data.landings ?? 'n/a'}`);
console.log(`  Unique visitors:   ${data.uniqueVisitors ?? 'n/a'}`);
console.log(`  Get-link:          ${data.getLink}  (${report.rates.getLinkOfLandings} of landings)`);
console.log(`  Unique get-link:   ${data.uniqueGetLink}`);
console.log(`  Copy link:         ${data.copyLink}`);
console.log(`  Share events:      ${data.shareEvents}  (${report.rates.shareEventsOfGetLink} of get-link)`);
console.log(`  Shares table:      ${data.sharesTable ?? 'n/a'}`);
console.log(`  Referrals:         ${data.referrals ?? 'n/a'}`);
console.log(`  Referred landings: ${data.referredLandings}`);
console.log('');
if (data.sharePlatforms?.length) {
  console.log('Share platforms (24h):');
  for (const p of data.sharePlatforms) console.log(`  ${p.name}: ${p.count}`);
  console.log('');
}
if (data.topUtm?.length) {
  console.log('Landing sources (utm_source, 24h):');
  for (const p of data.topUtm) console.log(`  ${p.name}: ${p.count}`);
  console.log('');
}
if (data.topCountries?.length) {
  console.log('Countries (events, 24h):');
  for (const p of data.topCountries) console.log(`  ${p.name}: ${p.count}`);
  console.log('');
}
if (data.allTime) {
  console.log('All-time context');
  console.log(`  Site landings:        ${data.allTime.siteLandings}`);
  console.log(`  Get-link:             ${data.allTime.getReferralLink}`);
  console.log(`  Verified referrals:   ${data.allTime.verifiedReferrals}`);
  console.log(`  Unique referrers:     ${data.allTime.uniqueReferrers}`);
  console.log('');
}
console.log('JSON');
console.log(JSON.stringify(report, null, 2));
