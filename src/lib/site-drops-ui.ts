/**
 * Paint live Site Drops and submit Just-entered after send.
 * Safe no-op when the 8:44 homepage has no drop nodes.
 */

import { supabase } from './supabase';
import { parseEdgeFunctionBody } from './edge-response';
import { escapeHtml } from './escape-html';
import { getMyReferralCode } from '../public/globals';
import { getClaimOwnershipToken } from './claim-ownership';
import { showToast } from '../ui';
import {
  ensureTurnstileReady,
  getTurnstileSiteKey,
  getTurnstileToken,
  removeTurnstileWidget,
} from './turnstile';
import {
  ENTERED_TTL_MS,
  RISING_TTL_MS,
  hostnameFromSafeUrl,
  labelFromUrl,
  normalizeWebsiteUrl,
  parseSiteDrops,
  publicChallengerDrops,
  publicEnteredDrops,
  publicRisingDrops,
  utcWeekId,
  type SiteDrop,
  type SiteDropsState,
} from './site-drops';
import { t } from './i18n';

const URL_KEY = 'vr_site_drop_url';
const LABEL_KEY = 'vr_site_drop_label';
const TICKER_EMPTY = 'Paste your site — it shows here for 15 min.';

export function rememberSiteDropWebsite(url: string, label = ''): void {
  try {
    const clean = String(url || '').trim();
    if (clean) localStorage.setItem(URL_KEY, clean);
    const name = String(label || '').trim();
    if (name) localStorage.setItem(LABEL_KEY, name);
  } catch {
    /* private mode */
  }
}

export function readRememberedSiteDropWebsite(): { url: string; label: string } {
  try {
    return {
      url: String(localStorage.getItem(URL_KEY) || '').trim(),
      label: String(localStorage.getItem(LABEL_KEY) || '').trim(),
    };
  } catch {
    return { url: '', label: '' };
  }
}

function remainLabel(expiresAt: string, now: Date): string {
  const ms = Date.parse(expiresAt) - now.getTime();
  if (!Number.isFinite(ms) || ms <= 0) return 'ended';
  const sec = Math.floor(ms / 1000);
  const hours = Math.floor(sec / 3600);
  const mins = Math.floor((sec % 3600) / 60);
  const secs = sec % 60;
  if (hours > 0) return `${hours}h ${mins}m left`;
  if (mins > 0) return `${mins}m ${String(secs).padStart(2, '0')}s left`;
  return `${secs}s left`;
}

function chipHtml(drop: SiteDrop, kicker: string, now: Date): string {
  const host = hostnameFromSafeUrl(drop.url) || '';
  const href = escapeHtml(drop.url);
  const label = escapeHtml(drop.label);
  return `<a class="site-drop-chip" href="${href}" target="_blank" rel="noopener noreferrer" data-vr-zone="site-drop">
    <span class="site-drop-chip__label">${label}</span>
    <span class="site-drop-chip__meta">${escapeHtml(kicker)} · ${escapeHtml(remainLabel(drop.expires_at, now))}</span>
    <span class="site-drop-chip__host">${escapeHtml(host)}</span>
  </a>`;
}

export function paintSiteDrops(raw: unknown, now: Date = new Date()): SiteDropsState {
  const state = parseSiteDrops(raw);
  const entered = publicEnteredDrops(state, now);
  const rising = publicRisingDrops(state, now);
  const challengers = publicChallengerDrops(state, now);

  const enteredList = document.getElementById('site-drops-entered-list');
  const enteredEmpty = document.getElementById('site-drops-entered-empty');
  if (enteredList) {
    enteredList.innerHTML = entered.map((d) => `<li>${chipHtml(d, 'Just entered', now)}</li>`).join('');
  }
  if (enteredEmpty) {
    const has = entered.length > 0;
    enteredEmpty.hidden = has;
    enteredEmpty.classList.toggle('hidden', has);
  }

  const risingList = document.getElementById('site-drops-rising-list');
  const risingEmpty = document.getElementById('site-drops-rising-empty');
  if (risingList) {
    risingList.innerHTML = rising
      .map((d) => `<li>${chipHtml(d, `Rising · ${d.locks} friend${d.locks === 1 ? '' : 's'}`, now)}</li>`)
      .join('');
  }
  if (risingEmpty) {
    const has = rising.length > 0;
    risingEmpty.hidden = has;
    risingEmpty.classList.toggle('hidden', has);
  }

  const challList = document.getElementById('site-drops-challenger-list');
  const challEmpty = document.getElementById('site-drops-challenger-empty');
  if (challList) {
    challList.innerHTML = challengers
      .map((d) => `<li>${chipHtml(d, `Challenger · #${d.rank}`, now)}</li>`)
      .join('');
  }
  if (challEmpty) {
    const has = challengers.length > 0;
    challEmpty.hidden = has;
    challEmpty.classList.toggle('hidden', has);
  }

  paintEnteredTicker(entered, rising, now);

  const openLabel = t('drop.rung_open') || 'open';
  paintFirstScreenRung('entered', entered, openLabel);
  paintFirstScreenRung('rising', rising, openLabel);
  paintFirstScreenRung('challenger', challengers, openLabel);

  return state;
}

function sendScreenWantsTicker(): boolean {
  const html = document.documentElement;
  return html.hasAttribute('data-vr-has-link') || html.hasAttribute('data-vr-post-link-one');
}

function showEnteredTicker(innerHtml: string): void {
  const ticker = document.getElementById('site-entered-ticker');
  const chips = document.getElementById('site-entered-chips');
  if (!ticker || !chips) return;
  ticker.hidden = false;
  ticker.removeAttribute('hidden');
  ticker.classList.remove('hidden');
  chips.innerHTML = innerHtml;
}

function hideEnteredTicker(): void {
  const ticker = document.getElementById('site-entered-ticker');
  const chips = document.getElementById('site-entered-chips');
  if (!ticker || !chips) return;
  ticker.hidden = true;
  ticker.classList.add('hidden');
  chips.innerHTML = '';
}

function paintEnteredTicker(entered: SiteDrop[], rising: SiteDrop[], now: Date): void {
  const live = [...entered, ...rising];
  if (live.length) {
    showEnteredTicker(
      live
        .slice(0, 4)
        .map((d) => chipHtml(d, d.kind === 'rising' ? 'Rising' : 'Just entered', now))
        .join(''),
    );
    return;
  }
  if (sendScreenWantsTicker()) {
    showEnteredTicker(`<p class="site-entered-ticker__empty">${TICKER_EMPTY}</p>`);
    return;
  }
  hideEnteredTicker();
}

export function paintOwnSiteDropChip(website: string, label = '', kind = 'entered'): void {
  const url = normalizeWebsiteUrl(website) || String(website || '').trim();
  if (!url) return;
  const now = new Date();
  const rung: SiteDrop['kind'] =
    kind === 'challenger' ? 'challenger' : kind === 'rising' ? 'rising' : 'entered';
  const drop: SiteDrop = {
    kind: rung,
    code: getMyReferralCode() || 'own',
    url,
    label: labelFromUrl(label, url),
    locks: rung === 'entered' ? 0 : 1,
    rank: rung === 'challenger' ? 2 : null,
    week: utcWeekId(now),
    expires_at: new Date(now.getTime() + (rung === 'rising' ? RISING_TTL_MS : ENTERED_TTL_MS)).toISOString(),
    updated_at: now.toISOString(),
  };
  const kicker = rung === 'rising' ? 'Rising' : rung === 'challenger' ? 'Challenger' : 'Just entered';
  const chips = document.getElementById('site-entered-chips');
  const host = (hostnameFromSafeUrl(url) || '').toLowerCase();
  if (chips && host && (chips.textContent || '').toLowerCase().includes(host)) {
    const ticker = document.getElementById('site-entered-ticker');
    if (ticker) {
      ticker.hidden = false;
      ticker.removeAttribute('hidden');
      ticker.classList.remove('hidden');
    }
    paintFirstScreenRung(rung, [drop], drop.label || host || 'open');
    return;
  }
  const chip = chipHtml(drop, kicker, now);
  const others = chips
    ? [...chips.querySelectorAll('.site-drop-chip')].map((el) => el.outerHTML).join('')
    : '';
  showEnteredTicker(chip + others);
  paintFirstScreenRung(rung, [drop], drop.label || host || 'open');
}

function paintRungLive(
  live: HTMLElement | null,
  drops: SiteDrop[],
  fallback: string,
): void {
  if (!live) return;
  const rung = live.closest('.site-drop-rung') as HTMLElement | null;
  if (!drops.length) {
    live.textContent = fallback;
    rung?.removeAttribute('data-live');
    return;
  }
  const first = drops[0];
  live.textContent = first.label || hostnameFromSafeUrl(first.url) || fallback;
  rung?.setAttribute('data-live', '1');
}

function paintFirstScreenRung(kind: 'entered' | 'rising' | 'challenger', drops: SiteDrop[], fallback: string): void {
  paintRungLive(document.getElementById(`site-drop-rung-${kind}`), drops, fallback);
  paintRungLive(document.querySelector(`[data-send-rung="${kind}"]`), drops, fallback);
}

export function applySiteDropsFromContent(content: Record<string, unknown>): void {
  paintSiteDrops(content.site_drops ?? content['site_drops']);
}

function readFormWebsite(): string {
  const remembered = readRememberedSiteDropWebsite();
  const a = (document.getElementById('site-drop-url') as HTMLInputElement | null)?.value || '';
  const b = (document.getElementById('post-link-site-drop-url') as HTMLInputElement | null)?.value || '';
  return String(a || b || remembered.url || '').trim();
}

let cachedDropToken: string | null = null;
let dropTokenWait: Promise<string> | null = null;

async function renderSiteDropToken(): Promise<string> {
  const siteKey = getTurnstileSiteKey();
  if (!siteKey) return 'dev-bypass-token';
  await ensureTurnstileReady();
  const host =
    document.getElementById('post-link-site-drop-turnstile') ||
    document.getElementById('site-drop-turnstile');
  if (!host) throw new Error('Could not start the human check. Refresh and try again.');
  return getTurnstileToken(host, siteKey, 'site-drop', {
    action: 'site-drop',
    size: 'compact',
    timeoutMs: 30_000,
  });
}

async function tokenForSiteDrop(): Promise<string> {
  if (cachedDropToken) {
    const token = cachedDropToken;
    cachedDropToken = null;
    return token;
  }
  if (dropTokenWait) {
    const token = await dropTokenWait;
    if (cachedDropToken === token) cachedDropToken = null;
    return token;
  }
  dropTokenWait = renderSiteDropToken();
  try {
    return await dropTokenWait;
  } finally {
    dropTokenWait = null;
  }
}

export function prefetchSiteDropScript(): void {
  if (document.documentElement.hasAttribute('data-vr-did-paste')) return;
  void ensureTurnstileReady().catch(() => {});
}

function prefetchSiteDropToken(): void {
  if (cachedDropToken || dropTokenWait) return;
  if (document.documentElement.hasAttribute('data-vr-did-paste')) return;
  if (!normalizeWebsiteUrl(readFormWebsite())) return;
  dropTokenWait = renderSiteDropToken()
    .then((token) => {
      cachedDropToken = token;
      return token;
    })
    .finally(() => {
      dropTokenWait = null;
    });
  void dropTokenWait.catch(() => {});
}

let submitInFlight = false;

function setDropSubmitBusy(busy: boolean): void {
  for (const id of ['post-link-site-drop-submit', 'site-drop-entered-btn'] as const) {
    const btn = document.getElementById(id) as HTMLButtonElement | null;
    if (!btn) continue;
    btn.disabled = busy;
    btn.setAttribute('aria-busy', busy ? 'true' : 'false');
  }
}

export async function submitSiteDrop(kind: 'entered' | 'rising' | 'challenger' = 'entered'): Promise<boolean> {
  if (submitInFlight) return false;
  submitInFlight = true;
  setDropSubmitBusy(true);
  const status = document.getElementById('site-drop-status');
  let widgetHost: HTMLElement | null = null;
  try {
    const code = getMyReferralCode();
    const website = readFormWebsite();
    const label = String(
      (document.getElementById('site-drop-label') as HTMLInputElement | null)?.value || '',
    ).trim();

    if (!code) {
      const msg = 'Get your referral link first.';
      if (status) status.textContent = msg;
      showToast(msg, 'info');
      return false;
    }
    const urlInput = document.getElementById('post-link-site-drop-url');
    const mainInput = document.getElementById('site-drop-url');
    if (!normalizeWebsiteUrl(website)) {
      urlInput?.classList.add('post-link-site-drop--need-url');
      mainInput?.classList.add('post-link-site-drop--need-url');
      const msg = 'Paste your website.';
      if (status) status.textContent = msg;
      showToast(msg, 'info');
      urlInput instanceof HTMLInputElement && urlInput.focus();
      return false;
    }
    urlInput?.classList.remove('post-link-site-drop--need-url');
    mainInput?.classList.remove('post-link-site-drop--need-url');

    if (status) status.textContent = 'Saving…';
    const token = await tokenForSiteDrop();
    widgetHost =
      document.getElementById('post-link-site-drop-turnstile') ||
      document.getElementById('site-drop-turnstile');
    const { data, error } = await supabase.functions.invoke('submit-site-drop', {
      body: {
        kind,
        referrerCode: code,
        website,
        label,
        turnstileToken: token,
        ownershipToken: getClaimOwnershipToken() || undefined,
      },
    });
    const envelope = await parseEdgeFunctionBody(data, error);
    if (!envelope?.success) {
      throw new Error(String(envelope?.error || error?.message || 'Could not save Site Drop'));
    }
    rememberSiteDropWebsite(website, label);
    const payload = envelope.data as { state?: unknown; kind?: string } | undefined;
    if (payload?.state) paintSiteDrops(payload.state);
    const rung = String(payload?.kind || kind);
    paintOwnSiteDropChip(website, label, rung);
    const sent = document.documentElement.hasAttribute('data-vr-did-send');
    const ok =
      rung === 'rising'
        ? sent
          ? 'Rising Site Drop live — 1 hour. A friend tapping Get my link keeps you climbing.'
          : 'Rising Site Drop live — 1 hour. Send it — a friend tapping Get my link is the climb.'
        : rung === 'challenger'
          ? sent
            ? 'Challenger strip updated. Keep sending.'
            : 'Challenger strip updated. Send it — a friend tapping Get my link is the climb.'
          : sent
            ? 'Just entered 15 min. A friend tapping Get my link climbs you to Rising.'
            : 'Just entered 15 min. Send it — a friend tapping Get my link is the climb.';
    if (status) status.textContent = ok;
    document.documentElement.setAttribute('data-vr-did-paste', '1');
    const send = document.getElementById('post-link-primary');
    if (send instanceof HTMLButtonElement && !send.hidden) send.focus();
    return true;
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Could not save';
    if (status) status.textContent = msg;
    showToast(msg, 'info');
    return false;
  } finally {
    if (widgetHost) removeTurnstileWidget(widgetHost.getAttribute('data-widget-id'));
    submitInFlight = false;
    setDropSubmitBusy(false);
  }
}

export function revealSiteDropForm(): void {
  for (const id of ['post-link-site-drop', 'site-drop-form'] as const) {
    const box = document.getElementById(id);
    if (!box) continue;
    box.hidden = false;
    box.removeAttribute('hidden');
    box.classList.remove('hidden');
  }
  prefetchSiteDropScript();
  prefetchSiteDropToken();
  const chips = document.getElementById('site-entered-chips');
  if (chips?.querySelector('.site-drop-chip')) {
    const ticker = document.getElementById('site-entered-ticker');
    if (ticker) {
      ticker.hidden = false;
      ticker.removeAttribute('hidden');
      ticker.classList.remove('hidden');
    }
    return;
  }
  if (sendScreenWantsTicker()) {
    showEnteredTicker(`<p class="site-entered-ticker__empty">${TICKER_EMPTY}</p>`);
  }
}

function syncUrlFields(from: HTMLInputElement | null, to: HTMLInputElement | null): void {
  const value = from?.value.trim();
  if (to && value) to.value = value;
}

export function initSiteDropForm(): void {
  if (
    document.documentElement.hasAttribute('data-vr-post-link-one') ||
    document.documentElement.hasAttribute('data-vr-has-link')
  ) {
    revealSiteDropForm();
  }
  const submit = document.getElementById('post-link-site-drop-submit');
  if (submit && submit.dataset.bound !== '1') {
    submit.dataset.bound = '1';
    submit.addEventListener('click', () => {
      const inline = document.getElementById('post-link-site-drop-url') as HTMLInputElement | null;
      const main = document.getElementById('site-drop-url') as HTMLInputElement | null;
      syncUrlFields(inline, main);
      void submitSiteDrop('entered');
    });
  }

  const form = document.getElementById('site-drop-form');
  if (form && form.dataset.bound !== '1') {
    form.dataset.bound = '1';
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const inline = document.getElementById('post-link-site-drop-url') as HTMLInputElement | null;
      const main = document.getElementById('site-drop-url') as HTMLInputElement | null;
      syncUrlFields(main, inline);
      void submitSiteDrop('entered');
    });
  }

  for (const id of ['post-link-site-drop-url', 'site-drop-url'] as const) {
    const input = document.getElementById(id) as HTMLInputElement | null;
    if (!input || input.dataset.enterBound === '1') continue;
    input.dataset.enterBound = '1';
    input.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter') return;
      event.preventDefault();
      const inline = document.getElementById('post-link-site-drop-url') as HTMLInputElement | null;
      const main = document.getElementById('site-drop-url') as HTMLInputElement | null;
      if (id === 'post-link-site-drop-url') syncUrlFields(inline, main);
      else syncUrlFields(main, inline);
      void submitSiteDrop('entered');
    });
    input.addEventListener('paste', () => {
      input.dataset.vrFromPaste = '1';
    });
    input.addEventListener('input', () => {
      const inline = document.getElementById('post-link-site-drop-url') as HTMLInputElement | null;
      const main = document.getElementById('site-drop-url') as HTMLInputElement | null;
      if (id === 'post-link-site-drop-url') syncUrlFields(inline, main);
      else syncUrlFields(main, inline);
      prefetchSiteDropToken();
      if (input.dataset.vrFromPaste !== '1') return;
      delete input.dataset.vrFromPaste;
      if (!normalizeWebsiteUrl(readFormWebsite())) return;
      void submitSiteDrop('entered');
    });
  }

  const remembered = readRememberedSiteDropWebsite();
  const inline = document.getElementById('post-link-site-drop-url') as HTMLInputElement | null;
  if (inline && !inline.value && remembered.url) inline.value = remembered.url;
  const main = document.getElementById('site-drop-url') as HTMLInputElement | null;
  if (main && !main.value && remembered.url) main.value = remembered.url;
  prefetchSiteDropToken();

  const jump = document.getElementById('post-link-site-drop-jump');
  if (jump && jump.dataset.bound !== '1') {
    jump.dataset.bound = '1';
    jump.addEventListener('click', () => {
      document.documentElement.setAttribute('data-vr-funnel-expanded', '1');
      document.getElementById('funnel-expand-btn')?.classList.add('hidden');
      const target =
        document.getElementById('site-drops') ||
        document.getElementById('site-entered-ticker') ||
        document.getElementById('how');
      target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }
}
