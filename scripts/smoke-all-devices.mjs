#!/usr/bin/env node
/**
 * Multi-device layout + tap-target smoke (local preview or live URL).
 *   node scripts/smoke-all-devices.mjs [url]
 */
import { chromium } from 'playwright';

const BASE = (process.argv[2] || process.env.SMOKE_LIVE_URL || 'http://127.0.0.1:5173').replace(
  /\/$/,
  '',
);

const VIEWPORTS = [
  { name: 'iphone-se', width: 375, height: 667 },
  { name: 'iphone-14', width: 390, height: 844 },
  { name: 'iphone-14-pro-max', width: 430, height: 932 },
  { name: 'pixel-7', width: 412, height: 915 },
  { name: 'galaxy-fold-cover', width: 320, height: 720 },
  { name: 'se-landscape', width: 667, height: 375 },
  { name: 'ipad', width: 768, height: 1024 },
  { name: 'ipad-landscape', width: 1024, height: 768 },
  { name: 'desktop', width: 1280, height: 800 },
  { name: 'desktop-wide', width: 1536, height: 864 },
];

const PAGES = [
  { path: '/', id: 'home' },
  { path: '/tools/', id: 'tools' },
  { path: '/tools/share-generator.html', id: 'share-gen' },
  { path: '/privacy/', id: 'privacy' },
  { path: '/terms/', id: 'terms' },
  { path: '/rules/', id: 'rules' },
];

const TAP_MIN = 44;
const TAP_SELECTORS = [
  '#hero-get-link-btn',
  '#nav-get-link-btn',
  '#hero-ad-visit',
  '#hero-slot-preview',
  '.cta',
  '#post-link-primary',
  '#post-link-copy',
];

const results = [];
let fails = 0;

function record(name, ok, detail = '') {
  results.push({ name, ok, detail });
  if (!ok) fails += 1;
  console.log(`[${ok ? 'PASS' : 'FAIL'}] ${name}${detail ? ` — ${detail}` : ''}`);
}

function overflowDetail(info) {
  return `scroll=${info.scrollW}x${info.scrollH} view=${info.innerW}x${info.innerH} overflowX=${info.overflowX} overflowY=${info.overflowY}`;
}

const browser = await chromium.launch({ headless: true });

try {
  for (const vp of VIEWPORTS) {
    const page = await browser.newPage({
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: 1,
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 playwright',
    });

    for (const route of PAGES) {
      const label = `${vp.name}:${route.id}`;
      try {
        const res = await page.goto(BASE + route.path, {
          waitUntil: 'domcontentloaded',
          timeout: 45000,
        });
        record(`${label}: HTTP`, !!res && res.ok(), `status=${res?.status()}`);
        await page.waitForTimeout(route.id === 'home' ? 1800 : 400);

        const info = await page.evaluate((tapSelectors) => {
          const doc = document.documentElement;
          const body = document.body;
          const innerW = window.innerWidth;
          const innerH = window.innerHeight;
          const scrollW = Math.max(doc.scrollWidth, body?.scrollWidth || 0);
          const scrollH = Math.max(doc.scrollHeight, body?.scrollHeight || 0);
          const overflowX = scrollW > innerW + 2;

          const vis = (el) => {
            if (!el) return null;
            const r = el.getBoundingClientRect();
            const style = window.getComputedStyle(el);
            const hidden =
              style.display === 'none' ||
              style.visibility === 'hidden' ||
              el.hasAttribute('hidden') ||
              el.classList.contains('hidden');
            return {
              present: true,
              hidden,
              x: Math.round(r.x),
              y: Math.round(r.y),
              w: Math.round(r.width),
              h: Math.round(r.height),
              bottom: Math.round(r.bottom),
              right: Math.round(r.right),
              inView: r.top < innerH && r.bottom > 0 && r.left < innerW && r.right > 0,
              fullyInView:
                r.top >= -1 && r.left >= -1 && r.bottom <= innerH + 1 && r.right <= innerW + 1,
            };
          };

          const taps = {};
          for (const sel of tapSelectors) {
            const el = document.querySelector(sel);
            taps[sel] = vis(el);
          }

          const offenders = [];
          const nodes = document.querySelectorAll('a, button, [role="button"]');
          for (const el of nodes) {
            const style = window.getComputedStyle(el);
            if (style.display === 'none' || style.visibility === 'hidden') continue;
            const r = el.getBoundingClientRect();
            if (r.width < 8 || r.height < 8) continue;
            const text = (el.textContent || '').trim().slice(0, 40);
            if (r.height < 40 && r.width < 40) {
              offenders.push({
                tag: el.id || el.className?.toString?.().slice(0, 40) || el.tagName,
                text,
                w: Math.round(r.width),
                h: Math.round(r.height),
              });
            }
          }

          return {
            innerW,
            innerH,
            scrollW,
            scrollH,
            overflowX,
            overflowY: scrollH,
            ready: doc.getAttribute('data-vr-ready'),
            title: vis(document.getElementById('hero-title')),
            subtitle: vis(document.getElementById('hero-subtitle')),
            ad: vis(document.getElementById('hero-banner-mock')),
            preview: vis(document.getElementById('hero-slot-preview')),
            prize: vis(document.getElementById('hero-prize-one')),
            cta: vis(document.getElementById('hero-get-link-btn')),
            visit: vis(document.getElementById('hero-ad-visit')),
            taps,
            smallTaps: offenders.slice(0, 8),
            smallTapCount: offenders.length,
          };
        }, TAP_SELECTORS);

        if (route.id === 'tools') {
          const title = await page.title();
          record(
            `${label}: is-tools-hub`,
            /growth tools/i.test(title),
            `title=${title}`,
          );
        }
        if (route.id === 'privacy') {
          const title = await page.title();
          record(`${label}: is-privacy`, /privacy/i.test(title), `title=${title}`);
        }

        record(
          `${label}: no-horizontal-scroll`,
          !info.overflowX,
          overflowDetail(info),
        );

        if (route.id === 'home') {
          const cta = info.cta;
          const ad = info.ad;
          const preview = info.preview;
          record(
            `${label}: ad-visible`,
            !!(ad && !ad.hidden && ad.h > 40),
            ad ? `h=${ad.h} y=${ad.y}` : 'missing',
          );
          record(
            `${label}: tools-preview`,
            !!(preview && !preview.hidden && preview.h > 40),
            preview ? `h=${preview.h}` : 'missing',
          );
          record(
            `${label}: cta-in-first-screen`,
            !!(cta && !cta.hidden && cta.fullyInView),
            cta ? `bottom=${cta.bottom} viewH=${info.innerH}` : 'missing',
          );
          if (cta && !cta.hidden) {
            record(
              `${label}: cta-tap`,
              cta.h >= TAP_MIN && cta.w >= 120,
              `w=${cta.w} h=${cta.h}`,
            );
          }
          if (info.visit && !info.visit.hidden) {
            record(
              `${label}: visit-tap`,
              info.visit.h >= 40 && info.visit.w >= 40,
              `w=${info.visit.w} h=${info.visit.h}`,
            );
          }
        }

        const criticalSmall = (info.smallTaps || []).filter(
          (t) =>
            /get.?link|visit|cta|share|copy|send/i.test(`${t.tag} ${t.text}`) &&
            t.h < 36,
        );
        record(
          `${label}: critical-taps`,
          criticalSmall.length === 0,
          criticalSmall.length
            ? JSON.stringify(criticalSmall.slice(0, 4))
            : `small=${info.smallTapCount}`,
        );
      } catch (err) {
        record(`${label}: load`, false, String(err).slice(0, 180));
      }
    }

    // After-get-link first screen (home only)
    try {
      await page.goto(BASE + '/', { waitUntil: 'domcontentloaded', timeout: 45000 });
      await page.waitForTimeout(800);
      await page.evaluate(() => {
        document.documentElement.setAttribute('data-vr-has-link', '1');
        document.documentElement.setAttribute('data-vr-post-link-one', '1');
        const share = document.getElementById('post-link-share');
        if (share) share.classList.remove('hidden');
      });
      const after = await page.evaluate(() => {
        const innerH = window.innerHeight;
        const innerW = window.innerWidth;
        const scrollW = Math.max(document.documentElement.scrollWidth, document.body.scrollWidth);
        const box = (id) => {
          const el = document.getElementById(id);
          if (!el) return null;
          const r = el.getBoundingClientRect();
          const style = window.getComputedStyle(el);
          return {
            display: style.display,
            hidden: style.display === 'none',
            y: Math.round(r.y),
            h: Math.round(r.height),
            bottom: Math.round(r.bottom),
            fullyInView: r.bottom <= innerH + 2 && r.top >= -2,
          };
        };
        return {
          overflowX: scrollW > innerW + 2,
          scrollW,
          innerW,
          ad: box('hero-banner-mock'),
          prize: box('hero-prize-one'),
          share: box('post-link-share'),
          primary: box('post-link-primary'),
          getLink: box('hero-get-link-btn'),
        };
      });
      record(
        `${vp.name}:post-link:no-h-scroll`,
        !after.overflowX,
        `scrollW=${after.scrollW} view=${after.innerW}`,
      );
      record(
        `${vp.name}:post-link:ad-stays`,
        !!(after.ad && !after.ad.hidden && after.ad.h > 40),
        after.ad ? `display=${after.ad.display} h=${after.ad.h}` : 'missing',
      );
      record(
        `${vp.name}:post-link:get-link-hidden`,
        !after.getLink || after.getLink.hidden,
        after.getLink ? `display=${after.getLink.display}` : 'absent',
      );
    } catch (err) {
      record(`${vp.name}:post-link`, false, String(err).slice(0, 180));
    }

    await page.close();
  }
} finally {
  await browser.close();
}

console.log(`\n${results.length} checks · ${fails} fail · ${results.length - fails} pass`);
process.exit(fails ? 1 : 0);
