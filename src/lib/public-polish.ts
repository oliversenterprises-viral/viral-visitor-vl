/**
 * Public polish — skeleton loaders, stagger reveals, nav elevation, a11y hooks.
 * Analytics-neutral; does not touch referral recording or funnel logic.
 */

export const COMMUNITY_NEAR_UNLOCK_PCT = 75;
export const COMMUNITY_HALF_UNLOCK_PCT = 50;

/** Status line under the community meter fill bar. */
export function communityUnlockStatusText(current: number, goal: number): string {
  if (goal < 1) return 'Hit the weekly goal together — everyone wins momentum.';
  if (current >= goal) return 'Community goal unlocked — keep the momentum!';
  const remaining = goal - current;
  const pct = Math.min(100, Math.round((current / goal) * 100));
  const remLabel = `${remaining.toLocaleString()} more referral${remaining === 1 ? '' : 's'}`;
  if (pct >= COMMUNITY_NEAR_UNLOCK_PCT) {
    return `Almost there — ${remLabel} to unlock this week!`;
  }
  if (pct >= COMMUNITY_HALF_UNLOCK_PCT) {
    return `Halfway there — ${remLabel} to unlock this week`;
  }
  return `${remaining.toLocaleString()} more to unlock this week`;
}

/** Percent label; adds urgency cue when near goal. */
export function communityUnlockPctLabel(current: number, goal: number): string {
  const pct = goal < 1 ? 0 : Math.min(100, Math.round((current / goal) * 100));
  if (current >= goal) return '100%';
  if (pct >= COMMUNITY_NEAR_UNLOCK_PCT) return `${pct}% · almost there`;
  return `${pct}%`;
}

function skeletonRow(widthClass = 'w-32'): string {
  return `<div class="public-skeleton-row flex justify-between items-center px-5 py-3 rounded-2xl border border-white/5 bg-zinc-900/40">
    <div class="flex items-center gap-3 flex-1 min-w-0">
      <div class="skeleton w-8 h-8 rounded-full shrink-0"></div>
      <div class="skeleton h-4 ${widthClass} rounded-lg max-w-[60%]"></div>
    </div>
    <div class="skeleton h-4 w-14 rounded-lg shrink-0"></div>
  </div>`;
}

/** Shimmer placeholder while the main leaderboard loads. */
export function leaderboardSkeletonHtml(rows = 5): string {
  const items = Array.from({ length: rows }, (_, i) =>
    skeletonRow(i === 0 ? 'w-40' : 'w-28'),
  ).join('');
  return `<div class="public-skeleton-stack space-y-2" aria-hidden="true">${items}</div>`;
}

/** Shimmer placeholder for the weekly sprint board. */
export function sprintSkeletonHtml(rows = 4): string {
  const items = Array.from({ length: rows }, () =>
    `<div class="public-skeleton-row flex justify-between items-center px-4 py-2.5 rounded-xl border border-white/5 bg-zinc-900/40">
      <div class="flex items-center gap-2.5 flex-1">
        <div class="skeleton w-6 h-6 rounded-full shrink-0"></div>
        <div class="skeleton h-3.5 w-24 rounded-lg"></div>
      </div>
      <div class="skeleton h-3.5 w-10 rounded-lg shrink-0"></div>
    </div>`,
  ).join('');
  return `<div class="public-skeleton-stack space-y-2" aria-hidden="true">${items}</div>`;
}

/** Shimmer placeholder for recent activity feed. */
export function activitySkeletonHtml(rows = 4): string {
  const items = Array.from({ length: rows }, () =>
    `<div class="public-skeleton-row flex justify-between items-center px-4 py-2.5 rounded-2xl border border-white/5 bg-zinc-900/40">
      <div class="skeleton h-3.5 w-48 rounded-lg max-w-[70%]"></div>
      <div class="skeleton h-3 w-12 rounded-lg shrink-0"></div>
    </div>`,
  ).join('');
  return `<div class="public-skeleton-stack space-y-3" aria-hidden="true">${items}</div>`;
}

/** Shimmer placeholder for the stats grid. */
export function statsSkeletonHtml(): string {
  const card = `<div class="rounded-2xl border border-white/5 bg-zinc-900/40 p-4 text-center space-y-2">
    <div class="skeleton h-3 w-20 rounded mx-auto"></div>
    <div class="skeleton h-10 w-16 rounded mx-auto"></div>
    <div class="skeleton h-3 w-28 rounded mx-auto"></div>
  </div>`;
  return `<div class="public-skeleton-stack grid grid-cols-1 sm:grid-cols-3 gap-4" aria-hidden="true">${card}${card}${card}</div>`;
}

export function prefersReducedMotion(): boolean {
  return document.documentElement.hasAttribute('data-vr-reduced-motion');
}

/** Staggered fade-in for freshly rendered rows (no-op when reduced motion). */
export function staggerReveal(root: ParentNode | null, selector: string): void {
  if (!root || prefersReducedMotion()) return;
  root.querySelectorAll(selector).forEach((el, i) => {
    el.classList.add('vr-reveal-row');
    (el as HTMLElement).style.setProperty('--vr-stagger', String(i));
  });
}

function wireNavScrollElevate(): void {
  const nav = document.getElementById('vr-nav');
  if (!nav || nav.dataset.vrPolishScroll === '1') return;
  nav.dataset.vrPolishScroll = '1';

  const onScroll = () => {
    nav.classList.toggle('vr-nav--scrolled', window.scrollY > 8);
  };
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });
}

const SMOOTH_ANCHORS = ['#how', '#prize', '#leaderboard'] as const;

function wireSmoothAnchors(): void {
  if (document.documentElement.dataset.vrSmoothAnchors === '1') return;
  document.documentElement.dataset.vrSmoothAnchors = '1';

  document.addEventListener('click', (e) => {
    const anchor = (e.target as Element | null)?.closest?.('a[href^="#"]') as HTMLAnchorElement | null;
    if (!anchor) return;
    const href = anchor.getAttribute('href');
    if (!href || !SMOOTH_ANCHORS.includes(href as (typeof SMOOTH_ANCHORS)[number])) return;
    const target = document.querySelector(href);
    if (!target) return;
    e.preventDefault();
    target.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });
    history.replaceState(null, '', href);
  });
}

function detectReducedMotion(): void {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    document.documentElement.setAttribute('data-vr-reduced-motion', '1');
  }
}

/** Seed skeletons for empty public sections before async data arrives. */
export function seedPublicLoadingSkeletons(): void {
  const lb = document.getElementById('leaderboard-container');
  if (lb && (lb.querySelector('[data-vr-loading]') || !lb.querySelector('.leaderboard-row, .public-skeleton-stack'))) {
    lb.innerHTML = leaderboardSkeletonHtml();
  }

  const act = document.getElementById('recent-activity');
  if (act && !act.querySelector('.activity-row, .public-skeleton-stack')) {
    act.innerHTML = activitySkeletonHtml();
  }

  const stats = document.getElementById('stats-content');
  if (stats && !stats.querySelector('.public-skeleton-stack, .grid')) {
    stats.innerHTML = statsSkeletonHtml();
  }

  const sprint = document.getElementById('weekly-sprint-container');
  if (sprint && !sprint.querySelector('.weekly-sprint-row, .public-skeleton-stack')) {
    sprint.innerHTML = sprintSkeletonHtml();
  }
}

/** Brief success flash on copy button (class only; copy logic stays in referral.ts). */
export function flashCopySuccess(btn: HTMLElement | null): void {
  if (!btn) return;
  btn.classList.add('copy-btn--success');
  window.setTimeout(() => btn.classList.remove('copy-btn--success'), 1400);
}

/** Bootstrap public polish (idempotent). */
export function initPublicPolish(): void {
  detectReducedMotion();
  seedPublicLoadingSkeletons();
  wireNavScrollElevate();
  wireSmoothAnchors();
}