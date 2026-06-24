import { chromium } from 'playwright';

const base = 'https://www.viralrefer.app';
const utm =
  '/?utm_source=reddit&utm_medium=paid&utm_campaign=launch_week1&ref=VIRAL-97UWEGZ';

const REDDIT_TRACKING_TIMEOUT_MS = 15000;
const REDDIT_TRACKING_POLL_MS = 250;

const results = [];
const fail = (name, detail) => results.push({ name, status: 'FAIL', detail });
const pass = (name, detail = '') => results.push({ name, status: 'PASS', detail });

const isAbortError = (err = '') =>
  /ERR_ABORTED|NS_BINDING_ABORTED|aborted|canceled|cancelled/i.test(err);

const isOptionalWithFallback = (url = '') =>
  /\/rest\/v1\/site_content|site_content/i.test(url);

const isTrackedNetworkUrl = (url = '') =>
  url.includes('viralrefer') || url.includes('supabase') || url.includes('reddit');

async function waitForRedditTracking(page, seenViaListener, timeoutMs = REDDIT_TRACKING_TIMEOUT_MS) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (seenViaListener()) return true;
    const hit = await page.evaluate(() =>
      performance.getEntriesByType('resource').some((e) => e.name.includes('alb.reddit.com')),
    );
    if (hit) return true;
    await page.waitForTimeout(REDDIT_TRACKING_POLL_MS);
  }
  return seenViaListener();
}

function classifyNetworkFailure(entry) {
  if (entry.kind === 'abort') {
    return { critical: false, reason: 'aborted (navigation/cancel)' };
  }
  if (entry.kind === 'failed' && isAbortError(entry.err)) {
    return { critical: false, reason: 'aborted' };
  }
  if (isOptionalWithFallback(entry.url)) {
    return { critical: false, reason: 'optional site_content (static fallback exists)' };
  }
  if (entry.kind === 'http' && entry.status >= 400 && entry.status < 500) {
    return { critical: true, reason: `HTTP ${entry.status}` };
  }
  if (entry.kind === 'http' && entry.status >= 500) {
    return { critical: true, reason: `HTTP ${entry.status}` };
  }
  if (entry.kind === 'failed') {
    return { critical: true, reason: entry.err || 'network error' };
  }
  return { critical: false, reason: 'ignored' };
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

const consoleErrors = [];
const networkEntries = new Map();
let redditTrackingSeen = false;

const trackNetwork = (url, patch) => {
  if (!isTrackedNetworkUrl(url) || url.includes('favicon')) return;
  const prev = networkEntries.get(url) || { url };
  networkEntries.set(url, { ...prev, ...patch });
};

const ignorableConsole = (text = '') =>
  /site_content|401|NaN|font-size:0|color:transparent/i.test(text) ||
  /Failed to send a request to the Edge Function/i.test(text);

page.on('console', (msg) => {
  if (msg.type() !== 'error') return;
  const text = msg.text();
  if (ignorableConsole(text)) return;
  consoleErrors.push(text);
});

page.on('request', (req) => {
  const url = req.url();
  if (url.includes('alb.reddit.com')) redditTrackingSeen = true;
  trackNetwork(url, { method: req.method() });
});

page.on('response', (resp) => {
  const url = resp.url();
  if (url.includes('alb.reddit.com')) redditTrackingSeen = true;
  if (!isTrackedNetworkUrl(url)) return;
  trackNetwork(url, { kind: 'http', status: resp.status(), err: resp.status() >= 400 ? `HTTP ${resp.status()}` : '' });
});

page.on('requestfailed', (req) => {
  const url = req.url();
  const err = req.failure()?.errorText || 'unknown';
  if (isAbortError(err)) {
    trackNetwork(url, { kind: 'abort', err });
    return;
  }
  trackNetwork(url, { kind: 'failed', err });
});

try {
  const resp = await page.goto(base + utm, { waitUntil: 'domcontentloaded', timeout: 45000 });
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

  const redditHit = await waitForRedditTracking(page, () => redditTrackingSeen);
  redditHit ? pass('Reddit tracking request sent') : fail('Reddit tracking request sent', `no alb.reddit.com hit within ${REDDIT_TRACKING_TIMEOUT_MS}ms`);

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

const ignoredNetwork = [];
const criticalFails = [];

for (const entry of networkEntries.values()) {
  if (entry.url.includes('turnstile') || entry.url.includes('analytics')) continue;

  const verdict = classifyNetworkFailure(entry);
  if (verdict.critical) {
    criticalFails.push({ url: entry.url, detail: verdict.reason });
  } else if (entry.kind === 'abort' || entry.kind === 'failed' || (entry.kind === 'http' && entry.status >= 400)) {
    ignoredNetwork.push(`${entry.url} (${verdict.reason})`);
  }
}

if (criticalFails.length === 0) {
  const detail = ignoredNetwork.length ? `ignored non-critical: ${ignoredNetwork.slice(0, 2).join('; ')}` : '';
  pass('No critical failed network requests', detail);
} else {
  fail(
    'Failed requests',
    criticalFails.map((r) => `${r.url} [${r.detail}]`).join(', '),
  );
}

await browser.close();

const passed = results.filter((r) => r.status === 'PASS').length;
const failed = results.filter((r) => r.status === 'FAIL').length;
console.log('\n=== VIRALREFER.APP AUDIT ===\n');
results.forEach((r) => console.log(`${r.status.padEnd(5)} ${r.name}${r.detail ? ' — ' + r.detail : ''}`));
console.log(`\nTotal: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);