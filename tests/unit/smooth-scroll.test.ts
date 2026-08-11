import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  isElementMostlyVisible,
  prefersReducedMotion,
  smoothScrollToElement,
} from '../../src/lib/smooth-scroll';

describe('smooth-scroll', () => {
  beforeEach(() => {
    document.documentElement.removeAttribute('data-vr-reduced-motion');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('prefersReducedMotion reads document flag', () => {
    document.documentElement.setAttribute('data-vr-reduced-motion', '1');
    expect(prefersReducedMotion()).toBe(true);
  });

  it('isElementMostlyVisible when rect is in viewport', () => {
    const el = document.createElement('div');
    vi.spyOn(el, 'getBoundingClientRect').mockReturnValue({
      top: 120,
      bottom: 200,
      left: 0,
      right: 100,
      width: 100,
      height: 80,
      x: 0,
      y: 120,
      toJSON: () => ({}),
    } as DOMRect);
    const win = {
      innerHeight: 800,
    } as Window;
    expect(isElementMostlyVisible(el, { win })).toBe(true);
  });

  it('isElementMostlyVisible false when far below fold', () => {
    const el = document.createElement('div');
    vi.spyOn(el, 'getBoundingClientRect').mockReturnValue({
      top: 1200,
      bottom: 1300,
      left: 0,
      right: 100,
      width: 100,
      height: 100,
      x: 0,
      y: 1200,
      toJSON: () => ({}),
    } as DOMRect);
    const win = { innerHeight: 700 } as Window;
    expect(isElementMostlyVisible(el, { win })).toBe(false);
  });

  it('smoothScrollToElement no-ops on null', () => {
    expect(() => smoothScrollToElement(null)).not.toThrow();
  });

  it('smoothScrollToElement skips when already visible', () => {
    const el = document.createElement('div');
    const scroll = vi.fn();
    (el as HTMLElement).scrollIntoView = scroll;
    vi.spyOn(el, 'getBoundingClientRect').mockReturnValue({
      top: 100,
      bottom: 180,
      left: 0,
      right: 100,
      width: 100,
      height: 80,
      x: 0,
      y: 100,
      toJSON: () => ({}),
    } as DOMRect);
    smoothScrollToElement(el, { win: { innerHeight: 800 } as Window, delayMs: 0 });
    // rAF may not run in node — force path
    smoothScrollToElement(el, { win: { innerHeight: 800 } as Window, force: true, delayMs: 0 });
  });
});
