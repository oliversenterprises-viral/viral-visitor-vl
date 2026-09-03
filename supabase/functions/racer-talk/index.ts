// Public Edge — current owner Talk message for the post–Get my link panel.
// No email. No signup. GET or POST { action: "get" }. Fail-open if CMS is empty.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import { blockedActivityResponse, isBlockedActivityIp } from '../_shared/blocked-ips.ts';
import { getTrustedClientIp } from '../_shared/trusted-ip.ts';
import {
  RACER_TALK_CONTENT_KEYS,
  mapSiteContentRowsToTalk,
  parseRacerTalkMessage,
} from '../_shared/racer-talk.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function adminClient() {
  return createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', {
    auth: { persistSession: false },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  if (req.method !== 'GET' && req.method !== 'POST') {
    return json({ success: false, error: 'Method not allowed', email_required: false }, 405);
  }

  try {
    const ip = getTrustedClientIp(req);
    if (isBlockedActivityIp(ip === 'unknown' ? '' : ip)) {
      return blockedActivityResponse(corsHeaders);
    }

    if (req.method === 'POST') {
      const body = await req.json().catch(() => ({}));
      const action = String(body.action || body.op || 'get')
        .trim()
        .toLowerCase();
      if (action && action !== 'get') {
        return json({ success: false, error: 'Unknown action', email_required: false }, 400);
      }
    }

    const supabaseAdmin = adminClient();
    const { data, error } = await supabaseAdmin
      .from('site_content')
      .select('key, id, value')
      .in('key', [...RACER_TALK_CONTENT_KEYS]);

    if (error) {
      console.error('[racer-talk] site_content', error.message || error);
      return json({ success: true, enabled: false, message: null, email_required: false });
    }

    const message = parseRacerTalkMessage(mapSiteContentRowsToTalk(data));
    return json({
      success: true,
      enabled: Boolean(message),
      email_required: false,
      message,
    });
  } catch (err) {
    console.error('[racer-talk]', err);
    return json({ success: true, enabled: false, message: null, email_required: false });
  }
});
