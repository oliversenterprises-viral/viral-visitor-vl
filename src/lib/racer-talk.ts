/**
 * Public post–Get my link “Message from ViralRefer” panel.
 * No email. Owner turns it on/off in Website → Talk. Fail-open if CMS/edge is empty.
 */

import { escapeHtml } from './escape-html';
import {
  formatBroadcastBodyHtml,
  isSafeHttpUrl,
  parseOwnerBroadcast,
  type OwnerBroadcastPayload,
  type OwnerBroadcastSponsor,
} from './owner-broadcast';
import { supabase } from './supabase';
import {
  RACER_TALK_DEFAULT_TITLE,
  parseRacerTalkMessage,
  racerTalkContentFromPublic,
  type RacerTalkMessage,
} from '../../supabase/functions/_shared/racer-talk';

export {
  RACER_TALK_DEFAULT_TITLE,
  parseRacerTalkMessage,
  racerTalkContentFromPublic,
} from '../../supabase/functions/_shared/racer-talk';
export type { RacerTalkMessage } from '../../supabase/functions/_shared/racer-talk';

export const RACER_TALK_ROOT_ID = 'racer-talk';
export const RACER_TALK_FORM_ID = 'racer-talk-form';
export const RACER_PING_ID = 'racer-ping';
export const RACER_TALK_READY_ATTR = 'data-talk-ready';

const BODY_ID = 'racer-talk-body';
const MEDIA_ID = 'racer-talk-media';
const SPONSOR_ID = 'racer-talk-sponsor';

export function visitorMaySeeRacerTalk(root: HTMLElement = document.documentElement): boolean {
  return root.hasAttribute('data-vr-has-link') || root.hasAttribute('data-vr-post-link-one');
}

export function messageFromTalkContent(
  content: Record<string, unknown> | null | undefined,
): OwnerBroadcastPayload | RacerTalkMessage | null {
  return parseOwnerBroadcast(content) || parseRacerTalkMessage(content);
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

function ensureRacerTalkRoot(): HTMLElement {
  let el = document.getElementById(RACER_TALK_ROOT_ID) as HTMLElement | null;
  if (el) {
    if (!el.querySelector(`#${RACER_TALK_FORM_ID}`)) {
      const form = document.createElement('form');
      form.id = RACER_TALK_FORM_ID;
      form.className = 'racer-talk__form hidden';
      form.hidden = true;
      form.setAttribute('hidden', '');
      form.setAttribute('data-racer-talk-form', '1');
      el.appendChild(form);
    }
    ensureRacerPing();
    return el;
  }

  el = document.createElement('aside');
  el.id = RACER_TALK_ROOT_ID;
  el.className = 'racer-talk hidden';
  el.hidden = true;
  el.setAttribute('hidden', '');
  el.setAttribute('data-racer-talk', '1');
  el.setAttribute('role', 'region');
  el.setAttribute('aria-label', RACER_TALK_DEFAULT_TITLE);
  el.innerHTML = `
    <p class="racer-talk__kicker">${escapeHtml(RACER_TALK_DEFAULT_TITLE)}</p>
    <h2 class="racer-talk__title">${escapeHtml(RACER_TALK_DEFAULT_TITLE)}</h2>
    <div id="${MEDIA_ID}" class="racer-talk__media" hidden></div>
    <div id="${BODY_ID}" class="racer-talk__body"></div>
    <div id="${SPONSOR_ID}" class="racer-talk__sponsor" hidden></div>
    <form id="${RACER_TALK_FORM_ID}" class="racer-talk__form hidden" hidden data-racer-talk-form="1"></form>
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
  ensureRacerPing();
  return el;
}

function ensureRacerPing(): HTMLElement | null {
  let ping = document.getElementById(RACER_PING_ID) as HTMLElement | null;
  if (ping) return ping;
  ping = document.createElement('section');
  ping.id = RACER_PING_ID;
  ping.className = 'racer-ping hidden';
  ping.hidden = true;
  ping.setAttribute('hidden', '');
  ping.setAttribute('data-racer-ping', '1');
  ping.setAttribute('aria-label', 'Racer ping');
  ping.innerHTML = `
    <p class="racer-ping__kicker">Racer ping</p>
    <p class="racer-ping__body">Ping after Get my link. No email.</p>
  `;
  const talk = document.getElementById(RACER_TALK_ROOT_ID);
  if (talk?.parentElement) {
    talk.insertAdjacentElement('afterend', ping);
  } else {
    const host = document.getElementById('referral-section');
    if (host) host.appendChild(ping);
    else document.body.appendChild(ping);
  }
  return ping;
}

function renderSponsorHtml(sponsor: OwnerBroadcastSponsor | NonNullable<RacerTalkMessage['sponsor']>): string {
  const url = escapeHtml(sponsor.url);
  const img = sponsor.imageUrl
    ? `<img src="${escapeHtml(sponsor.imageUrl)}" alt="${escapeHtml(sponsor.label)}" class="racer-talk__sponsor-img" loading="lazy" decoding="async" referrerpolicy="no-referrer" />`
    : '';
  return `
    <p class="racer-talk__sponsor-badge">Sponsored</p>
    <div class="racer-talk__sponsor-row">
      ${
        sponsor.imageUrl
          ? `<a href="${url}" target="_blank" rel="noopener noreferrer" class="racer-talk__sponsor-img-link" data-vr-zone="owner-broadcast-sponsor-img" data-bc-kind="sponsor_img" data-bc-href="${url}">${img}</a>`
          : ''
      }
      <div class="racer-talk__sponsor-copy">
        <p class="racer-talk__sponsor-label">${escapeHtml(sponsor.label)}</p>
        <a href="${url}" target="_blank" rel="noopener noreferrer" class="racer-talk__sponsor-cta" data-vr-zone="owner-broadcast-sponsor" data-bc-kind="sponsor" data-bc-href="${url}">
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

function paintPanel(el: HTMLElement, msg: OwnerBroadcastPayload | RacerTalkMessage): void {
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
      media.innerHTML = `<img src="${escapeHtml(msg.mediaUrl)}" alt="" class="racer-talk__media-img" loading="lazy" decoding="async" referrerpolicy="no-referrer" />`;
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
