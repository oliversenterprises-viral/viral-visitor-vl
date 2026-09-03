import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EMPTY_SLOT_META, EMPTY_SLOT_NAME } from '../../src/lib/prize-slot';
import {
  LOCKED_SITE_DROPS_CTA,
  LOCKED_SITE_DROPS_H1_ACCENT,
  LOCKED_SITE_DROPS_H1_LINE1,
  LOCKED_SITE_DROPS_SLOT,
  LOCKED_SITE_DROPS_SUB,
  LOCKED_SITE_DROPS_TITLE,
} from '../../src/lib/site-drops-copy';

const root = resolve(import.meta.dirname, '../..');

function read(rel: string): string {
  return readFileSync(resolve(root, rel), 'utf8');
}

describe('first-screen fail-fast (optimized, no hung-API wait)', () => {
  it('caps public REST/RPC on first paint at 2s and abortSignal', () => {
    const helper = read('src/lib/first-paint-fetch.ts');
    const supabase = read('src/lib/supabase.ts');
    const stub = read('src/lib/supabase-stub.ts');
    expect(helper).toContain('FIRST_PAINT_FETCH_MS');
    expect(helper).toMatch(/FIRST_PAINT_FETCH_MS\s*=\s*2_?000/);
    expect(helper).toContain('withFirstPaintAbort');
    expect(helper).toContain('AbortController');
    expect(supabase).toContain("from './first-paint-fetch'");
    expect(supabase).toContain('withFirstPaintAbort');
    expect(supabase).toContain('abortSignal(signal)');
    expect(stub).toContain('abortSignal');
    expect(stub).toMatch(/rpc:\s*\(\) => query\(\)/);

    const firstPaintFns = [
      'fetchLeaderboard',
      'fetchTotalReferrers',
      'fetchUniqueReferrerCount',
      'fetchPublicGetLinkStats',
      'fetchPublicPrizePull',
      'fetchPublicRecentActivity',
      'fetchPublicFunnelTicker',
      'fetchWeeklySprintLeaderboard',
      'fetchWeeklyReferralCount',
      'fetchDailyCrownStatus',
      'fetchSiteContent',
    ];
    for (const name of firstPaintFns) {
      const start = supabase.indexOf(`export async function ${name}`);
      expect(start, name).toBeGreaterThan(0);
      const next = supabase.indexOf('export async function', start + 10);
      const body = supabase.slice(start, next > start ? next : undefined);
      expect(body, name).toContain('withFirstPaintAbort');
      expect(body, name).toContain('abortSignal');
    }
  });

  it('does not await public count RPCs before Get my link is live', () => {
    const app = read('src/app.ts');
    expect(app).toContain('hydratePublicFirstPaint');
    expect(app).toContain('FIRST_PAINT_FETCH_MS');
    expect(app).toContain('Get my link is live before any public count RPC');
    expect(app).toContain('hydratePublicFirstPaint(myReferralCode)');
    expect(app).not.toMatch(/INIT_FETCH_TIMEOUT_MS\s*=\s*12_000/);
    expect(app).toMatch(/void import\('\.\/lib\/prize-slot'\)[\s\S]{0,80}initWeekRaceClock/);

    const initStart = app.indexOf('export async function initApp');
    const initBody = app.slice(initStart, app.indexOf('setWindowProp', initStart));
    expect(initBody).not.toMatch(/await withInitTimeout\(refreshWorldwideReferralTotals/);
    expect(initBody).not.toMatch(/await withInitTimeout\(loadLeaderboard/);
    expect(initBody).not.toMatch(/await withInitTimeout\(renderRecentActivity/);
    expect(initBody).not.toMatch(/await withInitTimeout\(renderMyStats/);

    const hydrateStart = app.indexOf('function hydratePublicFirstPaint');
    const hydrateBody = app.slice(hydrateStart, initStart);
    expect(hydrateBody).toMatch(/void withInitTimeout\(refreshWorldwideReferralTotals\(\)/);
    expect(hydrateBody).toMatch(/void withInitTimeout\(loadLeaderboard\(\)/);
    expect(hydrateBody).toMatch(/void withInitTimeout\(renderRecentActivity\(\)/);
    expect(hydrateBody).toMatch(/void withInitTimeout\(renderMyStats\(/);
  });

  it('keeps Site Drop English, lock844, 7-day prize, and last-night ticker hide', () => {
    const html = read('index.html');
    const lock = read('src/lib/hero-cta-variant.ts');
    const app = read('src/app.ts');
    expect(html).toContain(`<title>${LOCKED_SITE_DROPS_TITLE}</title>`);
    expect(html).toContain(LOCKED_SITE_DROPS_H1_LINE1);
    expect(html).toContain(LOCKED_SITE_DROPS_H1_ACCENT);
    expect(html).toContain(LOCKED_SITE_DROPS_SUB);
    expect(html).toContain(LOCKED_SITE_DROPS_SLOT);
    expect(html).toContain(LOCKED_SITE_DROPS_CTA);
    expect(html).not.toContain('#1 gets a banner for their site');
    expect(html).toContain('Your site here');
    expect(EMPTY_SLOT_NAME).toBe('Your site here');
    expect(EMPTY_SLOT_META).toBe('Your site here · 7 days');
    expect(EMPTY_SLOT_META).not.toContain('30 days');
    expect(lock).toContain('export function lock844HomepageCopy()');
    expect(app).toContain('lock844HomepageCopy()');
    expect(app).toMatch(/setFunnelTickerVisible\(false\)/);
    expect(app).toContain('Last-night lock: no LIVE WORLDWIDE ticker');
    expect(html).not.toContain('LIVE WORLDWIDE');
  });

  it('keeps the black homepage — does not restyle first screen to blue', () => {
    const css = read('src/style.css');
    expect(css).toContain('background: #0a0a0f');
    expect(css).toContain('--bg: #09090b');
    expect(css).not.toMatch(/body\s*\{[^}]*background:\s*#1e3a8a/);
    expect(css).not.toMatch(/body\s*\{[^}]*background:\s*#2563eb/);
    expect(css).not.toMatch(/body\s*\{[^}]*background:\s*#1d4ed8/);
  });

  it('does not rewrite the 18-language picker', () => {
    const i18n = read('src/lib/i18n/index.ts');
    expect(i18n).toContain('function createLangPickerWrap');
    expect(i18n).toContain('class="vr-lang-select"');
    expect(i18n).toContain("createLangPickerWrap('vr-lang-select')");
    expect(i18n).toContain('function buildLangPicker');
    expect(i18n).toContain('function mountEmbedLangPicker');
    expect(read('src/lib/i18n/messages.ts')).toContain('SUPPORTED_LOCALES');
    expect(read('src/lib/i18n/extra-locales.ts')).toContain('EXTRA_LOCALES');
    expect(read('index.html')).not.toContain('id="vr-lang-select"');
  });

  it('keeps the GSC verification file', () => {
    expect(existsSync(resolve(root, 'public/google163d31ba24216edd.html'))).toBe(true);
    expect(read('public/google163d31ba24216edd.html')).toContain(
      'google-site-verification: google163d31ba24216edd.html',
    );
  });
});

describe('initApp does not wait on hung first-paint APIs', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <button id="hero-get-link-btn">${LOCKED_SITE_DROPS_CTA}</button>
      <input id="ref-link" value="" />
      <div id="stats-content"></div>
      <div id="leaderboard-container"></div>
      <div id="recent-activity"></div>
    `;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = '';
  });

  it('resolves Get my link while public RPCs stay hung', async () => {
    const supabaseMod = await import('../../src/lib/supabase');
    const hung = () => new Promise<never>(() => {});
    vi.spyOn(supabaseMod, 'fetchSiteContent').mockImplementation(hung);
    vi.spyOn(supabaseMod, 'fetchTotalReferrers').mockImplementation(hung);
    vi.spyOn(supabaseMod, 'fetchUniqueReferrerCount').mockImplementation(hung);
    vi.spyOn(supabaseMod, 'fetchPublicGetLinkStats').mockImplementation(hung);
    vi.spyOn(supabaseMod, 'fetchLeaderboard').mockImplementation(hung);
    vi.spyOn(supabaseMod, 'fetchPublicRecentActivity').mockImplementation(hung);

    const { initApp } = await import('../../src/app');
    const started = Date.now();
    await initApp();
    expect(Date.now() - started).toBeLessThan(250);
    const cta = document.getElementById('hero-get-link-btn');
    expect(cta).toBeTruthy();
    expect((cta as HTMLButtonElement).disabled).toBe(false);
    expect(cta?.textContent).toBe(LOCKED_SITE_DROPS_CTA);
  });
});
