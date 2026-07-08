import { setActiveTab } from '../ui';
import { setAdminLiveActiveTab } from './admin-live-hub';
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
 * Main admin tab switcher.
 *
 * Handles tab selection, lazy-loading of heavy tabs (Share Analytics & Text Colors),
 * loading skeletons, race guards, and rendering the correct admin view.
 */
export async function switchAdminTab(tab: number) {
  const requestId = ++tabRequestId;
  const content = document.getElementById('admin-content') as HTMLElement | null;
  if (!content) {
    console.error('Admin content container not found');
    return;
  }

  content.classList.add('admin-tab-content');
  setActiveTab(tab);
  setAdminLiveActiveTab(tab);
  content.innerHTML = ADMIN_LOADING_SKELETON;

  try {
    if (tab === 0) {
      await renderReferralsTab(content);
    } else if (tab === 1) {
      if (isStale(requestId)) return;
      // console.log('%c[ViralRefer] Opening Share Analytics tab (Chart.js lazy-loaded)', 'color:#a78bfa'); // silenced for prod (audit)
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
      // console.log('%c[ViralRefer] Opening Text Colors tab (live preview active)', 'color:#a78bfa'); // silenced for prod (audit)
      const { renderTextColorsTab } = await import('./text-colors-tab');
      if (isStale(requestId)) return;
      await renderTextColorsTab(content);
    } else if (tab === 5) {
      if (isStale(requestId)) return;
      const { renderViralOptimizerTab } = await import('./viral-optimizer-tab');
      if (isStale(requestId)) return;
      await renderViralOptimizerTab(content);
    }
  } catch (err) {
    if (isStale(requestId)) return;
    console.error('[Admin] Tab render failed:', err);
    content.innerHTML = `
      <div class="p-6 text-amber-400">Unable to load this tab. ${String(err)}</div>
      <button onclick="window.switchAdminTab(${tab})" class="mt-3 px-4 py-2 text-sm bg-white/10 rounded-2xl">Retry</button>
    `;
  }
}