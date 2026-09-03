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

/** Owner-password verify must not hang on functions.invoke. */
export const OWNER_PASSWORD_VERIFY_TIMEOUT_MS = 15_000;

export type AdminActionFetchResult =
  | { ok: true; status: number; envelope: Record<string, unknown> }
  | { ok: false; error: string; timedOut?: boolean };

function isAbortError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const name = String((err as { name?: unknown }).name || '');
  return name === 'AbortError' || name === 'TimeoutError';
}

/**
 * Same path the rest of HQ uses: POST /functions/v1/admin-action
 * Authorization Bearer anon + JSON { action, payload }.
 */
export async function fetchAdminAction(
  action: string,
  payload: Record<string, unknown> = {},
  options?: { sessionToken?: string; timeoutMs?: number; signal?: AbortSignal },
): Promise<AdminActionFetchResult> {
  const cfg = supabaseUrlAndAnon();
  if (!cfg) {
    return { ok: false, error: 'Supabase not configured' };
  }
  const token = String(options?.sessionToken || '').trim();
  const timeoutMs = options?.timeoutMs;
  const ctrl = new AbortController();
  const onOuterAbort = () => ctrl.abort();
  if (options?.signal) {
    if (options.signal.aborted) ctrl.abort();
    else options.signal.addEventListener('abort', onOuterAbort, { once: true });
  }
  let timer: ReturnType<typeof setTimeout> | undefined;
  if (timeoutMs && timeoutMs > 0 && !ctrl.signal.aborted) {
    timer = setTimeout(() => ctrl.abort(), timeoutMs);
  }
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${cfg.anon}`,
    apikey: cfg.anon,
  };
  if (token) headers['x-admin-session'] = token;
  const body: Record<string, unknown> = { action, payload };
  if (token) body.session_token = token;
  try {
    const res = await fetch(`${cfg.url}/functions/v1/admin-action`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    const text = await res.text();
    let envelope: Record<string, unknown> = {};
    try {
      envelope = text ? (JSON.parse(text) as Record<string, unknown>) : {};
    } catch {
      return {
        ok: false,
        error: `Invalid JSON from admin-action (HTTP ${res.status})`,
      };
    }
    return { ok: true, status: res.status, envelope };
  } catch (err) {
    if (isAbortError(err)) {
      return {
        ok: false,
        error:
          action === 'verify_owner_password'
            ? 'Owner verify timed out — try again.'
            : 'Request timed out — try again.',
        timedOut: true,
      };
    }
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  } finally {
    if (timer) clearTimeout(timer);
    options?.signal?.removeEventListener('abort', onOuterAbort);
  }
}

/** Direct fetch — reliable custom headers + body session when functions.invoke strips headers. */
async function invokeAdminActionViaFetch<T>(
  action: string,
  payload: Record<string, unknown>,
  token: string,
  timeoutMs?: number,
  signal?: AbortSignal,
): Promise<AdminActionResult<T>> {
  const fetched = await fetchAdminAction(action, payload, { sessionToken: token, timeoutMs, signal });
  if (!fetched.ok) {
    return { success: false, error: fetched.error };
  }
  const envelope = fetched.envelope;
  if (!envelope.success) {
    return {
      success: false,
      error: String(envelope.error || `Admin action rejected (HTTP ${fetched.status})`),
    };
  }
  return {
    success: true,
    data: (envelope.data ?? null) as T,
    envelope,
  };
}

export type VerifyOwnerPasswordResult =
  | { success: true; sessionToken: string }
  | { success: false; error: string; timedOut?: boolean };

/** Owner gate: fetch + timeout. Never functions.invoke. Never log the password. */
export async function verifyOwnerPassword(password: string): Promise<VerifyOwnerPasswordResult> {
  const fetched = await fetchAdminAction(
    'verify_owner_password',
    { password },
    { timeoutMs: OWNER_PASSWORD_VERIFY_TIMEOUT_MS },
  );
  if (!fetched.ok) {
    return { success: false, error: fetched.error, timedOut: fetched.timedOut };
  }
  const token = String(fetched.envelope.session_token || '').trim();
  if (fetched.envelope.success === true && token) {
    return { success: true, sessionToken: token };
  }
  return {
    success: false,
    error: String(fetched.envelope.error || 'Incorrect — try again'),
  };
}

export async function invokeAdminAction<T = unknown>(
  action: string,
  payload: Record<string, unknown> = {},
  options?: { timeoutMs?: number; signal?: AbortSignal },
): Promise<AdminActionResult<T>> {
  const token = getAdminSessionToken();
  if (!isSupabaseConfigured || !token) {
    return {
      success: false,
      error: 'Admin session required — log in with the owner password',
    };
  }

  // Prefer direct fetch first — more reliable for large admin stats + custom session headers
  const viaFetch = await invokeAdminActionViaFetch<T>(
    action,
    payload,
    token,
    options?.timeoutMs,
    options?.signal,
  );
  if (viaFetch.success) return viaFetch;
  // Desk (and any timed call) must not fall through to functions.invoke — that path has no abort.
  if (options?.timeoutMs || options?.signal) return viaFetch;

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
