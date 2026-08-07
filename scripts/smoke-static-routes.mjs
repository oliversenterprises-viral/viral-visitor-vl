#!/usr/bin/env node
/**
 * Guard: required static pages exist in public/ and optionally respond 200 on prod.
 *
 *   node scripts/smoke-static-routes.mjs           # filesystem only
 *   node scripts/smoke-static-routes.mjs --live    # also HTTP probe www
 *
 * Exit 1 if any route is missing from the repo or returns non-2xx live.
 * Prevents silent loss of partner splash pages (e.g. /embed/herculist/).
 */

import { existsSync, readFileSync, statSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PROD_ORIGIN, REQUIRED_STATIC_ROUTES } from './required-static-routes.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC = join(ROOT, 'public');
const LIVE = process.argv.includes('--live');
const ORIGIN = process.env.SMOKE_ORIGIN || PROD_ORIGIN;

function ok(msg) {
  console.log(`  ✓ ${msg}`);
}
function fail(msg) {
  console.error(`  ✗ ${msg}`);
}

let failures = 0;

console.log('=== Static route smoke (must never 404) ===');
console.log(`public dir: ${PUBLIC}`);
console.log(`routes: ${REQUIRED_STATIC_ROUTES.length}${LIVE ? ` · live probe ${ORIGIN}` : ' · filesystem only'}\n`);

for (const route of REQUIRED_STATIC_ROUTES) {
  const abs = join(PUBLIC, route.file);
  if (!existsSync(abs)) {
    fail(`MISSING FILE  ${route.url}  →  public/${route.file}`);
    failures += 1;
    continue;
  }
  const st = statSync(abs);
  if (!st.isFile() || st.size < 32) {
    fail(`EMPTY/INVALID  ${route.url}  →  public/${route.file} (${st.size} bytes)`);
    failures += 1;
    continue;
  }
  // UTF-8 sanity: no classic mojibake markers in HTML/text
  if (/\.(html?|txt|xml|json|svg)$/i.test(route.file)) {
    const text = readFileSync(abs, 'utf8');
    if (text.includes('\uFFFD') || text.includes('┬╖') || /Ã.|Â·/.test(text)) {
      fail(`GARBLED UTF-8  ${route.url}  →  public/${route.file}`);
      failures += 1;
      continue;
    }
  }
  ok(`file  ${route.url}  (${st.size} B)`);
}

if (LIVE) {
  console.log('\n--- Live HTTP ---');
  for (const route of REQUIRED_STATIC_ROUTES) {
    const url = `${ORIGIN.replace(/\/$/, '')}${route.url}`;
    try {
      const res = await fetch(url, { redirect: 'follow' });
      if (res.status < 200 || res.status >= 300) {
        fail(`HTTP ${res.status}  ${route.url}`);
        failures += 1;
        continue;
      }
      const ct = res.headers.get('content-type') || '';
      // Detect SPA shell accidentally serving missing static routes as homepage
      if (ct.includes('html') && /\/(go|embed)\//.test(route.url)) {
        const body = await res.text();
        const isSplash =
          /EMBED_MODE|data-slug=|Splash pages|data-mode=|viralrefer\.app\/go\//i.test(body) ||
          route.url === '/go/' ||
          route.url.startsWith('/embed/ads');
        const isMainApp =
          /getMyReferralLinkInstant|data-vr-ready|assets\/index-[A-Za-z0-9_-]+\.js/i.test(body) &&
          body.length > 50_000;
        if (isMainApp && !isSplash) {
          fail(`SPA FALLBACK (not real page)  ${route.url}`);
          failures += 1;
          continue;
        }
      }
      ok(`live  ${res.status}  ${route.url}`);
    } catch (err) {
      fail(`FETCH ERR  ${route.url}  ${err?.message || err}`);
      failures += 1;
    }
  }
}

console.log('');
if (failures > 0) {
  console.error(`FAILED: ${failures} static route problem(s). Fix before deploy.`);
  process.exit(1);
}
console.log('All required static routes OK.');
process.exit(0);
