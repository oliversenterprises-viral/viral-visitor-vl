/**
 * First-touch UTM attribution (session-scoped).
 * Used by site-wide visitor funnel tracking for any traffic source.
 */

import { getStoredLandingRef, parseRefFromLocation } from './referral-url';

export interface UtmAttribution {
  source: string | null;
  medium: string | null;
  campaign: string | null;
  content: string | null;
  ref: string | null;
  landed_at: string;
}

const UTM_STORAGE_KEY = 'vr_utm_attribution';

/** Persist UTM params from the landing URL (first touch per session). */
export function captureUtmAttribution(loc: Location = location): UtmAttribution | null {
  const params = new URLSearchParams(loc.search);
  const source = params.get('utm_source');
  if (!source) return null;

  const attribution: UtmAttribution = {
    source,
    medium: params.get('utm_medium'),
    campaign: params.get('utm_campaign'),
    content: params.get('utm_content'),
    ref: params.get('ref') || parseRefFromLocation(loc) || getStoredLandingRef(),
    landed_at: new Date().toISOString(),
  };

  try {
    sessionStorage.setItem(UTM_STORAGE_KEY, JSON.stringify(attribution));
  } catch {
    // Non-fatal
  }

  return attribution;
}

export function getStoredUtmAttribution(): UtmAttribution | null {
  try {
    const raw = sessionStorage.getItem(UTM_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as UtmAttribution) : null;
  } catch {
    return null;
  }
}