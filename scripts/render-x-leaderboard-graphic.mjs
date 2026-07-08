#!/usr/bin/env node
/**
 * Renders marketing/x-launch/leaderboard-graphic.html to PNG (1600×900).
 * Output: marketing/x-launch/viralrefer-x-leaderboard-VIRAL-97UWEGZ.png
 */
import { mkdirSync, writeFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const HTML = resolve(ROOT, 'marketing', 'x-launch', 'leaderboard-graphic.html');
const OUT_DIR = resolve(ROOT, 'marketing', 'x-launch');
const OUT_FILE = resolve(OUT_DIR, 'viralrefer-x-leaderboard-VIRAL-97UWEGZ.png');
const DOWNLOADS = resolve(process.env.USERPROFILE || '', 'Downloads', 'viralrefer-promo');
const OUT_DOWNLOADS = resolve(DOWNLOADS, 'viralrefer-x-leaderboard-VIRAL-97UWEGZ.png');

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  mkdirSync(DOWNLOADS, { recursive: true });

  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: 1600, height: 900 },
    deviceScaleFactor: 2,
  });

  await page.goto(`file:///${HTML.replace(/\\/g, '/')}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);

  const png = await page.screenshot({
    type: 'png',
    fullPage: false,
    clip: { x: 0, y: 0, width: 1600, height: 900 },
  });

  await browser.close();

  writeFileSync(OUT_FILE, png);
  writeFileSync(OUT_DOWNLOADS, png);

  console.log('Saved:', OUT_FILE);
  console.log('Saved:', OUT_DOWNLOADS);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});