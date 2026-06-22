/**
 * Headless preview smoke: zero console errors, core DOM observables present.
 * Run: npm run build && npm run preview & node tests/preview-load.mjs
 */
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';

const PREVIEW_URL = process.env.PREVIEW_URL || 'http://localhost:4173';
const SCRATCH = process.env.SCRATCH || '.';

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
  await import('node:fs/promises').then((fs) =>
    fs.writeFile(`${SCRATCH}/preview-startup.log`, startupLog),
  );
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const consoleErrors = [];
page.on('console', (msg) => {
  if (msg.type() === 'error') consoleErrors.push(msg.text());
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
];
for (const id of ids) {
  assert(`#${id} exists`, !!(await page.$(`#${id}`)));
}

await page.click('text=Get my referral link');
const refVal = await page.inputValue('#ref-link');
assert('generate link updates #ref-link', /\/r\/VIRAL-/i.test(refVal), refVal);
const benign = (msg) =>
  /unconfigured\.invalid|ERR_NAME_NOT_RESOLVED|WebSocket connection.*realtime/i.test(msg);
const criticalErrors = consoleErrors.filter((e) => !benign(e));
assert('zero critical console errors', criticalErrors.length === 0, criticalErrors.join('; '));

const lines = checks.map((c) => `${c.ok ? 'PASS' : 'FAIL'}  ${c.name}${c.detail ? ` — ${c.detail}` : ''}`);
const report = lines.join('\n') + `\n\nConsole errors: ${consoleErrors.length}\n`;
await import('node:fs/promises').then((fs) => fs.writeFile(`${SCRATCH}/preview-load.log`, report));
console.log(report);

await browser.close();
if (previewProc) previewProc.kill();

const failed = checks.filter((c) => !c.ok).length;
process.exit(failed ? 1 : 0);