import { isSupabaseConfigured, supabase } from './supabase';

export function getAdminActionSecret(): string {
  return String(import.meta.env.VITE_ADMIN_ACTION_SECRET || '').trim();
}

export async function invokeAdminAction<T = unknown>(
  action: string,
  payload: Record<string, unknown> = {},
): Promise<{ success: true; data: T } | { success: false; error: string }> {
  const adminSecret = getAdminActionSecret();
  if (!isSupabaseConfigured || !adminSecret) {
    return { success: false, error: 'Admin secret not configured' };
  }

  try {
    const { data, error } = await supabase.functions.invoke('admin-action', {
      body: { action, payload },
      headers: { 'x-admin-secret': adminSecret },
    });
    if (error) {
      return { success: false, error: error.message || 'Request failed' };
    }
    if (!data?.success) {
      return { success: false, error: String(data?.error || 'Action rejected') };
    }
    return { success: true, data: (data.data ?? null) as T };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}