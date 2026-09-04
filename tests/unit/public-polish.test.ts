import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import {
  COMMUNITY_NEAR_UNLOCK_PCT,
  activitySkeletonHtml,
  communityUnlockPctLabel,
  communityUnlockStatusText,
  initPublicPolish,
  leaderboardSkeletonHtml,
  statsSkeletonHtml,
} from '../../src/lib/public-polish';

describe('public-polish', () => {
  it('communityUnlockStatusText escalates copy near goal', () => {
    expect(communityUnlockStatusText(0, 100)).toContain('100 more');
    expect(communityUnlockStatusText(60, 100)).toContain('Halfway there');
    expect(communityUnlockStatusText(80, 100)).toContain('Almost there');
    expect(communityUnlockStatusText(100, 100)).toContain('unlocked');
  });

  it('communityUnlockPctLabel adds urgency near threshold', () => {
    expect(communityUnlockPctLabel(10, 100)).toBe('10%');
    expect(communityUnlockPctLabel(80, 100)).toBe('80% · almost there');
    expect(communityUnlockPctLabel(100, 100)).toBe('100%');
  });

  it('COMMUNITY_NEAR_UNLOCK_PCT is 75', () => {
    expect(COMMUNITY_NEAR_UNLOCK_PCT).toBe(75);
  });

  it('skeleton helpers emit shimmer markup', () => {
    expect(leaderboardSkeletonHtml()).toContain('public-skeleton-stack');
    expect(leaderboardSkeletonHtml()).toContain('skeleton');
    expect(activitySkeletonHtml(2)).toContain('public-skeleton-stack');
    expect(statsSkeletonHtml()).toContain('grid');
  });
});

describe('public-polish How/Board anchors', () => {
  beforeEach(() => {
    document.documentElement.removeAttribute('data-vr-funnel-expanded');
    document.documentElement.removeAttribute('data-vr-smooth-anchors');
    document.body.innerHTML = `
      <a href="#how">How</a>
      <button id="funnel-expand-btn">See how it works</button>
      <div id="how"></div>
      <div id="leaderboard"></div>
    `;
  });

  afterEach(() => {
    document.documentElement.removeAttribute('data-vr-funnel-expanded');
    document.documentElement.removeAttribute('data-vr-smooth-anchors');
    document.body.innerHTML = '';
  });

  it('clicking How expands below-fold so the section is visible', () => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
    });
    const how = document.getElementById('how') as HTMLElement;
    how.scrollIntoView = () => {};
    initPublicPolish();
    document.querySelector('a[href="#how"]')?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    expect(document.documentElement.getAttribute('data-vr-funnel-expanded')).toBe('1');
    expect(document.getElementById('funnel-expand-btn')?.classList.contains('hidden')).toBe(true);
  });
});