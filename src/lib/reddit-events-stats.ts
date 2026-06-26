/**
 * Historical Reddit campaign event stats (read-only archive).
 * Phase 1: no client writes or pixel — admin panel unwired; data retained server-side.
 */

import { supabase } from './supabase';
import { eventName, groupBy, latestEvents } from './stats-helpers';

const REDDIT_EVENTS_KEY = 'viralrefer_reddit_events';

export type RedditFunnelEvent =
  | 'RedditLanding'
  | 'GetReferralLink'
  | 'CopyReferralLink'
  | 'ShareReferral'
  | 'OpenPrizeClaim'
  | 'SubmitPrizeClaim';

export function getLocalRedditEvents(): Array<Record<string, unknown>> {
  try {
    return JSON.parse(localStorage.getItem(REDDIT_EVENTS_KEY) || '[]');
  } catch {
    return [];
  }
}

export function computeRedditFunnelStats(events: Array<Record<string, any>>) {
  const counts: Record<string, number> = {};
  for (const e of events) {
    const name = eventName(e);
    counts[name] = (counts[name] || 0) + 1;
  }
  const funnelOrder: RedditFunnelEvent[] = [
    'RedditLanding',
    'GetReferralLink',
    'CopyReferralLink',
    'ShareReferral',
    'OpenPrizeClaim',
    'SubmitPrizeClaim',
  ];
  const funnel = funnelOrder.map((name) => ({
    name,
    count: counts[name] || 0,
  }));
  return {
    funnel,
    total: events.length,
    lastEvents: latestEvents(events, 8),
    byCampaign: groupBy(
      events.filter((e) => eventName(e) === 'RedditLanding'),
      (e) => String(e.utm_campaign || e.utmCampaign || '(none)'),
    ),
  };
}

export async function getRedditEventsForStats(): Promise<{
  events: Array<Record<string, any>>;
  source: 'server' | 'local';
  fetchError?: string;
}> {
  const local = getLocalRedditEvents();
  const adminSecret = import.meta.env.VITE_ADMIN_ACTION_SECRET || '';

  if (!adminSecret) {
    return { events: local, source: 'local', fetchError: 'Admin secret not configured in build' };
  }

  try {
    const { data, error } = await supabase.functions.invoke('admin-action', {
      body: { action: 'get_reddit_stats' },
      headers: { 'x-admin-secret': adminSecret },
    });
    if (error) {
      return { events: local, source: 'local', fetchError: error.message || 'Server request failed' };
    }
    if (!data?.success) {
      return {
        events: local,
        source: 'local',
        fetchError: String(data?.error || 'get_reddit_stats rejected'),
      };
    }
    if (!Array.isArray(data.data)) {
      return { events: local, source: 'local', fetchError: 'Invalid server response' };
    }
    const serverEvents = data.data.map((row: Record<string, any>) => ({
      event_name: row.event_name,
      utm_campaign: row.utm_campaign,
      utm_content: row.utm_content,
      utm_medium: row.utm_medium,
      ref_code: row.ref_code,
      metadata: row.metadata,
      created_at: row.created_at,
    }));
    return { events: serverEvents, source: 'server' };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Network error';
    return { events: local, source: 'local', fetchError: msg };
  }
}