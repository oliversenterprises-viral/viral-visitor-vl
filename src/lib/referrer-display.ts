/**
 * Glanceable referrer identity + plain-English stats labels.
 * One rule: the code always means "who got credit" (the referrer), never the visitor.
 */

/** Normalize a referral code for display; empty → em dash. */
export function normalizeReferrerCode(raw: string | null | undefined): string {
  const code = String(raw || '').trim();
  return code || '—';
}

/** Short badge label, e.g. "Referrer VIRAL-ABC". */
export function formatReferrerBadge(raw: string | null | undefined): string {
  const code = normalizeReferrerCode(raw);
  if (code === '—') return 'Referrer unknown';
  return `Referrer ${code}`;
}

/** Credit arrow used in feeds: "Credit → VIRAL-ABC". */
export function formatReferrerCreditArrow(raw: string | null | undefined): string {
  const code = normalizeReferrerCode(raw);
  if (code === '—') return 'Credit → unknown';
  return `Credit → ${code}`;
}

/** Public activity: who got the referral credit. */
export function formatPublicReferralActivity(raw: string | null | undefined): {
  code: string;
  action: string;
} {
  return {
    code: normalizeReferrerCode(raw),
    action: 'got credit · new signup',
  };
}

/** Public activity: share by a referrer. */
export function formatPublicShareActivity(
  raw: string | null | undefined,
  platformLabel: string,
): { code: string; action: string } {
  return {
    code: normalizeReferrerCode(raw),
    action: `shared on ${platformLabel}`,
  };
}

/** Admin live chip / sound history for a credited referral. */
export function formatAdminLiveReferralDetail(raw: string | null | undefined): string {
  return formatReferrerCreditArrow(raw);
}

/** Admin live chip for a share. */
export function formatAdminLiveShareDetail(
  raw: string | null | undefined,
  platform: string,
): string {
  const code = normalizeReferrerCode(raw);
  const p = String(platform || 'share').trim() || 'share';
  if (code === '—') return p;
  return `${formatReferrerBadge(code)} · ${p}`;
}

/** Funnel visitor detail: who sent them (landing referrer). */
export function formatVisitorViaReferrer(raw: string | null | undefined): string {
  const code = normalizeReferrerCode(raw);
  if (code === '—') return 'direct (no referrer)';
  return `via ${code}`;
}

/** Referral notifier: who got credit ← visitor IP. */
export function formatReferralCreditNotifierLine(opts: {
  referrerCode?: string | null;
  visitorIp?: string | null;
}): { code: string; referrerLabel: string; ipLabel: string; summary: string } {
  const code = normalizeReferrerCode(opts.referrerCode);
  const ip = String(opts.visitorIp || '').trim() || 'IP withheld';
  const referrerLabel = formatReferrerBadge(code);
  return {
    code,
    referrerLabel,
    ipLabel: ip,
    summary: `${referrerLabel} got credit ← visitor ${ip}`,
  };
}

/** Plain-English sublabels for admin referral stat cards. */
export const REFERRAL_STAT_HINTS = {
  total: 'How many friends got credit',
  unique: 'How many different people got credit',
  today: 'Credits since this morning',
  risk: 'Same computer used 3+ times — tap to look',
} as const;

/** Table / modal column title — never ambiguous. */
export const REFERRER_COLUMN_TITLE = 'Who got credit';
export const REFERRER_COLUMN_SUB = 'Referrer code';
export const VISITOR_IP_COLUMN_TITLE = 'Visitor IP';
export const VISITOR_IP_COLUMN_SUB = 'Person who joined';
