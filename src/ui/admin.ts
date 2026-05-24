/**
 * Admin UI helpers
 *
 * Small reusable utilities for the admin dashboard (currently just the active tab indicator).
 */

export function setActiveTab(tab: number) {
  document.querySelectorAll<HTMLElement>('.admin-tab').forEach((el, index) => {
    if (index === tab) {
      el.classList.add('border-b-2', 'border-violet-500', 'text-violet-400');
      el.classList.remove('text-zinc-400');
    } else {
      el.classList.remove('border-b-2', 'border-violet-500', 'text-violet-400');
      el.classList.add('text-zinc-400');
    }
  });
}
