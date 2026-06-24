#!/usr/bin/env node
/**
 * Poll production referrals until a new real row appears (or timeout).
 * Usage: node scripts/watch-first-referral.mjs
 */
import { createClient } from '@supabase/supabase-js';
import { execSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const URL = 'https://wqbefjzpgsezzwdrvvua.supabase.co';
const ANON =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndxYmVmanpwZ3Nlenp3ZHJ2dnVhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM5NTMyNDAsImV4cCI6MjA4OTUyOTI0MH0.pVHqeG0sGPgpUlOlskf7rOvnAsdrzrv5govZXcyxEdk';
const OWNER_CODE = process.env.WATCH_REFERRER_CODE || 'VIRAL-97UWEGZ';
const POLL_MS = Number(process.env.WATCH_POLL_MS || 5000);
const MAX_MINUTES = Number(process.env.WATCH_MAX_MINUTES || 15);

const TEST_PATTERNS = [
  /SMOKETEST/i,
  /AUDITPROBE/i,
  /NovaVerify/i,
  /NovaAuditProbe/i,
  /203\.0\.113\./,
];

function serviceKey() {
  const out = execSync('npx supabase projects api-keys --project-ref wqbefjzpgsezzwdrvvua', {
    encoding: 'utf8',
    cwd: ROOT,
  });
  return out.match(/service_role\s*\|\s*(eyJ[^\s|]+)/)[1];
}

function isRealReferral(row) {
  const ua = row.user_agent || '';
  const ip = row.referred_ip || '';
  if (TEST_PATTERNS.some((re) => re.test(ua) || re.test(ip))) return false;
  if (row.referrer_code === 'VIRAL-AUDITPROBE' || row.referrer_code === 'VIRAL-SMOKETEST') return false;
  return true;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

const admin = createClient(URL, serviceKey(), { auth: { persistSession: false } });
const pub = createClient(URL, ANON);

async function snapshot() {
  const [rows, total, mine, lb] = await Promise.all([
    admin.from('referrals').select('*').order('created_at', { ascending: false }).limit(20),
    pub.rpc('get_total_referral_count'),
    pub.rpc('get_my_referral_count', { p_referrer_code: OWNER_CODE }),
    pub.rpc('get_leaderboard', { min_referrals: 0 }),
  ]);
  return {
    rows: rows.data ?? [],
    total: total.data ?? 0,
    mine: mine.data ?? 0,
    leaderboard: lb.data ?? [],
    errors: [rows.error, total.error, mine.error, lb.error].filter(Boolean).map((e) => e.message),
  };
}

console.log('=== Watching for first real referral ===');
console.log(`Referrer: ${OWNER_CODE}`);
console.log(`Poll every ${POLL_MS / 1000}s for up to ${MAX_MINUTES} min`);
console.log('Open incognito → https://www.viralrefer.app/r/VIRAL-97UWEGZ');
console.log('');

const baseline = await snapshot();
const baselineIds = new Set(baseline.rows.map((r) => r.id));
console.log(`Baseline: total=${baseline.total}, yours=${baseline.mine}, rows=${baseline.rows.length}`);
console.log('Waiting...\n');

const deadline = Date.now() + MAX_MINUTES * 60_000;
let polls = 0;

while (Date.now() < deadline) {
  await sleep(POLL_MS);
  polls += 1;
  const snap = await snapshot();
  const newRows = snap.rows.filter((r) => !baselineIds.has(r.id));
  const realNew = newRows.filter(isRealReferral);

  const ts = new Date().toISOString().slice(11, 19);
  process.stdout.write(
    `[${ts}] poll #${polls} total=${snap.total} yours=${snap.mine} new=${newRows.length}\r`,
  );

  if (realNew.length > 0) {
    const row = realNew[0];
    console.log('\n');
    console.log('*** FIRST REAL REFERRAL DETECTED ***');
    console.log(JSON.stringify(
      {
        at: new Date().toISOString(),
        referral: {
          id: row.id,
          referrer_code: row.referrer_code,
          referred_ip: row.referred_ip,
          created_at: row.created_at,
          user_agent: (row.user_agent || '').slice(0, 120),
        },
        stats: {
          get_total_referral_count: snap.total,
          get_my_referral_count: snap.mine,
          leaderboard: snap.leaderboard,
        },
      },
      null,
      2,
    ));
    process.exit(0);
  }

  if (newRows.length > 0 && realNew.length === 0) {
    console.log(`\n[${ts}] Ignored test row(s): ${newRows.map((r) => r.referrer_code).join(', ')}`);
    newRows.forEach((r) => baselineIds.add(r.id));
  }
}

console.log('\n');
console.log(`No real referral within ${MAX_MINUTES} minutes.`);
console.log('Last snapshot:', JSON.stringify(await snapshot(), null, 2));
process.exit(1);