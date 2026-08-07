/**
 * ViralRefer Relay API client + session key.
 */

import { callEdgeFunction, isSupabaseConfigured, supabase } from './supabase';

const SESSION_KEY = 'vr_relay_client_key';

export type RelayLive = {
  id: string | null;
  url: string;
  domain: string;
  views_remaining: number | null;
  views_delivered: number;
  is_house: boolean;
  label?: string;
};

export type RelayPublicState = {
  enabled: boolean;
  min_dwell_seconds: number;
  views_per_seat: number;
  house_url: string;
  house_label: string;
  banner_url: string;
  live: RelayLive | null;
  queue_length: number;
  recent: Array<{
    domain: string;
    status: string;
    created_at: string;
    views_delivered: number;
  }>;
  error?: string;
};

export type RelaySession = {
  client_key: string;
  credits: number;
  id?: string;
};

function randomKey(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export function getOrCreateRelayClientKey(): string {
  try {
    const existing = localStorage.getItem(SESSION_KEY);
    if (existing && /^[a-zA-Z0-9_-]{16,80}$/.test(existing)) return existing;
    const key = randomKey();
    localStorage.setItem(SESSION_KEY, key);
    return key;
  } catch {
    return randomKey();
  }
}

export async function fetchRelayStateRpc(): Promise<RelayPublicState | null> {
  if (!isSupabaseConfigured) return null;
  try {
    const { data, error } = await supabase.rpc('get_relay_public_state');
    if (error || !data) return null;
    return data as RelayPublicState;
  } catch {
    return null;
  }
}

export async function relayAction(
  action: 'state' | 'view' | 'enqueue' | 'session',
  payload: Record<string, unknown> = {},
): Promise<Record<string, unknown>> {
  const client_key = getOrCreateRelayClientKey();
  if (!isSupabaseConfigured) {
    return { success: false, error: 'Supabase not configured' };
  }
  try {
    const data = await callEdgeFunction('relay', { action, client_key, ...payload });
    return (data && typeof data === 'object' ? data : { success: false, error: 'empty' }) as Record<
      string,
      unknown
    >;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Request failed';
    return { success: false, error: message };
  }
}

/** Normalize user-entered URL for display/preflight (server re-validates). */
export function normalizeRelayUrlInput(raw: string): string {
  const t = raw.trim();
  if (!t) return '';
  if (/^https?:\/\//i.test(t)) return t;
  return `https://${t}`;
}
