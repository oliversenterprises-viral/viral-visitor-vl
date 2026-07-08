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
    const eventType = String(body.event_type || body.eventType || '').trim();
    const zoneId = String(body.zone_id || body.zoneId || '').trim();
    if (!eventType || !zoneId) {
      return new Response(JSON.stringify({ success: false, error: 'event_type and zone_id required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const ip = getClientIp(req);
    const ipHash = await hashIp(ip);
    const clientMetadata =
      body.metadata && typeof body.metadata === 'object' && !Array.isArray(body.metadata)
        ? { ...body.metadata }
        : {};

    const row = {
      event_type: eventType.slice(0, 32),
      zone_id: zoneId.slice(0, 64),
      path: body.path ? String(body.path).slice(0, 256) : null,
      x: Number.isFinite(body.x) ? Math.round(body.x) : null,
      y: Number.isFinite(body.y) ? Math.round(body.y) : null,
      viewport_w: Number.isFinite(body.viewport_w) ? Math.round(body.viewport_w) : null,
      viewport_h: Number.isFinite(body.viewport_h) ? Math.round(body.viewport_h) : null,
      scroll_y: Number.isFinite(body.scroll_y) ? Math.round(body.scroll_y) : null,
      scroll_depth_pct: Number.isFinite(body.scroll_depth_pct)
        ? Math.min(100, Math.max(0, Math.round(body.scroll_depth_pct)))
        : null,
      visitor_id: String(body.visitor_id || body.visitorId || '').trim().slice(0, 64) || null,
      session_id: String(body.session_id || body.sessionId || '').trim().slice(0, 64) || null,
      ref_code: body.ref_code || body.refCode || null,
      ab_variant: body.ab_variant || body.abVariant || null,
      is_referred: body.is_referred === true || body.isReferred === true,
      ip_hash: ipHash,
      metadata: clientMetadata,
      created_at: body.timestamp || new Date().toISOString(),
    };

    const { error } = await supabaseAdmin.from('interaction_events').insert(row);
    if (error) throw error;

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[record-interaction] error:', err);
    return new Response(JSON.stringify({ success: false, error: 'Logged server-side' }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});