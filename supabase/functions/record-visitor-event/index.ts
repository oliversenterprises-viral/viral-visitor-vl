import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function getClientIp(req: Request): string {
  const cfIp = req.headers.get('cf-connecting-ip');
  if (cfIp) return cfIp.trim();
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return '';
}

function getCountryCode(req: Request): string | null {
  const raw =
    req.headers.get('cf-ipcountry') ||
    req.headers.get('x-vercel-ip-country') ||
    req.headers.get('x-country-code');
  if (!raw) return null;
  const code = raw.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(code) || code === 'XX' || code === 'T1') return null;
  return code;
}

async function hashIp(ip: string): Promise<string | null> {
  if (!ip) return null;
  const salt = Deno.env.get('VISITOR_IP_HASH_SALT') || 'viralrefer-visitor-v1';
  const data = new TextEncoder().encode(`${salt}:${ip}`);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 24);
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
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } },
    );

    const body = await req.json();
    const eventName = String(body.eventName || body.event_name || '').trim();
    if (!eventName) {
      return new Response(JSON.stringify({ success: false, error: 'eventName required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const visitorId = String(body.visitor_id || body.visitorId || '').trim().slice(0, 64) || null;
    const sessionId = String(body.session_id || body.sessionId || '').trim().slice(0, 64) || null;
    const ip = getClientIp(req);
    const ipHash = await hashIp(ip);
    const countryCode = getCountryCode(req);

    const row = {
      event_name: eventName.slice(0, 80),
      utm_source: body.utm_source || body.utmSource || null,
      utm_campaign: body.utm_campaign || body.utmCampaign || null,
      utm_content: body.utm_content || body.utmContent || null,
      utm_medium: body.utm_medium || body.utmMedium || null,
      ref_code: body.ref_code || body.refCode || null,
      visitor_id: visitorId,
      session_id: sessionId,
      ip_hash: ipHash,
      country_code: countryCode,
      metadata: body.metadata && typeof body.metadata === 'object' ? body.metadata : {},
      created_at: body.timestamp || new Date().toISOString(),
    };

    const { error } = await supabaseAdmin.from('visitor_events').insert(row);
    if (error) throw error;

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[record-visitor-event] error:', err);
    return new Response(JSON.stringify({ success: false, error: 'Logged server-side' }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});