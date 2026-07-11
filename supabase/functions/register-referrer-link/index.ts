// Public Edge — register a referrer code when the visitor gets their link.
// Starts the 24h verified-share clock.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import { registerReferrerLink } from '../_shared/referrer-share-deadline.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

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

  try {
    const body = await req.json();
    const code = String(body.referrer_code || body.referrerCode || '')
      .trim()
      .toUpperCase();

    if (!code || !/^VIRAL-[A-Z0-9_-]+$/i.test(code)) {
      return new Response(JSON.stringify({ success: false, error: 'Invalid referrer code' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } },
    );

    const result = await registerReferrerLink(supabaseAdmin, code);

    return new Response(
      JSON.stringify({
        success: result.ok || result.status === 'pending_share' || result.status === 'active',
        data: {
          status: result.status,
          created_at: result.created_at ?? null,
          deadline_at: result.deadline_at ?? null,
          share_required: result.status === 'pending_share',
          message:
            result.status === 'expired'
              ? result.error || 'Link expired — generate a new link and share within 24 hours.'
              : result.status === 'pending_share'
                ? 'Share this link within 24 hours or it will be removed from the system.'
                : result.status === 'active'
                  ? 'Link is active — verified share recorded.'
                  : 'Registered.',
        },
        error: result.status === 'expired' ? result.error : undefined,
      }),
      {
        status: result.status === 'expired' ? 410 : 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  } catch (err) {
    console.error('[register-referrer-link]', err);
    // Fail open for client UX — never block get-link on registration glitches
    return new Response(
      JSON.stringify({
        success: true,
        data: { status: 'unknown', share_required: true },
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
