import { test, expect, chromium, devices } from '@playwright/test';

/**
 * Multi-device audit for ViralRefer Relay.
 * Defaults to production; set RELAY_URL for local (e.g. http://127.0.0.1:4173/relay).
 */
const RELAY = process.env.RELAY_URL || 'https://www.viralrefer.app/relay';

const profiles: Array<{ name: string; options: Parameters<typeof chromium.launch>[0] extends never ? never : object } & {
  name: string;
  context: {
    viewport: { width: number; height: number };
    userAgent?: string;
    isMobile?: boolean;
    hasTouch?: boolean;
    deviceScaleFactor?: number;
  };
}> = [
  { name: 'iphone13', context: { ...devices['iPhone 13'] } },
  { name: 'pixel5', context: { ...devices['Pixel 5'] } },
  { name: 'ipad', context: { ...devices['iPad Pro 11'] } },
  {
    name: 'desktop',
    context: {
      viewport: { width: 1440, height: 900 },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120',
    },
  },
  {
    name: 'narrow320',
    context: {
      viewport: { width: 320, height: 640 },
      isMobile: true,
      hasTouch: true,
      deviceScaleFactor: 2,
      userAgent: 'Mozilla/5.0 (Linux; Android 12; Pixel) AppleWebKit/537.36 Chrome/120 Mobile',
    },
  },
];

test.describe('Relay multi-device', () => {
  test('no overflow / min touch targets on key viewports', async () => {
    const browser = await chromium.launch({ headless: true });
    const failures: string[] = [];

    try {
      for (const p of profiles) {
        const context = await browser.newContext(p.context);
        const page = await context.newPage();
        const pageErrors: string[] = [];
        page.on('pageerror', (e) => pageErrors.push(String(e)));

        await page.goto(RELAY, { waitUntil: 'networkidle', timeout: 60_000 });
        await page.waitForSelector('#vr-relay-root', { timeout: 20_000 });
        await page.waitForTimeout(900);

        const audit = await page.evaluate(() => {
          const issues: string[] = [];
          const body = document.body;
          const doc = document.documentElement;
          const overflowX =
            Math.max(body.scrollWidth, doc.scrollWidth) -
            Math.max(body.clientWidth, doc.clientWidth);
          if (overflowX > 2) issues.push(`h-overflow:${overflowX}`);

          for (const sel of [
            '#vr-relay-open',
            '#vr-relay-confirm',
            '#vr-relay-enqueue',
            '#vr-relay-url',
          ]) {
            const el = document.querySelector(sel) as HTMLElement | null;
            if (!el) {
              issues.push(`missing:${sel}`);
              continue;
            }
            const r = el.getBoundingClientRect();
            if (r.height < 44) issues.push(`small-h:${sel}:${Math.round(r.height)}`);
            if (r.right > window.innerWidth + 2) issues.push(`offscreen:${sel}`);
          }

          const domain = document.getElementById('vr-relay-domain');
          return {
            issues,
            ready: doc.getAttribute('data-vr-ready'),
            relay: doc.getAttribute('data-vr-relay'),
            domainText: domain?.textContent || '',
            bannerH: Math.round(
              document.querySelector('.vr-relay-banner')?.getBoundingClientRect().height || 0,
            ),
            w: window.innerWidth,
          };
        });

        if (pageErrors.length) failures.push(`${p.name}: errors ${pageErrors.join('|')}`);
        if (audit.relay !== '1') failures.push(`${p.name}: missing data-vr-relay`);
        if (audit.ready !== '1') failures.push(`${p.name}: not ready`);
        if (audit.issues.length) failures.push(`${p.name}: ${audit.issues.join(', ')}`);
        if (audit.domainText.length > 80) failures.push(`${p.name}: domain too long`);
        // Banner should not eat half the phone screen after compact redesign
        if (audit.w <= 400 && audit.bannerH > 90) {
          failures.push(`${p.name}: banner too tall (${audit.bannerH}px)`);
        }

        await context.close();
      }
    } finally {
      await browser.close();
    }

    expect(failures, failures.join('\n')).toEqual([]);
  });
});
