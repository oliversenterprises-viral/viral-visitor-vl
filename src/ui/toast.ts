/**
 * Lightweight Toast System
 *
 * Self-registering toast notifications used across the admin panel and public site.
 */

import { ViralRefer, registerGlobal } from '../lib/global';

let toastContainer: HTMLElement | null = null;

export function showToast(message: string, type: 'success' | 'info' = 'success') {
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.id = 'toast-container';
    document.body.appendChild(toastContainer);
  }

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <span>${type === 'success' ? '<i class="fa-solid fa-check text-emerald-400"></i>' : '<i class="fa-solid fa-info-circle text-sky-400"></i>'}</span>
    <span>${message}</span>
  `;

  toastContainer.appendChild(toast);

  // Auto dismiss
  setTimeout(() => {
    toast.style.animation = 'toastSlideOut 0.2s forwards';
    setTimeout(() => toast.remove(), 200);
  }, 2600);
}

// Self-register on the global namespace when this module is loaded
ViralRefer.showToast = showToast;
registerGlobal('showToast', showToast);
