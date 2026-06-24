#!/usr/bin/env node
/**
 * Remove test prize claim rows only (TESTABC123 pattern).
 * Dry-run: node scripts/cleanup-test-prize-claim.mjs
 * Apply:   node scripts/cleanup-test-prize-claim.mjs --apply
 */
import { createClient } from '@supabase/supabase-js';
import { execSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const APPLY = process.argv.includes('--apply');
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const URL = 'https://wqbefjzpgsezzwdrvvua.supabase.co';

function serviceKey() {
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) return process.env.SUPABASE_SERVICE_ROLE_KEY;
  const out = execSync('npx supabase projects api-keys --project-ref wqbefjzpgsezzwdrvvua', {
    encoding: 'utf8',
    cwd: ROOT,
  });
  return out.match(/service_role\s*\|\s*(eyJ[^\s|]+)/)[1];
}

export function isTestPrizeClaim(row) {
  const code = String(row.referrer_code || '').trim().toUpperCase();
  return code === 'TESTABC123' || /^TEST[A-Z0-9]+$/.test(code);
}

const admin = createClient(URL, serviceKey(), { auth: { persistSession: false } });

const { data, error } = await admin
  .from('prize_claims')
  .select('id, referrer_code, status, created_at')
  .order('created_at', { ascending: false })
  .limit(100);

if (error) throw error;

const testRows = (data || []).filter(isTestPrizeClaim);
const realRows = (data || []).filter((r) => !isTestPrizeClaim(r));

console.log(`=== Cleanup test prize claims (${APPLY ? 'APPLY' : 'DRY-RUN'}) ===`);
console.log(`Total claims: ${data?.length ?? 0}`);
console.log(`Test to remove: ${testRows.length}`);
console.log(`Real kept: ${realRows.length}`);

for (const r of testRows) {
  console.log(`  - ${r.id} | ${r.referrer_code} | ${r.status} | ${r.created_at}`);
}
for (const r of realRows) {
  console.log(`  + KEEP ${r.id} | ${r.referrer_code} | ${r.status}`);
}

if (!APPLY || testRows.length === 0) {
  if (!APPLY && testRows.length > 0) console.log('\nRe-run with --apply to delete.');
  process.exit(0);
}

const ids = testRows.map((r) => r.id);
const { error: delErr } = await admin.from('prize_claims').delete().in('id', ids);
if (delErr) throw delErr;
console.log(`\nDeleted ${ids.length} test prize claim(s).`);