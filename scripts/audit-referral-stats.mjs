#!/usr/bin/env node
/** Full referral stats audit — read-only unless --probe-insert */
import { createClient } from '@supabase/supabase-js';
import { execSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const URL = 'https://wqbefjzpgsezzwdrvvua.supabase.co';
const ANON =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndxYmVmanpwZ3Nlenp3ZHJ2dnVhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM5NTMyNDAsImV4cCI6MjA4OTUyOTI0MH0.pVHqeG0sGPgpUlOlskf7rOvnAsdrzrv5govZXcyxEdk';

function serviceKey() {
  const out = execSync('npx supabase projects api-keys --project-ref wqbefjzpgsezzwdrvvua', {
    encoding: 'utf8',
    cwd: ROOT,
  });
  return out.match(/service_role\s*\|\s*(eyJ[^\s|]+)/)[1];
}

const admin = createClient(URL, serviceKey(), { auth: { persistSession: false } });
const pub = createClient(URL, ANON);

const report = { at: new Date().toISOString() };

const [refs, lb, total, mine, recent] = await Promise.all([
  admin.from('referrals').select('*').order('created_at', { ascending: false }).limit(50),
  pub.rpc('get_leaderboard', { min_referrals: 0 }),
  pub.rpc('get_total_referral_count'),
  pub.rpc('get_my_referral_count', { p_referrer_code: 'VIRAL-97UWEGZ' }),
  admin.from('referrals').select('referrer_code, created_at').order('created_at', { ascending: false }).limit(10),
]);

report.referrals_table = { count: refs.data?.length ?? 0, error: refs.error?.message, rows: refs.data };
report.get_leaderboard = { data: lb.data, error: lb.error?.message };
report.get_total_referral_count = { data: total.data, error: total.error?.message };
report.get_my_referral_count_VIRAL_97UWEGZ = { data: mine.data, error: mine.error?.message };

// Count attributed landings without matching referrals (last 7 days)
const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
const { data: landings } = await admin
  .from('visitor_events')
  .select('ref_code, event_name, created_at')
  .eq('event_name', 'SiteLanding')
  .not('ref_code', 'is', null)
  .gte('created_at', weekAgo)
  .limit(500);

const refLandings = (landings || []).filter((e) => e.ref_code && e.ref_code !== '');
report.attributed_landings_7d = refLandings.length;
report.unique_ref_codes_7d = [...new Set(refLandings.map((e) => e.ref_code))];

// Test direct insert shape (dry run - check if trigger blocks)
const testPayload = {
  referrer_code: 'VIRAL-AUDITPROBE',
  referred_ip: '203.0.113.99',
  user_agent: 'NovaAuditProbe/1.0 (dry-run check only)',
};
const { error: insertErr } = await admin.from('referrals').insert(testPayload).select('id').single();
if (insertErr) {
  report.direct_insert_test = { ok: false, error: insertErr.message, code: insertErr.code };
} else {
  const { data: probe } = await admin
    .from('referrals')
    .select('id')
    .eq('referrer_code', 'VIRAL-AUDITPROBE')
    .maybeSingle();
  report.direct_insert_test = { ok: true, id: probe?.id };
  if (probe?.id) await admin.from('referrals').delete().eq('id', probe.id);
}

// Edge function contract (no valid turnstile)
const edgeRes = await fetch(`${URL}/functions/v1/record-referral`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${ANON}`,
    apikey: ANON,
  },
  body: JSON.stringify({
    referrerCode: 'VIRAL-97UWEGZ',
    turnstileToken: 'audit-invalid-token',
  }),
});
report.edge_reach = { status: edgeRes.status, body: await edgeRes.json() };

console.log(JSON.stringify(report, null, 2));