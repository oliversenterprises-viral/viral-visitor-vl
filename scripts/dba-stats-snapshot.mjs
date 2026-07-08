#!/usr/bin/env node
/** One-shot production stats snapshot for marketing copy — read-only. */
import { createClient } from '@supabase/supabase-js';
import { execSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const URL = 'https://wqbefjzpgsezzwdrvvua.supabase.co';
const ANON =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndxYmVmanpwZ3Nlenp3ZHJ2dnVhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM5NTMyNDAsImV4cCI6MjA4OTUyOTI0MH0.pVHqeG0sGPgpUlOlskf7rOvnAsdrzrv5govZXcyxEdk';
const OWNER_CODE = 'VIRAL-97UWEGZ';

function serviceKey() {
  const out = execSync('npx supabase projects api-keys --project-ref wqbefjzpgsezzwdrvvua', {
    encoding: 'utf8',
    cwd: ROOT,
  });
  return out.match(/service_role\s*\|\s*(eyJ[^\s|]+)/)[1];
}

const admin = createClient(URL, serviceKey(), { auth: { persistSession: false } });
const pub = createClient(URL, ANON);

const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();

const [
  lb,
  total,
  mine,
  uniqRef,
  eventsRes,
  sharesRes,
  bannersRes,
  claimsRes,
  totalEventsRes,
  totalSharesRes,
  totalLandingsRes,
  totalGetLinkRes,
  totalCopyRes,
  totalShareEvtRes,
] = await Promise.all([
  pub.rpc('get_leaderboard', { min_referrals: 0 }),
  pub.rpc('get_total_referral_count'),
  pub.rpc('get_my_referral_count', { p_referrer_code: OWNER_CODE }),
  pub.rpc('get_unique_referrer_count'),
  admin
    .from('visitor_events')
    .select('event_name, visitor_id, country_code, ref_code, created_at')
    .gte('created_at', weekAgo)
    .limit(5000),
  admin.from('shares').select('platform, referrer_code, created_at').gte('created_at', weekAgo).limit(2000),
  admin.from('banner_events').select('event_type, key, created_at').gte('created_at', weekAgo).limit(2000),
  admin.from('prize_claims').select('id, created_at').gte('created_at', weekAgo).limit(500),
  admin.from('visitor_events').select('*', { count: 'exact', head: true }),
  admin.from('shares').select('*', { count: 'exact', head: true }),
  admin.from('visitor_events').select('*', { count: 'exact', head: true }).eq('event_name', 'SiteLanding'),
  admin.from('visitor_events').select('*', { count: 'exact', head: true }).eq('event_name', 'GetReferralLink'),
  admin.from('visitor_events').select('*', { count: 'exact', head: true }).eq('event_name', 'CopyReferralLink'),
  admin.from('visitor_events').select('*', { count: 'exact', head: true }).eq('event_name', 'ShareReferral'),
]);

const events = eventsRes.data || [];
const byEvent = {};
for (const e of events) {
  byEvent[e.event_name] = (byEvent[e.event_name] || 0) + 1;
}

const visitors = new Set(events.filter((e) => e.visitor_id).map((e) => e.visitor_id));
const countries = {};
for (const e of events) {
  if (e.country_code) countries[e.country_code] = (countries[e.country_code] || 0) + 1;
}
const topCountries = Object.entries(countries)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 10)
  .map(([code, count]) => ({ code, count }));

const shares = sharesRes.data || [];
const sharePlatforms = {};
for (const s of shares) {
  sharePlatforms[s.platform] = (sharePlatforms[s.platform] || 0) + 1;
}

const banners = bannersRes.data || [];

const { data: recentRefs } = await admin
  .from('referrals')
  .select('created_at, referred_ip')
  .eq('referrer_code', OWNER_CODE)
  .order('created_at', { ascending: false });

const report = {
  at: new Date().toISOString(),
  site: 'https://www.viralrefer.app',
  ownerCode: OWNER_CODE,
  shareUrl: `https://www.viralrefer.app/r/${OWNER_CODE}`,
  referrals: {
    total: total.data,
    yours: mine.data,
    rank: lb.data?.[0]?.rank ?? null,
    leaderboard: lb.data,
    recent: recentRefs,
  },
  uniqueReferrersLive: uniqRef.data,
  last7Days: {
    funnelEventsSampled: events.length,
    uniqueVisitorsSampled: visitors.size,
    byEvent,
    topCountries,
    shares: shares.length,
    sharePlatforms,
    bannerImpressions: banners.filter((b) => b.event_type === 'impression').length,
    bannerClicks: banners.filter((b) => b.event_type === 'click').length,
    prizeClaims: (claimsRes.data || []).length,
  },
  allTime: {
    visitorEvents: totalEventsRes.count,
    siteLandings: totalLandingsRes.count,
    getReferralLink: totalGetLinkRes.count,
    copyReferralLink: totalCopyRes.count,
    shareReferralEvents: totalShareEvtRes.count,
    shares: totalSharesRes.count,
  },
};

console.log(JSON.stringify(report, null, 2));