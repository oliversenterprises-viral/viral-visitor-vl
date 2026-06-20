import { chromium } from 'playwright';

const base = 'https://www.viralrefer.app';
const utm =
  '/?utm_source=reddit&utm_medium=paid&utm_campaign=launch_week1&ref=VIRAL-97UWEGZ';

const results = [];
const fail = (name, detail) => results.push({ name, status: 'FAIL', detail });
const pass = (name, detail = '') => results.push({ name, status: 'PASS', detail });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

const consoleErrors = [];
const failedReqs = [];
page.on('console', (msg) => {
  if (msg.type() === 'error') consoleErrors.push(msg.text());
});
page.on('requestfailed', (req) => {
  const u = req.url();
  if (!u.includes('favicon')) failedReqs.push({ url: u, err: req.failure()?.errorText });
});

try {
  const resp = await page.goto(base + utm, { waitUntil: 'networkidle', timeout: 60000 });
  if (!resp || resp.status() >= 400) fail('Homepage load', `HTTP ${resp?.status()}`);
  else pass('Homepage load', `HTTP ${resp.status()}`);

  const title = await page.title();
  if (title) pass('Page title', title);
  else fail('Page title', 'empty');

  const checks = await page.evaluate(() => ({
    pixelId: document.documentElement.innerHTML.includes('a2_jr6jdbg2r4'),
    rdt: typeof window.rdt === 'function',
    pixelScript: !!document.querySelector('script[src*="redditstatic.com/ads/pixel.js"]'),
    welcomeBanner: !!document.getElementById('reddit-welcome-banner'),
    getLinkBtn: !!document.querySelector('#get-referral-link, [data-action="get-link"], button'),
    leaderboard: document.body.innerText.toLowerCase().includes('leaderboard'),
    noPlaceholder: !document.documentElement.innerHTML.includes('%VITE_'),
  }));

  checks.pixelId ? pass('Reddit pixel ID in HTML') : fail('Reddit pixel ID in HTML');
  checks.rdt ? pass('window.rdt initialized') : fail('window.rdt initialized');
  checks.pixelScript ? pass('pixel.js script tag') : fail('pixel.js script tag');
  checks.welcomeBanner ? pass('Reddit welcome banner (UTM)') : fail('Reddit welcome banner (UTM)');
  checks.leaderboard ? pass('Leaderboard content visible') : fail('Leaderboard content visible');
  checks.noPlaceholder ? pass('No unreplaced VITE placeholders') : fail('No unreplaced VITE placeholders');

  const redditHit = await page.evaluate(() =>
    performance.getEntriesByType('resource').some((e) => e.name.includes('alb.reddit.com')),
  );
  redditHit ? pass('Reddit tracking request sent') : fail('Reddit tracking request sent');

  // Apex redirect
  const apex = await page.goto('https://viralrefer.app/', { waitUntil: 'domcontentloaded', timeout: 30000 });
  const finalUrl = page.url();
  finalUrl.includes('www.viralrefer.app')
    ? pass('Apex redirect to www', finalUrl)
    : fail('Apex redirect to www', finalUrl);
} catch (e) {
  fail('Browser audit', e.message);
}

if (consoleErrors.length === 0) pass('No console errors');
else fail('Console errors', consoleErrors.slice(0, 5).join(' | '));

const criticalFails = failedReqs.filter(
  (r) =>
    !r.url.includes('turnstile') &&
    !r.url.includes('analytics') &&
    (r.url.includes('viralrefer') || r.url.includes('supabase') || r.url.includes('reddit')),
);
if (criticalFails.length === 0) pass('No critical failed network requests');
else fail('Failed requests', criticalFails.map((r) => r.url).join(', '));

await browser.close();

const passed = results.filter((r) => r.status === 'PASS').length;
const failed = results.filter((r) => r.status === 'FAIL').length;
console.log('\n=== VIRALREFER.APP AUDIT ===\n');
results.forEach((r) => console.log(`${r.status.padEnd(5)} ${r.name}${r.detail ? ' — ' + r.detail : ''}`));
console.log(`\nTotal: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);