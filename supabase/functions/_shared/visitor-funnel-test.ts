/** Shared test/owner/smoke detection for visitor_events — client + admin-action edge. */

export const ADMIN_FUNNEL_EXCLUDED_IPS = ['161.38.136.60', '57.138.135.240'] as const;

/** ip_hash values (VISITOR_IP_HASH_SALT viralrefer-visitor-v1). */
export const ADMIN_FUNNEL_EXCLUDED_IP_HASHES = [
  'd8399295624890754c844c12', // 161.38.136.60
  '717ece42045d3673ed7fb81c', // 57.138.135.240
] as const;

function metadataRecord(event: Record<string, unknown>): Record<string, unknown> {
  const meta = event.metadata;
  return meta && typeof meta === 'object' && !Array.isArray(meta)
    ? (meta as Record<string, unknown>)
    : {};
}

/** Resolved client IP when present on a funnel event (metadata or legacy top-level). */
export function getVisitorEventIp(event: Record<string, unknown>): string {
  const meta = metadataRecord(event);
  return String(meta.client_ip || event.client_ip || event.clientIp || '').trim();
}

/** Agent/smoke/E2E ref codes — aligned with share-analytics-helpers + unit-test landings. */
export function isTestVisitorFunnelRefCode(code: string | null | undefined): boolean {
  const c = (code || '').trim().toUpperCase();
  if (!c) return false;
  if (c === 'VIRAL-READY') return true;
  if (/PROBE/.test(c)) return true;
  if (/SMOKETEST/.test(c)) return true;
  if (/DEMOCODE/.test(c)) return true;
  if (/^DEMO\d+$/.test(c)) return true;
  if (/TESTFIX/.test(c)) return true;
  if (/^VIRAL-(LANDING|FUNNEL|TOAST|FAIL|RETRY|ATTRIB|DEMO)/.test(c)) return true;
  return false;
}

export function isOwnerVisitorFunnelEvent(
  event: Record<string, unknown>,
  excludedIps: readonly string[] = ADMIN_FUNNEL_EXCLUDED_IPS,
  excludedHashes: readonly string[] = ADMIN_FUNNEL_EXCLUDED_IP_HASHES,
): boolean {
  const ip = getVisitorEventIp(event);
  if (ip && excludedIps.some((blocked) => blocked === ip)) return true;

  const hash = String(event.ip_hash || event.ipHash || '').trim().toLowerCase();
  if (!hash) return false;
  return excludedHashes.some(
    (blocked) => hash === blocked.toLowerCase() || hash.startsWith(blocked.toLowerCase()),
  );
}

/** Playwright/smoke bursts from Azure egress — no copy/share/claim steps. */
export function isSmokeAutomationIpProfile(events: readonly Record<string, unknown>[]): boolean {
  if (!events.length) return false;
  const ip = getVisitorEventIp(events[0]);
  if (!ip || !/^20\.|^48\.|^52\.|^74\.|^135\./.test(ip)) return false;

  const names = new Set(
    events.map((e) => String(e.event_name || e.eventName || '').trim()),
  );
  if (names.has('CopyReferralLink') || names.has('ShareReferral') || names.has('SubmitPrizeClaim')) {
    return false;
  }
  if (names.has('GetReferralLink') && events.length <= 8) return true;
  return false;
}

export function isTestVisitorFunnelEvent(
  event: Record<string, unknown>,
  eventsFromSameIp?: readonly Record<string, unknown>[],
  excludedIps: readonly string[] = ADMIN_FUNNEL_EXCLUDED_IPS,
  excludedHashes: readonly string[] = ADMIN_FUNNEL_EXCLUDED_IP_HASHES,
): boolean {
  if (isOwnerVisitorFunnelEvent(event, excludedIps, excludedHashes)) return true;
  if (isTestVisitorFunnelRefCode(String(event.ref_code || event.refCode || ''))) return true;

  const ip = getVisitorEventIp(event);
  if (/^203\.0\.113\./.test(ip)) return true;

  const path = String(metadataRecord(event).path || '').trim();
  if (/localhost/i.test(path)) return true;

  if (eventsFromSameIp && eventsFromSameIp.length > 0 && isSmokeAutomationIpProfile(eventsFromSameIp)) {
    return true;
  }

  return false;
}

export function groupVisitorEventsByIp(
  events: readonly Record<string, unknown>[],
): Map<string, Record<string, unknown>[]> {
  const byIp = new Map<string, Record<string, unknown>[]>();
  for (const event of events) {
    const ip = getVisitorEventIp(event) || String(event.ip_hash || 'unknown');
    const list = byIp.get(ip) || [];
    list.push(event);
    byIp.set(ip, list);
  }
  return byIp;
}

export function filterTestVisitorFunnelEvents(
  events: readonly Record<string, unknown>[],
): Record<string, unknown>[] {
  const byIp = groupVisitorEventsByIp(events);
  return events.filter((event) => {
    const ip = getVisitorEventIp(event) || String(event.ip_hash || 'unknown');
    return !isTestVisitorFunnelEvent(event, byIp.get(ip));
  });
}

export function countTestVisitorFunnelEvents(events: readonly Record<string, unknown>[]): number {
  return events.length - filterTestVisitorFunnelEvents(events).length;
}