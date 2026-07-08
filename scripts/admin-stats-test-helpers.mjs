/** Node helpers mirroring supabase/functions/_shared/admin-stats-test.ts */

export const ADMIN_FUNNEL_EXCLUDED_IPS = ['161.38.136.60', '57.138.135.240'];
export const ADMIN_FUNNEL_EXCLUDED_IP_HASHES = [
  'd8399295624890754c844c12',
  '717ece42045d3673ed7fb81c',
];
export const AZURE_SMOKE_IP_RE = /^20\.|^48\.|^52\.|^74\.|^135\./;

export function getVisitorEventIp(event) {
  const meta = event?.metadata && typeof event.metadata === 'object' ? event.metadata : {};
  return String(meta.client_ip || event?.client_ip || '').trim();
}

export function isTestVisitorFunnelRefCode(code) {
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

export function isOwnerVisitorFunnelEvent(event) {
  const ip = getVisitorEventIp(event);
  if (ip && ADMIN_FUNNEL_EXCLUDED_IPS.includes(ip)) return true;
  const hash = String(event.ip_hash || '').trim().toLowerCase();
  if (!hash) return false;
  return ADMIN_FUNNEL_EXCLUDED_IP_HASHES.some(
    (blocked) => hash === blocked.toLowerCase() || hash.startsWith(blocked.toLowerCase()),
  );
}

export function isAutomationUserAgent(ua) {
  const s = String(ua || '').trim();
  if (!s) return false;
  if (s === 'node') return true;
  if (/HeadlessChrome/i.test(s)) return true;
  if (/\b(vitest|playwright|smoke|headless|automation)\b/i.test(s)) return true;
  return false;
}

export function isSmokeAutomationIpProfile(events) {
  if (!events.length) return false;
  const ip = getVisitorEventIp(events[0]);
  if (!ip || !AZURE_SMOKE_IP_RE.test(ip)) return false;
  const names = new Set(events.map((e) => String(e.event_name || '').trim()));
  if (names.has('CopyReferralLink') || names.has('ShareReferral') || names.has('SubmitPrizeClaim')) {
    return false;
  }
  if (names.has('GetReferralLink') && events.length <= 8) return true;
  return false;
}

export function isTestVisitorFunnelEvent(event, eventsFromSameIp) {
  if (isOwnerVisitorFunnelEvent(event)) return true;
  if (isTestVisitorFunnelRefCode(event.ref_code)) return true;
  const ip = getVisitorEventIp(event);
  if (/^203\.0\.113\./.test(ip)) return true;
  const path = String(event.metadata?.path || '').trim();
  if (/localhost/i.test(path)) return true;
  if (eventsFromSameIp?.length && isSmokeAutomationIpProfile(eventsFromSameIp)) return true;
  return false;
}

export function groupVisitorEventsByIp(events) {
  const byIp = new Map();
  for (const event of events) {
    const ip = getVisitorEventIp(event) || String(event.ip_hash || 'unknown');
    const list = byIp.get(ip) || [];
    list.push(event);
    byIp.set(ip, list);
  }
  return byIp;
}

export function getBannerEventIp(row) {
  const additional = row?.additional && typeof row.additional === 'object' ? row.additional : {};
  return String(row.ip || row.ip_address || additional.ip || '').trim();
}

export function getBannerEventUserAgent(row) {
  const additional = row?.additional && typeof row.additional === 'object' ? row.additional : {};
  return String(row.user_agent || additional.user_agent || '').trim();
}

export function isTestBannerEvent(row) {
  const ip = getBannerEventIp(row);
  if (ADMIN_FUNNEL_EXCLUDED_IPS.includes(ip)) return true;
  if (/^203\.0\.113\./.test(ip)) return true;
  const ua = getBannerEventUserAgent(row);
  if (isAutomationUserAgent(ua)) return true;
  return false;
}