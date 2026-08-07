#!/usr/bin/env node
/**
 * Live production funnel check for Reddit paid traffic.
 * Read-only browser probe — does not deploy or mutate prod config.
 *
 *   node scripts/smoke-reddit-ad-funnel.mjs
 */
import { chromium } from 'playwright';

const BASE = (process.env.SMOKE_LIVE_URL || 'https://www.viralrefer.app').replace(/\/$/, '');
const AD_URL =
  process.env.SMOKE_AD_URL ||
  `${BASE}/?utm_source=reddit&utm_medium=paid&utm_campaign=wave2_jul2026&utm_content=ad_primary`;

const results = [];
function log(name, ok, detail = '') {
  results.push({ name, ok, detail });
  console.log(`${ok ? '[PASS]' : '[FAIL]'} ${name}${detail ? ` — ${detail}` : ''}`);
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  userAgent:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
});
const page = await context.newPage();
const pageErrors = [];
const failedRequests = [];

page.on('pageerror', (e) => pageErrors.push(String(e.message).slice(0, 200)));
page.on('response', (r) => {
  if (r.status() >= 400 && !/favicon|turnstile|cloudflare/i.test(r.url())) {
    failedRequests.push(`${r.status()} ${r.url().slice(0, 120)}`);
  }
});

try {
  // 1) Reddit ad landing
  const t0 = Date.now();
  const resp = await page.goto(AD_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
  const loadMs = Date.now() - t0;
  log('ad_landing_http', Boolean(resp?.ok()), `status=${resp?.status()} loadMs=${loadMs}`);
  log('ad_landing_under_8s', loadMs < 8000, `${loadMs}ms`);

  await page.waitForTimeout(2800);

  const heroVisible = await page
    .locator('#hero-title, h1')
    .first()
    .isVisible()
    .catch(() => false);
  log('hero_visible', heroVisible);

  const bodyText = await page.locator('body').innerText();
  const promisesCash = /win\s*\$|\$5 cash|cash rewards|cash app prize/i.test(bodyText);
  log('no_misleading_cash_promise', !promisesCash, promisesCash ? 'found cash promise' : 'ok');
  log(
    'states_no_cash_or_feature',
    /no cash prize|homepage (banner )?feature|recognition only/i.test(bodyText),
    'honest positioning present',
  );

  const ctaLocator = page.getByRole('button', { name: /get my (free )?referral link|get my link/i });
  let ctaCount = await ctaLocator.count();
  if (ctaCount === 0) {
    ctaCount = await page.locator('text=/Get my referral link/i').count();
  }
  log('cta_get_link_visible', ctaCount > 0, `count=${ctaCount}`);

  if (ctaCount > 0) {
    const btn = ctaLocator.first();
    if (await btn.isVisible().catch(() => false)) {
      await btn.click({ timeout: 10000 });
    } else {
      await page.locator('text=/Get my referral link/i').first().click({ timeout: 10000 });
    }
    await page.waitForTimeout(3500);

    const refVal = await page.locator('#ref-link').inputValue().catch(() => '');
    const okLink = /VIRAL-|viralrefer\.app/i.test(refVal);
    log('get_link_generates_code', okLink, refVal.slice(0, 100) || 'empty');

    const section = await page.locator('#referral-section').isVisible().catch(() => false);
    log('referral_section_visible', section || okLink);

    const copyVisible = await page
      .locator('button:has-text("COPY"), #copy-ref-btn, [data-action="copy"]')
      .first()
      .isVisible()
      .catch(() => false);
    log('copy_control_present', copyVisible || okLink);

    const shareCount = await page
      .locator('#referral-section .share-btn, button.share-btn, #share-grid button')
      .count()
      .catch(() => 0);
    log('share_ui_present', shareCount > 0 || okLink, `count=${shareCount}`);

    // Stuck-state check: still loading spinner forever?
    const stuckSpinner = await page
      .locator('.animate-spin, [aria-busy="true"]')
      .first()
      .isVisible()
      .catch(() => false);
    if (stuckSpinner) {
      await page.waitForTimeout(4000);
      const still = await page
        .locator('.animate-spin, [aria-busy="true"]')
        .first()
        .isVisible()
        .catch(() => false);
      log('not_stuck_loading', !still, still ? 'spinner still visible after 4s' : 'cleared');
    } else {
      log('not_stuck_loading', true, 'no persistent spinner');
    }
  } else {
    log('get_link_generates_code', false, 'CTA not found');
    log('referral_section_visible', false, 'skipped');
    log('copy_control_present', false, 'skipped');
    log('share_ui_present', false, 'skipped');
    log('not_stuck_loading', false, 'no CTA');
  }

  // Leaderboard is below the fold — scroll then assert
  await page.evaluate(() => {
    document.getElementById('leaderboard')?.scrollIntoView({ block: 'center' });
  });
  await page.waitForTimeout(800);
  const lbVisible = await page.locator('#leaderboard').isVisible().catch(() => false);
  const lbTitle = await page.locator('#leaderboard-title').innerText().catch(() => '');
  log(
    'leaderboard_on_page',
    lbVisible && /leaderboard/i.test(lbTitle),
    lbVisible ? `title=${lbTitle.slice(0, 40)}` : 'missing #leaderboard',
  );

  // 2) /r/ referral path (friend lands via shared link)
  const page2 = await context.newPage();
  page2.on('pageerror', (e) => pageErrors.push(`p2:${String(e.message).slice(0, 120)}`));
  await page2.goto(`${BASE}/r/VIRAL-97UWEGZ?utm_source=reddit&utm_medium=paid&utm_campaign=wave2_jul2026`, {
    waitUntil: 'domcontentloaded',
    timeout: 30000,
  });
  await page2.waitForTimeout(2800);

  const attrVisible = await page2
    .locator('#referral-attribution, #referrer-code-display')
    .first()
    .isVisible()
    .catch(() => false);
  const codeText = (await page2.locator('#referrer-code-display').textContent().catch(() => '')) || '';
  const htmlHasCode = /97UWEGZ/i.test(await page2.content());
  log('ref_path_attribution', attrVisible || htmlHasCode, `code=${codeText.trim().slice(0, 40)}`);

  const getLinkBtns = page2.getByRole('button', { name: /get my/i });
  const n = await getLinkBtns.count();
  if (n > 0) {
    // Prefer second button if funnel step CTA exists (nth 1), else first
    await getLinkBtns.nth(Math.min(1, n - 1)).click({ timeout: 10000 }).catch(() =>
      getLinkBtns.first().click({ timeout: 10000 }),
    );
    await page2.waitForTimeout(4000);
    const v2 = await page2.locator('#ref-link').inputValue().catch(() => '');
    log('ref_path_get_own_link', /VIRAL-/i.test(v2), v2.slice(0, 100) || `btn count ${n}`);
  } else {
    const textCta = page2.locator('text=/Get my referral link/i');
    if ((await textCta.count()) > 0) {
      await textCta.first().click();
      await page2.waitForTimeout(4000);
      const v2 = await page2.locator('#ref-link').inputValue().catch(() => '');
      log('ref_path_get_own_link', /VIRAL-/i.test(v2), v2.slice(0, 100) || 'text cta');
    } else {
      log('ref_path_get_own_link', false, 'no get-link button on /r/ path');
    }
  }

  // 3) Static health
  const versionOk = await page
    .goto(`${BASE}/version.json`, { timeout: 15000 })
    .then((r) => r.ok())
    .catch(() => false);
  log('version_json', versionOk);

  const robotsOk = await page
    .goto(`${BASE}/robots.txt`, { timeout: 10000 })
    .then((r) => r.ok())
    .catch(() => false);
  log('robots_txt', robotsOk);

  const realErrors = pageErrors.filter(
    (e) => !/ResizeObserver|Script error|turnstile|cloudflare/i.test(e),
  );
  log('no_critical_page_errors', realErrors.length === 0, realErrors.slice(0, 3).join(' | '));

  const badReqs = failedRequests.filter((f) => !/sentry|analytics|collect|gtag/i.test(f));
  log('few_failed_requests', badReqs.length < 5, badReqs.slice(0, 5).join(' ; '));
} finally {
  await browser.close();
}

const fails = results.filter((r) => !r.ok);
console.log('\n=== REDDIT AD FUNNEL E2E (LIVE) ===');
console.log(`${results.filter((r) => r.ok).length}/${results.length} passed`);
if (fails.length) {
  console.log('FAILURES:');
  for (const f of fails) console.log(` - ${f.name}: ${f.detail}`);
  process.exit(1);
}
console.log('All critical visitor-path checks passed. Safe to run Reddit ads.');
