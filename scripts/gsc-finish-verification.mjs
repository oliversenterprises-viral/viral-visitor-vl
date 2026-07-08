#!/usr/bin/env node
/** Complete DNS verification + submit sitemap in Search Console. */
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const STATE_DIR = path.join(ROOT, '.gsc-setup');
const PROFILE = path.join(STATE_DIR, 'chrome-profile');
const DOMAIN = 'viralrefer.app';
const RESOURCE = 'sc-domain:viralrefer.app';
const SITEMAP = 'sitemap.xml';

mkdirSync(STATE_DIR, { recursive: true });

const context = await chromium.launchPersistentContext(PROFILE, {
  headless: false,
  channel: 'chrome',
  viewport: { width: 1400, height: 900 },
});

const page = context.pages()[0] || (await context.newPage());

async function clickVerifyOwnership() {
  const verifyOwnership = page.getByRole('button', { name: /verify your ownership/i });
  if (await verifyOwnership.isVisible({ timeout: 8000 }).catch(() => false)) {
    await verifyOwnership.click({ force: true });
    await page.waitForTimeout(3000);
    return true;
  }
  const verify = page.getByRole('button', { name: /^verify$/i }).first();
  if (await verify.isVisible({ timeout: 8000 }).catch(() => false)) {
    await verify.click({ force: true });
    await page.waitForTimeout(8000);
    return true;
  }
  return false;
}

// Re-open domain DNS verification wizard
await page.goto('https://search.google.com/search-console/welcome', {
  waitUntil: 'domcontentloaded',
  timeout: 90000,
});

const panel = page.locator('[data-input-type="1"]');
if (await panel.first().isVisible({ timeout: 10000 }).catch(() => false)) {
  await panel.first().click({ force: true });
  await panel.locator('input').first().fill(DOMAIN, { force: true });
  await page.getByRole('button', { name: /^CONTINUE$/i }).first().click({ force: true });
  await page.waitForTimeout(4000);
}

await clickVerifyOwnership();
console.log('After verify click:', page.url());

// Property dashboard
await page.goto(
  `https://search.google.com/search-console?resource_id=${encodeURIComponent(RESOURCE)}`,
  { waitUntil: 'domcontentloaded', timeout: 90000 },
);
console.log('Property URL:', page.url());

if (page.url().includes('not-verified')) {
  await clickVerifyOwnership();
  await page.waitForTimeout(5000);
  await page.goto(
    `https://search.google.com/search-console?resource_id=${encodeURIComponent(RESOURCE)}`,
    { waitUntil: 'domcontentloaded' },
  );
  console.log('Property URL retry:', page.url());
}

// Sitemaps (only works when verified)
if (!page.url().includes('not-verified')) {
  await page.goto(
    `https://search.google.com/search-console/sitemaps?resource_id=${encodeURIComponent(RESOURCE)}`,
    { waitUntil: 'domcontentloaded', timeout: 90000 },
  );
  const sitemapInput = page.locator('input:visible').last();
  if (await sitemapInput.isVisible({ timeout: 15000 }).catch(() => false)) {
    await sitemapInput.fill(SITEMAP, { force: true });
    const submit = page.getByRole('button', { name: /submit/i }).first();
    if (await submit.isVisible({ timeout: 5000 }).catch(() => false)) {
      await submit.click({ force: true });
      console.log('Submitted sitemap:', SITEMAP);
    }
  }
}

await page.screenshot({ path: path.join(STATE_DIR, 'gsc-finish.png'), fullPage: true });
writeFileSync(path.join(STATE_DIR, 'gsc-finish-url.txt'), page.url());
await page.waitForTimeout(2000);
await context.close();