import { setActiveTab } from '../ui';
import {
  renderReferralsTab,
  renderEditContentTab,
  renderPrizeClaimsTab,
} from './index';

/**
 * Main admin tab switcher.
 *
 * Handles tab selection, lazy-loading of heavy tabs (Share Analytics & Text Colors),
 * and rendering the correct admin view.
 *
 * This is the central dispatcher for the entire admin dashboard.
 */
export async function switchAdminTab(tab: number) {
  const content = document.getElementById('admin-content') as HTMLElement | null;
  if (!content) {
    console.error('Admin content container not found');
    return;
  }

  setActiveTab(tab);

  if (tab === 0) {
    await renderReferralsTab(content);
  } else if (tab === 1) {
    console.log('%c[ViralRefer] Opening Share Analytics tab (Chart.js lazy-loaded)', 'color:#a78bfa');
    const { renderShareAnalyticsTab } = await import('./share-analytics-tab');
    await renderShareAnalyticsTab(content);
  } else if (tab === 2) {
    await renderEditContentTab(content);
  } else if (tab === 3) {
    await renderPrizeClaimsTab(content);
  } else if (tab === 4) {
    console.log('%c[ViralRefer] Opening Text Colors tab (live preview active)', 'color:#a78bfa');
    const { renderTextColorsTab } = await import('./text-colors-tab');
    await renderTextColorsTab(content);
  }
}
