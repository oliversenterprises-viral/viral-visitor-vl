import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { initOptimizerFlagsFromContent, setOptimizerFlags } from '../../src/lib/optimizer-flags';
import {
  applyVisitorSlimFromFlags,
  getVisitorSlimSegment,
  hasReferralLinkInUI,
  initVisitorSlim,
  isVisitorSlimEnabled,
  refreshVisitorSlimState,
} from '../../src/lib/visitor-slim';

describe('visitor-slim', () => {
  beforeEach(() => {
    localStorage.clear();
    initOptimizerFlagsFromContent({});
    document.body.innerHTML = `
      <input id="ref-link" readonly value="" />
      <button id="share-more-options-btn" class="hidden"></button>
      <button data-vr-slim-share-extra></button>
      <button data-vr-slim-share-extra></button>
    `;
    document.documentElement.removeAttribute('data-vr-visitor-slim');
    document.documentElement.removeAttribute('data-vr-slim-segment');
    document.documentElement.removeAttribute('data-vr-has-link');
    document.documentElement.removeAttribute('data-vr-slim-share-expanded');
    vi.stubGlobal('location', { pathname: '/', search: '' });
  });

  afterEach(() => {
    document.body.innerHTML = '';
    document.documentElement.removeAttribute('data-vr-visitor-slim');
    document.documentElement.removeAttribute('data-vr-slim-segment');
    document.documentElement.removeAttribute('data-vr-has-link');
    document.documentElement.removeAttribute('data-vr-slim-share-expanded');
    vi.unstubAllGlobals();
  });

  it('is enabled by default unless visitor_slim is false', () => {
    expect(isVisitorSlimEnabled()).toBe(true);
    setOptimizerFlags({ visitor_slim: false });
    expect(isVisitorSlimEnabled()).toBe(false);
  });

  it('detects referred vs direct segment', () => {
    expect(getVisitorSlimSegment()).toBe('direct');
    vi.stubGlobal('location', { pathname: '/r/VIRAL-ABC', search: '' });
    expect(getVisitorSlimSegment()).toBe('referred');
  });

  it('initVisitorSlim sets html attrs and reveals more-share button', () => {
    initVisitorSlim();
    expect(document.documentElement.getAttribute('data-vr-visitor-slim')).toBe('1');
    expect(document.documentElement.getAttribute('data-vr-slim-segment')).toBe('direct');
    const btn = document.getElementById('share-more-options-btn');
    expect(btn?.classList.contains('hidden')).toBe(false);
  });

  it('does not enable slim when flag is false', () => {
    setOptimizerFlags({ visitor_slim: false });
    initVisitorSlim();
    expect(document.documentElement.hasAttribute('data-vr-visitor-slim')).toBe(false);
  });

  it('refreshVisitorSlimState sets data-vr-has-link when ref-link has value', () => {
    initVisitorSlim();
    const input = document.getElementById('ref-link') as HTMLInputElement;
    input.value = 'https://viralrefer.app/r/VIRAL-TEST';
    refreshVisitorSlimState();
    expect(document.documentElement.getAttribute('data-vr-has-link')).toBe('1');
    expect(hasReferralLinkInUI()).toBe(true);
  });

  it('more-share toggle expands and collapses extras', () => {
    initVisitorSlim();
    const btn = document.getElementById('share-more-options-btn') as HTMLButtonElement;
    expect(btn.textContent || '').toMatch(/More platforms/i);
    btn.click();
    expect(document.documentElement.hasAttribute('data-vr-slim-share-expanded')).toBe(true);
    expect(btn.getAttribute('aria-expanded')).toBe('true');
    expect(btn.textContent || '').toMatch(/Fewer/i);
    btn.click();
    expect(document.documentElement.hasAttribute('data-vr-slim-share-expanded')).toBe(false);
    expect(btn.textContent || '').toMatch(/More platforms/i);
  });

  it('applyVisitorSlimFromFlags re-enables after flag cleared', () => {
    setOptimizerFlags({ visitor_slim: false });
    applyVisitorSlimFromFlags();
    expect(document.documentElement.hasAttribute('data-vr-visitor-slim')).toBe(false);

    setOptimizerFlags({ visitor_slim: true });
    applyVisitorSlimFromFlags();
    expect(document.documentElement.getAttribute('data-vr-visitor-slim')).toBe('1');
  });
});