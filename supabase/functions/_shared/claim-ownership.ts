/**
 * HMAC ownership tokens for homepage-feature claims.
 * New referrer_links rows get a hash; legacy NULL hash stays grandfathered.
 */

export const CLAIM_OWNERSHIP_TTL_MS = 180 * 24 * 60 * 60 * 1000;

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(b64url: string): string {
  const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/');
  const pad = b64.length % 4 === 0 ? '' : '='.repeat(4 - (b64.length % 4));
  return atob(b64 + pad);
}

async function hmacSign(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message));
  return toBase64Url(new Uint8Array(sig));
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return result === 0;
}

export function resolveClaimOwnershipSecret(env: {
  get(key: string): string | undefined;
}): string {
  return (
    env.get('CLAIM_OWNERSHIP_SECRET') ||
    env.get('ADMIN_ACTION_SECRET') ||
    env.get('TURNSTILE_SECRET_KEY') ||
    ''
  );
}

export async function mintClaimOwnershipToken(
  secret: string,
  referrerCode: string,
): Promise<string> {
  const code = String(referrerCode || '').trim().toUpperCase();
  const exp = Date.now() + CLAIM_OWNERSHIP_TTL_MS;
  const payloadB64 = btoa(JSON.stringify({ code, exp, v: 1 }))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  const sig = await hmacSign(secret, payloadB64);
  return `${payloadB64}.${sig}`;
}

export async function hashClaimOwnershipToken(secret: string, token: string): Promise<string> {
  return hmacSign(secret, `hash:${token}`);
}

export async function verifyClaimOwnershipToken(
  secret: string,
  token: string,
  expectedCode: string,
): Promise<boolean> {
  if (!secret || !token) return false;
  const cleaned = String(token).trim();
  const dot = cleaned.indexOf('.');
  if (dot <= 0) return false;
  const payloadB64 = cleaned.slice(0, dot);
  const sig = cleaned.slice(dot + 1);
  if (!payloadB64 || !sig) return false;
  const expected = await hmacSign(secret, payloadB64);
  if (!timingSafeEqual(sig, expected)) return false;
  try {
    const payload = JSON.parse(fromBase64Url(payloadB64)) as {
      code?: string;
      exp?: number;
    };
    const code = String(payload.code || '').trim().toUpperCase();
    const want = String(expectedCode || '').trim().toUpperCase();
    return code === want && typeof payload.exp === 'number' && payload.exp > Date.now();
  } catch {
    return false;
  }
}
