/**
 * Owner-approved promoters. Separate from /r/ friend rank.
 * Credit = a visitor they sent tapped Get my link.
 */

import { isTestReferrerCode } from './test-referral';

export const AFFILIATE_STORAGE_KEY = 'vr_landing_aff';
export const AFFILIATES_SITE_CONTENT_KEY = 'affiliates_program';

const PATH_AFF_RE = /\/a\/([A-Za-z0-9_-]+)\/?$/i;
const CODE_RE = /^[A-Z0-9][A-Z0-9_-]{1,23}$/;

export interface AffiliateRow {
  code: string;
  name: string;
  created_at: string;
  notes: string;
  paid_count: number;
  active: boolean;
}

export interface AffiliatesProgram {
  bounty_label: string;
  payout_note: string;
  affiliates: AffiliateRow[];
}

export interface AffiliateConversionStats {
  landings: number;
  getLinks: number;
  uniqueGetLinkVisitors: number;
  unpaid: number;
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

export function parseAffiliateFromLocation(loc: Location = location): string | null {
  const params = new URLSearchParams(loc.search);
  const fromQuery = params.get('aff') || params.get('affiliate');
  if (fromQuery && isValidAffiliateCode(fromQuery)) return normalizeAffiliateCode(fromQuery);

  const fromPath = loc.pathname.match(PATH_AFF_RE);
  if (fromPath?.[1] && isValidAffiliateCode(fromPath[1])) {
    return normalizeAffiliateCode(fromPath[1]);
  }
  return null;
}

export function captureAffiliateAttribution(loc: Location = location): string | null {
  const next = parseAffiliateFromLocation(loc);
  if (!next) return getStoredAffiliateCode();
  try {
    if (!sessionStorage.getItem(AFFILIATE_STORAGE_KEY)) {
      sessionStorage.setItem(AFFILIATE_STORAGE_KEY, next);
    }
  } catch {
    /* non-fatal */
  }
  return getStoredAffiliateCode() || next;
}

export function getStoredAffiliateCode(): string | null {
  try {
    const raw = sessionStorage.getItem(AFFILIATE_STORAGE_KEY);
    return raw && isValidAffiliateCode(raw) ? normalizeAffiliateCode(raw) : null;
  } catch {
    return null;
  }
}

export function buildAffiliateLink(code: string, baseUrl = 'https://www.viralrefer.app'): string {
  const normalized = normalizeAffiliateCode(code);
  const base = String(baseUrl || 'https://www.viralrefer.app').replace(/\/$/, '');
  return `${base}/a/${normalized}`;
}

export function defaultAffiliatesProgram(): AffiliatesProgram {
  return {
    bounty_label: '$1 per new Get my link',
    payout_note:
      'You pay promoters. This is not a contest prize. The leaderboard prize is still a homepage banner, not cash.',
    affiliates: [],
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
  const list = Array.isArray(rec.affiliates) ? rec.affiliates : [];
  const affiliates: AffiliateRow[] = [];
  for (const item of list) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
    const row = item as Record<string, unknown>;
    const code = normalizeAffiliateCode(String(row.code || ''));
    if (!isValidAffiliateCode(code)) continue;
    if (affiliates.some((a) => a.code === code)) continue;
    affiliates.push({
      code,
      name: String(row.name || code).trim().slice(0, 80) || code,
      created_at: String(row.created_at || new Date().toISOString()),
      notes: String(row.notes || '').slice(0, 240),
      paid_count: Math.max(0, Math.floor(Number(row.paid_count) || 0)),
      active: row.active !== false,
    });
  }
  return { bounty_label: bounty, payout_note: note, affiliates };
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

export function addAffiliate(
  program: AffiliatesProgram,
  input: { name: string; code?: string },
): { program: AffiliatesProgram; error?: string; row?: AffiliateRow } {
  const name = String(input.name || '').trim().slice(0, 80);
  const rawCode = input.code?.trim() ? input.code : name;
  const code = normalizeAffiliateCode(rawCode.replace(/\s+/g, '-'));
  if (!name) return { program, error: 'Need a name' };
  if (!isValidAffiliateCode(code)) return { program, error: 'Code must be letters or numbers' };
  if (program.affiliates.some((a) => a.code === code)) {
    return { program, error: 'That code is already used' };
  }
  const row: AffiliateRow = {
    code,
    name,
    created_at: new Date().toISOString(),
    notes: '',
    paid_count: 0,
    active: true,
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
