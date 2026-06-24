#!/usr/bin/env node
/** Quick live probe: Reddit pixel network + funnel events */
import { chromium } from 'playwright';

const url =
  process.argv[2] ||
  'https://www.viralrefer.app/?utm_source=reddit&utm_medium=paid&utm_campaign=launch_week1&ref=VIRAL-97UWEGZ';
const hits = [];

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

page.on('request', (req) => {
  const u = req.url();
  if (u.includes('alb.reddit.com')) hits.push(u);
});

await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForTimeout(3000);
const afterLanding = hits.length;

await page.locator('button:has-text("Get my referral link")').first().click();
await page.waitForTimeout(8000);

const state = await page.evaluate(() => ({
  rdtReady: typeof window.rdt === 'function' && typeof window.rdt.sendEvent === 'function',
  banner: !!document.getElementById('reddit-welcome-banner'),
  refLink: document.getElementById('ref-link')?.value || '',
}));

console.log(
  JSON.stringify(
    {
      afterLandingHits: afterLanding,
      totalHits: hits.length,
      additionalHitsAfterClick: hits.length - afterLanding,
      state,
      urls: [...new Set(hits.map((u) => u.split('?')[0]))],
    },
    null,
    2,
  ),
);

await browser.close();