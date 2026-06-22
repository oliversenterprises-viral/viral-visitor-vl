/**
 * Headless preview smoke: zero console errors, core DOM observables present.
 * Run: npm run build && npm run preview & SCRATCH=... node tests/preview-load.mjs
 */
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { setTimeout as sleep } from 'node:timers/promises';

const PREVIEW_URL = process.env.PREVIEW_URL || 'http://localhost:4173';
const SCRATCH = process.env.SCRATCH || '.';
const RUN_ID = process.env.PREVIEW_RUN_ID || '1';

async function waitForServer(url, attempts = 40) {
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      /* retry */
    }
    await sleep(500);
  }
  throw new Error(`Preview server not ready at ${url}`);
}

let previewProc = null;
if (!process.env.SKIP_PREVIEW_START) {
  previewProc = spawn('npm', ['run', 'preview'], {
    shell: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    cwd: process.cwd(),
  });
  let startupLog = '';
  previewProc.stdout?.on('data', (d) => { startupLog += d; });
  previewProc.stderr?.on('data', (d) => { startupLog += d; });
  await waitForServer(PREVIEW_URL);
  await writeFile(`${SCRATCH}/preview-startup-${RUN_ID}.log`, startupLog);
}

await mkdir(SCRATCH, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const consoleErrors = [];
const consoleAll = [];

page.on('console', (msg) => {
  const line = `[${msg.type()}] ${msg.text()}`;
  consoleAll.push(line);
  if (msg.type() === 'error') consoleErrors.push(msg.text());
});
page.on('pageerror', (err) => {
  const line = `[pageerror] ${err.message}`;
  consoleAll.push(line);
  consoleErrors.push(err.message);
});

await page.goto(PREVIEW_URL, { waitUntil: 'networkidle' });
await page.waitForFunction(
  () => document.documentElement.getAttribute('data-vr-ready') === '1',
  { timeout: 25000 },
);

const checks = [];
const assert = (name, ok, detail = '') => checks.push({ name, ok, detail });

const ids = [
  'hero-title',
  'leaderboard-container',
  'winner-modal',
  'ref-link',
  'referral-attribution',
  'copy-link-btn',
  'prize-banner-visual',
];
for (const id of ids) {
  assert(`#${id} exists`, !!(await page.$(`#${id}`)));
}

const claimBtn = page.locator('button:has-text("I\'m the #1 Winner")');
assert('claim button visible', await claimBtn.isVisible());

const bannerVisual = page.locator('#prize-banner-visual');
const bannerHasContent = await bannerVisual.evaluate((el) => {
  return el.children.length > 0 && el.textContent.trim().length > 0;
});
assert('banner rotation DOM populated', bannerHasContent, await bannerVisual.innerText().catch(() => ''));

await page.click('text=Get my referral link');
const refVal = await page.inputValue('#ref-link');
assert('generate link updates #ref-link', /\/r\/VIRAL-/i.test(refVal), refVal);

assert('zero console errors', consoleErrors.length === 0, consoleErrors.join(' | '));

const screenshotPath = `${SCRATCH}/preview-screenshot-${RUN_ID}.png`;
await page.screenshot({ path: screenshotPath, fullPage: false });

const lines = checks.map((c) => `${c.ok ? 'PASS' : 'FAIL'}  ${c.name}${c.detail ? ` — ${c.detail}` : ''}`);
const report = [
  ...lines,
  '',
  `Screenshot: ${screenshotPath}`,
  `Console errors (${consoleErrors.length}):`,
  ...consoleErrors.map((e) => `  - ${e}`),
  '',
  'Full console log:',
  ...consoleAll,
].join('\n');

await writeFile(`${SCRATCH}/preview-load-${RUN_ID}.log`, report);
await writeFile(`${SCRATCH}/preview-console-${RUN_ID}.log`, consoleAll.join('\n'));
console.log(report);

await browser.close();
if (previewProc) previewProc.kill();

const failed = checks.filter((c) => !c.ok).length;
process.exit(failed ? 1 : 0);