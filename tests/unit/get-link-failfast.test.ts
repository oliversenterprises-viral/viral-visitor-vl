import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HUMAN_CHECK_STALL_MESSAGE } from '../../src/lib/turnstile';
import { showPostLinkLoading } from '../../src/lib/post-link-share';
import {
  failGetLinkIfHumanCheckStalled,
  GET_LINK_FAILFAST_MS,
  getMyReferralLinkInstant,
  resetReferralRecordingStateForTests,
} from '../../src/referral';

const ROOT = resolve(import.meta.dirname, '../..');

function mountGetLinkDom() {
  document.body.innerHTML = `
    <input id="ref-link" />
    <div id="post-link-share" class="hidden" hidden data-state="hidden">
      <h2 id="post-link-heading"></h2>
      <p id="post-link-url"></p>
      <button type="button" id="post-link-primary"></button>
      <button type="button" id="post-link-copy">Copy link</button>
      <p id="post-link-helper"></p>
      <p id="post-link-whisper" class="hidden" hidden></p>
    </div>
  `;
}

describe('Get my link fail-fast (human-check must not spin forever)', () => {
  beforeEach(() => {
    resetReferralRecordingStateForTests();
    localStorage.clear();
    sessionStorage.clear();
    delete (window as { turnstile?: unknown }).turnstile;
    mountGetLinkDom();
  });

  afterEach(() => {
    resetReferralRecordingStateForTests();
    document.body.innerHTML = '';
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('keeps Get my referral link on the first screen', () => {
    const html = readFileSync(resolve(ROOT, 'index.html'), 'utf8');
    const hero = html.slice(html.indexOf('id="hero-title"'), html.indexOf('id="funnel-journey"'));
    expect(hero).toContain('id="hero-get-link-btn"');
    expect(hero).toContain('Get my referral link');
    expect(html).toContain('id="ref-link"');
    expect(html).toContain('id="prize-slot-site"');
    expect(html).toContain('Your site here');
  });

  it('Get my link still mints immediately when Turnstile never loads', async () => {
    const started = Date.now();
    await getMyReferralLinkInstant();
    const elapsed = Date.now() - started;
    const value = (document.getElementById('ref-link') as HTMLInputElement).value;
    expect(value).toMatch(/\/r\/VIRAL-/i);
    expect(document.getElementById('post-link-share')?.dataset.state).toBe('ready');
    expect(elapsed).toBeLessThan(GET_LINK_FAILFAST_MS);
  });

  it('fail-fast error replaces Getting your link… when the human-check stalls', () => {
    showPostLinkLoading();
    expect(document.getElementById('post-link-heading')?.textContent).toMatch(/Getting your link/);
    expect(failGetLinkIfHumanCheckStalled()).toBe(true);
    expect(document.getElementById('post-link-heading')?.textContent).toBe(HUMAN_CHECK_STALL_MESSAGE);
    expect(document.getElementById('post-link-share')?.dataset.state).toBe('error');
    expect(document.getElementById('post-link-primary')?.textContent).toBe('Try again');
  });

  it('watchdog cannot leave Get my link spinning after the fail-fast window', async () => {
    vi.useFakeTimers();
    showPostLinkLoading();
    const watchdog = window.setTimeout(() => {
      failGetLinkIfHumanCheckStalled();
    }, GET_LINK_FAILFAST_MS);
    await vi.advanceTimersByTimeAsync(GET_LINK_FAILFAST_MS);
    window.clearTimeout(watchdog);
    expect(document.getElementById('post-link-heading')?.textContent).toBe(HUMAN_CHECK_STALL_MESSAGE);
    expect(document.getElementById('post-link-share')?.dataset.state).not.toBe('loading');
  });
});
