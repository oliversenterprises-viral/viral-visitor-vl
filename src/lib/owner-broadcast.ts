/**
 * Owner → everyone in-app broadcast via site_content (no email required).
 * Safe additive feature: missing keys = no banner. Fail-open if storage broken.
 *
 * Public visitors cannot dismiss — only the owner turns it off in Admin.
 *
 * Keys (CMS / admin):
 * - owner_broadcast_enabled: "1" | "true" | "yes" to show
 * - owner_broadcast_title: short headline
 * - owner_broadcast_body: message (URLs + [label](url) become clickable; http/https only)
 * - owner_broadcast_id: optional version id
 * - owner_broadcast_sponsor_label: sponsor name / headline
 * - owner_broadcast_sponsor_url: click destination (http/https)
 * - owner_broadcast_sponsor_image: optional image URL (http/https)
 * - owner_broadcast_sponsor_cta: optional button label (default Visit sponsor)
 */

import { normalizeSiteContentText } from './site-content-value';
import { escapeHtml } from './escape-html';

const BANNER_ID = 'vr-owner-broadcast-banner';
const LEGACY_DISMISS_KEY = 'vr_owner_broadcast_dismissed_id';

export interface OwnerBroadcastSponsor {
  label: string;
  url: string;
  imageUrl: string | null;
  cta: string;
}

export interface OwnerBroadcastPayload {
  enabled: boolean;
  title: string;
  body: string;
  id: string;
  sponsor: OwnerBroadcastSponsor | null;
}

function truthyFlag(raw: unknown): boolean {
  const s = String(raw ?? '')
    .trim()
    .toLowerCase();
  return s === '1' || s === 'true' || s === 'yes' || s === 'on';
}

/** Only allow http(s) absolute URLs — blocks javascript:, data:, etc. */
export function isSafeHttpUrl(raw: string): boolean {
  const s = String(raw || '').trim();
  if (!s || s.length > 2000) return false;
  try {
    const u = new URL(s);
    return u.protocol === 'https:' || u.protocol === 'http:';
  } catch {
    return false;
  }
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

function safeAnchor(href: string, label: string, extraClass = ''): string {
  const safeHref = escapeHtml(href);
  const safeLabel = escapeHtml(label);
  const cls = [
    'text-violet-300 underline underline-offset-2 hover:text-violet-200 break-all',
    extraClass,
  ]
    .filter(Boolean)
    .join(' ');
  return `<a href="${safeHref}" target="_blank" rel="noopener noreferrer" class="${cls}">${safeLabel}</a>`;
}

/**
 * Escape text, then turn bare http(s) URLs into links.
 * Unit-tested pure helper.
 */
export function linkifyEscapedText(escapedText: string): string {
  // After escapeHtml, URLs only change if they had & " ' < > — still match carefully
  const re = /https?:\/\/[^\s<&"']+/gi;
  return escapedText.replace(re, (match) => {
    // Strip trailing punctuation common in prose
    let url = match;
    let trail = '';
    while (/[.,);:!?]$/.test(url)) {
      trail = url.slice(-1) + trail;
      url = url.slice(0, -1);
    }
    if (!isSafeHttpUrl(url)) return match;
    return safeAnchor(url, url) + trail;
  });
}

/**
 * Format broadcast body: supports [label](https://url) + bare URLs.
 * Everything else is HTML-escaped (no raw HTML injection).
 */
export function formatBroadcastBodyHtml(rawBody: string): string {
  const text = String(rawBody || '');
  if (!text) return '';

  // Split on markdown links [label](url)
  const mdRe = /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/gi;
  let out = '';
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = mdRe.exec(text)) !== null) {
    out += linkifyEscapedText(escapeHtml(text.slice(last, m.index)));
    const label = m[1];
    const href = m[2];
    if (isSafeHttpUrl(href)) {
      out += safeAnchor(href, label);
    } else {
      out += escapeHtml(m[0]);
    }
    last = m.index + m[0].length;
  }
  out += linkifyEscapedText(escapeHtml(text.slice(last)));
  return out;
}

function parseSponsor(content: Record<string, unknown>): OwnerBroadcastSponsor | null {
  const urlRaw = normalizeSiteContentText(content['owner_broadcast_sponsor_url'])?.trim() || '';
  if (!urlRaw || !isSafeHttpUrl(urlRaw)) return null;

  const label =
    normalizeSiteContentText(content['owner_broadcast_sponsor_label'])?.trim() || 'Sponsored';
  const imageRaw = normalizeSiteContentText(content['owner_broadcast_sponsor_image'])?.trim() || '';
  const imageUrl = imageRaw && isSafeHttpUrl(imageRaw) ? imageRaw : null;
  const cta =
    normalizeSiteContentText(content['owner_broadcast_sponsor_cta'])?.trim() || 'Visit sponsor';

  return {
    label: label.slice(0, 80),
    url: urlRaw.slice(0, 2000),
    imageUrl: imageUrl ? imageUrl.slice(0, 2000) : null,
    cta: cta.slice(0, 40),
  };
}

/** Pure parse from site_content map — unit-tested. */
export function parseOwnerBroadcast(content: Record<string, unknown> | null | undefined): OwnerBroadcastPayload | null {
  if (!content || typeof content !== 'object') return null;
  if (!truthyFlag(content['owner_broadcast_enabled'])) return null;

  const title =
    normalizeSiteContentText(content['owner_broadcast_title'])?.trim() || 'Message from ViralRefer';
  const body = normalizeSiteContentText(content['owner_broadcast_body'])?.trim() || '';
  const sponsor = parseSponsor(content);

  // Need at least a message body or a valid sponsor ad
  if (!body && !sponsor) return null;

  const explicitId = normalizeSiteContentText(content['owner_broadcast_id'])?.trim();
  const id = broadcastMessageId(title, body || sponsor?.url || 'sponsor', explicitId);

  return {
    enabled: true,
    title: title.slice(0, 120),
    body: body.slice(0, 2000),
    id,
    sponsor,
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

function renderSponsorHtml(sponsor: OwnerBroadcastSponsor): string {
  const img = sponsor.imageUrl
    ? `<img src="${escapeHtml(sponsor.imageUrl)}" alt="${escapeHtml(sponsor.label)}" class="w-full max-h-28 object-contain rounded-lg bg-black/30 border border-white/10" loading="lazy" referrerpolicy="no-referrer" />`
    : '';
  return `
    <div class="mt-3 rounded-xl border border-amber-400/35 bg-amber-500/10 px-3 py-3">
      <p class="text-[10px] uppercase tracking-wider font-bold text-amber-200/90 mb-1.5">Sponsored</p>
      <div class="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        ${sponsor.imageUrl ? `<a href="${escapeHtml(sponsor.url)}" target="_blank" rel="noopener noreferrer" class="shrink-0 w-full sm:w-40 block">${img}</a>` : ''}
        <div class="min-w-0 flex-1">
          <p class="text-sm font-semibold text-amber-50">${escapeHtml(sponsor.label)}</p>
          <a href="${escapeHtml(sponsor.url)}" target="_blank" rel="noopener noreferrer"
            class="inline-flex items-center gap-1.5 mt-2 px-3 py-1.5 rounded-xl bg-amber-500/90 hover:bg-amber-400 text-zinc-950 text-xs font-bold transition-colors">
            ${escapeHtml(sponsor.cta)} <i class="fa-solid fa-arrow-up-right-from-square text-[10px]" aria-hidden="true"></i>
          </a>
        </div>
      </div>
    </div>
  `;
}

/**
 * Render or clear the public owner broadcast banner.
 * Only CMS owner_broadcast_enabled=off removes it — no public dismiss.
 * Non-fatal; never throws into content load.
 */
export function applyOwnerBroadcast(content: Record<string, unknown>): void {
  try {
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

    const bodyHtml = msg.body
      ? `<p class="text-sm text-zinc-300 mt-1 leading-relaxed whitespace-pre-wrap">${formatBroadcastBodyHtml(msg.body)}</p>`
      : '';
    const sponsorHtml = msg.sponsor ? renderSponsorHtml(msg.sponsor) : '';

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
          ${bodyHtml}
          ${sponsorHtml}
        </div>
      </div>
    `;
  } catch {
    /* never break homepage for broadcast */
  }
}
