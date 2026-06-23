// ============================================================================
// supabase/functions/admin-action/index.ts
// ViralRefer Premium — Admin-only actions (claim status, content editing, analytics)
// Phase 1 Bridge: Enforces x-admin-secret header (constant-time comparison)
// Production-ready — no bypass, no placeholders, no TODOs
// ============================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-admin-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function bannerEventKey(row: Record<string, unknown>): string {
  const lab = String(row.banner_label || row.label || '').trim();
  const url = String(row.redirect_url || row.redirectUrl || '').trim();
  const explicit = String(row.key || '').trim();
  if (explicit) return explicit;
  return lab && url ? `${lab}|${url}` : url || lab || 'unknown';
}

const BANNER_UPLOAD_ALLOWED_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
]);
const BANNER_UPLOAD_MAX_BYTES = 2 * 1024 * 1024;

function sanitizeBannerFileName(raw: string): string {
  const base = String(raw || 'banner')
    .split(/[/\\]/).pop()!
    .replace(/[^a-zA-Z0-9._-]/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 80);
  return base || 'banner';
}

function decodeBase64ToBytes(data: string): Uint8Array {
  const cleaned = data.includes(',') ? data.split(',').pop()! : data;
  const binary = atob(cleaned.replace(/\s/g, ''));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function normalizeBannerEventRow(row: Record<string, unknown>) {
  const additional =
    row.additional && typeof row.additional === 'object'
      ? (row.additional as Record<string, unknown>)
      : {};
  const keyFromAdditional = String(additional.key || '').trim();
  return {
    type: row.event_type || row.type,
    label: row.banner_label || row.label,
    redirect_url: row.redirect_url || row.redirectUrl || null,
    key: keyFromAdditional || bannerEventKey(row),
    additional,
    created_at: row.created_at,
  };
}

// Constant-time string comparison to prevent timing attacks
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ success: false, error: 'Method not allowed' }), {
      status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const body = await req.json();
  const { action, payload } = body;

  // Owner password verify — no admin secret required (password never stored in client bundle logic alone)
  if (action === 'verify_owner_password') {
    const password = String(payload?.password || '');
    const expected =
      Deno.env.get('ADMIN_OWNER_PASSWORD') ||
      Deno.env.get('VITE_ADMIN_PASSWORD') ||
      '';
    const ok = !!expected && timingSafeEqual(password, expected);
    return new Response(JSON.stringify({ success: ok }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Bridge auth: require the shared admin secret header (Phase 1)
  const adminSecretHeader = req.headers.get('x-admin-secret') || '';
  const expectedSecret = Deno.env.get('ADMIN_ACTION_SECRET') || '';

  if (!expectedSecret || !timingSafeEqual(adminSecretHeader, expectedSecret)) {
    return new Response(JSON.stringify({ success: false, error: 'Admin privileges required' }), {
      status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { persistSession: false } }
  );

  try {
    if (action === 'update_claim_status') {
      const { claimId, status, note } = payload;
      const { error } = await supabaseAdmin
        .from('prize_claims')
        .update({
          status,
          reviewed_at: new Date().toISOString(),
          review_note: note || null,
        })
        .eq('id', claimId);

      if (error) throw error;
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'get_claims') {
      // Service role read so password-based admin (no real user session) and owner tools both see the full list (pending + all statuses)
      // Bypasses RLS select_own / public-approved-only policies for admin visibility.
      const { data, error } = await supabaseAdmin
        .from('prize_claims')
        .select('id, created_at, referrer_code, website, cashtag, message, status, paid_at, review_note, reviewed_at')
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return new Response(JSON.stringify({ success: true, data: data || [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (action === 'update_site_content') {
      const { key, value } = payload;
      const { error } = await supabaseAdmin
        .from('site_content')
        .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' });

      if (error) throw error;
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'delete_site_content') {
      const key = String(payload?.key || '');
      if (!key) {
        return new Response(JSON.stringify({ success: false, error: 'key required' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const { error } = await supabaseAdmin.from('site_content').delete().eq('key', key);
      if (error) throw error;
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'get_shares') {
      const { data, error } = await supabaseAdmin
        .from('shares')
        .select('platform, referrer_code, referral_link, created_at')
        .order('created_at', { ascending: false })
        .limit(20000);
      if (error) throw error;

      const refFromLink = (link: unknown, explicit: unknown): string => {
        const code = String(explicit || '').trim();
        if (code && code.toLowerCase() !== 'unknown') return code.toUpperCase();
        const match = String(link || '').match(/\/r\/([A-Za-z0-9_-]+)/i);
        return match?.[1] ? match[1].toUpperCase() : 'unknown';
      };

      const normalized = (data || []).map((row: Record<string, unknown>) => ({
        platform: row.platform,
        referrer_code: refFromLink(row.referral_link, row.referrer_code),
        referral_link: row.referral_link || null,
        created_at: row.created_at,
      }));
      return new Response(JSON.stringify({ success: true, data: normalized }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (action === 'get_banner_stats') {
      // select('*') + normalize — prod uses event_type/banner_label, not type/label/key
      const { data, error } = await supabaseAdmin
        .from('banner_events')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(500);
      if (error) throw error;
      const normalized = (data || []).map((row: Record<string, unknown>) => normalizeBannerEventRow(row));
      return new Response(JSON.stringify({ success: true, data: normalized }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (action === 'get_reddit_stats') {
      const { data, error } = await supabaseAdmin
        .from('reddit_events')
        .select('event_name, utm_campaign, utm_content, utm_medium, ref_code, metadata, created_at')
        .order('created_at', { ascending: false })
        .limit(500);
      if (error) throw error;
      return new Response(JSON.stringify({ success: true, data: data || [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'get_visitor_stats') {
      const { data, error } = await supabaseAdmin
        .from('visitor_events')
        .select(
          'event_name, utm_source, utm_campaign, utm_content, utm_medium, ref_code, visitor_id, session_id, country_code, metadata, created_at',
        )
        .order('created_at', { ascending: false })
        .limit(500);
      if (error) throw error;
      return new Response(JSON.stringify({ success: true, data: data || [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'upload_banner_image') {
      const fileName = sanitizeBannerFileName(String(payload?.fileName || 'banner'));
      const contentType = String(payload?.contentType || '').toLowerCase();
      const data = String(payload?.data || '');

      if (!data) {
        return new Response(JSON.stringify({ success: false, error: 'Image data required' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (!BANNER_UPLOAD_ALLOWED_TYPES.has(contentType)) {
        return new Response(JSON.stringify({ success: false, error: 'Unsupported image type' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const bytes = decodeBase64ToBytes(data);
      if (bytes.length === 0 || bytes.length > BANNER_UPLOAD_MAX_BYTES) {
        return new Response(JSON.stringify({ success: false, error: 'Image must be between 1 byte and 2MB' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const storagePath = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}-${fileName}`;
      const { error: uploadError } = await supabaseAdmin.storage
        .from('banner-assets')
        .upload(storagePath, bytes, { contentType, upsert: false, cacheControl: '3600' });

      if (uploadError) throw uploadError;

      const { data: publicData } = supabaseAdmin.storage.from('banner-assets').getPublicUrl(storagePath);
      return new Response(JSON.stringify({ success: true, url: publicData.publicUrl, path: storagePath }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ success: false, error: 'Unknown action' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ success: false, error: err.message || 'Action failed' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});