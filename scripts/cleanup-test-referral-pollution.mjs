#!/usr/bin/env node
/**
 * Remove smoke/owner/automation referral rows (fast pollution sweep after deploy/smoke).
 * Does NOT remove pre-funnel passive credits — use cleanup-test-referrals.mjs for that.
 *
 * Dry-run: node scripts/cleanup-test-referral-pollution.mjs
 * Apply:    node scripts/cleanup-test-referral-pollution.mjs --apply
 */
import { createClient } from '@supabase/supabase-js';
import { execSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const APPLY = process.argv.includes('--apply');
const SUPABASE_URL =
  process.env.VITE_SUPABASE_URL || 'https://wqbefjzpgsezzwdrvvua.supabase.co';

const OWNER_IPS = ['161.38.136.60', '57.138.135.240'];
const TEST_CODE_RE = [
  /^VIRAL-SMOKETEST$/i,
  /^VIRAL-READY$/i,
  /SMOKETEST/i,
  /DEMOCODE/i,
  /^DEMO\d+$/i,
  /PROBE/i,
  /TESTFIX/i,
  /^VIRAL-(LANDING|FUNNEL|TOAST|FAIL|RETRY|ATTRIB|DEMO)/i,
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

function isTestReferrerCode(code) {
  const c = String(code || '').trim().toUpperCase();
  if (!c) return false;
  return TEST_CODE_RE.some((re) => re.test(c));
}

function isTestPollutionRow(row) {
  const code = String(row.referrer_code || '');
  const ua = String(row.user_agent || '').trim();
  const ip = String(row.referred_ip ?? row.ip_address ?? '').trim();
  if (isTestReferrerCode(code)) return true;
  if (OWNER_IPS.includes(ip)) return true;
  if (/^203\.0\.113\./.test(ip)) return true;
  if (ua === 'node') return true;
  if (/HeadlessChrome/i.test(ua)) return true;
  if (/\b(vitest|playwright|smoke|headless|automation)\b/i.test(ua)) return true;
  return false;
}

const admin = createClient(SUPABASE_URL, getServiceRoleKey(), {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function main() {
  console.log(`=== Cleanup test referral pollution (${APPLY ? 'APPLY' : 'DRY-RUN'}) ===\n`);

  const { data: all, error } = await admin
    .from('referrals')
    .select('id, referrer_code, referred_ip, user_agent, created_at')
    .order('created_at', { ascending: false })
    .limit(5000);
  if (error) throw error;

  const testRows = (all || []).filter(isTestPollutionRow);
  const kept = (all || []).filter((r) => !isTestPollutionRow(r));

  console.log(`Total: ${all?.length ?? 0} | test pollution: ${testRows.length} | kept: ${kept.length}`);

  if (testRows.length) {
    for (const r of testRows.slice(0, 12)) {
      console.log(`  - ${r.referrer_code} | ip=${r.referred_ip ?? '—'} | ${r.created_at}`);
    }
    if (testRows.length > 12) console.log(`  ... +${testRows.length - 12} more`);
  }

  const tot = await admin.rpc('get_total_referral_count');
  const lb = await admin.rpc('get_leaderboard', { min_referrals: 1 });
  console.log(`\nPublic total RPC: ${tot.data}`);
  console.log(`Public leaderboard: ${JSON.stringify(lb.data)}`);

  if (!APPLY || testRows.length === 0) {
    if (!APPLY && testRows.length > 0) console.log('\nDry-run only. Re-run with --apply to delete.');
    return;
  }

  const ids = testRows.map((r) => r.id);
  const chunk = 100;
  for (let i = 0; i < ids.length; i += chunk) {
    const { error: delErr } = await admin.from('referrals').delete().in('id', ids.slice(i, i + chunk));
    if (delErr) throw delErr;
  }

  console.log(`\nDeleted ${ids.length} test pollution row(s).`);
  const totAfter = await admin.rpc('get_total_referral_count');
  const lbAfter = await admin.rpc('get_leaderboard', { min_referrals: 1 });
  console.log(`After total RPC: ${totAfter.data}`);
  console.log(`After leaderboard: ${JSON.stringify(lbAfter.data)}`);
}

main().catch((err) => {
  console.error('Cleanup failed:', err);
  process.exit(1);
});