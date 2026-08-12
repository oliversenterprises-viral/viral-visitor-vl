/**
 * Trusted client IP for rate limits / dedupe.
 * Never trust the leftmost X-Forwarded-For hop — clients can set it.
 */

export function getTrustedClientIp(req: Request): string {
  const cf = req.headers.get('cf-connecting-ip')?.trim();
  if (cf) return cf;

  const real = req.headers.get('x-real-ip')?.trim();
  if (real) return real;

  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) {
    const parts = forwarded
      .split(',')
      .map((p) => p.trim())
      .filter(Boolean);
    // Rightmost hop is added by the platform; leftmost is attacker-controlled.
    if (parts.length > 0) return parts[parts.length - 1];
  }

  return 'unknown';
}
