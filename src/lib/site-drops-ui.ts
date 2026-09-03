/**
 * Paint live Site Drop ladder chips (Just entered / Rising / Challenger).
 * Timeout or empty payload keeps the static honest-empty copy — never hangs.
 */

import { escapeHtml } from './escape-html';
import {
  hostnameFromSafeUrl,
  parseSiteDrops,
  publicChallengerDrops,
  publicEnteredDrops,
  publicRisingDrops,
  type SiteDrop,
  type SiteDropsState,
} from './site-drops';
import { fetchPublicSiteDrops } from './site-drops-fetch';

const CHIP_CLASS =
  'inline-flex flex-col gap-0.5 min-h-[44px] min-w-[9.5rem] px-3 py-2 rounded-xl border border-white/15 bg-white/5 text-left hover:bg-white/10';

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
  return `<a class="${CHIP_CLASS}" href="${href}" target="_blank" rel="noopener noreferrer" data-vr-zone="site-drop">
    <span class="text-sm font-semibold text-white leading-tight">${label}</span>
    <span class="text-[11px] text-zinc-400">${escapeHtml(kicker)} · ${escapeHtml(remainLabel(drop.expires_at, now))}</span>
    <span class="text-[11px] font-mono text-zinc-500">${escapeHtml(host)}</span>
  </a>`;
}

function setEmptyVisible(id: string, hasItems: boolean): void {
  const empty = document.getElementById(id);
  if (!empty) return;
  empty.hidden = hasItems;
  empty.classList.toggle('hidden', hasItems);
}

export function paintSiteDrops(raw: unknown, now: Date = new Date()): SiteDropsState {
  const state = parseSiteDrops(raw);
  const entered = publicEnteredDrops(state, now);
  const rising = publicRisingDrops(state, now);
  const challengers = publicChallengerDrops(state, now);

  const enteredList = document.getElementById('site-drops-entered-list');
  if (enteredList) {
    enteredList.innerHTML = entered.map((d) => `<li>${chipHtml(d, 'Just entered', now)}</li>`).join('');
  }
  setEmptyVisible('site-drops-entered-empty', entered.length > 0);

  const risingList = document.getElementById('site-drops-rising-list');
  if (risingList) {
    risingList.innerHTML = rising
      .map((d) => `<li>${chipHtml(d, `Rising · ${d.locks} friend${d.locks === 1 ? '' : 's'}`, now)}</li>`)
      .join('');
  }
  setEmptyVisible('site-drops-rising-empty', rising.length > 0);

  const challList = document.getElementById('site-drops-challenger-list');
  if (challList) {
    challList.innerHTML = challengers
      .map((d) => `<li>${chipHtml(d, `Challenger · #${d.rank}`, now)}</li>`)
      .join('');
  }
  setEmptyVisible('site-drops-challenger-empty', challengers.length > 0);

  const ticker = document.getElementById('site-entered-ticker');
  const chips = document.getElementById('site-entered-chips');
  if (ticker && chips) {
    const live = [...entered, ...rising];
    if (live.length) {
      ticker.hidden = false;
      ticker.classList.remove('hidden');
      chips.innerHTML = live
        .slice(0, 4)
        .map((d) => chipHtml(d, d.kind === 'rising' ? 'Rising' : 'Just entered', now))
        .join('');
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
  const { raw } = await fetchPublicSiteDrops();
  return paintSiteDrops(raw);
}
