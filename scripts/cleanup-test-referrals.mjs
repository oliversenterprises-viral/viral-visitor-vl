#!/usr/bin/env node
/**
 * Remove non-funnel referrals from production:
 * - Nova/smoke/owner/test patterns (incl. 161.38.136.60)
 * - Pre-funnel passive landing credits (before Step 1 gating)
 * - Post-funnel rows without a matching GetReferralLink visitor event
 *
 * Dry-run: node scripts/cleanup-test-referrals.mjs
 * Apply:    node scripts/cleanup-test-referrals.mjs --apply
 */
import { createClient } from '@supabase/supabase-js';
import { execSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { partitionReferrals } from './referral-cleanup-helpers.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const APPLY = process.argv.includes('--apply');

const SUPABASE_URL =
  process.env.VITE_SUPABASE_URL || 'https://wqbefjzpgsezzwdrvvua.supabase.co';

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

const admin = createClient(SUPABASE_URL, getServiceRoleKey(), {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function fetchAllReferrals() {
  const { data, error } = await admin
    .from('referrals')
    .select('id, referrer_code, referred_ip, user_agent, created_at')
    .order('created_at', { ascending: false })
    .limit(5000);
  if (error) throw error;
  return data || [];
}

async function fetchFunnelEvents() {
  const { data, error } = await admin
    .from('visitor_events')
    .select('event_name, ref_code, metadata, created_at')
    .eq('event_name', 'GetReferralLink')
    .order('created_at', { ascending: false })
    .limit(5000);
  if (error) throw error;
  return data || [];
}

async function reconcileProfileCounts() {
  const [{ data: refs }, { data: profiles }] = await Promise.all([
    admin.from('referrals').select('referrer_code'),
    admin.from('profiles').select('referrer_code, referral_count, total_points'),
  ]);

  const counts = new Map();
  for (const row of refs || []) {
    counts.set(row.referrer_code, (counts.get(row.referrer_code) || 0) + 1);
  }

  let updated = 0;
  for (const profile of profiles || []) {
    const actual = counts.get(profile.referrer_code) || 0;
    const expectedPoints = actual * 10;
    if (profile.referral_count === actual && profile.total_points === expectedPoints) continue;

    const { error } = await admin
      .from('profiles')
      .update({
        referral_count: actual,
        total_points: expectedPoints,
        updated_at: new Date().toISOString(),
      })
      .eq('referrer_code', profile.referrer_code);
    if (error) throw error;
    updated += 1;
  }

  return updated;
}

function summarizeByReason(rows) {
  const byReason = {};
  for (const row of rows) {
    byReason[row.reason] = (byReason[row.reason] || 0) + 1;
  }
  return byReason;
}

async function main() {
  console.log(`=== Cleanup non-funnel referrals (${APPLY ? 'APPLY' : 'DRY-RUN'}) ===\n`);

  const [all, events] = await Promise.all([fetchAllReferrals(), fetchFunnelEvents()]);
  const { kept, removed } = partitionReferrals(all, events);

  console.log(`Total referrals in DB: ${all.length}`);
  console.log(`Rows to remove:        ${removed.length}`);
  console.log(`Rows to keep:          ${kept.length}`);
  console.log(`Remove breakdown:      ${JSON.stringify(summarizeByReason(removed))}\n`);

  if (removed.length) {
    console.log('Removing:');
    for (const r of removed) {
      console.log(
        `  - [${r.reason}] ${r.id} | ${r.referrer_code} | ip=${r.referred_ip ?? '—'} | ${r.created_at}`,
      );
    }
  }

  if (kept.length) {
    console.log('\nKeeping (funnel-gated):');
    for (const r of kept) {
      console.log(
        `  + ${r.id} | ${r.referrer_code} | ip=${r.referred_ip ?? '—'} | ${r.created_at}`,
      );
    }
  }

  const tot = await admin.rpc('get_total_referral_count');
  const lb = await admin.rpc('get_leaderboard', { min_referrals: 1 });
  console.log(`\nCurrent total count RPC: ${tot.data}`);
  console.log(`Current leaderboard: ${JSON.stringify(lb.data)}`);

  if (!APPLY || removed.length === 0) {
    if (!APPLY && removed.length > 0) {
      console.log('\nDry-run only. Re-run with --apply to delete non-funnel rows and reconcile profiles.');
    }
    return;
  }

  const ids = removed.map((r) => r.id);
  const chunk = 100;
  for (let i = 0; i < ids.length; i += chunk) {
    const slice = ids.slice(i, i + chunk);
    const { error: delErr } = await admin.from('referrals').delete().in('id', slice);
    if (delErr) throw delErr;
  }

  const profilesUpdated = await reconcileProfileCounts();

  console.log(`\nDeleted ${ids.length} non-funnel referral row(s).`);
  console.log(`Reconciled ${profilesUpdated} profile row(s).`);

  const totAfter = await admin.rpc('get_total_referral_count');
  const lbAfter = await admin.rpc('get_leaderboard', { min_referrals: 1 });
  console.log(`After cleanup total count RPC: ${totAfter.data}`);
  console.log(`After cleanup leaderboard: ${JSON.stringify(lbAfter.data)}`);
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  main().catch((err) => {
    console.error('Cleanup failed:', err);
    process.exit(1);
  });
}