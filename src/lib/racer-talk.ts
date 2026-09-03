/**
 * Public post–Get my link “Message from ViralRefer” panel.
 * No email. Owner turns it on/off in Website content. Fail-open if CMS/edge is empty.
 * Uses existing owner-broadcast CSS (no style.css edits).
 */

import { escapeHtml } from './escape-html';
import { formatBroadcastBodyHtml, isSafeHttpUrl } from './owner-broadcast';
import { supabase } from './supabase';
import {
  RACER_TALK_DEFAULT_TITLE,
  messageFromTalkContent,
  parseRacerTalkMessage,
  racerTalkContentFromPublic,
  type RacerTalkMessage,
  type RacerTalkSponsor,
} from './racer-talk-parse';

export {
  RACER_TALK_DEFAULT_TITLE,
  messageFromTalkContent,
  parseRacerTalkMessage,
  racerTalkContentFromPublic,
} from './racer-talk-parse';
export type { RacerTalkMessage } from './racer-talk-parse';

export const RACER_TALK_ROOT_ID = 'racer-talk';
export const RACER_TALK_READY_ATTR = 'data-talk-ready';

const BODY_ID = 'racer-talk-body';
const MEDIA_ID = 'racer-talk-media';
const SPONSOR_ID = 'racer-talk-sponsor';
const LEGACY_BANNER_ID = 'vr-owner-broadcast-banner';

export function visitorMaySeeRacerTalk(root: HTMLElement = document.documentElement): boolean {
  return root.hasAttribute('data-vr-has-link') || root.hasAttribute('data-vr-post-link-one');
}

function showEl(el: HTMLElement): void {
  el.hidden = false;
  el.removeAttribute('hidden');
  el.classList.remove('hidden');
}

function hideEl(el: HTMLElement): void {
  el.hidden = true;
  el.setAttribute('hidden', '');
  el.classList.add('hidden');
}

function removeLegacySitewideBanner(): void {
  document.getElementById(LEGACY_BANNER_ID)?.remove();
  try {
    document.documentElement.removeAttribute('data-vr-broadcast');
  } catch {
    /* ignore */
  }
}

function ensureRacerTalkRoot(): HTMLElement {
  let el = document.getElementById(RACER_TALK_ROOT_ID) as HTMLElement | null;
  if (el) return el;

  el = document.createElement('aside');
  el.id = RACER_TALK_ROOT_ID;
  el.className = 'vr-owner-broadcast racer-talk hidden';
  el.hidden = true;
  el.setAttribute('hidden', '');
  el.setAttribute('data-racer-talk', '1');
  el.setAttribute('role', 'region');
  el.setAttribute('aria-label', RACER_TALK_DEFAULT_TITLE);
  el.innerHTML = `
    <div class="vr-bc-inner">
      <span class="vr-bc-icon" aria-hidden="true"><i class="fa-solid fa-bullhorn"></i></span>
      <div class="vr-bc-main min-w-0">
        <p class="vr-bc-kicker racer-talk__kicker">${escapeHtml(RACER_TALK_DEFAULT_TITLE)}</p>
        <p class="vr-bc-title racer-talk__title">${escapeHtml(RACER_TALK_DEFAULT_TITLE)}</p>
        <div id="${MEDIA_ID}" class="vr-bc-media racer-talk__media hidden" hidden></div>
        <div id="${BODY_ID}" class="vr-bc-body racer-talk__body"></div>
        <div id="${SPONSOR_ID}" class="vr-bc-sponsor racer-talk__sponsor hidden" hidden></div>
      </div>
    </div>
  `;

  const afterShare = document.getElementById('post-link-share');
  const host = document.getElementById('referral-section');
  if (afterShare?.parentElement) {
    afterShare.insertAdjacentElement('afterend', el);
  } else if (host) {
    host.appendChild(el);
  } else {
    document.body.appendChild(el);
  }
  return el;
}

function renderSponsorHtml(sponsor: RacerTalkSponsor): string {
  const url = escapeHtml(sponsor.url);
  const img = sponsor.imageUrl
    ? `<img src="${escapeHtml(sponsor.imageUrl)}" alt="${escapeHtml(sponsor.label)}" class="vr-bc-sponsor-img" loading="lazy" decoding="async" referrerpolicy="no-referrer" />`
    : '';
  return `
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
          ${escapeHtml(sponsor.cta)}
        </a>
      </div>
    </div>
  `;
}

function wireTalkClicks(root: HTMLElement, broadcastId: string): void {
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
        const kind = kindRaw === 'sponsor' || kindRaw === 'sponsor_img' ? kindRaw : 'body';
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

function clearPanel(el: HTMLElement): void {
  el.removeAttribute(RACER_TALK_READY_ATTR);
  el.dataset.talkReady = '';
  const title = el.querySelector('.racer-talk__title');
  if (title) title.textContent = RACER_TALK_DEFAULT_TITLE;
  const body = el.querySelector(`#${BODY_ID}`);
  if (body) body.innerHTML = '';
  const media = el.querySelector(`#${MEDIA_ID}`) as HTMLElement | null;
  if (media) {
    media.innerHTML = '';
    hideEl(media);
  }
  const sponsor = el.querySelector(`#${SPONSOR_ID}`) as HTMLElement | null;
  if (sponsor) {
    sponsor.innerHTML = '';
    hideEl(sponsor);
  }
  hideEl(el);
}

function paintPanel(el: HTMLElement, msg: RacerTalkMessage): void {
  const title = el.querySelector('.racer-talk__title');
  if (title) title.textContent = msg.title || RACER_TALK_DEFAULT_TITLE;
  const kicker = el.querySelector('.racer-talk__kicker');
  if (kicker) kicker.textContent = RACER_TALK_DEFAULT_TITLE;

  const body = el.querySelector(`#${BODY_ID}`);
  if (body) {
    body.innerHTML = msg.body ? formatBroadcastBodyHtml(msg.body) : '';
  }

  const media = el.querySelector(`#${MEDIA_ID}`) as HTMLElement | null;
  if (media) {
    if (msg.mediaUrl && isSafeHttpUrl(msg.mediaUrl)) {
      media.innerHTML = `<img src="${escapeHtml(msg.mediaUrl)}" alt="" class="vr-bc-media-img" loading="lazy" decoding="async" referrerpolicy="no-referrer" />`;
      showEl(media);
    } else {
      media.innerHTML = '';
      hideEl(media);
    }
  }

  const sponsor = el.querySelector(`#${SPONSOR_ID}`) as HTMLElement | null;
  if (sponsor) {
    if (msg.sponsor) {
      sponsor.innerHTML = renderSponsorHtml(msg.sponsor);
      showEl(sponsor);
    } else {
      sponsor.innerHTML = '';
      hideEl(sponsor);
    }
  }

  el.dataset.talkId = msg.id;
  el.dataset.talkReady = '1';
  el.setAttribute(RACER_TALK_READY_ATTR, '1');
  el.setAttribute('aria-label', msg.title || RACER_TALK_DEFAULT_TITLE);
  wireTalkClicks(el, msg.id);
}

export function hideRacerTalk(): void {
  const el = document.getElementById(RACER_TALK_ROOT_ID) as HTMLElement | null;
  if (el) hideEl(el);
}

/** Show the painted panel only after Get my link. */
export function revealRacerTalk(): void {
  try {
    const el = document.getElementById(RACER_TALK_ROOT_ID) as HTMLElement | null;
    if (!el || el.dataset.talkReady !== '1') return;
    if (!visitorMaySeeRacerTalk()) return;
    showEl(el);
  } catch {
    /* never break Get my link */
  }
}

/** Paint from site_content. Hidden until the visitor has a link. */
export function applyRacerTalkFromContent(content: Record<string, unknown>): void {
  try {
    removeLegacySitewideBanner();
    const el = ensureRacerTalkRoot();
    const msg = messageFromTalkContent(content);
    if (!msg) {
      clearPanel(el);
      return;
    }
    paintPanel(el, msg);
    if (visitorMaySeeRacerTalk()) showEl(el);
    else hideEl(el);
  } catch {
    /* never break homepage */
  }
}

function edgePayloadToContent(data: unknown): Record<string, unknown> | null {
  if (!data || typeof data !== 'object') return null;
  const rec = data as Record<string, unknown>;
  const rawMsg = rec.message;
  if (rawMsg && typeof rawMsg === 'object') {
    const parsed = parseRacerTalkMessage(racerTalkContentFromPublic(rawMsg as RacerTalkMessage));
    if (parsed) return racerTalkContentFromPublic(parsed);
    const fallback = parseRacerTalkMessage(rawMsg as Record<string, unknown>);
    if (fallback) return racerTalkContentFromPublic(fallback);
  }
  if (rec.enabled === false) return {};
  return parseRacerTalkMessage(rec) ? rec : null;
}

export async function fetchRacerTalkFromEdge(): Promise<Record<string, unknown> | null> {
  try {
    const { data, error } = await supabase.functions.invoke('racer-talk', {
      body: { action: 'get' },
    });
    if (error || !data) return null;
    return edgePayloadToContent(data);
  } catch {
    return null;
  }
}

async function hydrateRacerTalkFromEdge(): Promise<void> {
  const content = await fetchRacerTalkFromEdge();
  if (!content || Object.keys(content).length === 0) return;
  applyRacerTalkFromContent(content);
}

/** Watch has-link and refresh from the racer-talk function when present. */
export function initRacerTalk(): void {
  try {
    ensureRacerTalkRoot();
    const root = document.documentElement;
    if (root.dataset.racerTalkBound === '1') {
      if (visitorMaySeeRacerTalk()) revealRacerTalk();
      return;
    }
    root.dataset.racerTalkBound = '1';
    const mo = new MutationObserver(() => {
      if (visitorMaySeeRacerTalk()) revealRacerTalk();
    });
    mo.observe(root, {
      attributes: true,
      attributeFilter: ['data-vr-has-link', 'data-vr-post-link-one'],
    });
    if (visitorMaySeeRacerTalk()) revealRacerTalk();
    void hydrateRacerTalkFromEdge();
  } catch {
    /* non-fatal */
  }
}
