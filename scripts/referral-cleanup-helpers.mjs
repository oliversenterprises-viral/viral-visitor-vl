/**
 * Classify referrals for cleanup: keep only funnel-gated credits (Step 1 GetReferralLink).
 * Shared by cleanup script + unit tests.
 */

/** Funnel-gated crediting deploy — commit 67cc22d (2026-06-26 18:36:09 UTC). */
export const FUNNEL_GATE_DEPLOY_ISO = '2026-06-26T18:36:09Z';

export const ADMIN_FUNNEL_EXCLUDED_IPS = ['161.38.136.60', '57.138.135.240'];

const LEGACY_DEMO_CODES = new Set([
  'sarah_m', 'james_t', 'maria_k', 'david_r', 'emma_l', 'noah_p',
]);

const FUNNEL_EVENT_WINDOW_BEFORE_MS = 10 * 60 * 1000;
const FUNNEL_EVENT_WINDOW_AFTER_MS = 2 * 60 * 1000;

export function getVisitorEventIp(event) {
  const meta = event?.metadata && typeof event.metadata === 'object' ? event.metadata : {};
  return String(meta.client_ip || event?.client_ip || event?.clientIp || '').trim();
}

/** Nova/agent/smoke/owner rows — always remove. */
export function isTestReferralRow(row) {
  const code = String(row.referrer_code || '').trim().toUpperCase();
  const ua = String(row.user_agent || '').trim();
  const ip = String(row.referred_ip ?? row.ip_address ?? '').trim();

  if (ADMIN_FUNNEL_EXCLUDED_IPS.includes(ip)) return true;
  if (LEGACY_DEMO_CODES.has(String(row.referrer_code || '').trim())) return true;
  if (/NovaVerify/i.test(ua)) return true;
  if (/\b(vitest|playwright|smoke|headless|automation)\b/i.test(ua)) return true;
  if (/HeadlessChrome/i.test(ua)) return true;
  if (ua === 'node') return true;
  if (/^203\.0\.113\./.test(ip)) return true;
  if (code === 'VIRAL-SMOKETEST' || code === 'VIRAL-READY') return true;
  if (/SMOKETEST/.test(code)) return true;
  if (/DEMOCODE/.test(code)) return true;
  if (/^DEMO\d+$/.test(code)) return true;
  if (/PROBE/.test(code)) return true;
  if (/TESTFIX/.test(code)) return true;
  if (/^VIRAL-(LANDING|FUNNEL|TOAST|FAIL|RETRY|ATTRIB|DEMO)/.test(code)) return true;

  return false;
}

/** True when visitor_events show Step 1 (GetReferralLink) near the referral insert. */
export function isFunnelGatedReferral(
  row,
  events,
  deployIso = FUNNEL_GATE_DEPLOY_ISO,
) {
  if (!row?.created_at || row.created_at < deployIso) return false;

  const ip = String(row.referred_ip || '').trim();
  if (!ip) return false;

  const refMs = new Date(row.created_at).getTime();
  const windowStart = refMs - FUNNEL_EVENT_WINDOW_BEFORE_MS;
  const windowEnd = refMs + FUNNEL_EVENT_WINDOW_AFTER_MS;

  return (events || []).some((event) => {
    if (String(event.event_name || event.eventName || '') !== 'GetReferralLink') {
      return false;
    }
    if (getVisitorEventIp(event) !== ip) return false;
    const eventMs = new Date(event.created_at).getTime();
    return eventMs >= windowStart && eventMs <= windowEnd;
  });
}

export function classifyReferralRow(row, events, deployIso = FUNNEL_GATE_DEPLOY_ISO) {
  if (isTestReferralRow(row)) {
    return { keep: false, reason: 'test_or_owner' };
  }
  if (isFunnelGatedReferral(row, events, deployIso)) {
    return { keep: true, reason: 'funnel_gated' };
  }
  if (row.created_at < deployIso) {
    return { keep: false, reason: 'pre_funnel_passive_landing' };
  }
  return { keep: false, reason: 'post_funnel_no_get_link' };
}

export function partitionReferrals(referrals, events, deployIso = FUNNEL_GATE_DEPLOY_ISO) {
  const kept = [];
  const removed = [];
  for (const row of referrals || []) {
    const verdict = classifyReferralRow(row, events, deployIso);
    if (verdict.keep) kept.push({ ...row, ...verdict });
    else removed.push({ ...row, ...verdict });
  }
  return { kept, removed };
}