#!/usr/bin/env node
/**
 * Production referral recording smoke test.
 *
 * Run after every deploy:
 *   npm run test:smoke:prod
 *
 * Catches regressions such as:
 * - record-referral querying a missing `profiles` table
 * - wrong referrals column names (ip_address vs referred_ip)
 * - edge function returning "Invalid referrer code" for valid VIRAL- codes
 * - live site / leaderboard RPC unreachable
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import { chromium } from 'playwright';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const SUPABASE_URL =
  process.env.VITE_SUPABASE_URL || 'https://wqbefjzpgsezzwdrvvua.supabase.co';
const SUPABASE_ANON_KEY =
  process.env.VITE_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndxYmVmanpwZ3Nlenp3ZHJ2dnVhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM5NTMyNDAsImV4cCI6MjA4OTUyOTI0MH0.pVHqeG0sGPgpUlOlskf7rOvnAsdrzrv5govZXcyxEdk';
const LIVE_SITE = (process.env.SMOKE_LIVE_URL || 'https://www.viralrefer.app').replace(/\/$/, '');
const SMOKE_REF_CODE = process.env.SMOKE_REF_CODE || 'VIRAL-SMOKETEST';

/** @type {{ name: string; ok: boolean; detail: string; severity: 'error' | 'warn' }[]} */
const results = [];

function record(name, ok, detail = '', severity = 'error') {
  results.push({ name, ok, detail, severity });
  const tag = ok ? 'PASS' : severity === 'warn' ? 'WARN' : 'FAIL';
  console.log(`[${tag}] ${name}${detail ? ` — ${detail}` : ''}`);
}

function errors() {
  return results.filter((r) => !r.ok && r.severity === 'error').length;
}

function readRecordReferralSource() {
  const files = [
    'supabase/functions/record-referral/index.ts',
    'supabase/functions/_shared/record-referral-index.ts',
    'supabase/functions/_shared/record-referral-serve.ts',
    'supabase/functions/_shared/record-referral-handler.ts',
    'supabase/functions/_shared/record-referral-request.ts',
    'supabase/functions/_shared/referrer-code.ts',
  ];
  return files.map((rel) => readFileSync(resolve(ROOT, rel), 'utf8')).join('\n');
}

function checkSourceGuards() {
  const src = readRecordReferralSource();

  record(
    'source: no profiles table lookup',
    !src.includes(".from('profiles')"),
    "record-referral must not query public.profiles (missing in prod)",
  );
  record(
    'source: uses referred_ip column',
    src.includes('referred_ip'),
    'insert/rate-limit must target production referred_ip column',
  );
  record(
    'source: no legacy ip_address writes',
    !src.includes('ip_address:') && !src.includes("eq('ip_address'"),
    'legacy migration column ip_address must not be used',
  );
  record(
    'source: referrer code format validation',
    src.includes('isValidReferrerCode') || src.includes('REFERRER_CODE_RE'),
    'client VIRAL- codes must be accepted without a profiles row',
  );
}

async function invokeRecordReferral(body) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/record-referral`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      apikey: SUPABASE_ANON_KEY,
    },
    body: JSON.stringify(body),
  });
  let json = null;
  try {
    json = await res.json();
  } catch {
    json = null;
  }
  return { status: res.status, json, text: JSON.stringify(json ?? {}) };
}

async function checkEdgeFunctionContract() {
  const malformed = await invokeRecordReferral({ referrerCode: '!!', turnstileToken: 'smoke-token' });
  record(
    'edge: rejects malformed referrer code',
    malformed.status === 400 &&
      (malformed.text.includes('Invalid request') || malformed.json?.error?.includes('Invalid request')),
    `status=${malformed.status} ${malformed.text.slice(0, 160)}`,
  );

  const valid = await invokeRecordReferral({
    referrerCode: SMOKE_REF_CODE,
    turnstileToken: 'smoke-invalid-turnstile-token',
  });

  const invalidReferrer = valid.text.includes('Invalid referrer code');
  const reachedTurnstile =
    valid.text.includes('Bot verification') ||
    valid.text.includes('verification_failed') ||
    valid.text.includes('verification');

  record(
    'edge: valid VIRAL code is NOT "Invalid referrer code"',
    !invalidReferrer,
    invalidReferrer
      ? 'REGRESSION — profiles-table bug would block all paid traffic'
      : valid.json?.error || `status=${valid.status}`,
  );
  record(
    'edge: request reaches Turnstile gate (not blocked pre-check)',
    valid.status === 403 && reachedTurnstile,
    valid.json?.error || `status=${valid.status}`,
  );

  const noTurnstile = await invokeRecordReferral({ referrerCode: SMOKE_REF_CODE });
  record(
    'edge: records referral without Turnstile (server-protected path)',
    noTurnstile.status === 200 && noTurnstile.json?.success === true,
    `status=${noTurnstile.status} ${noTurnstile.text.slice(0, 120)}`,
  );
}

async function checkLeaderboardRpc() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { data, error } = await supabase.rpc('get_leaderboard', { min_referrals: 1 });
  record(
    'db: get_leaderboard RPC reachable',
    !error && Array.isArray(data),
    error?.message || `${data?.length ?? 0} row(s)`,
  );

  const { data: total, error: totalErr } = await supabase.rpc('get_total_referral_count');
  record(
    'db: get_total_referral_count RPC reachable',
    !totalErr && typeof total === 'number',
    totalErr?.message || `total=${total}`,
  );
}

async function checkLiveSiteFetch() {
  const res = await fetch(`${LIVE_SITE}/?ref=VIRAL-97UWEGZ`, { redirect: 'follow' });
  const html = await res.text();
  record(
    'live: homepage HTTP 200',
    res.ok,
    `status=${res.status}`,
  );
  record(
    'live: page contains referral CTA',
    /get my referral link|refer friends/i.test(html),
    'hero CTA present in HTML',
  );
}

async function checkLiveSitePlaywright() {
  let recordReferralHit = null;
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  page.on('response', async (res) => {
    if (!res.url().includes('/functions/v1/record-referral')) return;
    try {
      recordReferralHit = { status: res.status(), body: await res.json() };
    } catch {
      recordReferralHit = { status: res.status(), body: null };
    }
  });

  try {
    await page.goto(`${LIVE_SITE}/?ref=VIRAL-97UWEGZ`, {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    });

    const btn = page.getByRole('button', { name: /referral link|get my|join/i }).first();
    if ((await btn.count()) > 0) {
      await btn.click();
      await page.waitForTimeout(10000);
    }

    if (recordReferralHit) {
      const bodyText = JSON.stringify(recordReferralHit.body || {});
      record(
        'live: record-referral response (if Turnstile allows)',
        !bodyText.includes('Invalid referrer code'),
        `status=${recordReferralHit.status} ${bodyText.slice(0, 140)}`,
      );
    } else {
      record(
        'live: record-referral network call observed',
        false,
        'Headless Turnstile often blocks automation — edge contract checks above are authoritative',
        'warn',
      );
    }
  } finally {
    await browser.close();
  }
}

async function checkLiveSite() {
  await checkLiveSiteFetch();
  try {
    await checkLiveSitePlaywright();
  } catch (err) {
    const msg = err?.message || String(err);
    if (msg.includes("Executable doesn't exist") || msg.includes('playwright install')) {
      record(
        'live: playwright attribution probe',
        false,
        'Skipped — run npx playwright install for full browser probe (fetch checks above still ran)',
        'warn',
      );
      return;
    }
    throw err;
  }
}

async function main() {
  console.log('=== ViralRefer Production Referral Smoke Test ===');
  console.log(`Site: ${LIVE_SITE}`);
  console.log(`Supabase: ${SUPABASE_URL}`);
  console.log('');

  checkSourceGuards();
  await checkEdgeFunctionContract();
  await checkLeaderboardRpc();
  await checkLiveSite();

  const passed = results.filter((r) => r.ok).length;
  const warns = results.filter((r) => !r.ok && r.severity === 'warn').length;
  const fails = errors();

  console.log('');
  console.log('=== Summary ===');
  console.log(`${passed}/${results.length} checks passed (${warns} warning(s), ${fails} failure(s))`);

  if (fails > 0) {
    console.error('\nSmoke test FAILED — do not treat deploy as healthy for referral recording.');
    process.exit(1);
  }

  console.log('\nSmoke test PASSED — referral recording path looks healthy.');
}

main().catch((err) => {
  console.error('Smoke test crashed:', err);
  process.exit(1);
});