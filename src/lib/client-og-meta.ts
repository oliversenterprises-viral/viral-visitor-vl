/**
 * Client-side document meta updates when visitor lands on /r/CODE (humans + in-app previews).
 */

import { buildReferralOgMeta } from './og-meta';
import { parseRefFromLocation } from './referral-url';
import { fetchMyLeaderboardRank, fetchMyReferralCount } from './supabase';

function setMeta(selector: string, attr: 'content' | 'href', value: string): void {
  const el = document.querySelector(selector) as HTMLMetaElement | HTMLLinkElement | null;
  if (el) el.setAttribute(attr, value);
}

function applyMetaFromPayload(
  meta: NonNullable<ReturnType<typeof buildReferralOgMeta>>,
): void {
  document.title = meta.title;
  setMeta('meta[name="description"]', 'content', meta.description);
  setMeta('meta[property="og:url"]', 'content', meta.canonicalUrl);
  setMeta('meta[property="og:title"]', 'content', meta.title);
  setMeta('meta[property="og:description"]', 'content', meta.description);
  setMeta('meta[property="og:image"]', 'content', meta.image);
  setMeta('meta[name="twitter:url"]', 'content', meta.canonicalUrl);
  setMeta('meta[name="twitter:title"]', 'content', meta.title);
  setMeta('meta[name="twitter:description"]', 'content', meta.description);
  setMeta('meta[name="twitter:image"]', 'content', meta.image);
}

/** Update title + OG/Twitter tags for the current /r/CODE or ?ref= landing. */
export function applyClientReferralOgMeta(loc: Location = location): void {
  const code = parseRefFromLocation(loc);
  if (!code) return;

  const subpathMatch = loc.pathname.match(/^(\/[^/]+)\/r\//i);
  const subpath = subpathMatch?.[1]?.replace(/^\//, '') || '';

  const meta = buildReferralOgMeta(code, { subpath, origin: loc.origin });
  if (!meta) return;
  applyMetaFromPayload(meta);
}

/** Async enrich OG image/description with live rank + referral count (wave 6). */
export async function enrichClientReferralOgMeta(
  code: string,
  loc: Location = location,
): Promise<void> {
  const normalized = code.trim().toUpperCase();
  if (!normalized) return;

  const subpathMatch = loc.pathname.match(/^(\/[^/]+)\/r\//i);
  const subpath = subpathMatch?.[1]?.replace(/^\//, '') || '';

  const [rank, referrals] = await Promise.all([
    fetchMyLeaderboardRank(normalized),
    fetchMyReferralCount(normalized),
  ]);

  const meta = buildReferralOgMeta(normalized, {
    subpath,
    origin: loc.origin,
    rank,
    referrals,
  });
  if (!meta) return;
  applyMetaFromPayload(meta);
}

/** Fire-and-forget enrichment for attributed landing pages. */
export function scheduleReferralOgEnrichment(loc: Location = location): void {
  const code = parseRefFromLocation(loc);
  if (!code) return;
  void enrichClientReferralOgMeta(code, loc);
}