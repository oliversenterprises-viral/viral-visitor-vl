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
 * - owner_broadcast_sponsor_image: optional image URL (http/https) — paste or admin upload
 * - owner_broadcast_sponsor_cta: optional button label (default Visit sponsor)
 * - owner_broadcast_media_url: optional message image (http/https) — paste or admin upload
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
  /** Optional image shown under the title (uploaded or URL). */
  mediaUrl: string | null;
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

function safeAnchor(
  href: string,
  label: string,
  opts?: { extraClass?: string; zone?: string; kind?: string },
): string {
  const safeHref = escapeHtml(href);
  const safeLabel = escapeHtml(label);
  const cls = [
    'text-violet-300 underline underline-offset-2 hover:text-violet-200 break-all',
    opts?.extraClass || '',
  ]
    .filter(Boolean)
    .join(' ');
  const zone = opts?.zone || 'owner-broadcast-link';
  const kind = opts?.kind || 'body';
  return `<a href="${safeHref}" target="_blank" rel="noopener noreferrer" class="${cls}" data-vr-zone="${escapeHtml(zone)}" data-bc-kind="${escapeHtml(kind)}" data-bc-href="${safeHref}">${safeLabel}</a>`;
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
    return safeAnchor(url, url, { zone: 'owner-broadcast-link', kind: 'body' }) + trail;
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
      out += safeAnchor(href, label, { zone: 'owner-broadcast-link', kind: 'body' });
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
  const mediaRaw = normalizeSiteContentText(content['owner_broadcast_media_url'])?.trim() || '';
  const mediaUrl = mediaRaw && isSafeHttpUrl(mediaRaw) ? mediaRaw.slice(0, 2000) : null;

  // Need at least a message body, media image, or a valid sponsor ad
  if (!body && !sponsor && !mediaUrl) return null;

  const explicitId = normalizeSiteContentText(content['owner_broadcast_id'])?.trim();
  const id = broadcastMessageId(title, body || sponsor?.url || mediaUrl || 'media', explicitId);

  return {
    enabled: true,
    title: title.slice(0, 120),
    body: body.slice(0, 2000),
    id,
    mediaUrl,
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
  try {
    document.documentElement.removeAttribute('data-vr-broadcast');
  } catch {
    /* ignore */
  }
}

function renderSponsorHtml(sponsor: OwnerBroadcastSponsor): string {
  const img = sponsor.imageUrl
    ? `<img src="${escapeHtml(sponsor.imageUrl)}" alt="${escapeHtml(sponsor.label)}" class="vr-bc-sponsor-img" loading="lazy" decoding="async" referrerpolicy="no-referrer" />`
    : '';
  const url = escapeHtml(sponsor.url);
  return `
    <div class="vr-bc-sponsor">
      <p class="vr-bc-sponsor-badge">Sponsored</p>
      <div class="vr-bc-sponsor-row">
        ${
          sponsor.imageUrl
            ? `<a href="${url}" target="_blank" rel="noopener noreferrer" class="vr-bc-sponsor-img-link" data-vr-zone="owner-broadcast-sponsor-img" data-bc-kind="sponsor_img" data-bc-href="${url}">${img}</a>`
            : ''
        }
        <div class="vr-bc-sponsor-copy min-w-0 flex-1">
          <p class="vr-bc-sponsor-label">${escapeHtml(sponsor.label)}</p>
          <a href="${url}" target="_blank" rel="noopener noreferrer" class="vr-bc-sponsor-cta" data-vr-zone="owner-broadcast-sponsor" data-bc-kind="sponsor" data-bc-href="${url}">
            ${escapeHtml(sponsor.cta)} <i class="fa-solid fa-arrow-up-right-from-square" aria-hidden="true"></i>
          </a>
        </div>
      </div>
    </div>
  `;
}

function wireBroadcastClickTracking(root: HTMLElement, broadcastId: string): void {
  if (root.dataset.bcClicksBound === '1') return;
  root.dataset.bcClicksBound = '1';
  root.addEventListener(
    'click',
    (ev) => {
      try {
        const t = ev.target;
        if (!(t instanceof Element)) return;
        const a = t.closest('a[href]') as HTMLAnchorElement | null;
        if (!a || !root.contains(a)) return;
        const href = (a.getAttribute('data-bc-href') || a.href || '').trim();
        if (!href || !isSafeHttpUrl(href)) return;
        const kindRaw = (a.getAttribute('data-bc-kind') || 'body').toLowerCase();
        const kind =
          kindRaw === 'sponsor' || kindRaw === 'sponsor_img' ? kindRaw : 'body';
        const label = (a.textContent || '').trim().slice(0, 120);
        void import('./interaction-tracking')
          .then((m) =>
            m.trackBroadcastLinkClick({
              href,
              kind: kind as 'body' | 'sponsor' | 'sponsor_img',
              broadcastId,
              label,
            }),
          )
          .catch(() => {});
      } catch {
        /* never block navigation */
      }
    },
    { capture: true },
  );
}

/** Prefer content shell under fixed nav so the banner never sits under/over the navbar wrongly. */
function resolveBroadcastHost(): HTMLElement {
  // Public homepage shell: first padded content div after fixed #vr-nav
  const underNav = document.querySelector('body > div.max-w-6xl, body > div.pt-20') as HTMLElement | null;
  if (underNav) return underNav;
  const afterNav = document.getElementById('vr-nav')?.nextElementSibling as HTMLElement | null;
  if (afterNav) return afterNav;
  return (
    (document.getElementById('app') as HTMLElement | null) ||
    (document.querySelector('main') as HTMLElement | null) ||
    document.body
  );
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
      resolveBroadcastHost().prepend(el);
    }

    const bodyHtml = msg.body
      ? `<div class="vr-bc-body">${formatBroadcastBodyHtml(msg.body)}</div>`
      : '';
    const mediaHtml = msg.mediaUrl
      ? `<div class="vr-bc-media"><img src="${escapeHtml(msg.mediaUrl)}" alt="" class="vr-bc-media-img" loading="lazy" decoding="async" referrerpolicy="no-referrer" /></div>`
      : '';
    const sponsorHtml = msg.sponsor ? renderSponsorHtml(msg.sponsor) : '';

    el.className = 'vr-owner-broadcast';
    el.dataset.bcId = msg.id;
    el.innerHTML = `
      <div class="vr-bc-inner">
        <span class="vr-bc-icon" aria-hidden="true">
          <i class="fa-solid fa-bullhorn"></i>
        </span>
        <div class="vr-bc-main min-w-0">
          <p class="vr-bc-kicker">Update from ViralRefer</p>
          <p class="vr-bc-title">${escapeHtml(msg.title)}</p>
          ${mediaHtml}
          ${bodyHtml}
          ${sponsorHtml}
        </div>
      </div>
    `;
    wireBroadcastClickTracking(el, msg.id);
    document.documentElement.setAttribute('data-vr-broadcast', '1');
  } catch {
    /* never break homepage for broadcast */
  }
}
