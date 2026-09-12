import { jsonPublic } from '../_lib/http';
import { kvBound, type UltraEnv } from '../_lib/store';

export const onRequestGet: PagesFunction<UltraEnv> = async ({ env }) => {
  const kv = kvBound(env);
  return jsonPublic(
    {
      ok: true,
      app: 'viralrefer-ultra',
      kv,
      demoMode: !kv,
      note: kv
        ? 'KV bound — unique locks persist. Board snapshots cached ~3s.'
        : 'TODO: bind BOARD KV. Running isolate memory demo mode.',
      scale: {
        target: '1k–10k+ daily visitors',
        assumedPlan: 'Cloudflare Workers Paid (or Pages with paid Workers) + one KV namespace BOARD',
        freeTierWarning: 'Free KV is ~1k writes/day — not enough once joins pick up. Paid includes 1M writes/day.',
        writes: 'KV writes only on Get-my-link / credit — never on pageviews or board polls',
        reads: 'Board/activity/challenge from ultra:board snapshot + 3s edge/isolate cache',
        degrade: 'Realtime polish (poll interval, cache freshness) sheds first. Paste → share → credit stays up.',
      },
    },
    { ttlSec: 15, staleSec: 60 },
  );
};
