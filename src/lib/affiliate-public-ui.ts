/**
 * Public promoter signup, dashboard, and weekly strip.
 */

import { supabase } from './supabase';
import { escapeHtml } from './escape-html';
import {
  buildAffiliateLink,
  getMyAffiliateCode,
  isValidAffiliateCode,
  normalizeAffiliateCode,
  setMyAffiliateCode,
} from './affiliate';

type BoardPayload = {
  top?: { code: string; name: string; uniqueGetLinkVisitors: number } | null;
  bounty_label?: string;
  cash_threshold?: number;
  ad_board_url?: string;
  payout_note?: string;
};

type StatsPayload = {
  code: string;
  name: string;
  stats: { landings: number; getLinks: number; uniqueGetLinkVisitors: number; unpaid: number };
  rewards: {
    adCreditOwed: number;
    adCreditGranted: number;
    cashThreshold: number;
    cashDue: boolean;
    cashUnpaid: number;
  };
  bounty_label: string;
  ad_board_url: string;
  payout_note: string;
  credit_days?: number;
};

async function callAffiliatePublic(
  action: string,
  extra: Record<string, unknown> = {},
): Promise<Record<string, unknown>> {
  const { data, error } = await supabase.functions.invoke('affiliate-public', {
    body: { action, ...extra },
  });
  if (error) throw error;
  return (data && typeof data === 'object' ? data : {}) as Record<string, unknown>;
}

function resolveWantedCode(): string | null {
  const params = new URLSearchParams(location.search);
  const fromQuery = params.get('promoter') || params.get('code');
  if (fromQuery && isValidAffiliateCode(fromQuery)) return normalizeAffiliateCode(fromQuery);
  return getMyAffiliateCode();
}

function paintWeekStrip(board: BoardPayload): void {
  const el = document.getElementById('promoter-week-strip');
  if (!el) return;
  const top = board.top;
  if (top && top.uniqueGetLinkVisitors > 0) {
    el.innerHTML = `<span class="promoter-week-kicker">This week's top promoter</span>
      <strong>${escapeHtml(top.name)}</strong>
      <span class="text-zinc-400">· ${top.uniqueGetLinkVisitors} friend${top.uniqueGetLinkVisitors === 1 ? '' : 's'} got a link</span>
      <span class="text-zinc-500 text-[11px]">(promoter · not contest #1)</span>
      <a href="#become-promoter" class="promoter-week-cta">Become a promoter</a>`;
    el.classList.remove('hidden');
    return;
  }
  el.innerHTML = `<span>We want promoters.</span>
    <span class="text-zinc-400">Send people here. When they tap Get my link, you earn ad credit.</span>
    <a href="#become-promoter" class="promoter-week-cta">Become a promoter</a>`;
  el.classList.remove('hidden');
}

function paintDashboard(box: HTMLElement, payload: StatsPayload): void {
  const link = buildAffiliateLink(payload.code);
  const r = payload.rewards;
  const wallet = payload.credit_days ?? r.adCreditGranted;
  const cashLine = r.cashDue
    ? `<p class="text-amber-300 text-sm">Cash bonus is on the books (${r.cashUnpaid} after ${r.cashThreshold} people). No action needed from you — the owner pays when ready.</p>`
    : `<p class="text-zinc-400 text-sm">Cash bonus starts after ${r.cashThreshold} people get a link. You have ${payload.stats.uniqueGetLinkVisitors}.</p>`;
  box.innerHTML = `
    <div class="text-sm font-semibold text-emerald-300 mb-1">Your promoter desk</div>
    <p class="text-zinc-300 text-sm mb-3">Hi ${escapeHtml(payload.name)}. Share this link — not a /r/ friend link.</p>
    <div class="font-mono text-sm break-all bg-black/40 border border-white/10 rounded-xl px-3 py-2 mb-3">${escapeHtml(link)}</div>
    <div class="flex flex-col sm:flex-row flex-wrap gap-2 mb-4">
      <button type="button" data-aff-copy-mine class="px-3 py-3 sm:py-1.5 text-sm sm:text-xs rounded-xl bg-violet-600 hover:bg-violet-500 min-h-[44px]">Copy my link</button>
      <a href="${escapeHtml(payload.ad_board_url)}" target="_blank" rel="noopener" class="px-3 py-3 sm:py-1.5 text-sm sm:text-xs rounded-xl border border-white/15 text-zinc-200 text-center min-h-[44px] inline-flex items-center justify-center">Open ad board</a>
    </div>
    <div class="grid grid-cols-3 gap-2 mb-3 text-center">
      <div class="rounded-lg bg-white/5 px-2 py-2"><div class="text-[9px] uppercase text-zinc-500">Visits</div><div class="text-xl font-bold">${payload.stats.landings}</div></div>
      <div class="rounded-lg bg-white/5 px-2 py-2"><div class="text-[9px] uppercase text-zinc-500">Got a link</div><div class="text-xl font-bold text-emerald-300">${payload.stats.uniqueGetLinkVisitors}</div></div>
      <div class="rounded-lg bg-white/5 px-2 py-2"><div class="text-[9px] uppercase text-zinc-500">Ad days ready</div><div class="text-xl font-bold text-amber-300">${wallet}</div></div>
    </div>
    <p class="text-zinc-400 text-sm mb-1">${escapeHtml(payload.bounty_label)}</p>
    ${cashLine}
    <p class="text-[11px] text-zinc-500 mt-2">${escapeHtml(payload.payout_note)}</p>
  `;
  box.querySelector('[data-aff-copy-mine]')?.addEventListener('click', () => {
    void navigator.clipboard.writeText(link);
  });
}

async function loadDashboard(code: string): Promise<void> {
  const box = document.getElementById('promoter-dashboard');
  const form = document.getElementById('promoter-signup-form');
  if (!box) return;
  box.classList.remove('hidden');
  box.innerHTML = '<p class="text-sm text-zinc-500">Loading your numbers…</p>';
  try {
    const res = await callAffiliatePublic('stats', { code });
    if (!res.success || !res.data) {
      box.innerHTML = `<p class="text-sm text-amber-300">${escapeHtml(String(res.error || 'Could not load'))}</p>`;
      return;
    }
    form?.classList.add('hidden');
    paintDashboard(box, res.data as StatsPayload);
  } catch (err) {
    box.innerHTML = `<p class="text-sm text-amber-300">Could not load promoter numbers (${escapeHtml(String(err))})</p>`;
  }
}

function wireSignup(): void {
  const form = document.getElementById('promoter-signup-form') as HTMLFormElement | null;
  if (!form || form.dataset.bound === '1') return;
  form.dataset.bound = '1';
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = String(new FormData(form).get('name') || '').trim();
    const btn = form.querySelector('button[type="submit"]') as HTMLButtonElement | null;
    if (btn) btn.disabled = true;
    void (async () => {
      try {
        const res = await callAffiliatePublic('register', { name });
        if (res.skipped) {
          form.querySelector('[data-aff-signup-err]')!.textContent = 'Try again in a normal browser.';
          return;
        }
        if (!res.success || !res.data) {
          const errEl = form.querySelector('[data-aff-signup-err]');
          if (errEl) errEl.textContent = String(res.error || 'Could not create');
          return;
        }
        const data = res.data as { code: string };
        setMyAffiliateCode(data.code);
        await loadDashboard(data.code);
      } catch (err) {
        const errEl = form.querySelector('[data-aff-signup-err]');
        if (errEl) errEl.textContent = String(err);
      } finally {
        if (btn) btn.disabled = false;
      }
    })();
  });
}

/** Boot public promoter chrome. Safe no-op if the nodes are missing. */
export function initAffiliatePublicUi(): void {
  wireSignup();
  const wanted = resolveWantedCode();
  if (wanted) {
    setMyAffiliateCode(wanted);
    void loadDashboard(wanted);
  }

  void callAffiliatePublic('board')
    .then((res) => {
      if (res.success && res.data) paintWeekStrip(res.data as BoardPayload);
      else paintWeekStrip({});
    })
    .catch(() => paintWeekStrip({}));

  if (new URLSearchParams(location.search).has('become') || location.hash === '#become-promoter') {
    document.getElementById('become-promoter')?.scrollIntoView({ behavior: 'smooth' });
  }
}
