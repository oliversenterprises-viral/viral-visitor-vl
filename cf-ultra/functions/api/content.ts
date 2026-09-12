import { jsonPublic } from '../_lib/http';
import { DEFAULT_OPS, loadOps } from '../_lib/ops';
import type { UltraEnv } from '../_lib/store';

export const onRequestGet: PagesFunction<UltraEnv> = async ({ env }) => {
  try {
    const ops = await loadOps(env);
    return jsonPublic({ ok: true, hero: ops.hero, lead: ops.lead }, { ttlSec: 15, staleSec: 60 });
  } catch {
    return jsonPublic({ ok: true, hero: DEFAULT_OPS.hero, lead: DEFAULT_OPS.lead }, { ttlSec: 15 });
  }
};
