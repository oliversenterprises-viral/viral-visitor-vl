import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { INIT_FETCH_TIMEOUT_MS, paintStaticFirstScreen } from '../../src/app';
import { LOCKED_SITE_DROPS_CTA } from '../../src/lib/site-drops-copy';
import { EMPTY_SLOT_NAME } from '../../src/lib/prize-slot';
import {
  PUBLIC_REST_TIMEOUT_MS,
  withPublicRestTimeout,
} from '../../src/lib/public-rest-timeout';

const root = resolve(import.meta.dirname, '../..');

function read(rel: string): string {
  return readFileSync(resolve(root, rel), 'utf8');
}

describe('homepage public REST/RPC fail-fast', () => {
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
    await expect(
      withPublicRestTimeout(async () => 'live', 'fallback'),
    ).resolves.toBe('live');
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
  });

  it('paints static Site Drops first screen instead of a spinner', () => {
    document.body.innerHTML = `
      <a id="hero-slot-site">Your site here</a>
      <button id="hero-get-link-btn"><span>Get my referral link</span></button>
      <h2 id="leaderboard-title">Recent Activity</h2>
      <div id="leaderboard-container" aria-busy="true"><div class="public-skeleton-stack"></div></div>
      <div id="recent-activity" aria-busy="true"><div class="public-skeleton-stack"></div></div>
    `;

    paintStaticFirstScreen();

    expect(document.getElementById('hero-slot-site')?.textContent).toBe(EMPTY_SLOT_NAME);
    expect(document.querySelector('#hero-get-link-btn span')?.textContent).toBe(LOCKED_SITE_DROPS_CTA);
    expect(document.getElementById('leaderboard-title')?.textContent).toBe('Recent Activity');
    expect(document.getElementById('leaderboard-container')?.innerHTML).toContain('public-empty-state');
    expect(document.getElementById('leaderboard-container')?.innerHTML).not.toContain('public-skeleton-stack');
    expect(document.getElementById('recent-activity')?.innerHTML).toContain('public-empty-state');
    expect(document.getElementById('recent-activity')?.getAttribute('aria-busy')).toBe('false');
  });

  it('does not edit Early Leaderboard or admin-action', () => {
    const html = read('index.html');
    const i18n = read('src/lib/i18n/messages.ts');
    expect(html).toMatch(/id="leaderboard-title"[^>]*>\s*Recent Activity\s*<\/h2>/);
    expect(i18n).toContain("'leaderboard.title': 'Recent Activity'");
    expect(html).not.toContain('Early Leaderboard');
  });
});
