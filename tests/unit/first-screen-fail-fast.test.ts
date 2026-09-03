import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import {
  ENHANCE_FETCH_TIMEOUT_MS,
  FIRST_SCREEN_FETCH_TIMEOUT_MS,
  initApp,
  withInitTimeout,
} from '../../src/app';
import * as supabaseMod from '../../src/lib/supabase';

const root = resolve(import.meta.dirname, '../..');

describe('first-screen fail-fast', () => {
  it('keeps first-paint budget at 2s and lets live enhance wait longer', () => {
    expect(FIRST_SCREEN_FETCH_TIMEOUT_MS).toBe(2_000);
    expect(FIRST_SCREEN_FETCH_TIMEOUT_MS).toBeLessThan(3_000);
    expect(ENHANCE_FETCH_TIMEOUT_MS).toBe(12_000);
    expect(ENHANCE_FETCH_TIMEOUT_MS).toBeGreaterThan(FIRST_SCREEN_FETCH_TIMEOUT_MS);
  });

  it('times out a hung fetch without blocking the caller', async () => {
    const hung = new Promise<string>(() => {
      /* never resolves — hung PostgREST */
    });
    const started = Date.now();
    const result = await withInitTimeout(hung, 'first-screen', 80);
    const elapsed = Date.now() - started;

    expect(result).toBe('first-screen');
    expect(elapsed).toBeGreaterThanOrEqual(60);
    expect(elapsed).toBeLessThan(400);
  });

  it('initApp returns without waiting on hung site_content', async () => {
    vi.spyOn(supabaseMod, 'fetchSiteContent').mockReturnValue(
      new Promise(() => {
        /* hung */
      }),
    );
    document.body.innerHTML = `
      <nav id="vr-nav"><span class="vr-wordmark">ViralRefer</span></nav>
      <span id="hero-title-line1">Win the homepage.</span>
      <span id="hero-title-accent">Each step puts your site on this page. #1 owns the banner for 7 days.</span>
      <p id="hero-subtitle"></p>
      <p id="hero-prize-one"></p>
      <button id="hero-get-link-btn"><span>Get my referral link</span></button>
      <h2 id="leaderboard-title">Recent Activity</h2>
    `;
    const started = Date.now();
    await initApp();
    expect(Date.now() - started).toBeLessThan(FIRST_SCREEN_FETCH_TIMEOUT_MS);
    expect(document.getElementById('hero-title-line1')?.textContent).toBe('Win the homepage.');
    vi.restoreAllMocks();
  });

  it('does not await CMS or board fetches inside initApp', () => {
    const app = readApp();
    const initFn = app.slice(
      app.indexOf('export async function initApp'),
      app.indexOf('async function enhanceAfterFirstPaint'),
    );
    expect(initFn).toContain('void enhanceAfterFirstPaint');
    expect(initFn).toContain('lock844HomepageCopy()');
    expect(initFn).not.toMatch(/await withInitTimeout\(loadSiteContent/);
    expect(initFn).not.toMatch(/await withInitTimeout\(loadLeaderboard/);
  });
});

function readApp(): string {
  return readFileSync(resolve(root, 'src/app.ts'), 'utf8');
}
