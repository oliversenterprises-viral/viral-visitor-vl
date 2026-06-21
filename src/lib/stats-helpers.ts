/** Shared helpers for admin analytics panels (visitor, Reddit, banner). */

export function groupBy<T>(arr: T[], keyFn: (item: T) => string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const item of arr) {
    const k = keyFn(item);
    out[k] = (out[k] || 0) + 1;
  }
  return out;
}

/** Newest-first — works for server (DESC) and local (append) event lists. */
export function latestEvents(events: Array<Record<string, unknown>>, limit: number) {
  return [...events]
    .sort((a, b) => {
      const ta = new Date(String(a.created_at || a.timestamp || 0)).getTime();
      const tb = new Date(String(b.created_at || b.timestamp || 0)).getTime();
      return tb - ta;
    })
    .slice(0, limit);
}

export function eventName(e: Record<string, unknown>): string {
  return String(e.event_name || e.eventName || 'unknown');
}