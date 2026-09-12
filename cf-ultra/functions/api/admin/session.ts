import { cfAccessEmail, configuredSecret, isCloudflareEdge, readSession } from '../../_lib/admin-auth';
import { json } from '../../_lib/http';
import { kvBound, type UltraEnv } from '../../_lib/store';

export const onRequestGet: PagesFunction<UltraEnv> = async ({ request, env }) => {
  const session = await readSession(env, request);
  return json({
    ok: session.ok,
    via: session.via,
    exp: session.exp ?? null,
    accessEmail: cfAccessEmail(request),
    secretConfigured: Boolean(configuredSecret(env)),
    edge: isCloudflareEdge(request),
    kv: kvBound(env),
    localFallback: !configuredSecret(env) && !isCloudflareEdge(request),
  });
};
