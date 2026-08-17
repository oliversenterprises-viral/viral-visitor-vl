import { setActiveTab } from '../ui';
import { isAdminExtraTab, setAdminMore, syncAdminTabCoach } from '../lib/admin-simple';
import { setAdminLiveActiveTab, startAdminLiveHub } from './admin-live-hub';
import { renderOwnerFunnelDesk } from './owner-funnel-desk';
import {
  renderReferralsTab,
  renderEditContentTab,
  renderPrizeClaimsTab,
} from './index';

/** Guards against out-of-order tab renders when the user clicks quickly. */
let tabRequestId = 0;

const ADMIN_LOADING_SKELETON = `
  <div class="space-y-4 py-1">
    <div class="flex justify-between items-center">
      <div class="h-8 w-48 skeleton rounded-xl"></div>
      <div class="h-9 w-24 skeleton rounded-2xl"></div>
    </div>
    <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
      <div class="h-24 skeleton rounded-2xl"></div>
      <div class="h-24 skeleton rounded-2xl"></div>
      <div class="h-24 skeleton rounded-2xl"></div>
      <div class="h-24 skeleton rounded-2xl"></div>
    </div>
    <div class="h-12 skeleton rounded-xl"></div>
    <div class="h-12 skeleton rounded-xl"></div>
    <div class="h-12 skeleton rounded-xl"></div>
  </div>
`;

function isStale(requestId: number): boolean {
  return requestId !== tabRequestId;
}

/**
 * First screen after the owner password: five-number desk only.
 * Extra tools stay behind More and never replace this path with "can't load."
 */
export async function showOwnerFunnelDesk() {
  const requestId = ++tabRequestId;
  const content = document.getElementById('admin-content') as HTMLElement | null;
  if (!content) {
    console.error('Admin content container not found');
    return;
  }

  content.classList.add('admin-tab-content');
  setAdminMore(false);
  setActiveTab(-1);
  syncAdminTabCoach(-1);
  setAdminLiveActiveTab(0);
  content.innerHTML = ADMIN_LOADING_SKELETON;

  try {
    await renderOwnerFunnelDesk(content);
  } catch {
    /* renderOwnerFunnelDesk paints zeros — never "can't load" after login */
  }
  if (isStale(requestId)) return;
}

/**
 * Extra owner tools (Friends / Prize / Website words / Shares / ...).
 * Opening any tab relocates that chrome into the More host.
 */
export async function switchAdminTab(tab: number) {
  const requestId = ++tabRequestId;
  const content = document.getElementById('admin-content') as HTMLElement | null;
  if (!content) {
    console.error('Admin content container not found');
    return;
  }

  content.classList.add('admin-tab-content');
  if (isAdminExtraTab(tab)) {
    setAdminMore(true);
    startAdminLiveHub();
  }
  setActiveTab(tab);
  syncAdminTabCoach(tab);
  setAdminLiveActiveTab(tab);
  content.innerHTML = ADMIN_LOADING_SKELETON;

  try {
    if (tab === 0) {
      await renderReferralsTab(content);
    } else if (tab === 1) {
      if (isStale(requestId)) return;
      const { renderShareAnalyticsTab } = await import('./share-analytics-tab');
      if (isStale(requestId)) return;
      await renderShareAnalyticsTab(content);
    } else if (tab === 2) {
      if (isStale(requestId)) return;
      await renderEditContentTab(content);
    } else if (tab === 3) {
      if (isStale(requestId)) return;
      await renderPrizeClaimsTab(content);
    } else if (tab === 4) {
      if (isStale(requestId)) return;
      const { renderTextColorsTab } = await import('./text-colors-tab');
      if (isStale(requestId)) return;
      await renderTextColorsTab(content);
    } else if (tab === 5) {
      if (isStale(requestId)) return;
      const { renderViralOptimizerTab } = await import('./viral-optimizer-tab');
      if (isStale(requestId)) return;
      await renderViralOptimizerTab(content);
    } else if (tab === 6) {
      if (isStale(requestId)) return;
      const { renderAffiliatesTab } = await import('./affiliates-tab');
      if (isStale(requestId)) return;
      await renderAffiliatesTab(content);
    }
  } catch (err) {
    if (isStale(requestId)) return;
    console.error('[Admin] Tab render failed:', err);
    const msg = err instanceof Error ? err.message : String(err);
    const safe = msg.replace(/[<>&"']/g, (c) =>
      ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;' })[c] || c,
    );
    content.innerHTML = `
      <div class="p-6 text-amber-400 border border-amber-500/30 rounded-2xl">
        <div class="font-semibold mb-1">Unable to load this tab</div>
        <div class="text-sm text-zinc-400">${safe}</div>
        <button type="button" data-admin-tab-retry="${tab}" class="mt-3 px-4 py-2 text-sm bg-white/10 rounded-2xl">Retry</button>
      </div>
    `;
    content.querySelector<HTMLButtonElement>('[data-admin-tab-retry]')?.addEventListener('click', () => {
      void switchAdminTab(tab);
    });
  }
}
