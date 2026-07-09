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

function supabaseUrlAndAnon(): { url: string; anon: string } | null {
  const url = String(import.meta.env.VITE_SUPABASE_URL || '').trim().replace(/\/$/, '');
  const anon = String(import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();
  if (!url || !anon) return null;
  return { url, anon };
}

/** Direct fetch — reliable custom headers + body session when functions.invoke strips headers. */
async function invokeAdminActionViaFetch<T>(
  action: string,
  payload: Record<string, unknown>,
  token: string,
): Promise<AdminActionResult<T>> {
  const cfg = supabaseUrlAndAnon();
  if (!cfg) {
    return { success: false, error: 'Supabase not configured' };
  }
  try {
    const res = await fetch(`${cfg.url}/functions/v1/admin-action`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cfg.anon}`,
        apikey: cfg.anon,
        'x-admin-session': token,
      },
      body: JSON.stringify({
        action,
        payload,
        session_token: token,
      }),
    });
    const text = await res.text();
    let envelope: Record<string, unknown> = {};
    try {
      envelope = text ? (JSON.parse(text) as Record<string, unknown>) : {};
    } catch {
      return {
        success: false,
        error: `Invalid JSON from admin-action (HTTP ${res.status})`,
      };
    }
    if (!envelope.success) {
      return {
        success: false,
        error: String(envelope.error || `Admin action rejected (HTTP ${res.status})`),
      };
    }
    return {
      success: true,
      data: (envelope.data ?? null) as T,
      envelope,
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

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

  // Primary: supabase-js invoke (sends token in header + body for resilience)
  try {
    const { data, error } = await supabase.functions.invoke('admin-action', {
      body: {
        action,
        payload,
        session_token: token,
      },
      headers: {
        'x-admin-session': token,
      },
    });

    if (!error && data && typeof data === 'object') {
      const envelope = data as Record<string, unknown>;
      if (envelope.success) {
        return {
          success: true,
          data: (envelope.data ?? null) as T,
          envelope,
        };
      }
      // Business / auth rejection with HTTP 200
      if (envelope.error) {
        const msg = String(envelope.error);
        // Fall through to fetch if it looks like a gateway/header issue
        if (!/privileges required|session required|re-login/i.test(msg)) {
          return { success: false, error: msg };
        }
      }
    }

    // Non-2xx or empty body — try direct fetch before giving up
    if (error) {
      const viaFetch = await invokeAdminActionViaFetch<T>(action, payload, token);
      if (viaFetch.success) return viaFetch;
      // Prefer structured body error over generic FunctionsHttpError
      if (data && typeof data === 'object' && (data as { error?: unknown }).error) {
        return {
          success: false,
          error: String((data as { error: unknown }).error),
        };
      }
      return {
        success: false,
        error: viaFetch.success === false ? viaFetch.error : error.message || 'Request failed',
      };
    }

    // success:false with re-login message — try fetch once more
    if (data && typeof data === 'object' && !(data as { success?: boolean }).success) {
      const viaFetch = await invokeAdminActionViaFetch<T>(action, payload, token);
      if (viaFetch.success) return viaFetch;
      return {
        success: false,
        error: String((data as { error?: unknown }).error || viaFetch.error || 'Action rejected'),
      };
    }

    return { success: false, error: 'Empty admin-action response' };
  } catch (err) {
    const viaFetch = await invokeAdminActionViaFetch<T>(action, payload, token);
    if (viaFetch.success) return viaFetch;
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
