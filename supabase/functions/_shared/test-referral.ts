/**
 * Test/owner/smoke referral detection — block crediting + filter public stats.
 * Keep in sync with migration is_test_referral_row() and scripts/referral-cleanup-helpers.mjs.
 */

import { ADMIN_FUNNEL_EXCLUDED_IPS } from './visitor-funnel-test.ts';

const LEGACY_DEMO_CODES = new Set([
  'sarah_m', 'james_t', 'maria_k', 'david_r', 'emma_l', 'noah_p',
]);

export function normalizeReferrerCodeForTest(raw: unknown): string {
  return String(raw || '').trim().toUpperCase();
}

/** Agent/smoke/E2E referrer codes — never credit or show on public leaderboard. */
export function isTestReferrerCode(code: string | null | undefined): boolean {
  const c = normalizeReferrerCodeForTest(code);
  if (!c) return false;
  if (LEGACY_DEMO_CODES.has(String(code || '').trim())) return true;
  if (c === 'VIRAL-SMOKETEST' || c === 'VIRAL-READY') return true;
  if (/SMOKETEST/.test(c)) return true;
  if (/DEMOCODE/.test(c)) return true;
  if (/^DEMO\d+$/.test(c)) return true;
  if (/PROBE/.test(c)) return true;
  if (/TESTFIX/.test(c)) return true;
  if (/^VIRAL-(LANDING|FUNNEL|TOAST|FAIL|RETRY|ATTRIB|DEMO)/.test(c)) return true;
  return false;
}

export function isAutomationUserAgent(ua: string | null | undefined): boolean {
  const s = String(ua || '').trim();
  if (!s) return false;
  if (s === 'node') return true;
  if (/NovaVerify/i.test(s)) return true;
  if (/HeadlessChrome/i.test(s)) return true;
  if (/\b(vitest|playwright|smoke|headless|automation)\b/i.test(s)) return true;
  return false;
}

export function isOwnerReferralIp(ip: string | null | undefined): boolean {
  const normalized = String(ip || '').trim();
  if (!normalized) return false;
  return (ADMIN_FUNNEL_EXCLUDED_IPS as readonly string[]).includes(normalized);
}

export function isProbeReferralIp(ip: string | null | undefined): boolean {
  return /^203\.0\.113\./.test(String(ip || '').trim());
}

/** True when this request must not create a referral row (smoke, owner, automation). */
export function shouldSkipReferralCrediting(input: {
  referrerCode: string;
  referredIp?: string | null;
  userAgent?: string | null;
}): boolean {
  if (isTestReferrerCode(input.referrerCode)) return true;
  if (isOwnerReferralIp(input.referredIp)) return true;
  if (isProbeReferralIp(input.referredIp)) return true;
  if (isAutomationUserAgent(input.userAgent)) return true;
  return false;
}

/** Classify an existing referrals row (for display filters + cleanup). */
export function isTestReferralRecord(row: Record<string, unknown>): boolean {
  return shouldSkipReferralCrediting({
    referrerCode: String(row.referrer_code || ''),
    referredIp: String(row.referred_ip ?? row.ip_address ?? ''),
    userAgent: String(row.user_agent || ''),
  });
}