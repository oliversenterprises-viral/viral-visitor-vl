import { json } from '../_lib/http';
import { kvBound, type UltraEnv } from '../_lib/store';

export const onRequestGet: PagesFunction<UltraEnv> = async ({ env }) => {
  const kv = kvBound(env);
  return json({
    ok: true,
    app: 'viralrefer-ultra',
    kv,
    demoMode: !kv,
    note: kv
      ? 'KV bound — unique locks persist.'
      : 'TODO: bind BOARD KV. Running isolate memory demo mode.',
  });
};
