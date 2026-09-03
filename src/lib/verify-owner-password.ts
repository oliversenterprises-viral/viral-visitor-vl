/**
 * Owner password verify — direct fetch only.
 * The JS client invoke helper can hang with no timeout; Continue must not wait on that.
 * Password is POSTed to admin-action. Never read from VITE_ (that would ship in the bundle).
 */

export const OWNER_VERIFY_TIMEOUT_MS = 8_000;

export type OwnerVerifyResult = {
  authorized: boolean;
  sessionToken: string;
};

function supabaseUrlAndAnon(): { url: string; anon: string } | null {
  const url = String(import.meta.env.VITE_SUPABASE_URL || '').trim().replace(/\/$/, '');
  const anon = String(import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();
  if (!url || !anon) return null;
  return { url, anon };
}

export async function verifyOwnerPassword(password: string): Promise<OwnerVerifyResult> {
  const denied: OwnerVerifyResult = { authorized: false, sessionToken: '' };
  const cfg = supabaseUrlAndAnon();
  if (!cfg) return denied;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), OWNER_VERIFY_TIMEOUT_MS);
  try {
    const res = await fetch(`${cfg.url}/functions/v1/admin-action`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cfg.anon}`,
        apikey: cfg.anon,
      },
      body: JSON.stringify({
        action: 'verify_owner_password',
        payload: { password },
      }),
      signal: ctrl.signal,
    });
    const text = await res.text();
    let envelope: Record<string, unknown> = {};
    try {
      envelope = text ? (JSON.parse(text) as Record<string, unknown>) : {};
    } catch {
      return denied;
    }
    const sessionToken =
      typeof envelope.session_token === 'string' ? envelope.session_token.trim() : '';
    if (envelope.success === true && sessionToken) {
      return { authorized: true, sessionToken };
    }
    return denied;
  } catch {
    return denied;
  } finally {
    clearTimeout(timer);
  }
}
