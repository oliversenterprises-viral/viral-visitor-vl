/**
 * Dedicated server fetch for admin Site Visitor Funnel.
 * Isolated from content.ts / tracking side-effects to avoid circular import bugs.
 */

import { getAdminSessionToken } from './admin-session';
import { getLocalVisitorEvents, parseVisitorEventMetadata } from './visitor-tracking';

export type VisitorFunnelFetchResult = {
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

function normalizeServerRow(row: Record<string, unknown>): Record<string, unknown> {
  return {
    event_name: row.event_name ?? row.eventName ?? null,
    visitor_id: row.visitor_id ?? row.visitorId ?? null,
    session_id: row.session_id ?? row.sessionId ?? null,
    country_code: row.country_code ?? row.countryCode ?? null,
    ip_hash: row.ip_hash ?? row.ipHash ?? null,
    utm_source: row.utm_source ?? row.utmSource ?? null,
    utm_campaign: row.utm_campaign ?? row.utmCampaign ?? null,
    utm_content: row.utm_content ?? row.utmContent ?? null,
    utm_medium: row.utm_medium ?? row.utmMedium ?? null,
    ref_code: row.ref_code ?? row.refCode ?? null,
    metadata: parseVisitorEventMetadata(row),
    created_at: row.created_at ?? row.timestamp ?? null,
  };
}

/**
 * Load visitor funnel events from admin-action get_visitor_stats via direct fetch.
 * Falls back to localStorage events with a clear error (never throws).
 */
export async function fetchVisitorFunnelEvents(): Promise<VisitorFunnelFetchResult> {
  const local = getLocalVisitorEvents();
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
        action: 'get_visitor_stats',
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
        fetchError: 'Server returned non-array visitor data',
        rowCount: local.length,
      };
    }

    const events = (json.data as Array<Record<string, unknown>>).map((row) =>
      normalizeServerRow(row && typeof row === 'object' ? row : {}),
    );

    return {
      events,
      source: 'server',
      rowCount: events.length,
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
