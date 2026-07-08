#!/usr/bin/env node
/**
 * Renders marketing/leadsleap/leadsleap-ad-300x250.html to PNG (300×250).
 * LeadsLeap credit ad image limit: 300×250, 125KB max.
 */
import { mkdirSync, writeFileSync, statSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const HTML = resolve(ROOT, 'marketing', 'leadsleap', 'leadsleap-ad-300x250.html');
const OUT_DIR = resolve(ROOT, 'marketing', 'leadsleap');
const OUT_FILE = resolve(OUT_DIR, 'viralrefer-leadsleap-ad-300x250.png');
const DOWNLOADS = resolve(process.env.USERPROFILE || '', 'Downloads', 'viralrefer-promo');
const OUT_DOWNLOADS = resolve(DOWNLOADS, 'viralrefer-leadsleap-ad-300x250.png');

const W = 300;
const H = 250;
const MAX_KB = 125;

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  mkdirSync(DOWNLOADS, { recursive: true });

  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: W, height: H },
    deviceScaleFactor: 1,
  });

  await page.goto(`file:///${HTML.replace(/\\/g, '/')}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(400);

  const png = await page.screenshot({
    type: 'png',
    fullPage: false,
    clip: { x: 0, y: 0, width: W, height: H },
  });

  await browser.close();

  writeFileSync(OUT_FILE, png);
  writeFileSync(OUT_DOWNLOADS, png);

  const kb = Math.round(statSync(OUT_FILE).size / 1024);
  console.log('Saved:', OUT_FILE);
  console.log('Saved:', OUT_DOWNLOADS);
  console.log(`Size: ${kb} KB (max ${MAX_KB} KB for LeadsLeap)`);
  if (kb > MAX_KB) {
    console.warn('WARNING: file exceeds LeadsLeap 125KB limit — re-export with compression.');
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});