/**
 * Worldwide FOMO funnel ticker — only for visitors who already got a referral link.
 * Surfaces important funnel steps from anyone on ViralRefer (not limited to your network).
 */

import { formatSharePlatformLabel, type PublicActivityRow } from './public-activity';
import { escapeHtml } from './escape-html';
import { isEmbedMode } from './embed-mode';

/** Important conversion steps (excludes passive SiteLanding). */
export const TICKER_FUNNEL_STEPS = [
  'GetReferralLink',
  'CopyReferralLink',
  'ShareReferral',
  'OpenPrizeClaim',
  'SubmitPrizeClaim',
] as const;

export type TickerFunnelStep = (typeof TICKER_FUNNEL_STEPS)[number];

export type FunnelTickerKind = 'funnel' | 'referral' | 'share' | 'rank_move';

export interface FunnelTickerRow {
  kind: FunnelTickerKind;
  step?: string;
  referrer_code?: string;
  platform?: string;
  country_code?: string | null;
  created_at: string;
  /** Client-only rank move fields */
  new_rank?: number;
  previous_rank?: number | null;
}

const STEP_LABELS: Record<string, string> = {
  GetReferralLink: 'just got their referral link',
  CopyReferralLink: 'just copied their link',
  ShareReferral: 'just shared their link',
  OpenPrizeClaim: 'opened the #1 feature claim',
  SubmitPrizeClaim: 'submitted a #1 feature claim',
};

export function isTickerFunnelStep(step: string | undefined): step is TickerFunnelStep {
  return !!step && (TICKER_FUNNEL_STEPS as readonly string[]).includes(step);
}

/** True when this browser has completed GetReferralLink (has a VIRAL code). */
export function shouldShowFunnelTicker(myReferralCode: string | null | undefined): boolean {
  if (typeof document !== 'undefined' && isEmbedMode()) return false;
  const code = String(myReferralCode || '').trim();
  return /^VIRAL-/i.test(code);
}

function countryPhrase(country: string | null | undefined): string {
  const c = String(country || '')
    .trim()
    .toUpperCase();
  if (!c || c.length !== 2 || c === 'XX' || c === 'ZZ') return 'Someone';
  return `Someone in ${c}`;
}

function shortCode(code: string | undefined): string {
  const c = String(code || '')
    .trim()
    .toUpperCase();
  if (!c) return 'a participant';
  return c.length > 14 ? `${c.slice(0, 12)}…` : c;
}

/** Human FOMO line for one ticker row (no HTML). */
export function formatFunnelTickerLabel(row: FunnelTickerRow): string {
  if (row.kind === 'funnel' && row.step) {
    const action = STEP_LABELS[row.step] || 'took a big step';
    return `${countryPhrase(row.country_code)} ${action}`;
  }
  if (row.kind === 'share') {
    const platform = formatSharePlatformLabel(row.platform);
    return `${shortCode(row.referrer_code)} shared on ${platform}`;
  }
  if (row.kind === 'rank_move' && row.new_rank != null) {
    if (row.new_rank === 1) return `${shortCode(row.referrer_code)} just hit #1`;
    return `${shortCode(row.referrer_code)} climbed to #${row.new_rank}`;
  }
  // referral credited
  return `New referral credited to ${shortCode(row.referrer_code)}`;
}

export function normalizeFunnelTickerRows(raw: unknown): FunnelTickerRow[] {
  if (!Array.isArray(raw)) return [];
  const out: FunnelTickerRow[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const row = item as Record<string, unknown>;
    const kindRaw = String(row.kind || '').toLowerCase();
    const created = String(row.created_at || row.createdAt || '').trim();
    if (!created) continue;

    if (kindRaw === 'funnel') {
      const step = String(row.step || row.event_name || '').trim();
      if (!isTickerFunnelStep(step)) continue;
      out.push({
        kind: 'funnel',
        step,
        country_code: row.country_code ? String(row.country_code) : null,
        created_at: created,
      });
      continue;
    }
    if (kindRaw === 'share') {
      const code = String(row.referrer_code || '').trim();
      if (!code) continue;
      out.push({
        kind: 'share',
        referrer_code: code,
        platform: row.platform ? String(row.platform) : undefined,
        created_at: created,
      });
      continue;
    }
    if (kindRaw === 'rank_move') {
      const code = String(row.referrer_code || '').trim();
      if (!code) continue;
      out.push({
        kind: 'rank_move',
        referrer_code: code,
        new_rank: typeof row.new_rank === 'number' ? row.new_rank : Number(row.new_rank) || undefined,
        previous_rank:
          row.previous_rank == null
            ? null
            : typeof row.previous_rank === 'number'
              ? row.previous_rank
              : Number(row.previous_rank),
        created_at: created,
      });
      continue;
    }
    // referral (default)
    const code = String(row.referrer_code || '').trim();
    if (!code) continue;
    out.push({
      kind: 'referral',
      referrer_code: code,
      created_at: created,
    });
  }
  return out;
}

/** Map existing public activity rows into ticker rows (fallback when RPC missing). */
export function publicActivityToTickerRows(
  rows: readonly PublicActivityRow[],
): FunnelTickerRow[] {
  return rows.map((r) => {
    if (r.kind === 'share') {
      return {
        kind: 'share' as const,
        referrer_code: r.referrer_code,
        platform: r.platform,
        created_at: r.created_at,
      };
    }
    if (r.kind === 'rank_move') {
      return {
        kind: 'rank_move' as const,
        referrer_code: r.referrer_code,
        new_rank: r.new_rank,
        previous_rank: r.previous_rank,
        created_at: r.created_at,
      };
    }
    return {
      kind: 'referral' as const,
      referrer_code: r.referrer_code,
      created_at: r.created_at,
    };
  });
}

/** Merge server ticker + public activity + rank moves; newest first, de-dupe by label+minute. */
export function mergeFunnelTickerRows(
  primary: readonly FunnelTickerRow[],
  fallback: readonly FunnelTickerRow[],
  limit = 24,
): FunnelTickerRow[] {
  const merged = [...primary, ...fallback].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
  const seen = new Set<string>();
  const out: FunnelTickerRow[] = [];
  for (const row of merged) {
    const label = formatFunnelTickerLabel(row);
    const minute = row.created_at.slice(0, 16);
    const key = `${label}|${minute}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(row);
    if (out.length >= limit) break;
  }
  return out;
}

/** Build marquee HTML (duplicated track for seamless loop). */
export function buildFunnelTickerHtml(rows: readonly FunnelTickerRow[]): string {
  if (!rows.length) {
    return `<span class="vr-funnel-ticker-item"><span class="vr-funnel-ticker-icon" aria-hidden="true">⚡</span>The worldwide board is live — share your link to climb</span>`;
  }
  const items = rows
    .map((row) => {
      const label = formatFunnelTickerLabel(row);
      const icon =
        row.kind === 'funnel'
          ? '🔥'
          : row.kind === 'share'
            ? '📣'
            : row.kind === 'rank_move'
              ? '📈'
              : '🎯';
      return `<span class="vr-funnel-ticker-item"><span class="vr-funnel-ticker-icon" aria-hidden="true">${icon}</span>${escapeHtml(label)}</span>`;
    })
    .join('<span class="vr-funnel-ticker-sep" aria-hidden="true">·</span>');

  // Duplicate for seamless CSS marquee
  return `<div class="vr-funnel-ticker-seq">${items}</div><div class="vr-funnel-ticker-seq" aria-hidden="true">${items}</div>`;
}

export function ensureFunnelTickerDom(): HTMLElement | null {
  if (typeof document === 'undefined') return null;
  let el = document.getElementById('vr-funnel-ticker');
  if (el) return el;

  el = document.createElement('div');
  el.id = 'vr-funnel-ticker';
  el.className = 'vr-funnel-ticker hidden';
  el.setAttribute('role', 'region');
  el.setAttribute('aria-label', 'Live worldwide activity');
  el.setAttribute('hidden', '');
  el.innerHTML = `
    <div class="vr-funnel-ticker-bar">
      <span class="vr-funnel-ticker-live" aria-hidden="true"><i class="fa-solid fa-bolt"></i> LIVE WORLDWIDE</span>
      <div class="vr-funnel-ticker-viewport">
        <div class="vr-funnel-ticker-track" id="vr-funnel-ticker-track"></div>
      </div>
    </div>`;

  const nav = document.getElementById('vr-nav');
  if (nav?.parentElement) {
    nav.insertAdjacentElement('afterend', el);
  } else {
    document.body.prepend(el);
  }
  return el;
}

export function setFunnelTickerVisible(visible: boolean): void {
  const el = ensureFunnelTickerDom();
  if (!el) return;
  if (visible) {
    el.classList.remove('hidden');
    el.removeAttribute('hidden');
    document.documentElement.classList.add('vr-has-funnel-ticker');
  } else {
    el.classList.add('hidden');
    el.setAttribute('hidden', '');
    document.documentElement.classList.remove('vr-has-funnel-ticker');
  }
}

export function renderFunnelTickerRows(rows: readonly FunnelTickerRow[]): void {
  const el = ensureFunnelTickerDom();
  if (!el) return;
  const track = el.querySelector('#vr-funnel-ticker-track') as HTMLElement | null;
  if (!track) return;
  track.innerHTML = buildFunnelTickerHtml(rows);
}
