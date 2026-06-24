#!/usr/bin/env node
/**
 * Remove Nova/agent-generated test referrals from production only.
 * Dry-run by default: node scripts/cleanup-test-referrals.mjs
 * Apply deletes:     node scripts/cleanup-test-referrals.mjs --apply
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

const LEGACY_DEMO_CODES = new Set([
  'sarah_m', 'james_t', 'maria_k', 'david_r', 'emma_l', 'noah_p',
]);

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

/** Conservative: only rows Nova/agents/smoke scripts would have created. */
export function isTestReferralRow(row) {
  const code = String(row.referrer_code || '').trim().toUpperCase();
  const ua = String(row.user_agent || '').trim();
  const ip = String(row.referred_ip ?? row.ip_address ?? '').trim();

  if (LEGACY_DEMO_CODES.has(String(row.referrer_code || '').trim())) return true;
  if (/NovaVerify/i.test(ua)) return true;
  if (/\b(vitest|playwright|smoke|headless|automation)\b/i.test(ua)) return true;
  if (/^203\.0\.113\./.test(ip)) return true;
  if (code === 'VIRAL-SMOKETEST' || code === 'VIRAL-READY') return true;
  if (/SMOKETEST/.test(code)) return true;
  if (/DEMOCODE/.test(code)) return true;
  if (/^DEMO\d+$/.test(code)) return true;
  if (/PROBE/.test(code)) return true;
  if (/TESTFIX/.test(code)) return true;

  return false;
}

const admin = createClient(SUPABASE_URL, getServiceRoleKey(), {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function main() {
  console.log(`=== Cleanup test referrals (${APPLY ? 'APPLY' : 'DRY-RUN'}) ===\n`);

  const { data: all, error } = await admin
    .from('referrals')
    .select('id, referrer_code, referred_ip, user_agent, created_at')
    .order('created_at', { ascending: false })
    .limit(5000);

  if (error) throw error;

  const testRows = (all || []).filter(isTestReferralRow);
  const realRows = (all || []).filter((r) => !isTestReferralRow(r));

  console.log(`Total referrals in DB: ${all?.length ?? 0}`);
  console.log(`Test rows to remove:   ${testRows.length}`);
  console.log(`Real rows kept:        ${realRows.length}\n`);

  if (testRows.length) {
    console.log('Test rows:');
    for (const r of testRows) {
      console.log(
        `  - ${r.id} | ${r.referrer_code} | ip=${r.referred_ip ?? r.ip_address ?? '—'} | ua=${(r.user_agent || '—').slice(0, 60)}`,
      );
    }
  } else {
    console.log('No test referral rows matched.');
  }

  if (realRows.length) {
    console.log('\nReal rows (kept):');
    for (const r of realRows) {
      console.log(
        `  + ${r.id} | ${r.referrer_code} | ip=${r.referred_ip ?? r.ip_address ?? '—'} | ua=${(r.user_agent || '—').slice(0, 60)}`,
      );
    }
  }

  if (!APPLY || testRows.length === 0) {
    if (!APPLY && testRows.length > 0) {
      console.log('\nDry-run only. Re-run with --apply to delete test rows.');
    }
    const tot = await admin.rpc('get_total_referral_count');
    const lb = await admin.rpc('get_leaderboard', { min_referrals: 1 });
    console.log(`\nCurrent total count RPC: ${tot.data}`);
    console.log(`Current leaderboard: ${JSON.stringify(lb.data)}`);
    return;
  }

  const ids = testRows.map((r) => r.id);
  const { error: delErr } = await admin.from('referrals').delete().in('id', ids);
  if (delErr) throw delErr;

  console.log(`\nDeleted ${ids.length} test referral row(s).`);

  const tot = await admin.rpc('get_total_referral_count');
  const lb = await admin.rpc('get_leaderboard', { min_referrals: 1 });
  console.log(`After cleanup total count RPC: ${tot.data}`);
  console.log(`After cleanup leaderboard: ${JSON.stringify(lb.data)}`);
}

main().catch((err) => {
  console.error('Cleanup failed:', err);
  process.exit(1);
});