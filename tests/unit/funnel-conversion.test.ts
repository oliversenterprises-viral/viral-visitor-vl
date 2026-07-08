import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  applyReferredLandingOverrides,
  funnelStepStates,
  initFunnelConversion,
  isReferredLanding,
  onReferralCredited,
  resolveLandingReferrerCode,
} from '../../src/lib/funnel-conversion';

describe('funnel-conversion helpers', () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.stubGlobal('location', { pathname: '/', search: '' });
  });

  afterEach(() => {
    document.body.innerHTML = '';
    document.documentElement.removeAttribute('data-vr-referred-landing');
    document.documentElement.removeAttribute('data-vr-credit-pending');
    document.documentElement.removeAttribute('data-vr-credit-status');
    vi.unstubAllGlobals();
  });

  it('isReferredLanding is true for /r/ path', () => {
    vi.stubGlobal('location', { pathname: '/r/VIRAL-TEST01', search: '' });
    expect(isReferredLanding()).toBe(true);
    expect(resolveLandingReferrerCode()).toBe('VIRAL-TEST01');
  });

  it('isReferredLanding is true for ?ref= query', () => {
    vi.stubGlobal('location', { pathname: '/', search: '?ref=VIRAL-QUERY' });
    expect(isReferredLanding()).toBe(true);
  });

  it('isReferredLanding is false on plain homepage', () => {
    expect(isReferredLanding()).toBe(false);
  });

  it('funnelStepStates marks step 2 active after link ready', () => {
    const states = funnelStepStates(2);
    expect(states[0]).toMatchObject({ step: 1, done: true, active: false });
    expect(states[1]).toMatchObject({ step: 2, done: false, active: true });
    expect(states[2]).toMatchObject({ step: 3, pending: true });
  });

  it('initFunnelConversion reveals credit gate for referred visitors', () => {
    document.body.innerHTML = `
      <p id="hero-title-line1"></p>
      <p id="hero-subtitle"></p>
      <div id="hero-badge"></div>
      <p id="hero-trust-line"></p>
      <p id="referrer-invite-headline"></p>
      <p id="referrer-invite-hint" class="hidden"></p>
      <span id="referrer-code-inline"></span>
      <div id="funnel-credit-gate" class="hidden">
        <p id="funnel-credit-gate-title"></p>
        <p id="funnel-credit-gate-desc"></p>
        <span id="funnel-gate-ref"></span>
      </div>
      <span data-funnel-step="1"></span>
      <span data-funnel-step="2"></span>
      <span data-funnel-step="3"></span>
    `;

    vi.stubGlobal('location', { pathname: '/r/VIRAL-GATE01', search: '' });
    initFunnelConversion();
    applyReferredLandingOverrides();

    expect(document.documentElement.getAttribute('data-vr-referred-landing')).toBe('1');
    expect(document.documentElement.getAttribute('data-vr-credit-pending')).toBe('1');
    expect(document.getElementById('funnel-credit-gate')?.classList.contains('hidden')).toBe(false);
    expect(document.getElementById('funnel-gate-ref')?.textContent).toBe('VIRAL-GATE01');
    expect(document.getElementById('hero-trust-line')?.textContent).toMatch(/does not credit/i);
  });

  it('onReferralCredited clears credit-pending and marks gate credited', () => {
    document.body.innerHTML = `
      <div id="funnel-credit-gate" class="hidden" data-status="required">
        <p id="funnel-credit-gate-title"></p>
        <p id="funnel-credit-gate-desc"></p>
      </div>
    `;
    document.documentElement.setAttribute('data-vr-credit-pending', '1');

    onReferralCredited();

    expect(document.documentElement.getAttribute('data-vr-credit-status')).toBe('credited');
    expect(document.documentElement.hasAttribute('data-vr-credit-pending')).toBe(false);
    expect(document.getElementById('funnel-credit-gate')?.dataset.status).toBe('credited');
  });
});