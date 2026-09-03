import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { INIT_FETCH_TIMEOUT_MS, paintStaticFirstScreen } from '../../src/app';
import { LOCKED_LIVE_FUNNEL_BADGE, LOCKED_SITE_DROPS_CTA } from '../../src/lib/site-drops-copy';
import { EMPTY_SLOT_NAME } from '../../src/lib/prize-slot';
import {
  PUBLIC_REST_TIMEOUT_MS,
  withPublicRestTimeout,
} from '../../src/lib/public-rest-timeout';

const root = resolve(import.meta.dirname, '../..');

function read(rel: string): string {
  return readFileSync(resolve(root, rel), 'utf8');
}

describe('homepage public REST/RPC fail-fast (HARD LOCK)', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('aborts public REST/RPC at ≤2s', () => {
    expect(PUBLIC_REST_TIMEOUT_MS).toBe(2_000);
    expect(INIT_FETCH_TIMEOUT_MS).toBe(2_000);
    expect(INIT_FETCH_TIMEOUT_MS).toBeLessThanOrEqual(PUBLIC_REST_TIMEOUT_MS);
  });

  it('returns fallback and aborts the signal when the request never resolves', async () => {
    vi.useFakeTimers();
    let aborted = false;
    const pending = withPublicRestTimeout((signal) => {
      signal.addEventListener('abort', () => {
        aborted = true;
      });
      return new Promise<string>(() => {});
    }, 'fallback');

    await vi.advanceTimersByTimeAsync(PUBLIC_REST_TIMEOUT_MS);
    await expect(pending).resolves.toBe('fallback');
    expect(aborted).toBe(true);
  });

  it('resolves the real value when the request finishes before 2s', async () => {
    await expect(withPublicRestTimeout(async () => 'live', 'fallback')).resolves.toBe('live');
  });

  it('wires abortSignal on homepage site_content / ticker / leaderboard / activity', () => {
    const src = read('src/lib/supabase.ts');
    expect(src).toContain('withPublicRestTimeout');
    expect(src).toMatch(/get_leaderboard[\s\S]*abortSignal/);
    expect(src).toMatch(/get_public_recent_activity[\s\S]*abortSignal/);
    expect(src).toMatch(/get_public_funnel_ticker[\s\S]*abortSignal/);
    expect(src).toMatch(/from\('site_content'\)[\s\S]*abortSignal/);
  });

  it('does not wait on ticker to show the hero or finish initApp', () => {
    const src = read('src/app.ts');
    expect(src).toContain('paintStaticFirstScreen');
    expect(src).toContain('Promise.all');
    expect(src).not.toMatch(/await withInitTimeout\(refreshFunnelTicker/);
    expect(src).not.toMatch(/await refreshFunnelTicker/);
    expect(src).toMatch(/void refreshFunnelTicker/);
    expect(src).toContain('INIT_FETCH_TIMEOUT_MS = 2_000');
    expect(src).not.toContain('INIT_FETCH_TIMEOUT_MS = 12_000');
    expect(src).not.toMatch(/innerHTML = leaderboardSkeletonHtml/);
    expect(src).not.toMatch(/innerHTML = activitySkeletonHtml/);
    expect(src).toContain('fetchPublicFunnelTicker');
    expect(src).toContain('shouldShowFunnelTicker');
    expect(src).not.toContain('Last-night lock: no LIVE WORLDWIDE ticker over the hero.');
  });

  it('paints static Site Drops first screen instead of a spinner', () => {
    document.body.innerHTML = `
      <a id="hero-slot-site">Your site here</a>
      <button id="hero-get-link-btn"><span>Get my referral link</span></button>
      <span id="funnel-journey-badge">YOUR 3-STEP PATH TO #1</span>
      <h2 id="leaderboard-title">Recent Activity</h2>
      <div id="leaderboard-container" aria-busy="true"><div class="public-skeleton-stack"></div></div>
      <div id="recent-activity" aria-busy="true"><div class="public-skeleton-stack"></div></div>
    `;

    paintStaticFirstScreen();

    expect(document.getElementById('hero-slot-site')?.textContent).toBe(EMPTY_SLOT_NAME);
    expect(document.querySelector('#hero-get-link-btn span')?.textContent).toBe(LOCKED_SITE_DROPS_CTA);
    expect(document.getElementById('funnel-journey-badge')?.textContent).toBe(LOCKED_LIVE_FUNNEL_BADGE);
    expect(document.getElementById('funnel-journey-badge')?.textContent).toBe('SITE DROP LADDER');
    expect(document.getElementById('leaderboard-title')?.textContent).toBe('Recent Activity');
    expect(document.getElementById('leaderboard-container')?.innerHTML).toContain('public-empty-state');
    expect(document.getElementById('leaderboard-container')?.innerHTML).not.toContain('public-skeleton-stack');
    expect(document.getElementById('recent-activity')?.innerHTML).toContain('public-empty-state');
    expect(document.getElementById('recent-activity')?.getAttribute('aria-busy')).toBe('false');
  });

  it('keeps Site Drop English and Your site here — no #1 gets a banner swap', () => {
    const html = read('index.html');
    const hero = html.slice(html.indexOf('id="hero-title"'), html.indexOf('id="funnel-journey"'));
    expect(html).toContain('Site Drop');
    expect(html).toContain('SITE DROP LADDER');
    expect(html).toContain('Your site here');
    expect(hero).not.toContain('#1 gets a banner for their site.');
    expect(html).toMatch(/id="leaderboard-title"[^>]*>\s*Recent Activity\s*<\/h2>/);
    const board = html.slice(html.indexOf('id="leaderboard-title"'), html.indexOf('id="leaderboard-container"'));
    expect(board).not.toContain('Early Leaderboard');
  });
});
