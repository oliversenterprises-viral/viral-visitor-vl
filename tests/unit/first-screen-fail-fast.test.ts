import { readFileSync, existsSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EMPTY_SLOT_NAME, EMPTY_SLOT_META } from '../../src/lib/prize-slot';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

function read(rel: string): string {
  return readFileSync(resolve(ROOT, rel), 'utf8');
}

describe('first-screen paint fail-fast (this tree)', () => {
  it('public first-paint REST/RPC use AbortController via withFirstPaintAbort', () => {
    const supabase = read('src/lib/supabase.ts');
    expect(supabase).toContain("from './first-paint-fetch'");
    expect(supabase).toContain('withFirstPaintAbort');
    expect(supabase).toContain('.abortSignal(signal)');

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

  it('initApp does not hang Get my link behind count RPCs', () => {
    const app = read('src/app.ts');
    expect(app).toContain('hydratePublicFirstPaint');
    expect(app).toContain('FIRST_PAINT_FETCH_MS');
    expect(app).toMatch(/Get my link is live before any public count RPC/);

    const initStart = app.indexOf('export async function initApp');
    const initBody = app.slice(initStart, app.indexOf('setWindowProp', initStart));
    expect(initBody).not.toMatch(/await withInitTimeout\(refreshWorldwideReferralTotals/);
    expect(initBody).not.toMatch(/await withInitTimeout\(loadLeaderboard/);
    expect(initBody).not.toMatch(/await withInitTimeout\(renderRecentActivity/);
    expect(initBody).not.toMatch(/await withInitTimeout\(renderMyStats/);
    expect(initBody).toContain('hydratePublicFirstPaint(myReferralCode)');

    const hydrateStart = app.indexOf('function hydratePublicFirstPaint');
    const hydrateBody = app.slice(hydrateStart, initStart);
    expect(hydrateBody).toMatch(/void withInitTimeout\(refreshWorldwideReferralTotals/);
    expect(hydrateBody).toMatch(/void withInitTimeout\(renderMyStats/);
  });

  it('keeps the black homepage — does not restyle first screen to blue', () => {
    const css = read('src/style.css');
    expect(css).toContain('background: #0a0a0f');
    expect(css).toContain('--bg: #09090b');
    expect(css).not.toMatch(/body\s*\{[^}]*background:\s*#1e3a8a/);
    expect(css).not.toMatch(/body\s*\{[^}]*background:\s*#2563eb/);
    expect(css).not.toMatch(/body\s*\{[^}]*background:\s*#1d4ed8/);
  });

  it('does not rewrite the i18n picker', () => {
    const i18n = read('src/lib/i18n/index.ts');
    expect(i18n).toContain('function createLangPickerWrap');
    expect(i18n).toContain('class="vr-lang-select"');
    expect(i18n).toContain("createLangPickerWrap('vr-lang-select')");
    expect(i18n).toContain('function buildLangPicker');
    expect(i18n).toContain('function mountEmbedLangPicker');
  });

  it('prize empty slot stays Your site here', () => {
    expect(EMPTY_SLOT_NAME).toBe('Your site here');
    expect(EMPTY_SLOT_META).toBe('Your site here · 30 days');
    const html = read('index.html');
    expect(html).toContain('Your site here');
  });

  it('GSC verification path stays', () => {
    expect(existsSync(resolve(ROOT, 'scripts/setup-google-search-console.mjs'))).toBe(true);
    expect(existsSync(resolve(ROOT, 'scripts/gsc-finish-verification.mjs'))).toBe(true);
    expect(existsSync(resolve(ROOT, 'scripts/gsc-extract-token.mjs'))).toBe(true);
    const vite = read('vite.config.ts');
    expect(vite).toContain('inject-google-site-verification');
    expect(vite).toContain('google-site-verification');
    const seo = read('src/lib/organic-seo.ts');
    expect(seo).toContain('google-site-verification');
    expect(seo).toContain('VITE_GOOGLE_SITE_VERIFICATION');
  });
});

describe('initApp first screen does not wait on hung counts', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <button id="hero-get-link-btn"><span>Get my referral link</span></button>
      <input id="ref-link" value="" />
      <div id="stats-content"></div>
      <div id="leaderboard-container"></div>
      <div id="recent-activity"></div>
      <div id="vr-verified-total">
        <span id="total-referrers"></span>
        <span id="hero-stats-suffix"></span>
        <p id="hero-got-link-today"></p>
      </div>
    `;
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = '';
  });

  it('resolves while public count RPCs stay hung', async () => {
    const supabaseMod = await import('../../src/lib/supabase');
    const hung = () => new Promise<never>(() => {});
    vi.spyOn(supabaseMod, 'fetchSiteContent').mockImplementation(hung);
    vi.spyOn(supabaseMod, 'fetchTotalReferrers').mockImplementation(hung);
    vi.spyOn(supabaseMod, 'fetchUniqueReferrerCount').mockImplementation(hung);
    vi.spyOn(supabaseMod, 'fetchPublicGetLinkStats').mockImplementation(hung);
    vi.spyOn(supabaseMod, 'fetchLeaderboard').mockImplementation(hung);

    const { initApp } = await import('../../src/app');
    const started = Date.now();
    await initApp();
    expect(Date.now() - started).toBeLessThan(250);

    const cta = document.getElementById('hero-get-link-btn');
    expect(cta).toBeTruthy();
    expect((cta as HTMLButtonElement).disabled).toBe(false);
    expect(cta?.textContent).toMatch(/Get my referral link/);
  });
});
