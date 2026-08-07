#!/usr/bin/env node
/**
 * Render last-24h growth graphics for social posts.
 * Outputs square + landscape PNGs to marketing/growth-24h and Downloads.
 */
import { mkdirSync, writeFileSync, copyFileSync, existsSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const DIR = resolve(ROOT, 'marketing', 'growth-24h');
const DOWNLOADS = resolve(process.env.USERPROFILE || '', 'Downloads', 'viralrefer-promo');
const DESKTOP = resolve(process.env.USERPROFILE || '', 'Desktop', 'ViralRefer-Growth-24h');

const jobs = [
  { file: 'growth-24h-1080.html', out: 'viralrefer-growth-24h-1080x1080.png', w: 1080, h: 1080 },
  { file: 'growth-24h-1200x628.html', out: 'viralrefer-growth-24h-1200x628.png', w: 1200, h: 628 },
];

mkdirSync(DIR, { recursive: true });
mkdirSync(DOWNLOADS, { recursive: true });
mkdirSync(DESKTOP, { recursive: true });

const browser = await chromium.launch();
for (const job of jobs) {
  const page = await browser.newPage({
    viewport: { width: job.w, height: job.h },
    deviceScaleFactor: 2,
  });
  const htmlPath = resolve(DIR, job.file);
  await page.goto(`file:///${htmlPath.replace(/\\/g, '/')}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  const outPath = resolve(DIR, job.out);
  await page.screenshot({
    path: outPath,
    type: 'png',
    clip: { x: 0, y: 0, width: job.w, height: job.h },
  });
  copyFileSync(outPath, resolve(DOWNLOADS, job.out));
  copyFileSync(outPath, resolve(DESKTOP, job.out));
  console.log('Wrote', job.out);
  await page.close();
}
await browser.close();

// Caption file for easy paste
const caption = `Last 24 hours on viralrefer.app 🔗

📊 76 site landings
👥 72 unique visitors
🌍 Traffic from EG · PH · US · IN · BR and more
🔗 3 free referral links claimed
📋 4 copies · 6 shares logged
✅ +2 verified referrals (vs 0 the day before)
🏆 4 live referrers on the board

Free link in ~30 seconds. No signup. No cash prize — #1 claims a homepage feature.

Get yours → https://www.viralrefer.app/

#referral #growth #sideproject #indiehackers #viralrefer`;

writeFileSync(resolve(DIR, 'CAPTION.txt'), caption);
writeFileSync(resolve(DESKTOP, 'CAPTION.txt'), caption);
writeFileSync(resolve(DOWNLOADS, 'viralrefer-growth-24h-CAPTION.txt'), caption);

console.log('Desktop folder:', DESKTOP);
console.log('Downloads:', DOWNLOADS);
console.log('Done.');
