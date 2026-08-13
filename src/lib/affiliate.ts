/**
 * Client affiliate helpers. Core logic lives in the shared Edge module.
 */

import { isValidAffiliateCode, normalizeAffiliateCode } from '../../supabase/functions/_shared/affiliate';

export {
  AFFILIATES_SITE_CONTENT_KEY,
  DEFAULT_AD_BOARD_URL,
  DEFAULT_CASH_THRESHOLD,
  addAffiliate,
  computeAffiliateRewards,
  computeAffiliateStats,
  countRecentSignupsForIp,
  defaultAffiliatesProgram,
  eventAffiliateCode,
  eventTimeMs,
  isValidAffiliateCode,
  markAffiliateAdCredit,
  markAffiliatePaid,
  mintAffiliateCode,
  normalizeAffiliateCode,
  parseAffiliatesProgram,
  pickWeeklyTopPromoter,
  setAffiliateActive,
  slugFromName,
  type AffiliateConversionStats,
  type AffiliateRewards,
  type AffiliateRow,
  type AffiliatesProgram,
} from '../../supabase/functions/_shared/affiliate';

export const AFFILIATE_STORAGE_KEY = 'vr_landing_aff';
export const MY_AFFILIATE_STORAGE_KEY = 'vr_my_aff_code';

const PATH_AFF_RE = /\/a\/([A-Za-z0-9_-]+)\/?$/i;

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

export function buildPromoterDashboardLink(
  code: string,
  baseUrl = 'https://www.viralrefer.app',
): string {
  const normalized = normalizeAffiliateCode(code);
  const base = String(baseUrl || 'https://www.viralrefer.app').replace(/\/$/, '');
  return `${base}/?promoter=${encodeURIComponent(normalized)}#become-promoter`;
}

export function getMyAffiliateCode(): string | null {
  try {
    const raw = localStorage.getItem(MY_AFFILIATE_STORAGE_KEY);
    return raw && isValidAffiliateCode(raw) ? normalizeAffiliateCode(raw) : null;
  } catch {
    return null;
  }
}

export function setMyAffiliateCode(code: string): void {
  const normalized = normalizeAffiliateCode(code);
  if (!isValidAffiliateCode(normalized)) return;
  try {
    localStorage.setItem(MY_AFFILIATE_STORAGE_KEY, normalized);
  } catch {
    /* non-fatal */
  }
}
