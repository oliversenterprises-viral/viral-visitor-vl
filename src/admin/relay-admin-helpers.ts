/**
 * Pure helpers for ViralRefer Relay admin tab (unit-testable).
 */

export type RelayAdminConfig = {
  id?: number;
  enabled?: boolean;
  min_dwell_seconds?: number;
  views_per_seat?: number;
  house_url?: string;
  house_label?: string;
  banner_url?: string;
  enqueue_cooldown_seconds?: number;
  updated_at?: string;
};

export type RelayAdminStats = {
  views_24h?: number;
  house_views_24h?: number;
  enqueues_24h?: number;
  sessions_active_24h?: number;
  queue_length?: number;
};

export type RelayAdminLink = {
  id: string;
  url?: string;
  domain?: string;
  status?: string;
  views_remaining?: number | null;
  views_delivered?: number | null;
  created_at?: string;
  live_at?: string | null;
  completed_at?: string | null;
};

export function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function formatRelayStat(n: unknown): string {
  const v = Number(n);
  if (!Number.isFinite(v)) return '0';
  return Math.max(0, Math.floor(v)).toLocaleString();
}

export function summarizeRelayHealth(stats: RelayAdminStats, config: RelayAdminConfig | null): string {
  if (config && config.enabled === false) return 'Relay is PAUSED (kill switch).';
  const views = Number(stats.views_24h) || 0;
  const enq = Number(stats.enqueues_24h) || 0;
  if (views === 0 && enq === 0) return 'Quiet last 24h — no views or enqueues yet.';
  return `Active · ${formatRelayStat(views)} views · ${formatRelayStat(enq)} enqueues (24h).`;
}

export function statusBadgeClass(status: string): string {
  switch (String(status || '').toLowerCase()) {
    case 'live':
      return 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30';
    case 'queued':
      return 'bg-violet-500/15 text-violet-300 border-violet-500/30';
    case 'completed':
      return 'bg-zinc-500/15 text-zinc-300 border-zinc-500/25';
    case 'rejected':
      return 'bg-rose-500/15 text-rose-300 border-rose-500/30';
    default:
      return 'bg-white/10 text-zinc-300 border-white/15';
  }
}
