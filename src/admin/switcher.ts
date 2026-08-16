import { setActiveTab } from '../ui';
import { initAdminDesk } from '../lib/admin-simple';
import { renderOwnerFunnelDesk } from './owner-funnel-desk';

/** Guards against out-of-order renders when refresh is clicked quickly. */
let deskRequestId = 0;

const ADMIN_LOADING_SKELETON = `
  <div class="space-y-4 py-1">
    <div class="h-16 skeleton rounded-2xl"></div>
    <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
      <div class="h-24 skeleton rounded-2xl"></div>
      <div class="h-24 skeleton rounded-2xl"></div>
      <div class="h-24 skeleton rounded-2xl"></div>
      <div class="h-24 skeleton rounded-2xl"></div>
    </div>
  </div>
`;

/**
 * Owner desk entry. Tabs are collapsed — every call paints the one funnel screen.
 */
export async function switchAdminTab(_tab = 0) {
  const requestId = ++deskRequestId;
  const content = document.getElementById('admin-content') as HTMLElement | null;
  if (!content) {
    console.error('Admin content container not found');
    return;
  }

  content.classList.add('admin-tab-content');
  initAdminDesk();
  setActiveTab(0);
  content.innerHTML = ADMIN_LOADING_SKELETON;

  try {
    await renderOwnerFunnelDesk(content);
  } catch (err) {
    if (requestId !== deskRequestId) return;
    console.error('[Admin] Funnel desk render failed:', err);
    const msg = err instanceof Error ? err.message : String(err);
    const safe = msg.replace(/[<>&"']/g, (c) =>
      ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;' })[c] || c,
    );
    content.innerHTML = `
      <div class="p-6 text-amber-400 border border-amber-500/30 rounded-2xl">
        <div class="font-semibold mb-1">Unable to load the funnel desk</div>
        <div class="text-sm text-zinc-400">${safe}</div>
        <button type="button" data-admin-tab-retry="0" class="mt-3 px-4 py-2 text-sm bg-white/10 rounded-2xl">Retry</button>
      </div>
    `;
    content.querySelector<HTMLButtonElement>('[data-admin-tab-retry]')?.addEventListener('click', () => {
      void switchAdminTab(0);
    });
  }
}
