/**
 * Admin UI helpers
 *
 * Reusable utilities for the admin dashboard: active tab indicator,
 * pending-claims badge, and accessibility state.
 */

export function setActiveTab(tab: number) {
  document.querySelectorAll<HTMLElement>('.admin-tab').forEach((el, index) => {
    const isActive = index === tab;
    el.setAttribute('aria-selected', isActive ? 'true' : 'false');
    el.setAttribute('tabindex', isActive ? '0' : '-1');

    if (isActive) {
      el.classList.add('border-b-2', 'border-violet-500', 'text-violet-400');
      el.classList.remove('text-zinc-400');
    } else {
      el.classList.remove('border-b-2', 'border-violet-500', 'text-violet-400');
      el.classList.add('text-zinc-400');
    }
  });
}

/** Updates the Prize Claims tab badge and optional header banner. */
export function updatePendingClaimsBadge(count: number) {
  const badge = document.getElementById('tab-3-badge');
  if (badge) {
    if (count > 0) {
      badge.textContent = String(count);
      badge.classList.remove('hidden');
    } else {
      badge.classList.add('hidden');
    }
  }

  const banner = document.getElementById('admin-pending-banner');
  const countEl = document.getElementById('admin-pending-count');
  if (banner && countEl) {
    if (count > 0) {
      countEl.textContent = String(count);
      banner.classList.remove('hidden');
    } else {
      banner.classList.add('hidden');
    }
  }
}