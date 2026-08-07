#!/usr/bin/env node
/** Read-only last-24h stats for marketing graphics. */
import { createClient } from '@supabase/supabase-js';
import { execSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeFileSync, mkdirSync } from 'node:fs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const URL = 'https://wqbefjzpgsezzwdrvvua.supabase.co';

function serviceKey() {
  const out = execSync('npx supabase projects api-keys --project-ref wqbefjzpgsezzwdrvvua', {
    encoding: 'utf8',
    cwd: ROOT,
  });
  const m = out.match(/service_role\s*\|\s*(eyJ[^\s|]+)/);
  if (!m) throw new Error('Could not parse service_role key');
  return m[1];
}

const admin = createClient(URL, serviceKey(), { auth: { persistSession: false } });
const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
const since48 = new Date(Date.now() - 48 * 3600 * 1000).toISOString();
const until = new Date().toISOString();

const [ev, shares, refs, refs48, totalLb, totalCount] = await Promise.all([
  admin
    .from('visitor_events')
    .select('event_name, visitor_id, country_code, created_at')
    .gte('created_at', since)
    .limit(5000),
  admin.from('shares').select('platform, created_at').gte('created_at', since).limit(2000),
  admin.from('referrals').select('id, referrer_code, created_at').gte('created_at', since).limit(500),
  admin
    .from('referrals')
    .select('id, created_at')
    .gte('created_at', since48)
    .lt('created_at', since)
    .limit(500),
  admin.rpc('get_leaderboard', { min_referrals: 0 }),
  admin.rpc('get_total_referral_count'),
]);

if (ev.error) throw ev.error;

const events = ev.data || [];
const byEvent = {};
for (const e of events) byEvent[e.event_name] = (byEvent[e.event_name] || 0) + 1;
const visitors = new Set(events.filter((e) => e.visitor_id).map((e) => e.visitor_id));
const countries = {};
for (const e of events) {
  if (e.country_code) countries[e.country_code] = (countries[e.country_code] || 0) + 1;
}
const topCountries = Object.entries(countries)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 8)
  .map(([code, count]) => ({ code, count }));

const shareRows = shares.data || [];
const platforms = {};
for (const s of shareRows) platforms[s.platform] = (platforms[s.platform] || 0) + 1;

const refRows = refs.data || [];
const uniqueReferrers = new Set(refRows.map((r) => r.referrer_code));

const hours = Array.from({ length: 24 }, (_, i) => {
  const t = Date.now() - (23 - i) * 3600 * 1000;
  const hStart = new Date(t);
  hStart.setMinutes(0, 0, 0);
  return { label: hStart.toISOString().slice(11, 13) + 'h', count: 0, ts: hStart.getTime() };
});
for (const e of events) {
  if (e.event_name !== 'SiteLanding') continue;
  const t = new Date(e.created_at).getTime();
  for (const h of hours) {
    if (t >= h.ts && t < h.ts + 3600000) {
      h.count++;
      break;
    }
  }
}

const landings = byEvent.SiteLanding || 0;
const getLink = byEvent.GetReferralLink || 0;
const copyLink = byEvent.CopyReferralLink || 0;
const shareEvents = byEvent.ShareReferral || 0;
const conversion = landings > 0 ? Math.round((getLink / landings) * 1000) / 10 : 0;

const report = {
  since,
  until,
  landings,
  uniqueVisitors: visitors.size,
  getLink,
  copyLink,
  shareEvents,
  shares: shareRows.length,
  platforms,
  referrals: refRows.length,
  uniqueReferrers24h: uniqueReferrers.size,
  priorDayReferrals: (refs48.data || []).length,
  linkConversionPct: conversion,
  byEvent,
  topCountries,
  hourlyLandings: hours.map((h) => h.count),
  hourlyLabels: hours.map((h) => h.label),
  liveReferrers: Array.isArray(totalLb.data) ? totalLb.data.length : 0,
  totalVerifiedReferrals: totalCount.data ?? null,
  site: 'https://www.viralrefer.app',
};

const outDir = resolve(ROOT, 'marketing', 'growth-24h');
mkdirSync(outDir, { recursive: true });
writeFileSync(resolve(outDir, 'stats-last-24h.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
