#!/usr/bin/env node
/**
 * Multi-device smoke for Daily Crown UI (local preview or live URL).
 *   node scripts/smoke-daily-crown-responsive.mjs [url]
 */
import { chromium } from 'playwright';

const BASE = (process.argv[2] || process.env.SMOKE_LIVE_URL || 'http://127.0.0.1:4173').replace(
  /\/$/,
  '',
);

const VIEWPORTS = [
  { name: 'iphone-se', width: 375, height: 667 },
  { name: 'iphone-14', width: 390, height: 844 },
  { name: 'pixel-7', width: 412, height: 915 },
  { name: 'ipad', width: 768, height: 1024 },
  { name: 'desktop', width: 1280, height: 800 },
];

const results = [];

function record(name, ok, detail = '') {
  results.push({ name, ok, detail });
  console.log(`[${ok ? 'PASS' : 'FAIL'}] ${name}${detail ? ` — ${detail}` : ''}`);
}

const browser = await chromium.launch({ headless: true });

try {
  for (const vp of VIEWPORTS) {
    const page = await browser.newPage({
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: 1,
    });
    try {
      const res = await page.goto(BASE + '/', { waitUntil: 'networkidle', timeout: 60000 });
      record(`${vp.name}: HTTP`, !!res && res.ok(), `status=${res?.status()}`);

      // Wait for public app ready or crown section attempt
      await page.waitForTimeout(2500);

      const markers = await page.evaluate(() => {
        const ids = [
          'hero-daily-crown-line',
          'daily-champion-strip',
          'daily-crown-section',
          'daily-crown-race-container',
          'hall-of-crowns-container',
          'daily-crown-countdown',
          'leaderboard-container',
        ];
        const out = {};
        for (const id of ids) {
          const el = document.getElementById(id);
          if (!el) {
            out[id] = { present: false };
            continue;
          }
          const r = el.getBoundingClientRect();
          const style = window.getComputedStyle(el);
          out[id] = {
            present: true,
            hidden: el.classList.contains('hidden'),
            display: style.display,
            w: Math.round(r.width),
            h: Math.round(r.height),
            overflowX: document.documentElement.scrollWidth > window.innerWidth + 2,
          };
        }
        return {
          ready: document.documentElement.getAttribute('data-vr-ready'),
          markers: out,
          scrollW: document.documentElement.scrollWidth,
          innerW: window.innerWidth,
        };
      });

      record(
        `${vp.name}: crown DOM present`,
        markers.markers['daily-crown-section']?.present &&
          markers.markers['daily-champion-strip']?.present &&
          markers.markers['hero-daily-crown-line']?.present,
        JSON.stringify({
          section: markers.markers['daily-crown-section']?.present,
          strip: markers.markers['daily-champion-strip']?.present,
          race: markers.markers['daily-crown-race-container']?.present,
        }),
      );

      // If RPC painted, section should unhide; either state is OK as long as no horizontal blowout
      const overflow = markers.scrollW > markers.innerW + 4;
      record(`${vp.name}: no horizontal overflow`, !overflow, `scrollW=${markers.scrollW} innerW=${markers.innerW}`);

      // Visible crown section when unhidden should not exceed viewport width
      const section = markers.markers['daily-crown-section'];
      if (section?.present && !section.hidden && section.display !== 'none') {
        record(
          `${vp.name}: crown section width fits`,
          section.w <= markers.innerW + 2,
          `w=${section.w}`,
        );
      } else {
        record(
          `${vp.name}: crown section state ok`,
          true,
          section?.hidden ? 'hidden (awaiting RPC paint or empty)' : `display=${section?.display}`,
        );
      }

      // Leaderboard still present
      record(
        `${vp.name}: leaderboard present`,
        !!markers.markers['leaderboard-container']?.present,
      );
    } catch (err) {
      record(`${vp.name}: page load`, false, String(err?.message || err));
    } finally {
      await page.close();
    }
  }
} finally {
  await browser.close();
}

const failed = results.filter((r) => !r.ok).length;
console.log(`\nDaily Crown responsive: ${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
