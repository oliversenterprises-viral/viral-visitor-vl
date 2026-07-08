#!/usr/bin/env node
/** Extract GSC verification token — handles GSC aria-hidden inputs via force. */
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SITE = 'https://www.viralrefer.app';
const DOMAIN = 'viralrefer.app';
const STATE_DIR = path.join(ROOT, '.gsc-setup');
const PROFILE = path.join(STATE_DIR, 'chrome-profile');

mkdirSync(STATE_DIR, { recursive: true });

function parseTokens(html) {
  return {
    htmlToken:
      html.match(/google-site-verification["']?\s*content=["']([A-Za-z0-9_-]+)["']/i)?.[1] || null,
    dnsToken: html.match(/google-site-verification=([A-Za-z0-9_-]+)/i)?.[1] || null,
  };
}

const context = await chromium.launchPersistentContext(PROFILE, {
  headless: false,
  channel: 'chrome',
  viewport: { width: 1400, height: 900 },
});

const page = context.pages()[0] || (await context.newPage());
await page.goto('https://search.google.com/search-console/welcome', {
  waitUntil: 'domcontentloaded',
  timeout: 90000,
});

const finish = page.getByText('finish verification', { exact: false });
if (await finish.isVisible({ timeout: 3000 }).catch(() => false)) {
  await finish.click();
  await page.waitForTimeout(4000);
}

async function submitProperty(inputType, value, continueIndex) {
  const panel = page.locator(`[data-input-type="${inputType}"]`);
  await panel.first().click({ force: true });
  const input = panel.locator('input').first();
  await input.fill(value, { force: true });
  await page.waitForTimeout(500);
  const btn = page.getByRole('button', { name: /^CONTINUE$/i }).nth(continueIndex);
  await btn.click({ force: true });
  await page.waitForTimeout(5000);
}

let htmlToken = null;
let dnsToken = null;

// URL prefix = data-input-type 2 (domain = 1) per GSC markup
try {
  await submitProperty('2', SITE, 1);
  console.log('URL after prefix:', page.url());

  const htmlTag = page.getByText('HTML tag', { exact: false }).first();
  if (await htmlTag.isVisible({ timeout: 20000 }).catch(() => false)) {
    await htmlTag.click({ force: true });
    await page.waitForTimeout(2500);
  }

  ({ htmlToken, dnsToken } = parseTokens(await page.content()));
} catch (e) {
  console.log('Prefix error:', e.message);
}

if (!htmlToken && !dnsToken) {
  await page.goto('https://search.google.com/search-console/welcome', { waitUntil: 'domcontentloaded' });
  try {
    await submitProperty('1', DOMAIN, 0);
    console.log('URL after domain:', page.url());
    ({ htmlToken, dnsToken } = parseTokens(await page.content()));
  } catch (e) {
    console.log('Domain error:', e.message);
  }
}

await page.screenshot({ path: path.join(STATE_DIR, 'gsc-step2.png'), fullPage: true });
const result = { htmlToken, dnsToken, url: page.url() };
writeFileSync(path.join(STATE_DIR, 'gsc-result.json'), JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));

await context.close();
process.exit(htmlToken || dnsToken ? 0 : 1);