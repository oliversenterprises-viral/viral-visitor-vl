#!/usr/bin/env node
/**
 * Capture live record-referral on production (no Turnstile stub).
 */
import { chromium } from 'playwright';
import { createClient } from '@supabase/supabase-js';
import { execSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const LIVE = (process.env.SMOKE_LIVE_URL || 'https://www.viralrefer.app').replace(/\/$/, '');
const REF = process.env.PROBE_REF || 'VIRAL-PROBE-LIVE';
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function serviceKey() {
  const out = execSync('npx supabase projects api-keys --project-ref wqbefjzpgsezzwdrvvua', {
    encoding: 'utf8',
    cwd: ROOT,
  });
  return out.match(/service_role\s*\|\s*(eyJ[^\s|]+)/)[1];
}

const report = {
  at: new Date().toISOString(),
  url: `${LIVE}/r/${REF}`,
  recordReferral: null,
  consoleErrors: [],
  verdict: null,
};

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

page.on('console', (msg) => {
  if (msg.type() === 'error' && !msg.text().includes('NaN')) {
    report.consoleErrors.push(msg.text());
  }
});

page.on('response', async (res) => {
  if (!res.url().includes('/functions/v1/record-referral')) return;
  let body = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  report.recordReferral = { status: res.status(), body, at: new Date().toISOString() };
});

const baseline = await createClient('https://wqbefjzpgsezzwdrvvua.supabase.co', serviceKey(), {
  auth: { persistSession: false },
})
  .from('referrals')
  .select('id', { count: 'exact', head: true });

report.baselineCount = baseline.count ?? 0;

await page.goto(report.url, { waitUntil: 'domcontentloaded', timeout: 90000 });
await page.waitForFunction(
  () => document.documentElement.getAttribute('data-vr-ready') === '1',
  { timeout: 30000 },
);
await page.waitForTimeout(8000);

const after = await createClient('https://wqbefjzpgsezzwdrvvua.supabase.co', serviceKey(), {
  auth: { persistSession: false },
})
  .from('referrals')
  .select('id', { count: 'exact', head: true });

report.afterCount = after.count ?? 0;
report.dbIncreased = (after.count ?? 0) > (baseline.count ?? 0);

await browser.close();

if (report.recordReferral?.status === 200 && report.recordReferral?.body?.success) {
  report.verdict = report.recordReferral.body.duplicate
    ? 'PASS — duplicate handled (dedupe working)'
    : 'PASS — referral recorded';
} else if (report.dbIncreased) {
  report.verdict = 'PASS — DB count increased';
} else {
  report.verdict = `FAIL — ${JSON.stringify(report.recordReferral)}`;
}

console.log(JSON.stringify(report, null, 2));

// Cleanup probe row
if (report.recordReferral?.body?.referralId && REF === 'VIRAL-PROBE-LIVE') {
  await createClient('https://wqbefjzpgsezzwdrvvua.supabase.co', serviceKey(), {
    auth: { persistSession: false },
  })
    .from('referrals')
    .delete()
    .eq('referrer_code', REF);
}

process.exit(report.verdict?.startsWith('PASS') ? 0 : 1);