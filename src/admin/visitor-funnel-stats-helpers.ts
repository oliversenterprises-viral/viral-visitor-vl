/** Pure helpers for visitor funnel stats panels (admin audit). */

export interface FunnelRow {
  name: string;
  count: number;
  unique: number;
}

export interface CountryRow {
  country: string;
  unique: number;
  events: number;
}

/** Exported for testability (pure function). */
export function countryLabel(code: string): string {
  if (!code || code === '—') return 'Unknown';
  try {
    return new Intl.DisplayNames(['en'], { type: 'region' }).of(code) || code;
  } catch {
    return code;
  }
}

/** Exported for testability (pure function). */
export function filterCountryRowsForDisplay(rows: readonly CountryRow[]): CountryRow[] {
  return rows.filter((c) => c.country !== '—');
}

/** Exported for testability (pure function). */
export function sortSourceEntries(bySource: Record<string, number>): Array<[string, number]> {
  return Object.entries(bySource).sort((a, b) => b[1] - a[1]);
}

/** Exported for testability (pure function). */
export function shouldShowUtmSources(bySource: Record<string, number>): boolean {
  const entries = Object.entries(bySource);
  if (entries.length > 1) return true;
  if (entries.length === 1 && entries[0][0] !== '(direct)') return true;
  return false;
}

/** Exported for testability (pure function). */
export function computeFunnelTotals(funnel: readonly FunnelRow[]) {
  const totalEvents = funnel.reduce((s, r) => s + r.count, 0);
  const landings = funnel.find((r) => r.name === 'SiteLanding')?.count ?? 0;
  const claims = funnel.find((r) => r.name === 'SubmitPrizeClaim')?.count ?? 0;
  const conversion =
    landings > 0 ? `${((claims / landings) * 100).toFixed(1)}%` : '—';
  return { totalEvents, landings, claims, conversion };
}

/** Exported for testability (pure function). */
export function topCountries(rows: readonly CountryRow[], limit = 10): CountryRow[] {
  return [...rows].slice(0, limit);
}