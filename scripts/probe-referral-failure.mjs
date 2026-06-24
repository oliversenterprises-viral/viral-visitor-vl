#!/usr/bin/env node
/**
 * Capture live record-referral failures on production (no Turnstile stub).
 */
import { chromium } from 'playwright';
import { createClient } from '@supabase/supabase-js';
import { execSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const LIVE = (process.env.SMOKE_LIVE_URL || 'https://www.viralrefer.app').replace(/\/$/, '');
const REF = process.env.PROBE_REF || 'VIRAL-97UWEGZ';
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
  turnstile: { rendered: false, iframe: false, errors: [] },
  recordReferral: null,
  consoleErrors: [],
  verdict: null,
};

const browser = await chromium.launch({
  headless: true,
  args: ['--disable-blink-features=AutomationControlled'],
});
const page = await browser.newPage({
  userAgent:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
});

page.on('console', (msg) => {
  if (msg.type() === 'error') report.consoleErrors.push(msg.text());
});

page.on('response', async (res) => {
  if (!res.url().includes('/functions/v1/record-referral')) return;
  let body = null;
  try {
    body = await res.json();
  } catch {
    body = await res.text().catch(() => null);
  }
  report.recordReferral = { status: res.status(), body, at: new Date().toISOString() };
});

await page.goto(report.url, { waitUntil: 'domcontentloaded', timeout: 90000 });
await page.waitForFunction(
  () => document.documentElement.getAttribute('data-vr-ready') === '1',
  { timeout: 30000 },
);

await page.waitForTimeout(15000);

report.turnstile.iframe = (await page.locator('#referral-turnstile-container iframe').count()) > 0;
report.turnstile.rendered = (await page.locator('#referral-turnstile-container > div').count()) > 0;

const admin = createClient('https://wqbefjzpgsezzwdrvvua.supabase.co', serviceKey(), {
  auth: { persistSession: false },
});
const { count } = await admin
  .from('referrals')
  .select('*', { count: 'exact', head: true })
  .eq('referrer_code', REF);

report.dbCountForReferrer = count ?? 0;

if (report.recordReferral?.status === 200 && report.recordReferral?.body?.success) {
  report.verdict = 'PASS — edge accepted referral';
} else if (report.recordReferral?.status === 403) {
  const err = report.recordReferral?.body?.error || '';
  const details = report.recordReferral?.body?.details || '';
  if (details.includes('invalid-input-secret')) {
    report.verdict = 'FAIL — Turnstile SECRET KEY wrong on Supabase (sitekey/secret mismatch)';
  } else if (err.includes('Bot verification')) {
    report.verdict = 'FAIL — Turnstile token rejected by edge (bad token, secret mismatch, or domain)';
  } else if (err.includes('Self-referral')) {
    report.verdict = 'SKIP — self-referral (test in incognito without your code)';
  } else {
    report.verdict = `FAIL — 403 ${err} ${details}`;
  }
} else if (!report.recordReferral) {
  report.verdict = 'FAIL — no record-referral call (Turnstile never produced token)';
} else {
  report.verdict = `FAIL — status ${report.recordReferral?.status}`;
}

await browser.close();
console.log(JSON.stringify(report, null, 2));
process.exit(report.verdict?.startsWith('PASS') ? 0 : 1);