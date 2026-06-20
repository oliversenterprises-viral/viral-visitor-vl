import { chromium } from 'playwright';

const url =
  'https://www.viralrefer.app/?utm_source=reddit&utm_medium=paid&utm_campaign=launch_week1&utm_content=banner_promo_v2';

const redditHits = [];
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

page.on('request', (req) => {
  const u = req.url();
  if (u.includes('alb.reddit.com')) redditHits.push(u);
});

await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
await page.click('button:has-text("Get my referral link")').catch(() =>
  page.click('button:has-text("referral link")'),
);
await page.waitForTimeout(3000);

const events = redditHits
  .filter((u) => u.includes('event='))
  .map((u) => {
    const m = u.match(/event=([^&]+)/);
    return m ? decodeURIComponent(m[1]) : null;
  })
  .filter(Boolean);

console.log('Reddit pixel events seen:', [...new Set(events)]);
const ok = events.some((e) => e === 'PageVisit' || e === 'Lead' || e === 'Custom');
await browser.close();
process.exit(ok ? 0 : 1);