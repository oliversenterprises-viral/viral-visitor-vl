/**
 * Dedicated server fetch for admin Banner Performance stats.
 * Isolated from content.ts / tracking side-effects to avoid circular import bugs.
 * Never throws — always returns local fallback with a clear error when needed.
 */

import { getAdminSessionToken } from './admin-session';
import { getLocalBannerEvents } from './banner-events';

export type BannerStatsFetchResult = {
  events: Array<Record<string, unknown>>;
  source: 'server' | 'local';
  fetchError?: string;
  rowCount?: number;
};

function envConfig(): { url: string; anon: string } | null {
  const url = String(import.meta.env.VITE_SUPABASE_URL || '').trim().replace(/\/$/, '');
  const anon = String(import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();
  if (!url || !anon) return null;
  return { url, anon };
}

/** Normalize edge/server banner_events rows into the shape the admin panel expects. */
export function normalizeBannerEventForStats(row: Record<string, unknown>): Record<string, unknown> {
  const additional =
    row.additional && typeof row.additional === 'object'
      ? (row.additional as Record<string, unknown>)
      : {};
  const label = String(row.label || row.banner_label || '').trim();
  const redirectUrl = String(row.redirect_url || row.redirectUrl || '').trim();
  const keyFromAdditional = String(additional.key || additional.Key || '').trim();
  const key =
    String(row.key || row.banner_key || keyFromAdditional || '').trim() ||
    (label && redirectUrl ? `${label}|${redirectUrl}` : label || redirectUrl || 'unknown');

  return {
    type: row.type || row.event_type,
    label: label || 'untitled',
    redirectUrl,
    key,
    ip: row.ip || row.ip_address || additional.ip,
    user_agent: row.user_agent || additional.user_agent,
    timestamp: row.created_at || row.timestamp,
    created_at: row.created_at || row.timestamp,
  };
}

/**
 * Load banner events from admin-action get_banner_stats via direct fetch.
 * Falls back to localStorage events with a clear error (never throws).
 */
export async function fetchBannerStatsEvents(): Promise<BannerStatsFetchResult> {
  const local = getLocalBannerEvents();
  const token = getAdminSessionToken();
  const cfg = envConfig();

  if (!cfg) {
    return {
      events: local,
      source: 'local',
      fetchError: 'Supabase env not configured in this build',
      rowCount: local.length,
    };
  }
  if (!token) {
    return {
      events: local,
      source: 'local',
      fetchError: 'Admin session required — log in with the owner password',
      rowCount: local.length,
    };
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
        action: 'get_banner_stats',
        payload: {},
        session_token: token,
      }),
    });

    const text = await res.text();
    let json: Record<string, unknown> = {};
    try {
      json = text ? (JSON.parse(text) as Record<string, unknown>) : {};
    } catch {
      return {
        events: local,
        source: 'local',
        fetchError: `Bad JSON from server (HTTP ${res.status})`,
        rowCount: local.length,
      };
    }

    if (json.success !== true) {
      return {
        events: local,
        source: 'local',
        fetchError: String(json.error || `Admin action failed (HTTP ${res.status})`),
        rowCount: local.length,
      };
    }

    if (!Array.isArray(json.data)) {
      return {
        events: local,
        source: 'local',
        fetchError: 'Server returned non-array banner data',
        rowCount: local.length,
      };
    }

    const events = (json.data as Array<Record<string, unknown>>).map((row) =>
      normalizeBannerEventForStats(row && typeof row === 'object' ? row : {}),
    );

    if (events.length > 0) {
      return {
        events,
        source: 'server',
        rowCount: events.length,
      };
    }

    // Empty server: prefer local browser events if present (same UX as before).
    if (local.length > 0) {
      return {
        events: local,
        source: 'local',
        fetchError: 'Server has no banner events yet — showing this browser',
        rowCount: local.length,
      };
    }

    return {
      events,
      source: 'server',
      rowCount: 0,
    };
  } catch (err) {
    return {
      events: local,
      source: 'local',
      fetchError: err instanceof Error ? err.message : String(err),
      rowCount: local.length,
    };
  }
}

/** @deprecated Prefer fetchBannerStatsEvents — kept for content.ts re-export compatibility. */
export async function getBannerEventsForStats(): Promise<BannerStatsFetchResult> {
  return fetchBannerStatsEvents();
}
