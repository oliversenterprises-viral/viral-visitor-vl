#!/usr/bin/env node
/**
 * Hands-free Google Search Console + Vercel verification setup.
 *
 *   node scripts/setup-google-search-console.mjs
 *   node scripts/setup-google-search-console.mjs --token=ABC123   # skip browser, env+deploy only
 *
 * Uses Playwright + system Chrome profile when no token provided.
 */

import { chromium } from 'playwright';
import { execSync } from 'child_process';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { homedir } from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SITE = 'https://www.viralrefer.app';
const SITEMAP = `${SITE}/sitemap.xml`;
const STATE_DIR = path.join(ROOT, '.gsc-setup');
const STATE_FILE = path.join(STATE_DIR, 'playwright-state.json');

const args = process.argv.slice(2);
const tokenArg = args.find((a) => a.startsWith('--token='))?.split('=')[1]?.trim();
const dryRun = args.includes('--dry-run');

function log(msg) {
  console.log(msg);
}

async function extractTokenFromBrowser() {
  mkdirSync(STATE_DIR, { recursive: true });
  const chromeUserData = path.join(homedir(), 'AppData', 'Local', 'Google', 'Chrome', 'User Data');
  const launchOpts = {
    headless: false,
    viewport: { width: 1280, height: 900 },
    args: ['--disable-blink-features=AutomationControlled'],
  };

  let context;
  if (existsSync(chromeUserData)) {
    log('Launching Chrome (automation profile — log into Google once if prompted)...');
    context = await chromium.launchPersistentContext(path.join(STATE_DIR, 'chrome-profile'), {
      ...launchOpts,
      channel: 'chrome',
    });
  } else {
    context = await chromium.launchPersistentContext(path.join(STATE_DIR, 'chrome-profile'), launchOpts);
  }

  if (existsSync(STATE_FILE)) {
    try {
      const cookies = JSON.parse(readFileSync(STATE_FILE, 'utf8'));
      if (Array.isArray(cookies)) await context.addCookies(cookies);
    } catch {
      /* ignore */
    }
  }

  const page = context.pages()[0] || (await context.newPage());
  await page.goto('https://search.google.com/search-console/welcome', { waitUntil: 'domcontentloaded', timeout: 60000 });

  // Already have properties list?
  if (page.url().includes('search-console') && !page.url().includes('welcome')) {
    log('Search Console session detected.');
  } else {
    log('Waiting up to 120s for Google sign-in (complete login in the browser window if shown)...');
    await page.waitForURL(/search\.google\.com\/search-console/, { timeout: 120000 }).catch(() => {});
  }

  await page.goto('https://search.google.com/search-console/welcome', { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {});

  // Property picker — add new if not on welcome
  const addBtn = page.getByRole('button', { name: /add property/i }).first();
  if (await addBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
    await addBtn.click();
    await page.waitForTimeout(1500);
  }

  // Welcome screen: URL prefix (right column) — placeholder https://www.example.com
  const urlPrefixInput = page.locator('input[placeholder*="example.com"]').last();
  if (await urlPrefixInput.isVisible({ timeout: 20000 }).catch(() => false)) {
    await urlPrefixInput.click();
    await urlPrefixInput.fill(SITE);
    const prefixContinue = page.locator('button:has-text("CONTINUE")').last();
    await prefixContinue.click();
    await page.waitForTimeout(2500);
  } else {
    // Already on verification or property exists
    const existing = page.locator(`text=${SITE}`).first();
    if (await existing.isVisible({ timeout: 5000 }).catch(() => false)) {
      await existing.click();
      await page.waitForTimeout(2000);
    }
  }

  // Ownership verification — HTML tag method
  const htmlTag = page.locator('text=HTML tag').first();
  if (await htmlTag.isVisible({ timeout: 25000 }).catch(() => false)) {
    await htmlTag.click();
    await page.waitForTimeout(1500);
  }

  await page.waitForTimeout(1500);
  const metaText = await page.locator('code, pre, .verification-code, [data-copy]').allTextContents();
  let token = '';
  for (const block of metaText) {
    const m = block.match(/content=["']([A-Za-z0-9_-]+)["']/);
    if (m) {
      token = m[1];
      break;
    }
  }
  if (!token) {
    const body = await page.content();
    const m = body.match(/google-site-verification["']?\s*content=["']([A-Za-z0-9_-]+)["']/i);
    if (m) token = m[1];
  }

  writeFileSync(STATE_FILE, JSON.stringify(await context.cookies(), null, 2));

  if (!token) {
    await page.screenshot({ path: path.join(STATE_DIR, 'gsc-debug.png'), fullPage: true });
    log(`Could not extract verification token — screenshot saved to ${path.join(STATE_DIR, 'gsc-debug.png')}`);
  }

  await context.close();
  return token;
}

function addVercelEnv(token) {
  log('Adding VITE_GOOGLE_SITE_VERIFICATION to Vercel (production + preview)...');
  const targets = ['production', 'preview'];
  const tmp = path.join(STATE_DIR, 'gsc-token.txt');
  mkdirSync(STATE_DIR, { recursive: true });
  writeFileSync(tmp, token, 'utf8');
  for (const target of targets) {
    try {
      execSync(`npx vercel env rm VITE_GOOGLE_SITE_VERIFICATION ${target} --yes`, {
        cwd: ROOT,
        stdio: 'pipe',
      });
    } catch {
      /* not present */
    }
    execSync(
      `cmd /c type "${tmp}" | npx vercel env add VITE_GOOGLE_SITE_VERIFICATION ${target} --yes`,
      { cwd: ROOT, stdio: 'inherit' },
    );
    log(`  ✓ ${target}`);
  }
}

function deployProd() {
  log('Deploying production (verification meta injected at build time)...');
  execSync('npm run deploy:prod', { cwd: ROOT, stdio: 'inherit' });
}

async function verifyMetaLive(token) {
  const res = await fetch(SITE);
  const html = await res.text();
  if (html.includes(`google-site-verification`) && html.includes(token)) {
    log('✓ Verification meta tag visible in live HTML');
    return true;
  }
  log('⚠ Verification meta not yet in HTML source — may need redeploy propagation');
  return false;
}

async function completeGscVerificationAndSitemap(token) {
  mkdirSync(STATE_DIR, { recursive: true });
  const context = await chromium.launchPersistentContext(path.join(STATE_DIR, 'chrome-profile'), {
    headless: false,
    channel: 'chrome',
    viewport: { width: 1280, height: 900 },
  });
  if (existsSync(STATE_FILE)) {
    try {
      const cookies = JSON.parse(readFileSync(STATE_FILE, 'utf8'));
      if (Array.isArray(cookies)) await context.addCookies(cookies);
    } catch {
      /* ignore */
    }
  }
  const page = context.pages()[0] || (await context.newPage());
  await page.goto(`https://search.google.com/search-console?resource_id=${encodeURIComponent(SITE)}`, {
    waitUntil: 'domcontentloaded',
    timeout: 60000,
  });

  // Settings → ownership verification → Verify
  await page.goto(`https://search.google.com/search-console/settings?resource_id=${encodeURIComponent(SITE)}`, {
    waitUntil: 'networkidle',
    timeout: 60000,
  }).catch(() => {});

  const verifyBtn = page.getByRole('button', { name: /^verify$/i }).first();
  if (await verifyBtn.isVisible({ timeout: 10000 }).catch(() => false)) {
    await verifyBtn.click();
    await page.waitForTimeout(5000);
    log('Clicked Verify in Search Console settings.');
  }

  // Sitemaps
  await page.goto(`https://search.google.com/search-console/sitemaps?resource_id=${encodeURIComponent(SITE)}`, {
    waitUntil: 'domcontentloaded',
    timeout: 60000,
  });
  const sitemapInput = page.locator('input[placeholder*="sitemap"], input[aria-label*="sitemap"]').first();
  if (await sitemapInput.isVisible({ timeout: 15000 }).catch(() => false)) {
    await sitemapInput.fill('sitemap.xml');
    const submit = page.getByRole('button', { name: /submit/i }).first();
    if (await submit.isVisible({ timeout: 5000 }).catch(() => false)) {
      await submit.click();
      log(`✓ Submitted sitemap: ${SITEMAP}`);
    }
  } else {
    log('Sitemap UI not found — property may need manual sitemap submit once verified.');
  }

  writeFileSync(STATE_FILE, JSON.stringify(await context.cookies(), null, 2));
  await page.waitForTimeout(3000);
  await context.close();
}

async function main() {
  log('=== Google Search Console hands-free setup ===\n');

  let token = tokenArg || process.env.VITE_GOOGLE_SITE_VERIFICATION || '';
  if (!token) {
    log('Step 1: Extract verification token from Search Console...');
    token = await extractTokenFromBrowser();
  }
  if (!token) {
    console.error('\nBlocked: need Google Search Console login to generate verification token.');
    console.error('A browser window should have opened — sign in, then re-run this script.');
    process.exit(2);
  }
  log(`Token acquired (${token.slice(0, 6)}…)`);

  if (dryRun) {
    log('Dry run — skipping Vercel env + deploy.');
    process.exit(0);
  }

  log('\nStep 2: Configure Vercel + deploy...');
  addVercelEnv(token);
  deployProd();

  log('\nStep 3: Confirm live HTML...');
  await verifyMetaLive(token);

  log('\nStep 4: Verify property + submit sitemap in Search Console...');
  await completeGscVerificationAndSitemap(token);

  log('\n=== Setup complete ===');
  log(`Property: ${SITE}`);
  log(`Sitemap: ${SITEMAP}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});