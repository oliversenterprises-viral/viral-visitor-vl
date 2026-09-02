import { readFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

function read(rel: string): string {
  return readFileSync(resolve(ROOT, rel), 'utf8');
}

const invokeMock = vi.fn();

vi.mock('../../src/lib/supabase', () => ({
  supabase: {
    functions: {
      invoke: (...args: unknown[]) => invokeMock(...args),
    },
  },
  isSupabaseConfigured: true,
}));

import {
  copyLink,
  ensureReferralLinkReady,
  getMyReferralLinkInstant,
  resetReferralRecordingStateForTests,
} from '../../src/referral';
import { shouldShowShareAbandon } from '../../src/lib/share-abandon-rescue';
import { MIN_DWELL_MS } from '../../src/lib/share-abandon-rescue';
import { markSharePending, clearShareFirstFlags } from '../../src/lib/share-first-ui';

describe('live homepage five fixes', () => {
  it('1. wordmark span is #f4f4f5 on the dark header', () => {
    expect(read('src/style.css')).toMatch(/#vr-nav span\.logo-font\s*\{\s*color:\s*#f4f4f5;/);
    expect(read('index.html')).toContain('>ViralRefer</span>');
  });

  it('2. public first paint shows #how #prize #leaderboard footer; embed/referred-micro still hide', () => {
    const css = read('src/style.css');
    expect(css).toMatch(
      /html:not\(\[data-vr-embed\]\):not\(\[data-vr-referred-micro\]\):not\(\[data-vr-has-link\]\) #how/,
    );
    expect(css).toMatch(
      /html:not\(\[data-vr-embed\]\):not\(\[data-vr-referred-micro\]\):not\(\[data-vr-has-link\]\) #prize/,
    );
    expect(css).toMatch(
      /html:not\(\[data-vr-embed\]\):not\(\[data-vr-referred-micro\]\):not\(\[data-vr-has-link\]\) #leaderboard/,
    );
    expect(css).toMatch(/html:not\(\[data-vr-embed\]\):not\(\[data-vr-referred-micro\]\) footer/);
    expect(css).toMatch(/html\[data-vr-referred-micro\]:not\(\[data-vr-has-link\]\) #how/);
    expect(css).toMatch(/html\[data-vr-embed\] \[data-vr-below-fold\]/);
    expect(css).not.toMatch(/html:not\(\[data-vr-funnel-expanded\]\) \[data-vr-below-fold\] \{\s*display: none/);
  });

  it('4. overlay sources have no dwell / poll / return auto-fire', () => {
    const exit = read('src/lib/exit-intent-rescue.ts');
    const abandon = read('src/lib/share-abandon-rescue.ts');
    const paid = read('src/lib/paid-conversion-boost.ts');
    expect(exit).not.toMatch(/tryShow\('dwell'\)/);
    expect(abandon).not.toMatch(/tryShow\('dwell'/);
    expect(abandon).not.toMatch(/tryShow\('poll'/);
    expect(abandon).not.toMatch(/tryShow\('return'/);
    expect(paid).not.toContain('showPaidGetLinkNudge');
    expect(shouldShowShareAbandon({
      hasLink: true,
      sharePending: true,
      locked: false,
      alreadyMaxShows: false,
      snoozed: false,
      dwellMs: MIN_DWELL_MS + 100,
      isCoarsePointer: false,
      embed: false,
      confirmFlowActive: false,
      reason: 'dwell',
    })).toBe(false);
  });

  it('5. admin-action implements get_site_content and update_site_content', () => {
    const src = read('supabase/functions/admin-action/index.ts');
    expect(src).toMatch(/action === 'get_site_content'/);
    expect(src).toMatch(/action === 'update_site_content'/);
    expect(read('src/admin/edit-content-tab.ts')).toContain("invokeAdminAction");
    expect(read('src/admin/edit-content-tab.ts')).toContain("'get_site_content'");
  });

  it('locks the six live first-screen strings and rejects the old 8a24705 hero', () => {
    const html = read('index.html');
    const hero = html.slice(html.indexOf('id="hero-title"'), html.indexOf('id="funnel-journey"'));
    expect(html).toContain('<title>Win the ViralRefer homepage — Site Drops + #1 banner</title>');
    expect(hero).toContain('Win the homepage.');
    expect(hero).toContain('Each step puts your site on this page. #1 owns the banner for 7 days.');
    expect(hero).toContain(
      'Get a link. Send it. When a friend taps Get my link, your site can go live here — Rising drop, text line, then the banner.',
    );
    expect(hero).toContain('Empty right now. #1 this week puts their site here.');
    expect(hero).toContain(
      'Paste your website in the slot. 1 friend → Rising drop. 2 → text line. #1 (not the owner) with 3+ friends → 7-day banner.',
    );
    expect(hero).toContain('Get my referral link');
    expect(hero).not.toContain('#1 gets a banner for their site.');
    expect(hero).not.toMatch(/30-day/);
    expect(hero).not.toContain('Example ad');
    expect(html).not.toMatch(/30-day/);
    expect(html).not.toContain('30 days');
    expect(html).not.toContain('#1 gets a banner for their site');
  });
});

describe('copy must not register-referrer-link again', () => {
  beforeEach(() => {
    invokeMock.mockReset();
    invokeMock.mockResolvedValue({ data: { success: true, data: { status: 'pending_share' } }, error: null });
    resetReferralRecordingStateForTests();
    localStorage.clear();
    sessionStorage.clear();
    clearShareFirstFlags();
    document.body.innerHTML = `
      <input id="ref-link" />
      <button type="button" id="copy-link-btn">COPY</button>
      <button type="button" id="post-link-copy">Copy link</button>
      <div id="post-link-share" class="hidden" hidden data-state="hidden"></div>
    `;
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('Get my link registers once; Copy / ensureReferralLinkReady do not register again', async () => {
    await getMyReferralLinkInstant();
    const registerCalls = () =>
      invokeMock.mock.calls.filter((c) => c[0] === 'register-referrer-link');
    expect(registerCalls().length).toBe(1);

    markSharePending();
    await ensureReferralLinkReady();
    copyLink();
    await Promise.resolve();
    await Promise.resolve();

    expect(registerCalls().length).toBe(1);
  });
});
