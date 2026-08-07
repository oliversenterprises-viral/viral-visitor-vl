/**
 * ViralRefer Relay — admin operator tab (global Hot Seat + queue + kill switch).
 * Mutations go through admin-action only (never direct client writes).
 */

import { invokeAdminAction } from '../lib/admin-action-client';
import {
  escapeHtml,
  formatRelayStat,
  statusBadgeClass,
  summarizeRelayHealth,
  type RelayAdminConfig,
  type RelayAdminLink,
  type RelayAdminStats,
} from './relay-admin-helpers';

type RelayAdminPayload = {
  config: RelayAdminConfig | null;
  live: RelayAdminLink | null;
  queue: RelayAdminLink[];
  recent: RelayAdminLink[];
  stats: RelayAdminStats;
};

function toast(msg: string, ok = true): void {
  const el = document.getElementById('vr-relay-admin-toast');
  if (!el) return;
  el.textContent = msg;
  el.className = ok
    ? 'text-sm text-emerald-300 mt-2 min-h-[1.25rem]'
    : 'text-sm text-rose-300 mt-2 min-h-[1.25rem]';
}

function renderStatCards(stats: RelayAdminStats): string {
  const items = [
    { label: 'Views 24h', value: stats.views_24h },
    { label: 'House views 24h', value: stats.house_views_24h },
    { label: 'Enqueues 24h', value: stats.enqueues_24h },
    { label: 'Sessions 24h', value: stats.sessions_active_24h },
    { label: 'Queue now', value: stats.queue_length },
  ];
  return `
    <div class="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
      ${items
        .map(
          (i) => `
        <div class="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div class="text-[11px] uppercase tracking-wider text-zinc-500 font-bold">${escapeHtml(i.label)}</div>
          <div class="text-2xl font-bold text-white mt-1 tabular-nums">${formatRelayStat(i.value)}</div>
        </div>`,
        )
        .join('')}
    </div>
  `;
}

function renderLiveCard(live: RelayAdminLink | null, config: RelayAdminConfig | null): string {
  if (!live) {
    return `
      <div class="rounded-2xl border border-amber-500/25 bg-amber-500/10 p-4 mb-4">
        <div class="text-xs font-bold uppercase tracking-wider text-amber-200/80 mb-1">LIVE seat</div>
        <div class="text-white font-semibold">House · ViralRefer</div>
        <p class="text-sm text-zinc-400 mt-1">No user link is LIVE — public Relay shows house URL.</p>
        <p class="text-xs text-zinc-500 mt-2 break-all">${escapeHtml(config?.house_url || '—')}</p>
      </div>
    `;
  }
  return `
    <div class="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 mb-4">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div class="min-w-0">
          <div class="text-xs font-bold uppercase tracking-wider text-emerald-200/80 mb-1">LIVE seat</div>
          <div class="text-lg font-bold text-white break-all">${escapeHtml(live.domain || '—')}</div>
          <a class="text-sm text-violet-300 hover:underline break-all" href="${escapeHtml(live.url || '#')}" target="_blank" rel="noopener noreferrer">${escapeHtml(live.url || '')}</a>
          <p class="text-sm text-zinc-400 mt-2">
            ${formatRelayStat(live.views_remaining)} views left · ${formatRelayStat(live.views_delivered)} delivered
          </p>
        </div>
        <div class="flex flex-col gap-2 shrink-0">
          <button type="button" data-relay-force-complete class="px-4 py-2 text-sm rounded-2xl bg-white/10 hover:bg-white/15 font-semibold">
            Force complete → next
          </button>
          <button type="button" data-relay-reject="${escapeHtml(live.id)}" class="px-4 py-2 text-sm rounded-2xl bg-rose-500/15 text-rose-200 border border-rose-500/30 hover:bg-rose-500/25 font-semibold">
            Reject LIVE
          </button>
        </div>
      </div>
    </div>
  `;
}

function renderLinkTable(
  rows: RelayAdminLink[],
  opts: { showReject: boolean; empty: string },
): string {
  if (!rows.length) {
    return `<p class="text-sm text-zinc-500">${escapeHtml(opts.empty)}</p>`;
  }
  return `
    <div class="overflow-x-auto rounded-2xl border border-white/10">
      <table class="w-full text-sm text-left">
        <thead class="text-xs uppercase text-zinc-500 border-b border-white/10 bg-white/5">
          <tr>
            <th class="px-3 py-2 font-bold">Domain</th>
            <th class="px-3 py-2 font-bold">Status</th>
            <th class="px-3 py-2 font-bold">Views</th>
            <th class="px-3 py-2 font-bold">When</th>
            ${opts.showReject ? '<th class="px-3 py-2 font-bold">Actions</th>' : ''}
          </tr>
        </thead>
        <tbody>
          ${rows
            .map((r) => {
              const st = String(r.status || '');
              const canReject = opts.showReject && (st === 'queued' || st === 'live');
              return `
              <tr class="border-b border-white/5 hover:bg-white/[0.03]">
                <td class="px-3 py-2.5">
                  <div class="font-semibold text-white break-all">${escapeHtml(r.domain || '—')}</div>
                  <div class="text-[11px] text-zinc-500 break-all max-w-xs truncate">${escapeHtml(r.url || '')}</div>
                </td>
                <td class="px-3 py-2.5">
                  <span class="inline-block text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border ${statusBadgeClass(st)}">${escapeHtml(st)}</span>
                </td>
                <td class="px-3 py-2.5 tabular-nums text-zinc-300">${formatRelayStat(r.views_delivered)}${
                  r.views_remaining != null ? ` / left ${formatRelayStat(r.views_remaining)}` : ''
                }</td>
                <td class="px-3 py-2.5 text-zinc-400 text-xs whitespace-nowrap">${escapeHtml(
                  (r.created_at || '').replace('T', ' ').slice(0, 16),
                )}</td>
                ${
                  opts.showReject
                    ? `<td class="px-3 py-2.5">${
                        canReject
                          ? `<button type="button" data-relay-reject="${escapeHtml(r.id)}" class="text-xs px-2.5 py-1.5 rounded-xl bg-rose-500/10 text-rose-200 border border-rose-500/25 hover:bg-rose-500/20">Reject</button>`
                          : '—'
                      }</td>`
                    : ''
                }
              </tr>`;
            })
            .join('')}
        </tbody>
      </table>
    </div>
  `;
}

function renderConfigForm(config: RelayAdminConfig | null): string {
  const c = config || {};
  return `
    <form id="vr-relay-config-form" class="grid md:grid-cols-2 gap-4 rounded-2xl border border-white/10 bg-white/5 p-4">
      <label class="flex items-center gap-3 md:col-span-2 cursor-pointer select-none">
        <input type="checkbox" name="enabled" class="w-5 h-5 accent-violet-500" ${c.enabled !== false ? 'checked' : ''} />
        <span>
          <span class="font-semibold text-white">Relay enabled</span>
          <span class="block text-xs text-zinc-500">Kill switch — when off, public Relay shows paused and views/enqueues fail closed.</span>
        </span>
      </label>
      <label class="block text-xs font-semibold text-zinc-400">
        Min dwell (seconds)
        <input name="min_dwell_seconds" type="number" min="5" max="120" value="${escapeHtml(String(c.min_dwell_seconds ?? 15))}"
          class="mt-1 w-full rounded-xl bg-black/40 border border-white/10 px-3 py-2.5 text-white text-sm" />
      </label>
      <label class="block text-xs font-semibold text-zinc-400">
        Views per seat
        <input name="views_per_seat" type="number" min="1" max="50" value="${escapeHtml(String(c.views_per_seat ?? 5))}"
          class="mt-1 w-full rounded-xl bg-black/40 border border-white/10 px-3 py-2.5 text-white text-sm" />
      </label>
      <label class="block text-xs font-semibold text-zinc-400">
        Enqueue cooldown (seconds / domain)
        <input name="enqueue_cooldown_seconds" type="number" min="0" max="86400" value="${escapeHtml(String(c.enqueue_cooldown_seconds ?? 120))}"
          class="mt-1 w-full rounded-xl bg-black/40 border border-white/10 px-3 py-2.5 text-white text-sm" />
      </label>
      <label class="block text-xs font-semibold text-zinc-400">
        House label
        <input name="house_label" type="text" maxlength="200" value="${escapeHtml(c.house_label || '')}"
          class="mt-1 w-full rounded-xl bg-black/40 border border-white/10 px-3 py-2.5 text-white text-sm" />
      </label>
      <label class="block text-xs font-semibold text-zinc-400 md:col-span-2">
        House URL (empty seat + seed)
        <input name="house_url" type="url" value="${escapeHtml(c.house_url || '')}"
          class="mt-1 w-full rounded-xl bg-black/40 border border-white/10 px-3 py-2.5 text-white text-sm" />
      </label>
      <label class="block text-xs font-semibold text-zinc-400 md:col-span-2">
        Banner URL (always-on promo)
        <input name="banner_url" type="url" value="${escapeHtml(c.banner_url || '')}"
          class="mt-1 w-full rounded-xl bg-black/40 border border-white/10 px-3 py-2.5 text-white text-sm" />
      </label>
      <div class="md:col-span-2 flex flex-wrap gap-2">
        <button type="submit" class="px-5 py-2.5 rounded-2xl bg-violet-600 hover:bg-violet-500 text-white font-bold text-sm">
          Save Relay config
        </button>
        <a href="https://www.viralrefer.app/relay" target="_blank" rel="noopener noreferrer"
          class="px-5 py-2.5 rounded-2xl bg-white/10 hover:bg-white/15 text-white font-semibold text-sm inline-flex items-center">
          Open public Relay ↗
        </a>
      </div>
    </form>
  `;
}

function wire(container: HTMLElement): void {
  container.querySelector('[data-relay-refresh]')?.addEventListener('click', () => {
    void renderRelayAdminTab(container);
  });

  container.querySelector('[data-relay-force-complete]')?.addEventListener('click', async () => {
    if (!confirm('Force-complete the LIVE seat and promote the next queued link?')) return;
    toast('Working…');
    const res = await invokeAdminAction('force_complete_relay_live', {});
    if (!res.success) {
      toast(res.error, false);
      return;
    }
    toast('LIVE completed; next promoted if queue had items.');
    void renderRelayAdminTab(container);
  });

  container.querySelectorAll<HTMLButtonElement>('[data-relay-reject]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-relay-reject') || '';
      if (!id) return;
      if (!confirm('Reject this Relay link? If it is LIVE, the next queued site is promoted.')) return;
      toast('Rejecting…');
      const res = await invokeAdminAction('reject_relay_link', { linkId: id });
      if (!res.success) {
        toast(res.error, false);
        return;
      }
      toast('Link rejected.');
      void renderRelayAdminTab(container);
    });
  });

  const form = container.querySelector<HTMLFormElement>('#vr-relay-config-form');
  form?.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const fd = new FormData(form);
    const payload = {
      enabled: fd.get('enabled') === 'on',
      min_dwell_seconds: Number(fd.get('min_dwell_seconds')),
      views_per_seat: Number(fd.get('views_per_seat')),
      enqueue_cooldown_seconds: Number(fd.get('enqueue_cooldown_seconds')),
      house_label: String(fd.get('house_label') || ''),
      house_url: String(fd.get('house_url') || ''),
      banner_url: String(fd.get('banner_url') || ''),
    };
    toast('Saving…');
    const res = await invokeAdminAction('update_relay_config', payload);
    if (!res.success) {
      toast(res.error, false);
      return;
    }
    toast('Relay config saved.');
    void renderRelayAdminTab(container);
  });
}

export async function renderRelayAdminTab(container: HTMLElement): Promise<void> {
  container.innerHTML = `
    <div class="space-y-2 py-2">
      <div class="h-8 w-48 skeleton rounded-xl"></div>
      <div class="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div class="h-20 skeleton rounded-2xl"></div>
        <div class="h-20 skeleton rounded-2xl"></div>
        <div class="h-20 skeleton rounded-2xl"></div>
        <div class="h-20 skeleton rounded-2xl"></div>
        <div class="h-20 skeleton rounded-2xl"></div>
      </div>
    </div>
  `;

  const res = await invokeAdminAction<RelayAdminPayload>('get_relay_admin', {});
  if (!res.success) {
    container.innerHTML = `
      <div class="p-6 text-amber-400 border border-amber-500/30 rounded-2xl">
        <div class="font-semibold mb-1">Unable to load Relay admin</div>
        <div class="text-sm text-zinc-400">${escapeHtml(res.error)}</div>
        <p class="text-xs text-zinc-500 mt-2">Requires admin login. If tables are missing, apply migration 0044.</p>
        <button type="button" data-relay-refresh class="mt-3 px-4 py-2 text-sm bg-white/10 rounded-2xl">Retry</button>
      </div>
    `;
    container.querySelector('[data-relay-refresh]')?.addEventListener('click', () => {
      void renderRelayAdminTab(container);
    });
    return;
  }

  const data = res.data;
  const config = data.config;
  const stats = data.stats || {};
  const health = summarizeRelayHealth(stats, config);

  container.innerHTML = `
    <div class="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div>
        <h2 class="text-2xl font-bold text-white flex items-center gap-2">
          <i class="fa-solid fa-bolt text-violet-400"></i> Relay
        </h2>
        <p class="text-sm text-zinc-400 mt-1">Global Hot Seat · queue · house promo · kill switch</p>
        <p class="text-[11px] text-zinc-500 mt-1">${escapeHtml(health)}</p>
        <p id="vr-relay-admin-toast" class="text-sm text-zinc-500 mt-2 min-h-[1.25rem]"></p>
      </div>
      <button type="button" data-relay-refresh class="px-4 py-2 text-sm bg-white/10 hover:bg-white/15 rounded-2xl flex items-center gap-2">
        <i class="fa-solid fa-sync"></i> Refresh
      </button>
    </div>

    ${renderStatCards(stats)}
    ${renderLiveCard(data.live, config)}

    <section class="mb-8">
      <h3 class="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-3">Config</h3>
      ${renderConfigForm(config)}
    </section>

    <section class="mb-8">
      <h3 class="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-3">Queue (FIFO)</h3>
      ${renderLinkTable(data.queue || [], { showReject: true, empty: 'Queue empty — house seat is LIVE for the public.' })}
    </section>

    <section class="mb-4">
      <h3 class="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-3">Recent links</h3>
      ${renderLinkTable(data.recent || [], { showReject: true, empty: 'No Relay links yet.' })}
    </section>

    <p class="text-[11px] text-zinc-600">
      Safe: public Relay only sees LIVE domain, queue length, and recent domains — never IPs or full session wallets.
      Mutations require admin session.
    </p>
  `;

  wire(container);
}
