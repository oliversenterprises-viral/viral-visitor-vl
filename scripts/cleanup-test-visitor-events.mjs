#!/usr/bin/env node
/**
 * Remove owner/smoke/agent visitor_events from production.
 * Dry-run: node scripts/cleanup-test-visitor-events.mjs
 * Apply:    node scripts/cleanup-test-visitor-events.mjs --apply
 */
import { createClient } from '@supabase/supabase-js';
import { execSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const APPLY = process.argv.includes('--apply');

const SUPABASE_URL =
  process.env.VITE_SUPABASE_URL || 'https://wqbefjzpgsezzwdrvvua.supabase.co';

const ADMIN_FUNNEL_EXCLUDED_IPS = ['161.38.136.60', '57.138.135.240'];
const ADMIN_FUNNEL_EXCLUDED_IP_HASHES = [
  'd8399295624890754c844c12',
  '717ece42045d3673ed7fb81c',
];

function getServiceRoleKey() {
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) return process.env.SUPABASE_SERVICE_ROLE_KEY;
  const out = execSync('npx supabase projects api-keys --project-ref wqbefjzpgsezzwdrvvua', {
    encoding: 'utf8',
    cwd: ROOT,
  });
  const match = out.match(/service_role\s*\|\s*(eyJ[^\s|]+)/);
  if (!match) throw new Error('Could not resolve service_role key');
  return match[1];
}

function getVisitorEventIp(event) {
  const meta = event.metadata && typeof event.metadata === 'object' ? event.metadata : {};
  return String(meta.client_ip || event.client_ip || '').trim();
}

function isTestVisitorFunnelRefCode(code) {
  const c = (code || '').trim().toUpperCase();
  if (!c) return false;
  if (c === 'VIRAL-READY') return true;
  if (/PROBE/.test(c)) return true;
  if (/SMOKETEST/.test(c)) return true;
  if (/DEMOCODE/.test(c)) return true;
  if (/^DEMO\d+$/.test(c)) return true;
  if (/TESTFIX/.test(c)) return true;
  if (/^VIRAL-(LANDING|FUNNEL|TOAST|FAIL|RETRY|ATTRIB|DEMO)/.test(c)) return true;
  return false;
}

function isOwnerVisitorFunnelEvent(event) {
  const ip = getVisitorEventIp(event);
  if (ip && ADMIN_FUNNEL_EXCLUDED_IPS.includes(ip)) return true;
  const hash = String(event.ip_hash || '').trim().toLowerCase();
  if (!hash) return false;
  return ADMIN_FUNNEL_EXCLUDED_IP_HASHES.some(
    (blocked) => hash === blocked.toLowerCase() || hash.startsWith(blocked.toLowerCase()),
  );
}

function isSmokeAutomationIpProfile(events) {
  if (!events.length) return false;
  const ip = getVisitorEventIp(events[0]);
  if (!ip || !/^20\.|^48\.|^52\.|^74\.|^135\./.test(ip)) return false;
  const names = new Set(events.map((e) => String(e.event_name || '').trim()));
  if (names.has('CopyReferralLink') || names.has('ShareReferral') || names.has('SubmitPrizeClaim')) {
    return false;
  }
  if (names.has('GetReferralLink') && events.length <= 8) return true;
  return false;
}

function eventIpKey(event) {
  return getVisitorEventIp(event) || String(event.ip_hash || 'unknown');
}

function isTestVisitorFunnelEvent(event, eventsFromSameIp) {
  if (isOwnerVisitorFunnelEvent(event)) return true;
  if (isTestVisitorFunnelRefCode(event.ref_code)) return true;
  const ip = getVisitorEventIp(event);
  if (/^203\.0\.113\./.test(ip)) return true;
  const path = String(event.metadata?.path || '').trim();
  if (/localhost/i.test(path)) return true;
  if (eventsFromSameIp?.length && isSmokeAutomationIpProfile(eventsFromSameIp)) return true;
  return false;
}

function groupVisitorEventsByIp(events) {
  const byIp = new Map();
  for (const event of events) {
    const key = eventIpKey(event);
    const list = byIp.get(key) || [];
    list.push(event);
    byIp.set(key, list);
  }
  return byIp;
}

const admin = createClient(SUPABASE_URL, getServiceRoleKey(), {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function fetchAllVisitorEvents() {
  const rows = [];
  const page = 1000;
  let start = 0;
  while (true) {
    const { data, error } = await admin
      .from('visitor_events')
      .select('id, event_name, ref_code, ip_hash, metadata, created_at')
      .order('created_at', { ascending: true })
      .range(start, start + page - 1);
    if (error) throw error;
    if (!data?.length) break;
    rows.push(...data);
    if (data.length < page) break;
    start += page;
  }
  return rows;
}

async function deleteIds(ids) {
  const chunk = 200;
  for (let i = 0; i < ids.length; i += chunk) {
    const slice = ids.slice(i, i + chunk);
    const { error } = await admin.from('visitor_events').delete().in('id', slice);
    if (error) throw error;
  }
}

async function main() {
  console.log(`=== Cleanup test visitor_events (${APPLY ? 'APPLY' : 'DRY-RUN'}) ===\n`);

  const all = await fetchAllVisitorEvents();
  const byIp = groupVisitorEventsByIp(all);
  const testRows = all.filter((row) => isTestVisitorFunnelEvent(row, byIp.get(eventIpKey(row))));
  const realRows = all.filter((row) => !isTestVisitorFunnelEvent(row, byIp.get(eventIpKey(row))));

  console.log(`Total visitor_events: ${all.length}`);
  console.log(`Test rows to remove:    ${testRows.length}`);
  console.log(`Real rows kept:         ${realRows.length}`);

  if (testRows.length) {
    console.log('\nSample test rows (most recent):');
    for (const r of testRows.slice(-8)) {
      const ip = r.metadata?.client_ip || '—';
      console.log(
        `  - ${r.id} | ${r.event_name} | ref=${r.ref_code || '—'} | ip=${ip} | ${r.created_at}`,
      );
    }
  }

  if (!APPLY || testRows.length === 0) {
    if (!APPLY && testRows.length > 0) {
      console.log('\nDry-run only. Re-run with --apply to delete test rows.');
    }
    return;
  }

  const ids = testRows.map((r) => r.id);
  await deleteIds(ids);
  console.log(`\nDeleted ${ids.length} test visitor_event row(s).`);

  const after = await fetchAllVisitorEvents();
  console.log(`Remaining visitor_events: ${after.length}`);
}

main().catch((err) => {
  console.error('Cleanup failed:', err);
  process.exit(1);
});