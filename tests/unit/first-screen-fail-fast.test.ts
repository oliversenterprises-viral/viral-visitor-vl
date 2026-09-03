import { readFileSync, existsSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EMPTY_SLOT_NAME, EMPTY_SLOT_META } from '../../src/lib/prize-slot';
import {
  LOCKED_BOARD_TITLE,
  LOCKED_DROP_CHALLENGER_LABEL,
  LOCKED_DROP_ENTERED_LABEL,
  LOCKED_DROP_RISING_LABEL,
  LOCKED_LIVE_FUNNEL_BADGE,
  LOCKED_PRIZE_SLOT,
} from '../../src/lib/site-drops-copy';

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
    expect(app).toContain('loadSiteDropsLadder');

    const initStart = app.indexOf('export async function initApp');
    const initBody = app.slice(initStart, app.indexOf('setWindowProp', initStart));
    expect(initBody).not.toMatch(/await withInitTimeout\(refreshWorldwideReferralTotals/);
    expect(initBody).not.toMatch(/await withInitTimeout\(loadLeaderboard/);
    expect(initBody).not.toMatch(/await withInitTimeout\(renderRecentActivity/);
    expect(initBody).not.toMatch(/await withInitTimeout\(renderMyStats/);
    expect(initBody).not.toMatch(/await withInitTimeout\(loadSiteContent/);
    expect(initBody).toContain('hydratePublicFirstPaint(myReferralCode)');

    const hydrateStart = app.indexOf('function hydratePublicFirstPaint');
    const hydrateBody = app.slice(hydrateStart, initStart);
    expect(hydrateBody).toMatch(/void withInitTimeout\(refreshWorldwideReferralTotals/);
    expect(hydrateBody).toMatch(/void withInitTimeout\(renderMyStats/);
    expect(hydrateBody).toContain('loadSiteDropsLadder');
  });

  it('keeps Site Drop English and prize Your site here · 7 days', () => {
    expect(EMPTY_SLOT_NAME).toBe(LOCKED_PRIZE_SLOT);
    expect(EMPTY_SLOT_META).toBe('Your site here · 7 days');
    const html = read('index.html');
    expect(html).toContain(LOCKED_PRIZE_SLOT);
    expect(html).toContain(LOCKED_DROP_ENTERED_LABEL);
    expect(html).toContain(LOCKED_DROP_RISING_LABEL);
    expect(html).toContain(LOCKED_DROP_CHALLENGER_LABEL);
    expect(html).toContain(LOCKED_LIVE_FUNNEL_BADGE);
    expect(html).toMatch(/id="leaderboard-title"[^>]*>\s*Recent Activity\s*<\/h2>/);
    expect(LOCKED_BOARD_TITLE).toBe('Recent Activity');
  });

  it('does not rewrite the i18n picker', () => {
    const i18n = read('src/lib/i18n/index.ts');
    expect(i18n).toContain('function createLangPickerWrap');
    expect(i18n).toContain('class="vr-lang-select"');
    expect(i18n).toContain("createLangPickerWrap('vr-lang-select')");
  });

  it('GSC verification path stays', () => {
    expect(existsSync(resolve(ROOT, 'scripts/setup-google-search-console.mjs'))).toBe(true);
    const vite = read('vite.config.ts');
    expect(vite).toContain('inject-google-site-verification');
    expect(vite).toContain('google-site-verification');
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
