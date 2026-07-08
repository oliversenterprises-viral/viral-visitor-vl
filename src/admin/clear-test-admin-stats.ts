/** Server-side purge of owner/smoke rows from visitor_events + banner_events. */

import { invokeAdminAction } from '../lib/admin-action-client';

export async function clearTestAdminStatsFromServer(): Promise<{
  visitorDeleted: number;
  bannerDeleted: number;
}> {
  const result = await invokeAdminAction<{
    deleted_visitor?: number;
    deleted_banner?: number;
  }>('clear_test_admin_stats', { dry_run: false });

  if (!result.success) {
    throw new Error(result.error || 'clear_test_admin_stats rejected');
  }

  return {
    visitorDeleted: result.data?.deleted_visitor ?? 0,
    bannerDeleted: result.data?.deleted_banner ?? 0,
  };
}

