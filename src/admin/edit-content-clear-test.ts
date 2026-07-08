/** Clear test admin stats + refresh both Edit Content quick panels. */

import { clearTestAdminStatsFromServer } from './clear-test-admin-stats';
import { renderBannerStats } from './banner-stats';
import { renderVisitorFunnelStats } from './visitor-funnel-stats';
import { showToast } from '../ui';

export async function refreshEditContentStatsPanels(root: HTMLElement): Promise<void> {
  const visitorEl = root.querySelector('#visitor-stats-quick') as HTMLElement | null;
  const bannerEl = root.querySelector('#banner-stats-quick') as HTMLElement | null;
  await Promise.allSettled([
    visitorEl ? renderVisitorFunnelStats(visitorEl) : Promise.resolve(),
    bannerEl ? renderBannerStats(bannerEl) : Promise.resolve(),
  ]);
}

export function resolveEditContentRoot(container: HTMLElement): HTMLElement | null {
  return container.closest('[data-vr-edit-content-root]') as HTMLElement | null;
}

export async function runClearTestAdminStatsForEditContent(
  root: HTMLElement,
  options: { toast?: boolean; toastWhenEmpty?: boolean; toastPrefix?: string } = {},
): Promise<{ visitorDeleted: number; bannerDeleted: number }> {
  const { toast = true, toastWhenEmpty = false, toastPrefix = '' } = options;
  const { visitorDeleted, bannerDeleted } = await clearTestAdminStatsFromServer();
  await refreshEditContentStatsPanels(root);
  const total = visitorDeleted + bannerDeleted;
  if (toast) {
    if (total > 0) {
      const msg = `${toastPrefix}Removed ${visitorDeleted} funnel + ${bannerDeleted} banner test event${total === 1 ? '' : 's'}`;
      showToast(msg, 'success');
    } else if (toastWhenEmpty) {
      showToast('No test events to remove', 'info');
    }
  }
  return { visitorDeleted, bannerDeleted };
}