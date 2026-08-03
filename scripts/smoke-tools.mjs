#!/usr/bin/env node
/** Smoke free tools hub + pages. node scripts/smoke-tools.mjs [baseUrl] */
const BASE = (process.argv[2] || 'https://www.viralrefer.app').replace(/\/$/, '');
const PATHS = [
  '/tools/',
  '/tools/index.html',
  '/tools/share-generator.html',
  '/tools/viral-calculator.html',
  '/tools/7-day-launch.html',
  '/tools/utm-builder.html',
  '/tools/traffic-refer-kit.html',
  '/tools/hook-bank.html',
];

let fail = 0;
for (const p of PATHS) {
  const url = BASE + p;
  try {
    const res = await fetch(url, { redirect: 'follow' });
    const text = await res.text();
    const okStatus = res.ok;
    const isHtml = /text\/html/i.test(res.headers.get('content-type') || '') || text.includes('<!DOCTYPE html');
    // Must not be SPA shell only (main app) for tool pages
    const looksLikeTool =
      text.includes('leadmagnet') ||
      text.includes('Free Growth Tools') ||
      text.includes('ViralRefer') && text.includes('tool');
    const notSpaHijack =
      p === '/tools/' || p.endsWith('.html')
        ? !text.includes('id="leaderboard-container"') || text.includes('tools')
        : true;
    const ok = okStatus && isHtml && looksLikeTool;
    console.log(`[${ok ? 'PASS' : 'FAIL'}] ${p} status=${res.status} toolish=${looksLikeTool}`);
    if (!ok) fail++;
  } catch (e) {
    console.log(`[FAIL] ${p} ${e.message}`);
    fail++;
  }
}

// homepage still ok
try {
  const res = await fetch(BASE + '/');
  const t = await res.text();
  const ok = res.ok && t.includes('Get my') || t.includes('referral') || t.includes('leaderboard');
  console.log(`[${ok ? 'PASS' : 'FAIL'}] / homepage`);
  if (!ok) fail++;
} catch (e) {
  console.log(`[FAIL] / ${e.message}`);
  fail++;
}

console.log(fail ? `\nFAILED ${fail}` : '\nAll tools smoke checks passed');
process.exit(fail ? 1 : 0);
