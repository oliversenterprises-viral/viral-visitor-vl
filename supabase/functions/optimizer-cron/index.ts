import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import { runOptimizerAutopilotCycle } from '../_shared/optimizer-autopilot-run.ts';
import { expireStalePendingLinks } from '../_shared/referrer-share-deadline.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-optimizer-cron-secret, x-admin-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return result === 0;
}

function isAuthorized(req: Request): boolean {
  const cronSecret = Deno.env.get('OPTIMIZER_CRON_SECRET') || '';
  const adminSecret = Deno.env.get('ADMIN_ACTION_SECRET') || '';
  const header =
    req.headers.get('x-optimizer-cron-secret') ||
    req.headers.get('x-admin-secret') ||
    '';
  if (cronSecret && timingSafeEqual(header, cronSecret)) return true;
  if (adminSecret && timingSafeEqual(header, adminSecret)) return true;
  return false;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ success: false, error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  if (!isAuthorized(req)) {
    return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), {
      status: 403,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } },
    );

    let dryRun = false;
    try {
      const body = await req.json();
      dryRun = body?.dry_run === true || body?.dryRun === true;
    } catch {
      // empty body ok
    }

    const expiredLinks = dryRun ? 0 : await expireStalePendingLinks(supabase);
    const result = await runOptimizerAutopilotCycle(supabase, { dryRun });
    return new Response(
      JSON.stringify({
        success: true,
        data: { ...result, expired_pending_links: expiredLinks },
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  } catch (err) {
    console.error('[optimizer-cron] error:', err);
    return new Response(
      JSON.stringify({
        success: false,
        error: err instanceof Error ? err.message : 'Autopilot failed',
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  }
});