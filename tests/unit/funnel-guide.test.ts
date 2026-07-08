import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { setFunnelStep } from '../../src/lib/funnel-conversion';
import { initFunnelGuide, onFunnelShareComplete, syncFunnelGuide } from '../../src/lib/funnel-guide';

function funnelGuideFixture(): void {
  document.body.innerHTML = `
    <div id="referral-attribution" class="hidden"></div>
    <button id="hero-get-link-btn"></button>
    <button id="attribution-get-link-btn"></button>
    <button id="copy-link-btn"></button>
    <button id="share-whatsapp-primary"></button>
    <div id="funnel-steps">
      <span data-funnel-step="1" class="funnel-step funnel-step-active"></span>
      <span class="funnel-step-arrow" data-funnel-arrow="1"></span>
      <span data-funnel-step="2" class="funnel-step funnel-step-pending"></span>
      <span class="funnel-step-arrow" data-funnel-arrow="2"></span>
      <span data-funnel-step="3" class="funnel-step funnel-step-pending"></span>
    </div>
    <div id="funnel-guide-coach" class="hidden">
      <span class="funnel-guide-coach-icon"><i></i></span>
      <span id="funnel-guide-coach-text"></span>
    </div>
  `;
}

describe('funnel-guide DOM sync', () => {
  beforeEach(() => {
    funnelGuideFixture();
    document.documentElement.removeAttribute('data-vr-funnel-complete');
    document.documentElement.removeAttribute('data-vr-funnel-guide-step');
  });

  afterEach(() => {
    document.body.innerHTML = '';
    document.documentElement.removeAttribute('data-vr-funnel-guide-step');
    document.documentElement.removeAttribute('data-vr-funnel-complete');
  });

  it('syncFunnelGuide highlights step-2 target and coach', () => {
    syncFunnelGuide(2);
    expect(document.documentElement.getAttribute('data-vr-funnel-guide-step')).toBe('2');
    expect(document.getElementById('funnel-guide-coach')?.classList.contains('hidden')).toBe(false);
    expect(document.getElementById('funnel-guide-coach-text')?.textContent).toMatch(/COPY/i);
    expect(document.getElementById('copy-link-btn')?.classList.contains('funnel-guide-target-ring')).toBe(
      true,
    );
    expect(document.querySelector('[data-funnel-arrow="1"]')?.classList.contains('funnel-step-arrow--done')).toBe(
      true,
    );
    expect(document.querySelector('[data-funnel-arrow="2"]')?.classList.contains('funnel-step-arrow--flow')).toBe(
      true,
    );
  });

  it('setFunnelStep wires guide through funnel-conversion', () => {
    setFunnelStep(3);
    expect(document.documentElement.getAttribute('data-vr-funnel-guide-step')).toBe('3');
    expect(document.getElementById('share-whatsapp-primary')?.classList.contains('funnel-guide-target-ring')).toBe(
      true,
    );
  });

  it('onFunnelShareComplete marks funnel complete', () => {
    syncFunnelGuide(3);
    onFunnelShareComplete();
    expect(document.documentElement.getAttribute('data-vr-funnel-complete')).toBe('1');
    expect(document.querySelector('[data-funnel-step="3"]')?.classList.contains('funnel-step-done')).toBe(true);
  });

  it('initFunnelGuide is idempotent', () => {
    initFunnelGuide();
    initFunnelGuide();
    expect(document.getElementById('funnel-guide-coach')).toBeTruthy();
  });
});