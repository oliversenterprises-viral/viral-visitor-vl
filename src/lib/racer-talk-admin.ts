/**
 * Owner HQ Talk tab — racer-talk edge (live Site Drops).
 * Fail closed when the function is missing or returns Unknown action.
 * Never look like an empty inbox when Talk is unavailable.
 */

import { getAdminSessionToken } from './admin-session';

export class TalkAdminError extends Error {
  readonly code: 'unknown_action' | 'unavailable' | 'auth' | 'failed';
  constructor(message: string, code: TalkAdminError['code'] = 'failed') {
    super(message);
    this.name = 'TalkAdminError';
    this.code = code;
  }
}

export type TalkPerson = {
  code: string;
  friends: number;
  unread: number;
};

export type TalkMessage = {
  from_role?: string;
  body?: string;
  created_at?: string;
};

export function isTalkUnavailable(error: string | undefined | null): boolean {
  const text = String(error || '');
  return /unknown action/i.test(text) || /not found/i.test(text) || /failed to fetch/i.test(text);
}

export function parseOwnerListResult(result: {
  success: boolean;
  data?: unknown;
  error?: string;
}): TalkPerson[] {
  if (!result.success) {
    if (/sign in again/i.test(String(result.error || ''))) {
      throw new TalkAdminError(result.error || 'Sign in again to open Talk.', 'auth');
    }
    if (isTalkUnavailable(result.error)) {
      throw new TalkAdminError(
        'Talk is not connected on this site yet. The racer-talk function is missing or returned Unknown action.',
        'unknown_action',
      );
    }
    throw new TalkAdminError(result.error || 'Could not load Talk. Try again.', 'failed');
  }
  if (!Array.isArray(result.data)) {
    throw new TalkAdminError('Talk owner_list returned no people array.', 'failed');
  }
  return (result.data as TalkPerson[])
    .map((row) => ({
      code: String(row?.code || '').trim().toUpperCase(),
      friends: Number(row?.friends) || 0,
      unread: Number(row?.unread) || 0,
    }))
    .filter((row) => row.code);
}

export function parseOwnerThreadResult(result: {
  success: boolean;
  data?: unknown;
  error?: string;
}): TalkMessage[] {
  if (!result.success) {
    if (isTalkUnavailable(result.error)) {
      throw new TalkAdminError(
        'Talk is not connected on this site yet. The racer-talk function is missing or returned Unknown action.',
        'unknown_action',
      );
    }
    throw new TalkAdminError(result.error || 'Could not load Talk. Try again.', 'failed');
  }
  const data = result.data && typeof result.data === 'object' ? (result.data as { messages?: unknown }) : {};
  return Array.isArray(data.messages) ? (data.messages as TalkMessage[]) : [];
}

type InvokeTalk = (
  action: string,
  payload: Record<string, unknown>,
) => Promise<{ success: boolean; data?: unknown; error?: string }>;

function supabaseUrlAndAnon(): { url: string; anon: string } | null {
  const url = String(import.meta.env.VITE_SUPABASE_URL || '').trim().replace(/\/$/, '');
  const anon = String(import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();
  if (!url || !anon) return null;
  return { url, anon };
}

export async function invokeRacerTalk(
  action: string,
  payload: Record<string, unknown> = {},
): Promise<{ success: boolean; data?: unknown; error?: string }> {
  const token = getAdminSessionToken();
  if (!token) {
    return { success: false, error: 'Sign in again to open Talk.' };
  }
  const cfg = supabaseUrlAndAnon();
  if (!cfg) {
    return { success: false, error: 'Talk is not connected on this site yet.' };
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12_000);
  try {
    const res = await fetch(`${cfg.url}/functions/v1/racer-talk`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cfg.anon}`,
        apikey: cfg.anon,
        'x-admin-session': token,
      },
      body: JSON.stringify({ action, payload, session_token: token }),
      signal: controller.signal,
    });
    const text = await res.text();
    let envelope: Record<string, unknown> = {};
    try {
      envelope = text ? (JSON.parse(text) as Record<string, unknown>) : {};
    } catch {
      return { success: false, error: `Invalid JSON from racer-talk (HTTP ${res.status})` };
    }
    if (!envelope.success) {
      return {
        success: false,
        error: String(envelope.error || `Could not load Talk. Try again.`),
      };
    }
    return { success: true, data: envelope.data };
  } catch (err) {
    const name = err instanceof Error ? err.name : '';
    if (name === 'AbortError') {
      return { success: false, error: 'Talk timed out. Try again.' };
    }
    return { success: false, error: 'Talk timed out. Try again.' };
  } finally {
    clearTimeout(timer);
  }
}

export async function loadTalkPeople(invoke: InvokeTalk = invokeRacerTalk): Promise<TalkPerson[]> {
  return parseOwnerListResult(await invoke('owner_list', {}));
}

export async function loadTalkThread(
  code: string,
  invoke: InvokeTalk = invokeRacerTalk,
): Promise<TalkMessage[]> {
  return parseOwnerThreadResult(await invoke('owner_thread', { code }));
}

export function parseOwnerSendResult(result: {
  success: boolean;
  data?: unknown;
  error?: string;
}): void {
  if (result.success) return;
  if (isTalkUnavailable(result.error)) {
    throw new TalkAdminError(
      'Talk is not connected on this site yet. The racer-talk function is missing or returned Unknown action.',
      'unknown_action',
    );
  }
  throw new TalkAdminError(result.error || 'Could not send.', 'failed');
}
