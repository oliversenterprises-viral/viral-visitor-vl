import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  applyViewportHeightVar,
  computeViewportHeight,
  initMobileOptimize,
  isCoarsePointer,
  isNarrowViewport,
} from '../../src/lib/mobile-optimize';

describe('mobile-optimize', () => {
  beforeEach(() => {
    document.documentElement.removeAttribute('data-vr-touch');
    document.documentElement.removeAttribute('data-vr-mobile');
    document.documentElement.style.removeProperty('--vr-vh');
    document.documentElement.style.removeProperty('--vr-vh-unit');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('computeViewportHeight prefers visualViewport', () => {
    vi.stubGlobal('window', {
      innerHeight: 800,
      visualViewport: { height: 650 },
    } as Window);
    expect(computeViewportHeight()).toBe(650);
  });

  it('computeViewportHeight falls back to innerHeight', () => {
    vi.stubGlobal('window', { innerHeight: 720 } as Window);
    expect(computeViewportHeight()).toBe(720);
  });

  it('applyViewportHeightVar sets CSS custom properties', () => {
    applyViewportHeightVar(812);
    expect(document.documentElement.style.getPropertyValue('--vr-vh')).toBe('812px');
    expect(document.documentElement.style.getPropertyValue('--vr-vh-unit')).toBe('8.12px');
  });

  it('isCoarsePointer reads matchMedia', () => {
    vi.stubGlobal('window', {
      matchMedia: () => ({ matches: true }),
    } as unknown as Window);
    expect(isCoarsePointer()).toBe(true);
  });

  it('isNarrowViewport detects mobile widths', () => {
    vi.stubGlobal('window', {
      matchMedia: (q: string) => ({ matches: q.includes('767') }),
    } as unknown as Window);
    expect(isNarrowViewport()).toBe(true);
  });

  it('initMobileOptimize sets touch and mobile attrs', () => {
    vi.stubGlobal('window', {
      innerHeight: 700,
      visualViewport: { height: 680, addEventListener: vi.fn() },
      matchMedia: (q: string) => ({
        matches: q.includes('coarse') || q.includes('767'),
      }),
      addEventListener: vi.fn(),
    } as unknown as Window);

    initMobileOptimize();
    expect(document.documentElement.getAttribute('data-vr-touch')).toBe('1');
    expect(document.documentElement.getAttribute('data-vr-mobile')).toBe('1');
    expect(document.documentElement.style.getPropertyValue('--vr-vh')).toBe('680px');
  });
});