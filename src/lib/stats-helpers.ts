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

export function eventTimestamp(e: Record<string, unknown>): string {
  return String(e.created_at || e.timestamp || '').trim();
}

/** Human-readable relative time, e.g. "2h ago". */
export function formatRelativeTime(iso: string): string {
  if (!iso) return '';
  const ms = new Date(iso).getTime();
  if (Number.isNaN(ms)) return '';
  const diff = Date.now() - ms;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

/** Short local date/time for event rows, e.g. "Jun 22, 12:00 PM". */
export function formatEventClock(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Combined label for headers and event lines: "Jun 22, 12:00 PM · 2h ago". */
export function formatEventTimestampLabel(iso: string): string {
  const clock = formatEventClock(iso);
  const rel = formatRelativeTime(iso);
  if (clock && rel) return `${clock} · ${rel}`;
  return clock || rel;
}

export function latestEventTimestamp(events: Array<Record<string, unknown>>): string {
  const latest = latestEvents(events, 1)[0];
  return latest ? eventTimestamp(latest) : '';
}