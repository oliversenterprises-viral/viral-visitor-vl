import { isSupabaseConfigured, supabase } from './supabase';
import { getAdminSessionToken } from './admin-session';

export function getAdminActionHeaders(): Record<string, string> {
  const token = getAdminSessionToken();
  if (!token) return {};
  return { 'x-admin-session': token };
}

export function parseAdminActionError(edgeErr: unknown, edgeData: unknown): string {
  if (edgeData && typeof edgeData === 'object' && edgeData !== null && 'error' in edgeData) {
    const msg = (edgeData as { error?: unknown }).error;
    if (msg) return String(msg);
  }
  if (edgeErr && typeof edgeErr === 'object' && edgeErr !== null && 'message' in edgeErr) {
    return String((edgeErr as { message?: unknown }).message || 'Admin action failed');
  }
  return 'Admin action failed';
}

export type AdminActionResult<T> =
  | { success: true; data: T; envelope: Record<string, unknown> }
  | { success: false; error: string };

export async function invokeAdminAction<T = unknown>(
  action: string,
  payload: Record<string, unknown> = {},
): Promise<AdminActionResult<T>> {
  const token = getAdminSessionToken();
  if (!isSupabaseConfigured || !token) {
    return {
      success: false,
      error: 'Admin session required — log in with the owner password',
    };
  }

  try {
    const { data, error } = await supabase.functions.invoke('admin-action', {
      body: { action, payload },
      headers: { 'x-admin-session': token },
    });
    if (error) {
      return { success: false, error: error.message || 'Request failed' };
    }
    const envelope = (data && typeof data === 'object' ? data : {}) as Record<string, unknown>;
    if (!envelope.success) {
      return { success: false, error: String(envelope.error || 'Action rejected') };
    }
    return {
      success: true,
      data: (envelope.data ?? null) as T,
      envelope,
    };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}