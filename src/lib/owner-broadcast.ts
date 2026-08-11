/**
 * Owner → everyone in-app broadcast via site_content (no email required).
 * Safe additive feature: missing keys = no banner. Fail-open if storage broken.
 *
 * Public visitors cannot dismiss — only the owner turns it off in Admin
 * (Edit Site Content → Message all joiners → Turn OFF banner).
 *
 * Keys (CMS / admin):
 * - owner_broadcast_enabled: "1" | "true" | "yes" to show
 * - owner_broadcast_title: short headline
 * - owner_broadcast_body: message body (plain text)
 * - owner_broadcast_id: optional version id (for your records)
 */

import { normalizeSiteContentText } from './site-content-value';
import { escapeHtml } from './escape-html';

const BANNER_ID = 'vr-owner-broadcast-banner';
/** Legacy key from when visitors could dismiss — cleared so old dismiss never hides owner messages. */
const LEGACY_DISMISS_KEY = 'vr_owner_broadcast_dismissed_id';

export interface OwnerBroadcastPayload {
  enabled: boolean;
  title: string;
  body: string;
  id: string;
}

function truthyFlag(raw: unknown): boolean {
  const s = String(raw ?? '')
    .trim()
    .toLowerCase();
  return s === '1' || s === 'true' || s === 'yes' || s === 'on';
}

/** Stable short id from title/body or explicit CMS id. */
export function broadcastMessageId(title: string, body: string, explicitId?: string): string {
  const explicit = String(explicitId || '').trim();
  if (explicit) return explicit.slice(0, 80);
  const base = `${title}\n${body}`.trim();
  let h = 0;
  for (let i = 0; i < base.length; i++) h = (Math.imul(31, h) + base.charCodeAt(i)) | 0;
  return `bc_${(h >>> 0).toString(16)}`;
}

/** Pure parse from site_content map — unit-tested. */
export function parseOwnerBroadcast(content: Record<string, unknown> | null | undefined): OwnerBroadcastPayload | null {
  if (!content || typeof content !== 'object') return null;
  if (!truthyFlag(content['owner_broadcast_enabled'])) return null;

  const title =
    normalizeSiteContentText(content['owner_broadcast_title'])?.trim() || 'Message from ViralRefer';
  const body = normalizeSiteContentText(content['owner_broadcast_body'])?.trim() || '';
  if (!body) return null;

  const explicitId = normalizeSiteContentText(content['owner_broadcast_id'])?.trim();
  const id = broadcastMessageId(title, body, explicitId);

  return {
    enabled: true,
    title: title.slice(0, 120),
    body: body.slice(0, 2000),
    id,
  };
}

function clearLegacyVisitorDismiss(): void {
  try {
    localStorage.removeItem(LEGACY_DISMISS_KEY);
  } catch {
    /* private mode */
  }
}

function removeBanner(): void {
  document.getElementById(BANNER_ID)?.remove();
}

/**
 * Render or clear the public owner broadcast banner.
 * Only CMS owner_broadcast_enabled=off removes it — no public dismiss.
 * Non-fatal; never throws into content load.
 */
export function applyOwnerBroadcast(content: Record<string, unknown>): void {
  try {
    // Drop any old visitor-side dismiss so owner messages always show when enabled
    clearLegacyVisitorDismiss();

    const msg = parseOwnerBroadcast(content);
    if (!msg) {
      removeBanner();
      return;
    }

    let el = document.getElementById(BANNER_ID) as HTMLElement | null;
    if (!el) {
      el = document.createElement('div');
      el.id = BANNER_ID;
      el.setAttribute('role', 'region');
      el.setAttribute('aria-label', 'Site announcement');
      el.setAttribute('data-owner-only-remove', '1');
      const host =
        document.getElementById('app') ||
        document.querySelector('main') ||
        document.body;
      host.prepend(el);
    }

    el.className =
      'vr-owner-broadcast sticky top-0 z-[80] border-b border-violet-400/40 bg-gradient-to-r from-violet-950/95 via-zinc-950/95 to-fuchsia-950/95 backdrop-blur-md shadow-lg shadow-violet-900/20';
    el.innerHTML = `
      <div class="max-w-5xl mx-auto px-4 py-3 flex items-start gap-3">
        <span class="mt-0.5 shrink-0 w-8 h-8 rounded-xl bg-violet-500/25 text-violet-200 flex items-center justify-center" aria-hidden="true">
          <i class="fa-solid fa-bullhorn text-sm"></i>
        </span>
        <div class="min-w-0 flex-1">
          <p class="text-[10px] uppercase tracking-wider font-bold text-violet-300/90 mb-0.5">Update from ViralRefer</p>
          <p class="text-sm font-semibold text-white leading-snug">${escapeHtml(msg.title)}</p>
          <p class="text-sm text-zinc-300 mt-1 leading-relaxed whitespace-pre-wrap">${escapeHtml(msg.body)}</p>
        </div>
      </div>
    `;
  } catch {
    /* never break homepage for broadcast */
  }
}
