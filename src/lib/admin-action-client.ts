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

export type InvokeAdminActionOptions = {
  /** Abort the direct fetch. When set, skip the hanging functions.invoke fallback. */
  signal?: AbortSignal;
  /** Fail-fast AbortController budget. Desk uses ≤8000. */
  timeoutMs?: number;
};

function supabaseUrlAndAnon(): { url: string; anon: string } | null {
  const url = String(import.meta.env.VITE_SUPABASE_URL || '').trim().replace(/\/$/, '');
  const anon = String(import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();
  if (!url || !anon) return null;
  return { url, anon };
}

function isAbortError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const name = String((err as { name?: unknown }).name || '');
  const msg = String((err as { message?: unknown }).message || '').toLowerCase();
  return name === 'AbortError' || msg.includes('aborted') || msg.includes('abort');
}

/** Direct fetch — reliable custom headers + body session when functions.invoke strips headers. */
async function invokeAdminActionViaFetch<T>(
  action: string,
  payload: Record<string, unknown>,
  token: string,
  options: InvokeAdminActionOptions = {},
): Promise<AdminActionResult<T>> {
  const cfg = supabaseUrlAndAnon();
  if (!cfg) {
    return { success: false, error: 'Supabase not configured' };
  }
  const timeoutMs =
    typeof options.timeoutMs === 'number' && options.timeoutMs > 0 ? options.timeoutMs : 0;
  const ctrl = new AbortController();
  const onOuterAbort = () => ctrl.abort();
  if (options.signal) {
    if (options.signal.aborted) ctrl.abort();
    else options.signal.addEventListener('abort', onOuterAbort, { once: true });
  }
  const timer =
    timeoutMs > 0 && !ctrl.signal.aborted
      ? setTimeout(() => ctrl.abort(), timeoutMs)
      : undefined;
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
      signal: ctrl.signal,
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
    if (isAbortError(err) || ctrl.signal.aborted) {
      return { success: false, error: 'timed out' };
    }
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  } finally {
    if (timer) clearTimeout(timer);
    options.signal?.removeEventListener('abort', onOuterAbort);
  }
}

export async function invokeAdminAction<T = unknown>(
  action: string,
  payload: Record<string, unknown> = {},
  options: InvokeAdminActionOptions = {},
): Promise<AdminActionResult<T>> {
  const token = getAdminSessionToken();
  if (!isSupabaseConfigured || !token) {
    return {
      success: false,
      error: 'Admin session required — log in with the owner password',
    };
  }

  // Prefer direct fetch first — more reliable for large admin stats + custom session headers
  const viaFetch = await invokeAdminActionViaFetch<T>(action, payload, token, options);
  if (viaFetch.success) return viaFetch;
  // Abort/timeout must not fall through to functions.invoke (that path has no AbortController).
  if (options.signal || options.timeoutMs) return viaFetch;

  // Fallback: supabase-js invoke
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

    if (!error && data && typeof data === 'object' && !Array.isArray(data)) {
      const envelope = data as Record<string, unknown>;
      if (envelope.success === true) {
        return {
          success: true,
          data: (envelope.data ?? null) as T,
          envelope,
        };
      }
      if (envelope.error) {
        return { success: false, error: String(envelope.error) };
      }
    }

    if (error) {
      // Prefer the clearer fetch error when invoke only returns a generic FunctionsHttpError
      const invokeMsg = error.message || 'Request failed';
      if (viaFetch.error && !/Failed to send a request/i.test(viaFetch.error)) {
        return { success: false, error: viaFetch.error };
      }
      return { success: false, error: invokeMsg };
    }

    return {
      success: false,
      error: viaFetch.error || 'Empty admin-action response',
    };
  } catch (err) {
    return {
      success: false,
      error:
        viaFetch.error ||
        (err instanceof Error ? err.message : String(err)),
    };
  }
}
