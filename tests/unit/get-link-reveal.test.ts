import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { getMyReferralLinkInstant, resetReferralRecordingStateForTests } from '../../src/referral';
import {
  POST_LINK_ATTR,
  POST_LINK_HEADING_READY,
  revealReferralSection,
  showPostLinkReady,
} from '../../src/lib/post-link-share';
import { SEND_NOW_LABEL } from '../../src/lib/referred-race';
import {
  hasReferralLinkInUI,
  initVisitorSlim,
  refreshVisitorSlimState,
} from '../../src/lib/visitor-slim';
import { refreshPublicClarityState } from '../../src/lib/public-clarity';
import { initPaidConversionBoost } from '../../src/lib/paid-conversion-boost';
import { captureUtmAttribution } from '../../src/lib/utm-attribution';
import { initExitIntentRescue } from '../../src/lib/exit-intent-rescue';
import { writeShareDeadlineState } from '../../src/lib/share-deadline';
import { renderPostLinkStatus } from '../../src/lib/post-link-status';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const LINK = 'https://viralrefer.app/r/VIRAL-REVEAL1';

function mountKidSimpleSendDom() {
  document.documentElement.setAttribute('data-vr-kid-simple', '1');
  document.body.innerHTML = `
    <button id="hero-get-link-btn"><span>Get my link</span></button>
    <div id="mobile-referral-cta" class="hidden"><span>Get my link</span></div>
    <div id="referral-section" hidden class="hidden" style="display:none">
      <input id="ref-link" value="" />
      <div id="post-link-status" class="hidden" hidden data-state="hidden">
        <h2 id="post-link-status-title">You're in.</h2>
        <p id="post-link-status-line"></p>
        <p id="share-deadline-banner" class="hidden" hidden><span id="share-deadline-countdown"></span></p>
      </div>
      <div id="post-link-share" class="hidden" hidden>
        <h2 id="post-link-heading">You're racing.</h2>
        <p id="post-link-sub">Send it now. A friend must tap Get my link — that's how you climb.</p>
        <p id="post-link-url"></p>
        <p id="post-link-tool">This is your public link. Paste it in any bio, story, or text.</p>
        <button type="button" id="post-link-primary"></button>
        <button type="button" id="post-link-copy">Copy link</button>
        <p id="post-link-helper"></p>
        <p id="post-link-whisper" class="hidden" hidden></p>
      </div>
    </div>
  `;
}

describe('Get my link reveal (last-night lock)', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    resetReferralRecordingStateForTests();
    document.documentElement.removeAttribute('data-vr-has-link');
    document.documentElement.removeAttribute(POST_LINK_ATTR);
    document.documentElement.removeAttribute('data-vr-kid-simple');
    document.documentElement.removeAttribute('data-vr-visitor-slim');
    document.documentElement.removeAttribute('data-vr-paid-landing');
    delete document.documentElement.dataset.vrPaidBoostBound;
    delete document.documentElement.dataset.vrExitBound;
    mountKidSimpleSendDom();
  });

  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = '';
    document.getElementById('vr-paid-getlink-nudge')?.remove();
    document.getElementById('vr-exit-rescue')?.remove();
    document.documentElement.removeAttribute('data-vr-has-link');
    document.documentElement.removeAttribute(POST_LINK_ATTR);
    document.documentElement.removeAttribute('data-vr-kid-simple');
    document.documentElement.removeAttribute('data-vr-visitor-slim');
    document.documentElement.removeAttribute('data-vr-paid-landing');
  });

  it('first-paint HTML is the 8:44 homepage: one Get my referral link, 7-day slot', () => {
    const html = readFileSync(resolve(ROOT, 'index.html'), 'utf8');
    const hero = html.slice(html.indexOf('id="hero-title"'), html.indexOf('id="funnel-journey"'));
    expect(hero).toContain('Win the homepage.');
    expect(hero).toContain('#1 puts their site on');
    expect(hero).toContain('this page.');
    expect(hero).toContain(
      'Tap Get my link. Send it. When a friend taps Get my link, you climb — and #1 owns this slot for 7 days.',
    );
    expect(hero).toContain('Get my referral link');
    expect(hero).toContain("This week's top racer gets a 7-day banner for their website.");
    expect(hero).toContain('id="hero-week-clock"');
    expect(hero).toContain('Your site here · 7 days');
    expect(hero).toContain('Empty right now. #1 this week puts their site here.');
    expect(hero).not.toContain('Example ad');
    expect(hero).not.toContain('ViralRefer Tools');
    expect(html).toContain('See how it works');
    expect(html).toContain('id="ref-link"');
    expect(html).toContain("You're racing.");
    expect(html).toContain("Send it now. A friend must tap Get my link — that's how you climb.");
    expect(html).not.toContain('id="post-link-status"');
    expect(html).not.toContain('Your link is ready');
    expect(html).not.toContain('Send to a friend now');
    expect(html).toContain("rdt('init','a2_ir6sjdbsj2n4')");
    const sendSrc = [
      readFileSync(resolve(ROOT, 'src/lib/post-link-share.ts'), 'utf8'),
      readFileSync(resolve(ROOT, 'src/lib/referred-race.ts'), 'utf8'),
    ].join('\n');
    expect(sendSrc).toContain("You're racing.");
    expect(sendSrc).toContain('Send it now');
    expect(sendSrc).not.toContain('Your link is ready');
    expect(sendSrc).not.toContain('Send to a friend now');
    expect(html).not.toContain('One tap to get your link');
    expect(html).not.toContain('Wait — free worldwide link');
    expect(html).not.toContain('LIVE WORLDWIDE');
  });

  it('CSS un-hides #referral-section after has-link / post-link', () => {
    const css = readFileSync(resolve(ROOT, 'src/style.css'), 'utf8');
    expect(css).toMatch(/html\[data-vr-has-link\] #referral-section/);
    expect(css).toMatch(/html\[data-vr-post-link-one\] #referral-section/);
    expect(css).not.toMatch(/html\[data-vr-post-link-one\] #post-link-status/);
    expect(css).toMatch(/html\[data-vr-kid-simple\]:not\(\[data-vr-kid-more\]\) #vr-funnel-ticker/);
  });

  it('showPostLinkReady paints You\'re racing / Send it now / Copy link and reveals the section', () => {
    showPostLinkReady(LINK);
    const section = document.getElementById('referral-section');
    expect(document.documentElement.getAttribute('data-vr-has-link')).toBe('1');
    expect(document.documentElement.getAttribute(POST_LINK_ATTR)).toBe('1');
    expect(section?.hidden).toBe(false);
    expect(section?.classList.contains('hidden')).toBe(false);
    expect(section?.style.display).not.toBe('none');
    expect(document.getElementById('post-link-heading')?.textContent).toBe(POST_LINK_HEADING_READY);
    expect(document.getElementById('post-link-heading')?.textContent).toBe("You're racing.");
    expect(document.getElementById('post-link-sub')?.textContent).toBe(
      "Send it now. A friend must tap Get my link — that's how you climb.",
    );
    expect(document.getElementById('post-link-primary')?.textContent).toBe(SEND_NOW_LABEL);
    expect(document.getElementById('post-link-primary')?.textContent).toBe('Send it now');
    expect(document.getElementById('post-link-copy')?.textContent).toBe('Copy link');
    expect(document.querySelectorAll('#post-link-share button:not([hidden])').length).toBe(2);
    expect(document.getElementById('referral-section')?.textContent).not.toContain('Your link is ready');
    expect(document.getElementById('referral-section')?.textContent).not.toContain('Send to a friend now');
    expect(document.getElementById('post-link-status')).toBeNull();
    expect(document.documentElement.hasAttribute('data-vr-post-link-status')).toBe(false);
  });

  it('getMyReferralLinkInstant reveals the send screen and survives slim/clarity refresh', async () => {
    initVisitorSlim();
    await getMyReferralLinkInstant();

    const section = document.getElementById('referral-section');
    const input = document.getElementById('ref-link') as HTMLInputElement;
    expect(input.value).toMatch(/\/r\/VIRAL-/i);
    expect(hasReferralLinkInUI()).toBe(true);
    expect(document.documentElement.getAttribute('data-vr-has-link')).toBe('1');
    expect(section?.hidden).toBe(false);
    expect(section?.style.display).not.toBe('none');
    expect(document.getElementById('post-link-heading')?.textContent).toBe("You're racing.");
    expect(document.getElementById('post-link-primary')?.textContent).toBe('Send it now');
    expect(document.getElementById('post-link-copy')?.textContent).toBe('Copy link');
    expect(document.getElementById('referral-section')?.textContent).not.toContain('Your link is ready');
    expect(document.getElementById('referral-section')?.textContent).not.toContain('Send to a friend now');
    expect(document.getElementById('post-link-status')).toBeNull();
    expect(document.documentElement.hasAttribute('data-vr-post-link-status')).toBe(false);

    refreshVisitorSlimState();
    refreshPublicClarityState();
    expect(document.documentElement.getAttribute('data-vr-has-link')).toBe('1');
    expect(document.getElementById('referral-section')?.hidden).toBe(false);
  });

  it('first send is not the live Waiting status view', async () => {
    writeShareDeadlineState({
      code: 'VIRAL-WAIT1',
      status: 'pending_share',
      createdAt: new Date().toISOString(),
      deadlineAt: new Date(Date.now() + 47 * 60 * 60 * 1000 + 5 * 60 * 1000).toISOString(),
    });
    initVisitorSlim();
    await getMyReferralLinkInstant();
    // Live Wa() then async-imports renderPostLinkStatus after ready.
    renderPostLinkStatus();

    expect(document.getElementById('post-link-heading')?.textContent).toBe("You're racing.");
    expect(document.getElementById('post-link-primary')?.textContent).toBe('Send it now');
    expect(document.getElementById('post-link-copy')?.textContent).toBe('Copy link');
    expect(document.getElementById('post-link-status')).toBeNull();
    expect(document.documentElement.hasAttribute('data-vr-post-link-status')).toBe(false);
    expect(document.getElementById('referral-section')?.textContent).not.toContain('Waiting');
    expect(document.getElementById('referral-section')?.textContent).not.toContain(
      '1 friend must tap Get my link',
    );
    expect(document.getElementById('referral-section')?.textContent).not.toContain('Your link is ready');
    expect(document.getElementById('referral-section')?.textContent).not.toContain('Send to a friend now');
  });

  it('reveal survives a missing #ref-link after a later slim refresh', () => {
    showPostLinkReady(LINK);
    document.getElementById('ref-link')?.remove();
    initVisitorSlim();
    refreshVisitorSlimState();
    refreshPublicClarityState();
    expect(hasReferralLinkInUI()).toBe(true);
    expect(document.documentElement.getAttribute('data-vr-has-link')).toBe('1');
    expect(document.getElementById('referral-section')?.hidden).toBe(false);
  });

  it('live 0d13b49 shape: no #ref-link at tap, fo() must create it so slim cannot strip has-link', async () => {
    document.body.innerHTML = `
      <button id="hero-get-link-btn"><span>Get my link</span></button>
      <div id="mobile-referral-cta" class="hidden"><span>Get my link</span></div>
      <div id="referral-section" hidden class="hidden" style="display:none">
        <div id="post-link-status" class="hidden" hidden data-state="hidden">
          <h2 id="post-link-status-title">You're in.</h2>
          <p id="post-link-status-line"></p>
        </div>
        <div id="post-link-share" class="hidden" hidden>
          <h2 id="post-link-heading">You're racing</h2>
          <p id="post-link-url"></p>
          <button type="button" id="post-link-primary"></button>
          <button type="button" id="post-link-copy">Copy link</button>
        </div>
      </div>
    `;
    expect(document.getElementById('ref-link')).toBeNull();
    document.documentElement.setAttribute('data-vr-kid-simple', '1');
    initVisitorSlim();
    await getMyReferralLinkInstant();

    const created = document.getElementById('ref-link') as HTMLInputElement | null;
    expect(created).not.toBeNull();
    expect(created?.value).toMatch(/\/r\/VIRAL-/i);
    expect(hasReferralLinkInUI()).toBe(true);
    expect(document.documentElement.getAttribute('data-vr-has-link')).toBe('1');
    expect(document.documentElement.getAttribute(POST_LINK_ATTR)).toBe('1');
    expect(document.getElementById('referral-section')?.hidden).toBe(false);
    expect(document.getElementById('referral-section')?.style.display).not.toBe('none');
    expect(document.getElementById('post-link-heading')?.textContent).toBe("You're racing.");
    expect(document.getElementById('post-link-primary')?.textContent).toBe('Send it now');
    expect(document.getElementById('post-link-copy')?.textContent).toBe('Copy link');
    expect(document.getElementById('referral-section')?.textContent).not.toContain('Your link is ready');
    expect(document.getElementById('referral-section')?.textContent).not.toContain('Send to a friend now');
    expect(document.getElementById('post-link-status')).toBeNull();

    refreshVisitorSlimState();
    refreshPublicClarityState();
    expect(document.getElementById('ref-link')).not.toBeNull();
    expect((document.getElementById('ref-link') as HTMLInputElement).value).toMatch(/\/r\/VIRAL-/i);
    expect(document.documentElement.getAttribute('data-vr-has-link')).toBe('1');
    expect(document.getElementById('referral-section')?.hidden).toBe(false);
  });

  it('paid Reddit landings do not spawn interstitial popups', () => {
    vi.useFakeTimers();
    vi.stubGlobal('location', {
      search: '?utm_source=reddit&utm_medium=paid&utm_campaign=get_my_link',
      pathname: '/',
    });
    captureUtmAttribution();
    expect(initPaidConversionBoost(location as Location, window)).toBe(true);
    initExitIntentRescue(window);
    vi.advanceTimersByTime(30_000);
    expect(document.getElementById('vr-paid-getlink-nudge')).toBeNull();
    expect(document.getElementById('vr-exit-rescue')).toBeNull();
    expect(document.getElementById('mobile-referral-cta')?.classList.contains('hidden')).toBe(true);
  });

  it('revealReferralSection dismisses leftover popups', () => {
    const nudge = document.createElement('div');
    nudge.id = 'vr-paid-getlink-nudge';
    document.body.appendChild(nudge);
    const exit = document.createElement('div');
    exit.id = 'vr-exit-rescue';
    document.body.appendChild(exit);
    revealReferralSection();
    expect(document.getElementById('vr-paid-getlink-nudge')).toBeNull();
    expect(document.getElementById('vr-exit-rescue')).toBeNull();
  });
});
