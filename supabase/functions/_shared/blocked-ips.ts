/**
 * High-risk / abuse IP blocklist — hard deny on public edge activity.
 * Keep exact IPs only (no broad ranges) to avoid collateral damage.
 * Sync with Vercel Firewall IP blocks when adding entries.
 */

/** IPs permanently denied from referrals, claims, visitor events, and related writes. */
export const BLOCKED_ACTIVITY_IPS = [
  '77.49.85.59', // high-risk — blocked 2026-08-02 (Nova Team)
  '24.255.60.39', // high-risk — blocked 2026-08-07 (Nova Team)
] as const;

/** Normalize client IP for comparison (trim, lowercase for IPv6). */
export function normalizeClientIp(ip: string | null | undefined): string {
  return String(ip || '').trim().toLowerCase();
}

/** True when this client IP must not perform any public write activity. */
export function isBlockedActivityIp(ip: string | null | undefined): boolean {
  const normalized = normalizeClientIp(ip);
  if (!normalized || normalized === 'unknown') return false;
  return (BLOCKED_ACTIVITY_IPS as readonly string[]).some(
    (blocked) => normalizeClientIp(blocked) === normalized,
  );
}

/** Standard 403 body for blocked IPs (generic — do not reveal blocklist details). */
export function blockedActivityResponse(corsHeaders: Record<string, string> = {}): Response {
  return new Response(JSON.stringify({ success: false, error: 'Access denied.' }), {
    status: 403,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
