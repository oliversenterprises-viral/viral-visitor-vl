import { issueSession, sessionCookie, verifySecret } from '../../_lib/admin-auth';
import { json, readJson } from '../../_lib/http';
import { hitLimit } from '../../_lib/limit';
import { clientIp } from '../../_lib/http';
import type { UltraEnv } from '../../_lib/store';

type Body = { password?: string };

export const onRequestPost: PagesFunction<UltraEnv> = async ({ request, env }) => {
  const limited = hitLimit(`admin-login:${clientIp(request)}`, 8, 300_000);
  if (!limited.ok) {
    return json({ ok: false, error: 'Too many login attempts.' }, { status: 429 });
  }
  const body = (await readJson<Body>(request)) ?? {};
  const check = verifySecret(env, request, String(body.password || ''));
  if (!check.ok) {
    const hint =
      check.mode === 'unset'
        ? 'Set ADMIN_OWNER_PASSWORD on the Pages Function (never VITE_). Local wrangler without CF-Ray can use ultra-local-only.'
        : 'Wrong password.';
    return json({ ok: false, error: hint, mode: check.mode }, { status: 401 });
  }
  const token = await issueSession(env, request);
  if (!token) return json({ ok: false, error: 'Could not sign a session.' }, { status: 500 });
  return json(
    { ok: true, via: check.mode },
    { headers: { 'set-cookie': sessionCookie(token), 'cache-control': 'no-store' } },
  );
};
