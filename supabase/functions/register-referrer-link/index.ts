// Public Edge — register a referrer code when the visitor gets their link.
// Starts the 48h first-friend lock clock (share may add grace; copy never locks).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import { registerReferrerLink } from '../_shared/referrer-share-deadline.ts';
import { blockedActivityResponse, isBlockedActivityIp } from '../_shared/blocked-ips.ts';
import { getTrustedClientIp } from '../_shared/trusted-ip.ts';
import { isAutomationUserAgent, isTestReferrerCode } from '../_shared/test-referral.ts';
import {
  hashClaimOwnershipToken,
  mintClaimOwnershipToken,
  resolveClaimOwnershipSecret,
} from '../_shared/claim-ownership.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function getClientIp(req: Request): string {
  return getTrustedClientIp(req);
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

    if (isTestReferrerCode(code) || isAutomationUserAgent(req.headers.get('user-agent'))) {
      return new Response(
        JSON.stringify({ success: true, skipped: true, data: { status: 'pending_share', exempt: true } }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } },
    );

    const clientIp = getClientIp(req);
    if (isBlockedActivityIp(clientIp)) {
      return blockedActivityResponse(corsHeaders);
    }
    const result = await registerReferrerLink(supabaseAdmin, code, { clientIp });

    try {
      const { pruneAndSaveSiteDrops } = await import('../_shared/site-drops-store.ts');
      await pruneAndSaveSiteDrops(supabaseAdmin);
    } catch (dropErr) {
      console.warn('[register-referrer-link] site-drop prune skipped:', dropErr);
    }

    let ownership_token: string | undefined;
    const secret = resolveClaimOwnershipSecret({ get: (k) => Deno.env.get(k) });
    if (secret && result.created) {
      try {
        const token = await mintClaimOwnershipToken(secret, code);
        const hash = await hashClaimOwnershipToken(secret, token);
        const { error: hashErr } = await supabaseAdmin
          .from('referrer_links')
          .update({ ownership_hash: hash })
          .eq('referrer_code', code)
          .is('ownership_hash', null);
        if (!hashErr) ownership_token = token;
      } catch (ownErr) {
        console.warn('[register-referrer-link] ownership mint skipped:', ownErr);
      }
    }

    return new Response(
      JSON.stringify({
        success: result.ok || result.status === 'pending_share' || result.status === 'active',
        data: {
          status: result.status,
          created_at: result.created_at ?? null,
          deadline_at: result.deadline_at ?? null,
          share_required: result.exempt ? false : result.status === 'pending_share',
          exempt: Boolean(result.exempt),
          ownership_token: ownership_token ?? null,
          message: result.exempt
            ? 'Owner IP exempt — no first-friend deadline.'
            : result.status === 'expired'
              ? result.error ||
                'Link expired — get a new free link. A friend must Get my link within about 2 days (48h) to lock it.'
              : result.status === 'pending_share'
                ? 'Send this link — a friend must Get my link within about 2 days (48h) or this link stops. Sharing can add time. Copy alone never locks.'
                : result.status === 'active'
                  ? 'Link is locked — a friend already joined through you.'
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
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Could not register your link',
        data: { status: 'unknown', share_required: true },
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
