import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  enterSendMode,
  exitSendMode,
  isSendModeActive,
  polishShareFirstForSendMode,
  activateSendModeAfterGetLink,
  showStickySendBar,
  hideStickySendBar,
} from '../../src/lib/send-mode';
import {
  clearShareFirstFlags,
  markSharePending,
  renderShareFirstStrip,
} from '../../src/lib/share-first-ui';
import { clearShareDeadlineState } from '../../src/lib/share-deadline';

function mountShareFirstDom() {
  document.body.innerHTML = `
    <input id="ref-link" value="https://viralrefer.app/r/VIRAL-TEST1" />
    <button id="hero-get-link-btn"><span>Get my referral link</span></button>
    <p id="referral-next-step" class="hidden"></p>
    <button id="share-more-options-btn">More platforms & tools</button>
    <button id="kid-more-tools-btn">Show extra tools</button>
    <div id="post-link-share" class="hidden" hidden>
      <h2 id="post-link-heading"></h2>
      <p id="post-link-url" tabindex="0"></p>
      <button type="button" id="post-link-primary"></button>
      <button type="button" id="post-link-copy">Copy link</button>
      <p id="post-link-helper"></p>
      <p id="post-link-whisper" class="hidden" hidden></p>
    </div>
    <div id="share-first-strip" class="hidden share-first-strip">
      <div class="flex items-start justify-between gap-2 mb-2">
        <div class="min-w-0">
          <p data-i18n="share_first.heading">Send your link</p>
          <p id="share-first-status" data-status="pending" data-i18n="share_first.status_pending">
            Pending
          </p>
          <p data-i18n="share_first.sub">Sub</p>
        </div>
      </div>
      <div class="flex flex-col gap-2 mt-3">
        <button id="native-share-btn" type="button" class="share-first-primary-btn hidden">
          <span data-i18n="share_first.cta_native">Share now</span>
        </button>
        <div class="grid grid-cols-2 gap-2">
          <button id="share-first-sms" type="button" class="share-first-alt-btn"><span>SMS</span></button>
          <button id="share-first-whatsapp" type="button" class="share-first-alt-btn"><span>WhatsApp</span></button>
        </div>
        <button type="button" class="share-first-copy-only">Copy only</button>
      </div>
    </div>
  `;
  document.documentElement.setAttribute('data-vr-has-link', '1');
}

describe('send-mode (post–get-link bulletproof)', () => {
  beforeEach(() => {
    localStorage.clear();
    clearShareFirstFlags();
    clearShareDeadlineState();
    document.documentElement.removeAttribute('data-vr-send-mode');
    document.documentElement.removeAttribute('data-vr-send-more');
    document.documentElement.removeAttribute('data-vr-has-link');
    document.documentElement.removeAttribute('data-vr-visitor-slim');
    document.documentElement.removeAttribute('data-vr-post-link-one');
    document.body.className = '';
    document.body.innerHTML = '';
    document.getElementById('mobile-send-cta')?.remove();
  });

  afterEach(() => {
    exitSendMode();
    clearShareFirstFlags();
    clearShareDeadlineState();
    vi.restoreAllMocks();
  });

  it('enterSendMode sets attr + pending + slim; exit clears sticky', () => {
    enterSendMode();
    expect(isSendModeActive()).toBe(true);
    expect(document.documentElement.getAttribute('data-vr-send-mode')).toBe('1');
    expect(document.documentElement.getAttribute('data-vr-share-pending')).toBe('1');
    expect(document.documentElement.getAttribute('data-vr-visitor-slim')).toBe('1');

    showStickySendBar();
    expect(document.getElementById('mobile-send-cta')).toBeTruthy();
    expect(document.body.classList.contains('has-mobile-send-cta')).toBe(true);

    exitSendMode();
    expect(isSendModeActive()).toBe(false);
    expect(document.documentElement.hasAttribute('data-vr-send-mode')).toBe(false);
    expect(document.getElementById('mobile-send-cta')?.classList.contains('hidden')).toBe(true);
  });

  it('polish with native: no SMS, no More door, pack stays out', () => {
    mountShareFirstDom();
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: vi.fn(),
    });
    Object.defineProperty(navigator, 'canShare', {
      configurable: true,
      value: () => true,
    });
    const native = document.getElementById('native-share-btn') as HTMLButtonElement;
    native.classList.remove('hidden');
    document.getElementById('share-first-strip')?.classList.remove('hidden');
    markSharePending();
    enterSendMode();
    polishShareFirstForSendMode();

    const strip = document.getElementById('share-first-strip')!;
    expect(strip.classList.contains('share-first-strip--send-mode')).toBe(true);

    const grid = strip.querySelector('.grid.grid-cols-2') as HTMLElement;
    const copy = strip.querySelector('.share-first-copy-only') as HTMLElement;
    expect(grid.classList.contains('hidden')).toBe(true);
    expect(copy.classList.contains('hidden')).toBe(true);
    expect(document.getElementById('share-first-sms')?.classList.contains('hidden')).toBe(true);
    expect(document.getElementById('share-more-options-btn')?.classList.contains('hidden')).toBe(true);
    expect(document.getElementById('send-mode-more-btn')).toBeFalsy();
  });

  it('activateSendModeAfterGetLink: Lumina screen, no More, no sticky', () => {
    mountShareFirstDom();
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: vi.fn(),
    });
    Object.defineProperty(navigator, 'canShare', {
      configurable: true,
      value: () => true,
    });

    activateSendModeAfterGetLink({ autoCopied: true });

    expect(isSendModeActive()).toBe(false);
    expect(document.documentElement.getAttribute('data-vr-post-link-one')).toBe('1');
    expect(document.querySelector('#hero-get-link-btn span')?.textContent).not.toMatch(/Send to a friend/);
    expect(document.getElementById('send-mode-more-btn')).toBeFalsy();
    expect(document.getElementById('share-first-strip')?.classList.contains('hidden')).toBe(true);
    expect(document.getElementById('share-more-options-btn')?.classList.contains('hidden')).toBe(true);
    expect(document.getElementById('kid-more-tools-btn')?.classList.contains('hidden')).toBe(true);
    expect(document.getElementById('post-link-heading')?.textContent).toBe('Your link is ready');
    const primary = document.getElementById('post-link-primary');
    expect(primary?.textContent).toBe('Send to a friend now');
    expect(document.getElementById('post-link-copy')?.textContent).toBe('Copy link');
    expect(document.body.classList.contains('has-mobile-send-cta')).toBe(false);
  });

  it('renderShareFirstStrip never unhides More or SMS', () => {
    mountShareFirstDom();
    markSharePending();
    renderShareFirstStrip();
    expect(document.getElementById('share-more-options-btn')?.classList.contains('hidden')).toBe(true);
    expect(document.getElementById('share-first-sms')?.classList.contains('hidden')).toBe(true);
    expect(document.getElementById('kid-more-tools-btn')?.classList.contains('hidden')).toBe(true);
  });

  it('hideStickySendBar removes body class', () => {
    mountShareFirstDom();
    showStickySendBar();
    expect(document.body.classList.contains('has-mobile-send-cta')).toBe(true);
    hideStickySendBar();
    expect(document.body.classList.contains('has-mobile-send-cta')).toBe(false);
  });
});
