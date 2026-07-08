/**
 * Scheduled auto-clear timer for Edit Content test-event purge (visitor + banner).
 * Single global timer — caller supplies the onTick handler (no admin panel imports here).
 */

export type AdminStatsAutoClearTestMs = 0 | 60_000 | 120_000 | 300_000 | 600_000 | 900_000 | 1_800_000;

export const ADMIN_STATS_AUTO_CLEAR_TEST_OPTIONS: ReadonlyArray<{
  ms: AdminStatsAutoClearTestMs;
  label: string;
}> = [
  { ms: 0, label: 'Off' },
  { ms: 60_000, label: '1m' },
  { ms: 120_000, label: '2m' },
  { ms: 300_000, label: '5m' },
  { ms: 600_000, label: '10m' },
  { ms: 900_000, label: '15m' },
  { ms: 1_800_000, label: '30m' },
];

export const ADMIN_STATS_AUTO_CLEAR_TEST_KEY = 'vr_admin_autoclear_test_ms';

let globalTimerId: number | null = null;
let clearInFlight = false;
let delegationRoot: HTMLElement | null = null;
let currentOnTick: (() => void | Promise<void>) | null = null;

export function parseStoredAutoClearTestMs(raw: string | null): AdminStatsAutoClearTestMs {
  const n = Number(raw);
  if (ADMIN_STATS_AUTO_CLEAR_TEST_OPTIONS.some((o) => o.ms === n)) {
    return n as AdminStatsAutoClearTestMs;
  }
  return 0;
}

export function getStoredAutoClearTestMs(): AdminStatsAutoClearTestMs {
  try {
    return parseStoredAutoClearTestMs(localStorage.getItem(ADMIN_STATS_AUTO_CLEAR_TEST_KEY));
  } catch {
    return 0;
  }
}

export function storeAutoClearTestMs(ms: AdminStatsAutoClearTestMs): void {
  try {
    localStorage.setItem(ADMIN_STATS_AUTO_CLEAR_TEST_KEY, String(ms));
  } catch {
    // non-fatal
  }
}

export function buildAutoClearTestSelectHtml(): string {
  const current = getStoredAutoClearTestMs();
  const options = ADMIN_STATS_AUTO_CLEAR_TEST_OPTIONS.map(
    ({ ms, label }) =>
      `<option value="${ms}"${ms === current ? ' selected' : ''}>${label}</option>`,
  ).join('');
  return `
    <label class="inline-flex items-center gap-1 text-[9px] text-zinc-500" title="Auto-remove owner/smoke test rows on a schedule">
      <span>Auto-clear</span>
      <select data-admin-autoclear-test class="bg-zinc-900 border border-white/15 rounded px-1 py-0.5 text-[9px] text-zinc-200 focus:border-amber-500/50">
        ${options}
      </select>
    </label>`;
}

export function syncAutoClearTestSelects(root: HTMLElement): void {
  const current = String(getStoredAutoClearTestMs());
  root.querySelectorAll<HTMLSelectElement>('select[data-admin-autoclear-test]').forEach((select) => {
    select.value = current;
  });
}

export function clearAdminStatsAutoClearTestTimer(): void {
  if (globalTimerId != null) {
    window.clearInterval(globalTimerId);
    globalTimerId = null;
  }
}

export function scheduleAdminStatsAutoClearTest(onTick: () => void | Promise<void>): void {
  clearAdminStatsAutoClearTestTimer();
  currentOnTick = onTick;
  const ms = getStoredAutoClearTestMs();
  if (!ms) return;

  globalTimerId = window.setInterval(() => {
    if (!currentOnTick) return;
    if (delegationRoot && !document.body.contains(delegationRoot)) {
      clearAdminStatsAutoClearTestTimer();
      return;
    }
    if (clearInFlight) return;
    clearInFlight = true;
    void Promise.resolve(currentOnTick()).finally(() => {
      clearInFlight = false;
    });
  }, ms);
}

function handleAutoClearSelectChange(root: HTMLElement, select: HTMLSelectElement): void {
  const nextMs = parseStoredAutoClearTestMs(select.value);
  const prevMs = getStoredAutoClearTestMs();

  if (nextMs > 0 && prevMs === 0) {
    const ok = window.confirm(
      'Auto-clear will remove owner/smoke test rows from visitor funnel and banner stats on a schedule (no prompt each time). Real visitor data is kept. Enable?',
    );
    if (!ok) {
      syncAutoClearTestSelects(root);
      return;
    }
  }

  storeAutoClearTestMs(nextMs);
  syncAutoClearTestSelects(root);
  if (currentOnTick) {
    scheduleAdminStatsAutoClearTest(currentOnTick);
  }
}

export function wireEditContentAutoClearTest(
  root: HTMLElement,
  onAutoClearTick: () => void | Promise<void>,
): void {
  delegationRoot = root;
  syncAutoClearTestSelects(root);
  scheduleAdminStatsAutoClearTest(onAutoClearTick);

  if (root.dataset.vrAutoClearDelegation === '1') return;
  root.dataset.vrAutoClearDelegation = '1';

  root.addEventListener('change', (e) => {
    const select = (e.target as HTMLElement).closest('select[data-admin-autoclear-test]');
    if (!select || !root.contains(select)) return;
    handleAutoClearSelectChange(root, select as HTMLSelectElement);
  });
}

/** Reset module state for unit tests. */
export function resetAdminStatsAutoClearTestForTests(): void {
  clearAdminStatsAutoClearTestTimer();
  clearInFlight = false;
  delegationRoot = null;
  currentOnTick = null;
}