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
  hostnameFromSafeUrl,
  normalizeWebsiteUrl,
  parseSiteDrops,
  publicChallengerDrops,
  publicEnteredDrops,
  publicRisingDrops,
  type SiteDrop,
  type SiteDropsState,
} from './site-drops';
import { fetchPublicSiteDrops } from './site-drops-fetch';

const URL_KEY = 'vr_site_drop_url';
const LABEL_KEY = 'vr_site_drop_label';

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

  const ticker = document.getElementById('site-entered-ticker');
  const chips = document.getElementById('site-entered-chips');
  if (ticker && chips) {
    const live = [...entered, ...rising];
    if (live.length) {
      ticker.hidden = false;
      ticker.classList.remove('hidden');
      chips.innerHTML = live.slice(0, 4).map((d) => chipHtml(d, d.kind === 'rising' ? 'Rising' : 'Just entered', now)).join('');
    } else {
      ticker.hidden = true;
      ticker.classList.add('hidden');
      chips.innerHTML = '';
    }
  }

  return state;
}

export function applySiteDropsFromContent(content: Record<string, unknown>): void {
  if (!content || !Object.prototype.hasOwnProperty.call(content, 'site_drops')) return;
  paintSiteDrops(content.site_drops);
}

/**
 * Dedicated ladder paint — does not wait on the hung site_content REST.
 * Timeout (≤2s) paints the existing empty-state copy immediately.
 */
export async function loadSiteDropsLadder(): Promise<SiteDropsState> {
  initSiteDropForm();
  const { raw } = await fetchPublicSiteDrops();
  return paintSiteDrops(raw);
}

function readFormWebsite(): string {
  const remembered = readRememberedSiteDropWebsite();
  const a = (document.getElementById('site-drop-url') as HTMLInputElement | null)?.value || '';
  const b = (document.getElementById('post-link-site-drop-url') as HTMLInputElement | null)?.value || '';
  return String(a || b || remembered.url || '').trim();
}

async function tokenForSiteDrop(): Promise<string> {
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

export async function submitSiteDrop(kind: 'entered' | 'rising' | 'challenger' = 'entered'): Promise<boolean> {
  const code = getMyReferralCode();
  const website = readFormWebsite();
  const label = String(
    (document.getElementById('site-drop-label') as HTMLInputElement | null)?.value || '',
  ).trim();
  const status = document.getElementById('site-drop-status');

  if (!code) {
    const msg = 'Get your referral link first.';
    if (status) status.textContent = msg;
    showToast(msg, 'info');
    return false;
  }
  if (!normalizeWebsiteUrl(website)) {
    const input = document.getElementById('post-link-site-drop-url');
    input?.classList.add('post-link-site-drop--need-url');
    const msg = 'Paste your website.';
    if (status) status.textContent = msg;
    showToast(msg, 'info');
    return false;
  }

  if (status) status.textContent = 'Saving…';
  let widgetHost: HTMLElement | null = null;
  try {
    const token = await tokenForSiteDrop();
    widgetHost = document.getElementById('post-link-site-drop-turnstile');
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
    const state = (envelope.data as { state?: unknown } | undefined)?.state;
    if (state) paintSiteDrops(state);
    const ok =
      kind === 'entered'
        ? 'Just entered — your site is on this homepage for 15 minutes.'
        : kind === 'rising'
          ? 'Rising Site Drop live — 1 hour on this homepage.'
          : 'Challenger strip updated.';
    if (status) status.textContent = ok;
    showToast(ok, 'success');
    return true;
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Could not save';
    if (status) status.textContent = msg;
    showToast(msg, 'info');
    return false;
  } finally {
    if (widgetHost) removeTurnstileWidget(widgetHost.getAttribute('data-widget-id'));
  }
}

export function revealSiteDropForm(): void {
  const box = document.getElementById('post-link-site-drop');
  if (!box) return;
  box.hidden = false;
  box.removeAttribute('hidden');
  box.classList.remove('hidden');
}

export function initSiteDropForm(): void {
  if (document.documentElement.hasAttribute('data-vr-post-link-one')) {
    revealSiteDropForm();
  }
  const submit = document.getElementById('post-link-site-drop-submit');
  if (submit && submit.dataset.bound !== '1') {
    submit.dataset.bound = '1';
    submit.addEventListener('click', () => {
      const inline = document.getElementById('post-link-site-drop-url') as HTMLInputElement | null;
      const main = document.getElementById('site-drop-url') as HTMLInputElement | null;
      if (main && inline?.value.trim()) main.value = inline.value.trim();
      void submitSiteDrop('entered');
    });
  }

  const form = document.getElementById('site-drop-form');
  if (form && form.dataset.bound !== '1') {
    form.dataset.bound = '1';
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      void submitSiteDrop('entered');
    });
  }

  const remembered = readRememberedSiteDropWebsite();
  const inline = document.getElementById('post-link-site-drop-url') as HTMLInputElement | null;
  if (inline && !inline.value && remembered.url) inline.value = remembered.url;
  const main = document.getElementById('site-drop-url') as HTMLInputElement | null;
  if (main && !main.value && remembered.url) main.value = remembered.url;

  const jump = document.getElementById('post-link-site-drop-jump');
  if (jump && jump.dataset.bound !== '1') {
    jump.dataset.bound = '1';
    jump.addEventListener('click', () => {
      document.getElementById('site-entered-ticker')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  }
}
