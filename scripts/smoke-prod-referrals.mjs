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

  record(
    'edge: valid VIRAL code is NOT "Invalid referrer code"',
    !invalidReferrer,
    invalidReferrer
      ? 'REGRESSION — profiles-table bug would block all paid traffic'
      : valid.json?.error || `status=${valid.status}`,
  );
  record(
    'edge: invalid Turnstile token does NOT block recording',
    valid.status === 200 && valid.json?.success === true,
    valid.json?.error || `status=${valid.status}`,
  );

  const noTurnstile = await invokeRecordReferral({ referrerCode: SMOKE_REF_CODE });
  record(
    'edge: records referral without Turnstile (server-protected path)',
    noTurnstile.status === 200 && noTurnstile.json?.success === true,
    `status=${noTurnstile.status} ${noTurnstile.text.slice(0, 120)}`,
  );
}

async function checkRlsLockdown() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  const sensitiveTables = [
    'referrals',
    'shares',
    'visitor_events',
    'banner_events',
    'prize_claims',
    'interaction_events',
    'optimizer_experiments',
  ];
  for (const table of sensitiveTables) {
    const { data, error } = await supabase.from(table).select('id').limit(1);
    const blocked =
      Boolean(error) ||
      (Array.isArray(data) && data.length === 0);
    record(
      `rls: anon blocked from ${table} SELECT`,
      blocked,
      error?.message || `${data?.length ?? 0} row(s) returned`,
    );
  }

  const { error: interactionInsertErr } = await supabase.from('interaction_events').insert({
    event_type: 'click',
    zone_id: 'smoke-test',
  });
  record(
    'rls: anon blocked from interaction_events INSERT',
    Boolean(interactionInsertErr),
    interactionInsertErr?.message || 'insert succeeded (regression)',
  );

  for (const table of ['visits', 'reddit_events', 'site_analytics']) {
    const { data, error } = await supabase.from(table).select('id').limit(1);
    const blocked = Boolean(error) || (Array.isArray(data) && data.length === 0);
    record(
      `rls: anon blocked from ${table} SELECT`,
      blocked,
      error?.message || `${data?.length ?? 0} row(s) returned`,
    );
  }

  const { data: siteContent, error: siteContentErr } = await supabase
    .from('site_content')
    .select('key')
    .limit(3);
  record(
    'rls: anon can read site_content SELECT',
    !siteContentErr && Array.isArray(siteContent) && siteContent.length > 0,
    siteContentErr?.message || `${siteContent?.length ?? 0} row(s)`,
  );

  const { error: siteContentUpdateErr } = await supabase
    .from('site_content')
    .update({ value: '"smoke-test"' })
    .eq('key', 'hero_title');
  record(
    'rls: anon blocked from site_content UPDATE',
    Boolean(siteContentUpdateErr),
    siteContentUpdateErr?.message || 'update succeeded (regression)',
  );

  const { error: siteContentInsertErr } = await supabase.from('site_content').insert({
    key: 'smoke_test_key',
    value: '"blocked"',
  });
  record(
    'rls: anon blocked from site_content INSERT',
    Boolean(siteContentInsertErr),
    siteContentInsertErr?.message || 'insert succeeded (regression)',
  );

  const { data: activity, error: activityErr } = await supabase.rpc('get_public_recent_activity', {
    p_limit: 3,
  });
  const activityOk =
    !activityErr &&
    activity &&
    typeof activity === 'object' &&
    Array.isArray(activity.rows);
  record(
    'rls: get_public_recent_activity RPC reachable',
    activityOk,
    activityErr?.message || `${activity?.rows?.length ?? 0} row(s)`,
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

  const homeFrame = res.headers.get('x-frame-options') || '';
  const homeCsp = res.headers.get('content-security-policy') || '';
  record(
    'live: homepage blocks iframe embedding',
    homeFrame.toUpperCase().includes('DENY') || /frame-ancestors\s+'none'/i.test(homeCsp),
    `x-frame-options=${homeFrame || '(none)'} frame-ancestors=${/frame-ancestors[^;]+/i.exec(homeCsp)?.[0] || '(none)'}`,
  );
}

async function checkEmbedRoute() {
  const res = await fetch(`${LIVE_SITE}/embed?utm_source=smoke`, { redirect: 'follow' });
  const html = await res.text();
  record('live: /embed HTTP 200', res.ok, `status=${res.status}`);
  record(
    'live: /embed contains referral CTA',
    /get my referral link|refer friends/i.test(html),
    'embed shell serves SPA',
  );

  const csp = res.headers.get('content-security-policy') || '';
  const xfo = (res.headers.get('x-frame-options') || '').toUpperCase();
  record(
    'live: /embed allows iframe embedding',
    /frame-ancestors\s+\*/i.test(csp) && !xfo.includes('DENY'),
    `csp frame-ancestors *; x-frame-options=${xfo || '(none)'}`,
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

async function checkOgImages() {
  const svgUrl = `${LIVE_SITE}/api/og-image?code=VIRAL-TEST01`;
  const pngUrl = `${svgUrl}&format=png`;

  try {
    const svgRes = await fetch(svgUrl);
    const svgType = svgRes.headers.get('content-type') || '';
    record(
      'live: OG image SVG endpoint',
      svgRes.ok && svgType.includes('svg'),
      `status=${svgRes.status} type=${svgType}`,
    );
  } catch (err) {
    record('live: OG image SVG endpoint', false, err?.message || String(err));
  }

  try {
    const pngRes = await fetch(pngUrl);
    const pngType = pngRes.headers.get('content-type') || '';
    record(
      'live: OG image PNG fallback',
      pngRes.ok && pngType.includes('png'),
      `status=${pngRes.status} type=${pngType}`,
    );
  } catch (err) {
    record('live: OG image PNG fallback', false, err?.message || String(err));
  }
}

async function checkLiveSite() {
  await checkLiveSiteFetch();
  await checkEmbedRoute();
  await checkOgImages();
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
  await checkRlsLockdown();
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