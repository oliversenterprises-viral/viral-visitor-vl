/** Server-side purge of owner/smoke rows from visitor_events + banner_events. */

import { supabase } from '../lib/supabase';

function parseAdminActionError(edgeErr: unknown, edgeData: unknown): string {
  if (edgeData && typeof edgeData === 'object' && edgeData !== null && 'error' in edgeData) {
    const msg = (edgeData as { error?: unknown }).error;
    if (msg) return String(msg);
  }
  if (edgeErr && typeof edgeErr === 'object' && edgeErr !== null && 'message' in edgeErr) {
    return String((edgeErr as { message?: unknown }).message || 'Admin action failed');
  }
  return 'Admin action failed';
}

export async function clearTestAdminStatsFromServer(): Promise<{
  visitorDeleted: number;
  bannerDeleted: number;
}> {
  const adminSecret = import.meta.env.VITE_ADMIN_ACTION_SECRET || '';
  if (!adminSecret) {
    throw new Error('Admin secret not configured');
  }

  const { data: edgeData, error: edgeErr } = await supabase.functions.invoke('admin-action', {
    body: { action: 'clear_test_admin_stats', payload: { dry_run: false } },
    headers: { 'x-admin-secret': adminSecret },
  });

  if (edgeErr && !(edgeData && typeof edgeData === 'object' && (edgeData as { success?: boolean }).success)) {
    throw new Error(parseAdminActionError(edgeErr, edgeData));
  }
  if (!edgeData?.success) {
    throw new Error(String(edgeData?.error || 'clear_test_admin_stats rejected'));
  }

  const result = edgeData.data as {
    deleted_visitor?: number;
    deleted_banner?: number;
  } | undefined;

  return {
    visitorDeleted: result?.deleted_visitor ?? 0,
    bannerDeleted: result?.deleted_banner ?? 0,
  };
}