/**
 * Helix post-link P1: after Get my link the screen is a STATUS, not a toolkit.
 * Three states only — You're in / Waiting / Locked. No new buttons.
 */

import { msUntilDeadline, readShareDeadlineState } from './share-deadline';
export const POST_LINK_STATUS_ATTR = 'data-vr-post-link-status';

export type PostLinkStatus = 'in' | 'waiting' | 'locked';

export const POST_LINK_COPY = {
  inLabel: "You're in.",
  inSub: 'Send this. A friend must tap Get my link.',
  waitingLabel: 'Waiting',
  waitingSub: '1 friend must tap Get my link',
  lockedLabel: 'Locked',
  lockedSub: "A friend tapped Get my link. You're on the board.",
  timeUp: "Time's up",
} as const;

export const POST_LINK_COPY_TOAST =
  'Link copied. A friend still has to tap Get my link.';

const IDS = {
  root: 'post-link-status',
  title: 'post-link-status-title',
  line: 'post-link-status-line',
  clock: 'share-deadline-banner',
  countdown: 'share-deadline-countdown',
  copy: 'post-link-copy',
} as const;

function el<T extends HTMLElement>(id: string): T | null {
  return document.getElementById(id) as T | null;
}

function hasLink(): boolean {
  if (document.documentElement.hasAttribute('data-vr-has-link')) return true;
  if (document.documentElement.hasAttribute('data-vr-post-link-one')) return true;
  const input = document.getElementById('ref-link') as HTMLInputElement | null;
  return !!input?.value?.trim();
}

export function formatPostLinkClock(ms: number): string {
  if (ms <= 0) return POST_LINK_COPY.timeUp;
  const totalMin = Math.floor(ms / 60_000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return `${h}h ${m}m`;
}

export function resolvePostLinkStatus(): PostLinkStatus {
  if (typeof document !== 'undefined' && document.documentElement.hasAttribute('data-vr-share-locked')) {
    return 'locked';
  }
  const state = readShareDeadlineState();
  if (state?.status === 'active') return 'locked';
  if (state) return 'waiting';
  return 'in';
}

function copyFor(status: PostLinkStatus): { title: string; line: string } {
  if (status === 'waiting') {
    return { title: POST_LINK_COPY.waitingLabel, line: POST_LINK_COPY.waitingSub };
  }
  if (status === 'locked') {
    return { title: POST_LINK_COPY.lockedLabel, line: POST_LINK_COPY.lockedSub };
  }
  return { title: POST_LINK_COPY.inLabel, line: POST_LINK_COPY.inSub };
}

function setClockVisible(visible: boolean): void {
  const clock = el(IDS.clock);
  if (!clock) return;
  clock.classList.toggle('hidden', !visible);
  if (visible) clock.removeAttribute('hidden');
  else clock.setAttribute('hidden', '');
}

function paintCountdown(): void {
  const countdown = el(IDS.countdown);
  if (!countdown) return;
  const state = readShareDeadlineState();
  countdown.textContent = state ? formatPostLinkClock(msUntilDeadline(state)) : '';
}

export function hidePostLinkStatus(): void {
  // First send is You're racing. Do not CSS-hide leftover You're in. — unmount it.
  el(IDS.root)?.remove();
  document.documentElement.removeAttribute(POST_LINK_STATUS_ATTR);
}

export function renderPostLinkStatus(): void {
  const root = el(IDS.root);
  if (!root) return;
  // First send: do not render #post-link-status / You're in. at all.
  if (document.documentElement.hasAttribute('data-vr-post-link-one')) {
    hidePostLinkStatus();
    return;
  }
  if (!hasLink()) {
    hidePostLinkStatus();
    return;
  }
  const status = resolvePostLinkStatus();
  const copy = copyFor(status);
  const title = el(IDS.title);
  const line = el(IDS.line);
  if (title) title.textContent = copy.title;
  if (line) line.textContent = copy.line;
  root.classList.remove('hidden');
  root.hidden = false;
  root.dataset.state = status;
  document.documentElement.setAttribute(POST_LINK_STATUS_ATTR, status);
  setClockVisible(status === 'waiting');
  if (status === 'waiting') paintCountdown();
  document.getElementById('post-link-primary')?.classList.toggle(
    'post-link-share__primary--quiet',
    status === 'locked',
  );
}

function observeLinkFlags(): void {
  if (typeof MutationObserver === 'undefined') return;
  const root = document.documentElement;
  if (root.dataset.vrPostLinkStatusObserved === '1') return;
  root.dataset.vrPostLinkStatusObserved = '1';
  new MutationObserver(() => {
    renderPostLinkStatus();
  }).observe(root, {
    attributes: true,
    attributeFilter: ['data-vr-has-link', 'data-vr-post-link-one', 'data-vr-share-locked'],
  });
}

export function initPostLinkStatus(): void {
  observeLinkFlags();
  renderPostLinkStatus();
  if (typeof window === 'undefined') return;
  window.addEventListener('vr:locale-change', () => {
    renderPostLinkStatus();
  });
}
