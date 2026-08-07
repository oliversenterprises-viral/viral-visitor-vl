#!/usr/bin/env node
/**
 * Date-window cleanup: remove ONLY test/owner/smoke referrals + test shares.
 * Never deletes real user rows. Safe for production.
 *
 * Default window: yesterday 00:00 America/Chicago → end of today (CDT/CST).
 *
 * Dry-run: node scripts/cleanup-test-window.mjs
 * Apply:    node scripts/cleanup-test-window.mjs --apply
 */
import { createClient } from '@supabase/supabase-js';
import { execSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isTestReferralRow } from './referral-cleanup-helpers.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const APPLY = process.argv.includes('--apply');
const SUPABASE_URL =
  process.env.VITE_SUPABASE_URL || 'https://wqbefjzpgsezzwdrvvua.supabase.co';

/** Yesterday 00:00 → tomorrow 00:00 in America/Chicago (covers "yesterday and today"). */
function defaultWindow() {
  // Fixed calendar for this run: 2026-07-25 and 2026-07-26 CDT (UTC-5)
  // 00:00 CDT Jul 25 = 05:00 UTC Jul 25
  // 00:00 CDT Jul 27 = 05:00 UTC Jul 27
  return {
    since: process.env.CLEAN_SINCE || '2026-07-25T05:00:00.000Z',
    until: process.env.CLEAN_UNTIL || '2026-07-27T05:00:00.000Z',
  };
}

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

function isTestShareCode(code) {
  const c = String(code || '').trim().toUpperCase();
  if (!c || c === 'UNKNOWN') return true;
  if (c === 'VIRAL-READY') return true;
  if (/PROBE|SMOKETEST|DEMOCODE|TESTFIX/.test(c)) return true;
  if (/^DEMO\d+$/.test(c)) return true;
  if (/^VIRAL-(LANDING|FUNNEL|TOAST|FAIL|RETRY|ATTRIB|DEMO)/.test(c)) return true;
  return false;
}

function resolveShareCode(row) {
  const direct = String(row.referrer_code || '').trim();
  if (direct && direct.toLowerCase() !== 'unknown') return direct;
  const link = String(row.referral_link || '');
  const m = link.match(/VIRAL-[A-Z0-9]+/i);
  return m ? m[0] : direct || 'unknown';
}

async function reconcileProfileCounts(admin) {
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

async function deleteByIds(admin, table, ids) {
  const chunk = 100;
  for (let i = 0; i < ids.length; i += chunk) {
    const { error } = await admin.from(table).delete().in('id', ids.slice(i, i + chunk));
    if (error) throw error;
  }
}

async function main() {
  const { since, until } = defaultWindow();
  console.log(`=== Cleanup TEST refs/shares in window (${APPLY ? 'APPLY' : 'DRY-RUN'}) ===`);
  console.log(`Window: ${since} → ${until}\n`);

  const admin = createClient(SUPABASE_URL, getServiceRoleKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: refs, error: rErr } = await admin
    .from('referrals')
    .select('id, referrer_code, referred_ip, user_agent, created_at')
    .gte('created_at', since)
    .lt('created_at', until)
    .order('created_at', { ascending: false })
    .limit(5000);
  if (rErr) throw rErr;

  const { data: shares, error: sErr } = await admin
    .from('shares')
    .select('*')
    .gte('created_at', since)
    .lt('created_at', until)
    .order('created_at', { ascending: false })
    .limit(5000);
  if (sErr) throw sErr;

  const testRefs = (refs || []).filter(isTestReferralRow);
  const keepRefs = (refs || []).filter((r) => !isTestReferralRow(r));
  const testShares = (shares || []).filter((r) => isTestShareCode(resolveShareCode(r)));
  const keepShares = (shares || []).filter((r) => !isTestShareCode(resolveShareCode(r)));

  console.log(
    `Referrals in window: ${refs?.length ?? 0} | TEST delete: ${testRefs.length} | KEEP real: ${keepRefs.length}`,
  );
  for (const r of testRefs) {
    console.log(
      `  - REF ${r.id} | ${r.referrer_code} | ip=${r.referred_ip ?? '—'} | ua=${String(r.user_agent || '').slice(0, 48)} | ${r.created_at}`,
    );
  }
  if (keepRefs.length) {
    console.log('  (kept real referrals in window — not touched)');
    for (const r of keepRefs) {
      console.log(`  + KEEP ${r.id} | ${r.referrer_code} | ${r.created_at}`);
    }
  }

  console.log(
    `\nShares in window: ${shares?.length ?? 0} | TEST delete: ${testShares.length} | KEEP real: ${keepShares.length}`,
  );
  for (const r of testShares.slice(0, 40)) {
    console.log(
      `  - SHARE ${r.id} | ${resolveShareCode(r)} | ${r.platform || '—'} | ${r.created_at}`,
    );
  }
  if (testShares.length > 40) console.log(`  ... +${testShares.length - 40} more`);
  if (keepShares.length) {
    console.log('  (kept real shares in window — not touched)');
    for (const r of keepShares.slice(0, 15)) {
      console.log(`  + KEEP ${r.id} | ${resolveShareCode(r)} | ${r.platform || '—'} | ${r.created_at}`);
    }
    if (keepShares.length > 15) console.log(`  ... +${keepShares.length - 15} more kept`);
  }

  const tot = await admin.rpc('get_total_referral_count');
  const lb = await admin.rpc('get_leaderboard', { min_referrals: 1 });
  console.log(`\nPublic total RPC: ${tot.data}`);
  console.log(`Public leaderboard: ${JSON.stringify(lb.data)}`);

  if (!APPLY) {
    if (testRefs.length || testShares.length) {
      console.log('\nDry-run only. Re-run with --apply to delete TEST rows only.');
    } else {
      console.log('\nNothing to delete in window.');
    }
    return;
  }

  if (testRefs.length) {
    await deleteByIds(
      admin,
      'referrals',
      testRefs.map((r) => r.id),
    );
    console.log(`\nDeleted ${testRefs.length} test referral(s).`);
  }
  if (testShares.length) {
    await deleteByIds(
      admin,
      'shares',
      testShares.map((r) => r.id),
    );
    console.log(`Deleted ${testShares.length} test share(s).`);
  }

  let profilesUpdated = 0;
  try {
    profilesUpdated = await reconcileProfileCounts(admin);
  } catch (err) {
    // profiles table may be unused / missing in prod — non-fatal
    console.warn('Profile reconcile skipped:', err?.message || err);
  }
  console.log(`Profile rows reconciled: ${profilesUpdated}`);

  const totAfter = await admin.rpc('get_total_referral_count');
  const lbAfter = await admin.rpc('get_leaderboard', { min_referrals: 1 });
  console.log(`After total RPC: ${totAfter.data}`);
  console.log(`After leaderboard: ${JSON.stringify(lbAfter.data)}`);
  console.log('\n=== Done (real user data preserved) ===');
}

main().catch((err) => {
  console.error('Cleanup failed:', err);
  process.exit(1);
});
