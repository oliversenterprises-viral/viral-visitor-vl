/**
 * Auto-refresh for Edit Content quick stats panels (visitor funnel + banner).
 * Read-only fetches only — paired with admin-stats-refresh-guard to block new events.
 */

export type AdminStatsAutorefreshMs = 0 | 15_000 | 30_000 | 60_000 | 120_000 | 300_000;

export const ADMIN_STATS_AUTOREFRESH_OPTIONS: ReadonlyArray<{ ms: AdminStatsAutorefreshMs; label: string }> = [
  { ms: 0, label: 'Off' },
  { ms: 15_000, label: '15s' },
  { ms: 30_000, label: '30s' },
  { ms: 60_000, label: '1m' },
  { ms: 120_000, label: '2m' },
  { ms: 300_000, label: '5m' },
];

const timers = new WeakMap<HTMLElement, number>();

export function parseStoredAutorefreshMs(raw: string | null): AdminStatsAutorefreshMs {
  const n = Number(raw);
  if (ADMIN_STATS_AUTOREFRESH_OPTIONS.some((o) => o.ms === n)) return n as AdminStatsAutorefreshMs;
  return 0;
}

export function getStoredAutorefreshMs(storageKey: string): AdminStatsAutorefreshMs {
  try {
    return parseStoredAutorefreshMs(localStorage.getItem(storageKey));
  } catch {
    return 0;
  }
}

export function storeAutorefreshMs(storageKey: string, ms: AdminStatsAutorefreshMs): void {
  try {
    localStorage.setItem(storageKey, String(ms));
  } catch {
    // non-fatal
  }
}

export function buildAutorefreshSelectHtml(
  selectAttr: string,
  storageKey: string,
): string {
  const current = getStoredAutorefreshMs(storageKey);
  const options = ADMIN_STATS_AUTOREFRESH_OPTIONS.map(
    ({ ms, label }) =>
      `<option value="${ms}"${ms === current ? ' selected' : ''}>${label}</option>`,
  ).join('');
  return `
    <label class="inline-flex items-center gap-1 text-[9px] text-zinc-500">
      <span>Auto</span>
      <select ${selectAttr} class="bg-zinc-900 border border-white/15 rounded px-1 py-0.5 text-[9px] text-zinc-200 focus:border-violet-500/50">
        ${options}
      </select>
    </label>`;
}

export function clearAdminStatsAutorefresh(container: HTMLElement): void {
  const id = timers.get(container);
  if (id != null) {
    window.clearInterval(id);
    timers.delete(container);
  }
}

export function scheduleAdminStatsAutorefresh(
  container: HTMLElement,
  storageKey: string,
  onTick: () => void | Promise<void>,
): void {
  clearAdminStatsAutorefresh(container);
  const ms = getStoredAutorefreshMs(storageKey);
  if (!ms) return;

  const id = window.setInterval(() => {
    if (!document.body.contains(container)) {
      clearAdminStatsAutorefresh(container);
      return;
    }
    void onTick();
  }, ms);
  timers.set(container, id);
}

export function wireAdminStatsAutorefresh(
  container: HTMLElement,
  storageKey: string,
  selectAttr: string,
  onSilentRefresh: () => void | Promise<void>,
): void {
  const select = container.querySelector<HTMLSelectElement>(`select[${selectAttr}]`);
  if (!select || select.dataset.vrAutorefreshBound === '1') return;
  select.dataset.vrAutorefreshBound = '1';

  select.addEventListener('change', () => {
    const ms = parseStoredAutorefreshMs(select.value);
    storeAutorefreshMs(storageKey, ms);
    scheduleAdminStatsAutorefresh(container, storageKey, onSilentRefresh);
  });

  scheduleAdminStatsAutorefresh(container, storageKey, onSilentRefresh);
}