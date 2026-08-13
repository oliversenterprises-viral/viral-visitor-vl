/**
 * Promoter (affiliate) helpers — shared by the public site and Edge.
 * Friend rank stays on /r/. Promoter credit is Get my link via /a/CODE.
 */

import { isTestReferrerCode } from './test-referral.ts';

export const AFFILIATES_SITE_CONTENT_KEY = 'affiliates_program';
export const DEFAULT_CASH_THRESHOLD = 10;
export const DEFAULT_AD_BOARD_URL = 'https://ads.viralrefer.app/#affiliate-join';

const CODE_RE = /^[A-Z0-9][A-Z0-9_-]{1,23}$/;

export interface AffiliateRow {
  code: string;
  name: string;
  created_at: string;
  notes: string;
  paid_count: number;
  ad_credit_granted: number;
  active: boolean;
  source: 'self' | 'owner';
  created_ip_hash?: string;
}

export interface AffiliatesProgram {
  bounty_label: string;
  payout_note: string;
  cash_threshold: number;
  ad_board_url: string;
  affiliates: AffiliateRow[];
}

export interface AffiliateConversionStats {
  landings: number;
  getLinks: number;
  uniqueGetLinkVisitors: number;
  unpaid: number;
}

export interface AffiliateRewards {
  adCreditOwed: number;
  adCreditGranted: number;
  cashThreshold: number;
  cashDue: boolean;
  cashUnpaid: number;
}

export function normalizeAffiliateCode(raw: string | null | undefined): string {
  return String(raw || '')
    .trim()
    .toUpperCase()
    .replace(/^AFF-/, '');
}

export function isValidAffiliateCode(raw: string | null | undefined): boolean {
  const code = normalizeAffiliateCode(raw);
  if (!code || !CODE_RE.test(code)) return false;
  if (isTestReferrerCode(code) || isTestReferrerCode(`VIRAL-${code}`)) return false;
  return true;
}

export function slugFromName(name: string): string {
  return normalizeAffiliateCode(String(name || '').replace(/[^A-Za-z0-9]+/g, '')).slice(0, 8);
}

export function mintAffiliateCode(name: string, taken: ReadonlySet<string>): string {
  const base = slugFromName(name) || 'P';
  if (isValidAffiliateCode(base) && !taken.has(base)) return base;
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  for (let i = 0; i < 24; i++) {
    let suffix = '';
    for (let j = 0; j < 3; j++) suffix += alphabet[Math.floor(Math.random() * alphabet.length)];
    const stem = (base || 'P').slice(0, 8);
    const candidate = `${stem}${suffix}`.slice(0, 12);
    if (isValidAffiliateCode(candidate) && !taken.has(candidate)) return candidate;
  }
  return `P${Date.now().toString(36).toUpperCase()}`.slice(0, 12);
}

export function defaultAffiliatesProgram(): AffiliatesProgram {
  return {
    bounty_label: '1 ad-board day per person who taps Get my link',
    payout_note:
      'Default thank-you is ad days on ads.viralrefer.app, granted automatically. Cash bonus after 10 people get a link is tracked automatically. This is not a contest prize — the leaderboard prize is still a homepage banner.',
    cash_threshold: DEFAULT_CASH_THRESHOLD,
    ad_board_url: DEFAULT_AD_BOARD_URL,
    affiliates: [],
  };
}

function parseRow(item: unknown): AffiliateRow | null {
  if (!item || typeof item !== 'object' || Array.isArray(item)) return null;
  const row = item as Record<string, unknown>;
  const code = normalizeAffiliateCode(String(row.code || ''));
  if (!isValidAffiliateCode(code)) return null;
  const source = row.source === 'owner' ? 'owner' : 'self';
  return {
    code,
    name: String(row.name || code).trim().slice(0, 80) || code,
    created_at: String(row.created_at || new Date().toISOString()),
    notes: String(row.notes || '').slice(0, 240),
    paid_count: Math.max(0, Math.floor(Number(row.paid_count) || 0)),
    ad_credit_granted: Math.max(0, Math.floor(Number(row.ad_credit_granted) || 0)),
    active: row.active !== false,
    source,
    created_ip_hash: String(row.created_ip_hash || '').slice(0, 24) || undefined,
  };
}

export function parseAffiliatesProgram(raw: unknown): AffiliatesProgram {
  const fallback = defaultAffiliatesProgram();
  let value = raw;
  if (typeof value === 'string' && value.trim()) {
    try {
      value = JSON.parse(value) as unknown;
    } catch {
      return fallback;
    }
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return fallback;
  const rec = value as Record<string, unknown>;
  const bounty =
    typeof rec.bounty_label === 'string' && rec.bounty_label.trim()
      ? rec.bounty_label.trim()
      : fallback.bounty_label;
  const note =
    typeof rec.payout_note === 'string' && rec.payout_note.trim()
      ? rec.payout_note.trim()
      : fallback.payout_note;
  const threshold = Math.max(1, Math.floor(Number(rec.cash_threshold) || fallback.cash_threshold));
  const adUrl =
    typeof rec.ad_board_url === 'string' && rec.ad_board_url.trim()
      ? rec.ad_board_url.trim()
      : fallback.ad_board_url;
  const affiliates: AffiliateRow[] = [];
  const list = Array.isArray(rec.affiliates) ? rec.affiliates : [];
  for (const item of list) {
    const row = parseRow(item);
    if (!row) continue;
    if (affiliates.some((a) => a.code === row.code)) continue;
    affiliates.push(row);
  }
  return {
    bounty_label: bounty,
    payout_note: note,
    cash_threshold: threshold,
    ad_board_url: adUrl,
    affiliates,
  };
}

export function eventAffiliateCode(event: Record<string, unknown>): string {
  const meta =
    event.metadata && typeof event.metadata === 'object' && !Array.isArray(event.metadata)
      ? (event.metadata as Record<string, unknown>)
      : {};
  const raw = meta.aff_code || event.aff_code || event.affCode;
  const code = normalizeAffiliateCode(String(raw || ''));
  return isValidAffiliateCode(code) ? code : '';
}

export function computeAffiliateStats(
  events: readonly Record<string, unknown>[],
  code: string,
  paidCount = 0,
): AffiliateConversionStats {
  const want = normalizeAffiliateCode(code);
  let landings = 0;
  let getLinks = 0;
  const unique = new Set<string>();
  for (const event of events) {
    if (eventAffiliateCode(event) !== want) continue;
    const name = String(event.event_name || event.eventName || '');
    const visitor = String(event.visitor_id || event.visitorId || '').trim();
    if (name === 'SiteLanding') landings += 1;
    if (name === 'GetReferralLink') {
      getLinks += 1;
      unique.add(visitor || `row-${getLinks}`);
    }
  }
  return {
    landings,
    getLinks,
    uniqueGetLinkVisitors: unique.size,
    unpaid: Math.max(0, unique.size - Math.max(0, paidCount)),
  };
}

export function computeAffiliateRewards(
  stats: AffiliateConversionStats,
  program: AffiliatesProgram,
  row?: Pick<AffiliateRow, 'paid_count' | 'ad_credit_granted'> | null,
): AffiliateRewards {
  const granted = Math.max(0, row?.ad_credit_granted || 0);
  const paid = Math.max(0, row?.paid_count || 0);
  const unique = stats.uniqueGetLinkVisitors;
  const threshold = Math.max(1, program.cash_threshold || DEFAULT_CASH_THRESHOLD);
  const cashUnpaid = Math.max(0, unique - paid);
  return {
    adCreditOwed: Math.max(0, unique - granted),
    adCreditGranted: granted,
    cashThreshold: threshold,
    cashDue: unique >= threshold && cashUnpaid > 0,
    cashUnpaid,
  };
}

export function eventTimeMs(event: Record<string, unknown>): number {
  const raw = event.created_at || event.createdAt || event.timestamp;
  const t = raw ? Date.parse(String(raw)) : NaN;
  return Number.isFinite(t) ? t : 0;
}

export function pickWeeklyTopFromLedger(
  grants: readonly { affiliate_code?: string | null }[],
  program: AffiliatesProgram,
): { code: string; name: string; uniqueGetLinkVisitors: number } | null {
  const counts = new Map<string, number>();
  for (const row of grants) {
    const code = normalizeAffiliateCode(row.affiliate_code);
    if (!isValidAffiliateCode(code)) continue;
    counts.set(code, (counts.get(code) || 0) + 1);
  }
  let best: { code: string; name: string; uniqueGetLinkVisitors: number } | null = null;
  for (const [code, n] of counts) {
    if (n <= 0) continue;
    const named = program.affiliates.find((a) => a.code === code && a.active !== false);
    if (program.affiliates.length && !named) continue;
    if (!best || n > best.uniqueGetLinkVisitors) {
      best = { code, name: named?.name || code, uniqueGetLinkVisitors: n };
    }
  }
  return best;
}

export function pickWeeklyTopPromoter(
  events: readonly Record<string, unknown>[],
  program: AffiliatesProgram,
  nowMs = Date.now(),
): { code: string; name: string; uniqueGetLinkVisitors: number } | null {
  const since = nowMs - 7 * 24 * 60 * 60 * 1000;
  const weekEvents = events.filter((e) => eventTimeMs(e) >= since);
  let best: { code: string; name: string; uniqueGetLinkVisitors: number } | null = null;
  for (const row of program.affiliates) {
    if (!row.active) continue;
    const stats = computeAffiliateStats(weekEvents, row.code, 0);
    if (stats.uniqueGetLinkVisitors <= 0) continue;
    if (!best || stats.uniqueGetLinkVisitors > best.uniqueGetLinkVisitors) {
      best = {
        code: row.code,
        name: row.name,
        uniqueGetLinkVisitors: stats.uniqueGetLinkVisitors,
      };
    }
  }
  return best;
}

export function addAffiliate(
  program: AffiliatesProgram,
  input: { name: string; code?: string; source?: 'self' | 'owner'; created_ip_hash?: string },
): { program: AffiliatesProgram; error?: string; row?: AffiliateRow } {
  const name = String(input.name || '').trim().slice(0, 80);
  if (!name) return { program, error: 'Need a name' };
  const taken = new Set(program.affiliates.map((a) => a.code));
  let code = input.code?.trim()
    ? normalizeAffiliateCode(input.code.replace(/\s+/g, '-'))
    : mintAffiliateCode(name, taken);
  if (!isValidAffiliateCode(code)) return { program, error: 'Code must be letters or numbers' };
  if (taken.has(code)) {
    if (input.source === 'self' || !input.code?.trim()) {
      code = mintAffiliateCode(name, taken);
    } else {
      return { program, error: 'That code is already used' };
    }
  }
  const row: AffiliateRow = {
    code,
    name,
    created_at: new Date().toISOString(),
    notes: '',
    paid_count: 0,
    ad_credit_granted: 0,
    active: true,
    source: input.source === 'owner' ? 'owner' : 'self',
    created_ip_hash: input.created_ip_hash,
  };
  return { program: { ...program, affiliates: [...program.affiliates, row] }, row };
}

export function markAffiliatePaid(
  program: AffiliatesProgram,
  code: string,
  paidCount: number,
): AffiliatesProgram {
  const want = normalizeAffiliateCode(code);
  return {
    ...program,
    affiliates: program.affiliates.map((row) =>
      row.code === want ? { ...row, paid_count: Math.max(0, Math.floor(paidCount)) } : row,
    ),
  };
}

export function markAffiliateAdCredit(
  program: AffiliatesProgram,
  code: string,
  granted: number,
): AffiliatesProgram {
  const want = normalizeAffiliateCode(code);
  return {
    ...program,
    affiliates: program.affiliates.map((row) =>
      row.code === want ? { ...row, ad_credit_granted: Math.max(0, Math.floor(granted)) } : row,
    ),
  };
}

export function setAffiliateActive(
  program: AffiliatesProgram,
  code: string,
  active: boolean,
): AffiliatesProgram {
  const want = normalizeAffiliateCode(code);
  return {
    ...program,
    affiliates: program.affiliates.map((row) => (row.code === want ? { ...row, active } : row)),
  };
}

export function countRecentSignupsForIp(
  program: AffiliatesProgram,
  ipHash: string,
  windowMs = 24 * 60 * 60 * 1000,
  nowMs = Date.now(),
): number {
  if (!ipHash) return 0;
  return program.affiliates.filter((row) => {
    if (row.created_ip_hash !== ipHash) return false;
    const t = Date.parse(row.created_at);
    return Number.isFinite(t) && nowMs - t < windowMs;
  }).length;
}
