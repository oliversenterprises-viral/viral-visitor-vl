/**
 * Helix post-link P1: after Get my link the screen is a STATUS, not a toolkit.
 * Three states only — You're in / Waiting / Locked. No new buttons.
 */

import { t } from './i18n';
import { readShareDeadlineState } from './share-deadline';

export const POST_LINK_STATUS_ATTR = 'data-vr-post-link-status';

export type PostLinkStatus = 'in' | 'waiting' | 'locked';

const IDS = {
  root: 'post-link-status',
  title: 'post-link-status-title',
  line: 'post-link-status-line',
  clock: 'share-deadline-banner',
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
    return { title: t('post_link.status_waiting'), line: t('post_link.status_waiting_line') };
  }
  if (status === 'locked') {
    return { title: t('post_link.status_locked'), line: t('post_link.status_locked_line') };
  }
  return { title: t('post_link.status_in'), line: t('post_link.status_in_line') };
}

function setClockVisible(visible: boolean): void {
  const clock = el(IDS.clock);
  if (!clock) return;
  clock.classList.toggle('hidden', !visible);
  if (visible) clock.removeAttribute('hidden');
  else clock.setAttribute('hidden', '');
}

export function renderPostLinkStatus(): void {
  const root = el(IDS.root);
  if (!root) return;
  if (!hasLink()) {
    root.classList.add('hidden');
    root.hidden = true;
    root.dataset.state = 'hidden';
    document.documentElement.removeAttribute(POST_LINK_STATUS_ATTR);
    setClockVisible(false);
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
}

export function initPostLinkStatus(): void {
  renderPostLinkStatus();
  if (typeof window === 'undefined') return;
  window.addEventListener('vr:locale-change', () => {
    renderPostLinkStatus();
  });
}
