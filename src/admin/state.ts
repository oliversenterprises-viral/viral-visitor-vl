/**
 * Shared admin state (caches)
 *
 * In-memory caches used by the admin tabs to avoid refetching data
 * on every render and to support optimistic updates.
 *
 * We use lightweight "Admin Row" types here (denormalized projections
 * of what the UI actually needs) rather than the strict domain models.
 * This keeps the admin layer flexible while still giving us decent type safety.
 */

export interface AdminReferralRow {
  id?: string;
  referrer_code: string;
  created_at: string;
  ip_address?: string;
  user_agent?: string;
  referrer_user_id?: string;
  referred_user_id?: string;
  [key: string]: unknown; // Allow extra DB columns without breaking
}

export interface AdminClaimRow {
  id: string;
  created_at: string;
  referrer_code: string;
  website?: string;
  cashtag?: string;
  message?: string;
  status: string;
  paid_at?: string;
  [key: string]: unknown;
}

// Private mutable storage (only this module mutates them)
let _adminClaimsCache: AdminClaimRow[] = [];
let _adminReferralsCache: AdminReferralRow[] = [];

// Public readonly views — all external code must use the helper functions below
export const adminClaimsCache: readonly AdminClaimRow[] = _adminClaimsCache;
export const adminReferralsCache: readonly AdminReferralRow[] = _adminReferralsCache;

/**
 * Safely replace the entire referrals cache.
 * Use this instead of direct array mutation.
 */
export function replaceReferralsCache(rows: AdminReferralRow[]) {
  _adminReferralsCache.length = 0;
  _adminReferralsCache.push(...rows);
}

/**
 * Safely replace the entire claims cache.
 */
export function replaceClaimsCache(rows: AdminClaimRow[]) {
  _adminClaimsCache.length = 0;
  _adminClaimsCache.push(...rows);
}

/**
 * Apply a partial update to a single item in the referrals cache by index.
 * Used for optimistic status updates, etc.
 */
export function updateReferralInCache(index: number, patch: Partial<AdminReferralRow>) {
  if (_adminReferralsCache[index]) {
    Object.assign(_adminReferralsCache[index], patch);
  }
}

/**
 * Apply a partial update to a single item in the claims cache by index.
 */
export function updateClaimInCache(index: number, patch: Partial<AdminClaimRow>) {
  if (_adminClaimsCache[index]) {
    Object.assign(_adminClaimsCache[index], patch);
  }
}
