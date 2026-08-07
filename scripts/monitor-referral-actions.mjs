#!/usr/bin/env node
/**
 * READ-ONLY production monitor for ViralRefer referral actions.
 * Emits one JSON line per NEW event (stdout) for Grok monitor / logs.
 *
 * Does NOT write, deploy, or mutate production.
 *
 * Usage:
 *   node scripts/monitor-referral-actions.mjs
 *   node scripts/monitor-referral-actions.mjs --once
 *   $env:WATCH_POLL_MS=15000; node scripts/monitor-referral-actions.mjs
 *
 * Env:
 *   WATCH_POLL_MS   default 20000 (20s)
 *   WATCH_MAX_MIN   0 = forever (default 0); else exit after N minutes
 *   WATCH_STATE     path to cursor file (default scripts/.monitor-referral-state.json)
 */
import { createClient } from '@supabase/supabase-js';
import { execSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const URL = 'https://wqbefjzpgsezzwdrvvua.supabase.co';
const ONCE = process.argv.includes('--once');
const POLL_MS = Number(process.env.WATCH_POLL_MS || 20000);
const MAX_MIN = Number(process.env.WATCH_MAX_MIN || 0);
const STATE_PATH =
  process.env.WATCH_STATE || resolve(ROOT, 'scripts', '.monitor-referral-state.json');

const ACTION_EVENTS = new Set([
  'GetReferralLink',
  'CopyReferralLink',
  'ShareReferral',
  'ReceiptGenerated',
  'ChallengeLanding',
  'ChallengeLinkReady',
  'SiteLanding', // optional noise — we still emit but tag severity
]);

function serviceKey() {
  const out = execSync('npx supabase projects api-keys --project-ref wqbefjzpgsezzwdrvvua', {
    encoding: 'utf8',
    cwd: ROOT,
  });
  const m = out.match(/service_role\s*\|\s*(eyJ[^\s|]+)/);
  if (!m) throw new Error('service_role key not found');
  return m[1];
}

function loadState() {
  if (!existsSync(STATE_PATH)) {
    return {
      referralIds: [],
      shareIds: [],
      eventKeys: [],
      startedAt: new Date().toISOString(),
    };
  }
  try {
    return JSON.parse(readFileSync(STATE_PATH, 'utf8'));
  } catch {
    return { referralIds: [], shareIds: [], eventKeys: [], startedAt: new Date().toISOString() };
  }
}

function saveState(state) {
  mkdirSync(dirname(STATE_PATH), { recursive: true });
  // Keep cursor sets bounded
  state.referralIds = (state.referralIds || []).slice(-500);
  state.shareIds = (state.shareIds || []).slice(-500);
  state.eventKeys = (state.eventKeys || []).slice(-2000);
  writeFileSync(STATE_PATH, JSON.stringify(state, null, 2));
}

function emit(obj) {
  // One line = one monitor notification
  console.log(JSON.stringify({ at: new Date().toISOString(), ...obj }));
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

const admin = createClient(URL, serviceKey(), { auth: { persistSession: false } });
let state = loadState();

// First run: seed cursors without flooding history (only last 5 min lookback for seed)
const SEED_LOOKBACK_MS = 5 * 60 * 1000;

async function poll() {
  const sinceIso = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(); // 2h window query
  const isSeed = !(state.referralIds?.length || state.shareIds?.length || state.eventKeys?.length);

  const [refs, shares, events, totalRpc] = await Promise.all([
    admin
      .from('referrals')
      .select('id, referrer_code, referred_ip, user_agent, created_at')
      .gte('created_at', sinceIso)
      .order('created_at', { ascending: false })
      .limit(100),
    admin
      .from('shares')
      .select('id, platform, referrer_code, created_at')
      .gte('created_at', sinceIso)
      .order('created_at', { ascending: false })
      .limit(100),
    admin
      .from('visitor_events')
      .select('id, event_name, visitor_id, country_code, ref_code, created_at')
      .gte('created_at', sinceIso)
      .order('created_at', { ascending: false })
      .limit(300),
    admin.rpc('get_total_referral_count'),
  ]);

  if (refs.error) emit({ type: 'error', source: 'referrals', message: refs.error.message });
  if (shares.error) emit({ type: 'error', source: 'shares', message: shares.error.message });
  if (events.error) emit({ type: 'error', source: 'visitor_events', message: events.error.message });

  const knownRefs = new Set(state.referralIds || []);
  const knownShares = new Set(state.shareIds || []);
  const knownEvents = new Set(state.eventKeys || []);
  let newCount = 0;

  const cutoffSeed = Date.now() - SEED_LOOKBACK_MS;

  for (const row of [...(refs.data || [])].reverse()) {
    if (knownRefs.has(row.id)) continue;
    knownRefs.add(row.id);
    state.referralIds = [...knownRefs];
    const ts = new Date(row.created_at).getTime();
    if (isSeed && ts < cutoffSeed) continue;
    newCount++;
    emit({
      type: 'referral',
      severity: 'high',
      referrer_code: row.referrer_code,
      referred_ip: (row.referred_ip || '').replace(/\.\d+$/, '.*'), // partial redact
      created_at: row.created_at,
      total_board: totalRpc.data ?? null,
    });
  }

  for (const row of [...(shares.data || [])].reverse()) {
    if (knownShares.has(row.id)) continue;
    knownShares.add(row.id);
    state.shareIds = [...knownShares];
    const ts = new Date(row.created_at).getTime();
    if (isSeed && ts < cutoffSeed) continue;
    newCount++;
    emit({
      type: 'share',
      severity: 'medium',
      platform: row.platform,
      referrer_code: row.referrer_code,
      created_at: row.created_at,
    });
  }

  for (const row of [...(events.data || [])].reverse()) {
    const key = row.id || `${row.event_name}:${row.created_at}:${row.visitor_id}`;
    if (knownEvents.has(key)) continue;
    knownEvents.add(key);
    state.eventKeys = [...knownEvents];

    // Skip pure SiteLanding spam in non-seed mode unless user wants all
    if (row.event_name === 'SiteLanding' && !process.env.WATCH_INCLUDE_LANDINGS) {
      continue;
    }
    if (!ACTION_EVENTS.has(row.event_name) && row.event_name !== 'SiteLanding') {
      // still track unknown interesting events
    }
    const ts = new Date(row.created_at).getTime();
    if (isSeed && ts < cutoffSeed) continue;

    // Only emit action events (not every landing unless enabled)
    if (row.event_name === 'SiteLanding') {
      if (process.env.WATCH_INCLUDE_LANDINGS) {
        newCount++;
        emit({
          type: 'funnel',
          severity: 'low',
          event: row.event_name,
          country: row.country_code,
          ref_code: row.ref_code,
          created_at: row.created_at,
        });
      }
      continue;
    }

    if (
      [
        'GetReferralLink',
        'CopyReferralLink',
        'ShareReferral',
        'ReceiptGenerated',
        'ChallengeLanding',
        'ChallengeLinkReady',
      ].includes(row.event_name)
    ) {
      newCount++;
      emit({
        type: 'funnel',
        severity: row.event_name === 'GetReferralLink' ? 'high' : 'medium',
        event: row.event_name,
        country: row.country_code,
        ref_code: row.ref_code,
        created_at: row.created_at,
      });
    }
  }

  saveState(state);

  if (isSeed) {
    emit({
      type: 'monitor_ready',
      severity: 'info',
      message: 'Cursor seeded. Watching NEW referral actions only (read-only).',
      total_referrals_board: totalRpc.data ?? null,
      poll_ms: POLL_MS,
    });
  } else if (newCount === 0 && process.env.WATCH_HEARTBEAT) {
    emit({ type: 'heartbeat', severity: 'info', message: 'no new actions', total: totalRpc.data });
  }

  return newCount;
}

emit({
  type: 'monitor_start',
  severity: 'info',
  message: 'ViralRefer referral-action monitor starting (READ-ONLY, no prod writes)',
  once: ONCE,
  poll_ms: POLL_MS,
  site: 'https://www.viralrefer.app',
});

const deadline = MAX_MIN > 0 ? Date.now() + MAX_MIN * 60_000 : Infinity;

try {
  if (ONCE) {
    await poll();
    emit({ type: 'monitor_end', severity: 'info', message: 'single poll complete' });
    process.exit(0);
  }

  while (Date.now() < deadline) {
    await poll();
    await sleep(POLL_MS);
  }
  emit({ type: 'monitor_end', severity: 'info', message: 'max minutes reached' });
} catch (err) {
  emit({ type: 'error', severity: 'high', message: String(err?.message || err) });
  process.exit(1);
}
