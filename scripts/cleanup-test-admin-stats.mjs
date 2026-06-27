#!/usr/bin/env node
/**
 * Remove owner/smoke test rows from visitor_events + banner_events (Edit Content panels).
 * Dry-run: node scripts/cleanup-test-admin-stats.mjs
 * Apply:    node scripts/cleanup-test-admin-stats.mjs --apply
 */
import { createClient } from '@supabase/supabase-js';
import { execSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  getVisitorEventIp,
  groupVisitorEventsByIp,
  isTestBannerEvent,
  isTestVisitorFunnelEvent,
} from './admin-stats-test-helpers.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
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

async function fetchPaged(table, select) {
  const rows = [];
  let start = 0;
  const page = 1000;
  while (true) {
    const { data, error } = await admin
      .from(table)
      .select(select)
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

async function deleteIds(table, ids) {
  const chunk = 200;
  for (let i = 0; i < ids.length; i += chunk) {
    const slice = ids.slice(i, i + chunk);
    const { error } = await admin.from(table).delete().in('id', slice);
    if (error) throw error;
  }
}

async function main() {
  console.log(`=== Cleanup test admin stats (${APPLY ? 'APPLY' : 'DRY-RUN'}) ===\n`);

  const [visitorAll, bannerAll] = await Promise.all([
    fetchPaged('visitor_events', 'id, event_name, ref_code, ip_hash, metadata, created_at'),
    fetchPaged('banner_events', 'id, event_type, banner_label, ip, user_agent, additional, created_at'),
  ]);

  const byIp = groupVisitorEventsByIp(visitorAll);
  const visitorTest = visitorAll.filter((row) =>
    isTestVisitorFunnelEvent(row, byIp.get(getVisitorEventIp(row) || String(row.ip_hash || 'unknown'))),
  );
  const bannerTest = bannerAll.filter(isTestBannerEvent);

  console.log(`visitor_events: ${visitorAll.length} total, ${visitorTest.length} test, ${visitorAll.length - visitorTest.length} kept`);
  console.log(`banner_events:  ${bannerAll.length} total, ${bannerTest.length} test, ${bannerAll.length - bannerTest.length} kept`);

  if (!APPLY) {
    if (visitorTest.length + bannerTest.length > 0) {
      console.log('\nDry-run only. Re-run with --apply to delete test rows.');
    }
    return;
  }

  if (visitorTest.length) {
    await deleteIds('visitor_events', visitorTest.map((r) => r.id));
  }
  if (bannerTest.length) {
    await deleteIds('banner_events', bannerTest.map((r) => r.id));
  }

  console.log(`\nDeleted ${visitorTest.length} visitor + ${bannerTest.length} banner test row(s).`);
}

main().catch((err) => {
  console.error('Cleanup failed:', err);
  process.exit(1);
});