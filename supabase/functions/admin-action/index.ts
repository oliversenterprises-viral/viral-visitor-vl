// ============================================================================
// supabase/functions/admin-action/index.ts
// ViralRefer Premium — Admin-only actions (claim status, content editing, analytics)
// Phase 1 Bridge: Enforces x-admin-secret header (constant-time comparison)
// Production-ready — no bypass, no placeholders, no TODOs
// ============================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import {
  getBannerEventIp,
  getVisitorEventIp,
  groupVisitorEventsByIp,
  isTestBannerEvent,
  isTestVisitorFunnelEvent,
} from '../_shared/admin-stats-test.ts';
import {
  getFunnelNotifyChannel,
  isFunnelNotifyImportantOnly,
  isFunnelOffsiteNotifyEnabled,
} from '../_shared/funnel-notify.ts';
import { mintAdminSessionToken, verifyAdminSessionToken } from '../_shared/admin-session.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-admin-secret, x-admin-session',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function bannerEventKey(row: Record<string, unknown>): string {
  const lab = String(row.banner_label || row.label || '').trim();
  const url = String(row.redirect_url || row.redirectUrl || '').trim();
  const explicit = String(row.key || row.banner_key || '').trim();
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

function resolveShareReferrerCode(row: Record<string, unknown>): string {
  const code = String(row.referrer_code ?? row.referrerCode ?? '').trim();
  if (code && code.toLowerCase() !== 'unknown') return code.toUpperCase();
  const match = String(row.referral_link ?? row.referralLink ?? '').match(/\/r\/([A-Za-z0-9_-]+)/i);
  return match?.[1] ? match[1].toUpperCase() : 'unknown';
}

/** Agent/smoke/E2E patterns only — must match client share-analytics-helpers.ts */
function isTestShareReferrerCode(code: string): boolean {
  const c = (code || '').trim().toUpperCase();
  if (!c || c === 'UNKNOWN') return true;
  if (c === 'VIRAL-READY') return true;
  if (/PROBE/.test(c)) return true;
  if (/SMOKETEST/.test(c)) return true;
  if (/DEMOCODE/.test(c)) return true;
  if (/^DEMO\d+$/.test(c)) return true;
  if (/TESTFIX/.test(c)) return true;
  return false;
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
    key: keyFromAdditional || String(row.key || row.banner_key || '').trim() || bannerEventKey(row),
    ip: getBannerEventIp(row) || null,
    user_agent: String(row.user_agent || additional.user_agent || '').trim() || null,
    additional,
    created_at: row.created_at,
  };
}

const PASSWORD_RATE_WINDOW_MS = 60_000;
const PASSWORD_RATE_MAX = 10;
const passwordAttemptsByIp = new Map<string, { count: number; windowStart: number }>();

function clientIp(req: Request): string {
  return (
    req.headers.get('cf-connecting-ip')?.trim() ||
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    'unknown'
  );
}

function isPasswordRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = passwordAttemptsByIp.get(ip);
  if (!entry || now - entry.windowStart > PASSWORD_RATE_WINDOW_MS) {
    passwordAttemptsByIp.set(ip, { count: 1, windowStart: now });
    return false;
  }
  entry.count += 1;
  return entry.count > PASSWORD_RATE_MAX;
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

  let body: { action?: string; payload?: Record<string, unknown> };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ success: false, error: 'Invalid JSON body' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  const { action, payload } = body;

  // Owner password verify — no admin secret required (password never stored in client bundle logic alone)
  if (action === 'verify_owner_password') {
    const ip = clientIp(req);
    if (isPasswordRateLimited(ip)) {
      return new Response(JSON.stringify({ success: false, error: 'Too many attempts — try again shortly' }), {
        status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const password = String(payload?.password || '');
    const expected = Deno.env.get('ADMIN_OWNER_PASSWORD') || '';
    const actionSecret = Deno.env.get('ADMIN_ACTION_SECRET') || '';
    const ok = !!expected && timingSafeEqual(password, expected);
    const sessionToken =
      ok && actionSecret ? await mintAdminSessionToken(actionSecret) : undefined;
    return new Response(JSON.stringify({ success: ok, session_token: sessionToken }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Bridge auth: x-admin-secret (scripts/cron) OR x-admin-session (browser after password verify)
  const adminSecretHeader = req.headers.get('x-admin-secret') || '';
  const adminSessionHeader = req.headers.get('x-admin-session') || '';
  const expectedSecret = Deno.env.get('ADMIN_ACTION_SECRET') || '';

  let authorized = false;
  if (expectedSecret) {
    if (timingSafeEqual(adminSecretHeader, expectedSecret)) {
      authorized = true;
    } else if (
      adminSessionHeader &&
      (await verifyAdminSessionToken(expectedSecret, adminSessionHeader))
    ) {
      authorized = true;
    }
  }

  if (!authorized) {
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
      const ALLOWED_CLAIM_STATUS = new Set(['pending', 'approved', 'rejected', 'paid']);
      if (!claimId || typeof claimId !== 'string') {
        return new Response(JSON.stringify({ success: false, error: 'claimId required' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (!status || !ALLOWED_CLAIM_STATUS.has(String(status))) {
        return new Response(JSON.stringify({ success: false, error: 'Invalid claim status' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const statusStr = String(status);
      const updatePayload: Record<string, unknown> = {
        status: statusStr,
        reviewed_at: new Date().toISOString(),
        review_note: note || null,
      };
      if (statusStr === 'paid') {
        updatePayload.paid_at = new Date().toISOString();
      }
      const { data: updated, error } = await supabaseAdmin
        .from('prize_claims')
        .update(updatePayload)
        .eq('id', claimId)
        .select('id')
        .maybeSingle();

      if (error) throw error;
      if (!updated) {
        return new Response(JSON.stringify({ success: false, error: 'Claim not found' }), {
          status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
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
      // select('*') — prod schema may have referrer_code OR referral_link (not always both)
      const { data, error } = await supabaseAdmin
        .from('shares')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20000);
      if (error) throw error;

      const normalized = (data || []).map((row: Record<string, unknown>) => {
        const referral_link = row.referral_link ?? row.referralLink ?? null;
        const rawVariant = String(row.ab_variant ?? row.abVariant ?? '').toLowerCase().trim();
        return {
          platform: row.platform,
          referrer_code: resolveShareReferrerCode(row),
          referral_link,
          ab_variant: rawVariant === 'a' || rawVariant === 'b' ? rawVariant : null,
          created_at: row.created_at,
        };
      });
      return new Response(JSON.stringify({ success: true, data: normalized }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (action === 'get_referral_counts') {
      const { data, error } = await supabaseAdmin
        .from('referrals')
        .select('referrer_code')
        .limit(50000);
      if (error) throw error;

      const counts: Record<string, number> = {};
      for (const row of data || []) {
        const code = String(row.referrer_code || '').trim().toUpperCase();
        if (!code || isTestShareReferrerCode(code)) continue;
        counts[code] = (counts[code] || 0) + 1;
      }

      return new Response(JSON.stringify({ success: true, data: counts }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'get_referrals') {
      const limit = Math.min(Math.max(Number(payload?.limit) || 2000, 1), 5000);
      const { data, error } = await supabaseAdmin
        .from('referrals')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);
      if (error) throw error;
      return new Response(JSON.stringify({ success: true, data: data || [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'get_admin_live_seed') {
      const [referrals, shares, claims, visitorEvents, bannerEvents, siteContent] = await Promise.all([
        supabaseAdmin
          .from('referrals')
          .select('id, referrer_code, created_at')
          .order('created_at', { ascending: false })
          .limit(6),
        supabaseAdmin
          .from('shares')
          .select('id, platform, referrer_code, created_at')
          .order('created_at', { ascending: false })
          .limit(6),
        // Prod prize_claims columns (Cash App claims) — no prize_name/prize_id
        supabaseAdmin
          .from('prize_claims')
          .select('id, status, referrer_code, cashtag, website, message, created_at, reviewed_at, paid_at')
          .order('created_at', { ascending: false })
          .limit(4),
        supabaseAdmin
          .from('visitor_events')
          .select('id, event_name, utm_source, ref_code, created_at')
          .order('created_at', { ascending: false })
          .limit(8),
        supabaseAdmin
          .from('banner_events')
          .select('id, type, label, key, created_at')
          .order('created_at', { ascending: false })
          .limit(6),
        supabaseAdmin
          .from('site_content')
          .select('key, updated_at')
          .order('updated_at', { ascending: false })
          .limit(4),
      ]);

      const firstError =
        referrals.error ||
        shares.error ||
        claims.error ||
        visitorEvents.error ||
        bannerEvents.error ||
        siteContent.error;
      if (firstError) throw firstError;

      return new Response(
        JSON.stringify({
          success: true,
          data: {
            referrals: referrals.data || [],
            shares: shares.data || [],
            prize_claims: claims.data || [],
            visitor_events: visitorEvents.data || [],
            banner_events: (bannerEvents.data || []).map((row: Record<string, unknown>) =>
              normalizeBannerEventRow(row),
            ),
            site_content: siteContent.data || [],
          },
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    if (action === 'clear_test_shares') {
      const dryRun = payload?.dry_run === true;
      // select('*') — prod shares may have referrer_code only (no referral_link column)
      const { data, error } = await supabaseAdmin
        .from('shares')
        .select('*')
        .limit(20000);
      if (error) throw error;

      const idsToDelete: string[] = [];
      const codes = new Set<string>();
      for (const row of data || []) {
        const id = row.id;
        if (!id) continue;
        const code = resolveShareReferrerCode(row as Record<string, unknown>);
        if (!isTestShareReferrerCode(code)) continue;
        idsToDelete.push(String(id));
        codes.add(code);
      }

      const codeList = [...codes].sort();
      if (dryRun || idsToDelete.length === 0) {
        return new Response(
          JSON.stringify({
            success: true,
            data: { deleted: 0, would_delete: idsToDelete.length, codes: codeList },
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }

      const { error: delErr } = await supabaseAdmin.from('shares').delete().in('id', idsToDelete);
      if (delErr) throw delErr;

      return new Response(
        JSON.stringify({
          success: true,
          data: { deleted: idsToDelete.length, codes: codeList },
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
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

    if (action === 'get_visitor_stats') {
      const { data, error } = await supabaseAdmin
        .from('visitor_events')
        .select(
          'event_name, utm_source, utm_campaign, utm_content, utm_medium, ref_code, visitor_id, session_id, country_code, ip_hash, metadata, created_at',
        )
        .order('created_at', { ascending: false })
        .limit(2000);
      if (error) throw error;
      return new Response(JSON.stringify({ success: true, data: data || [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'clear_test_visitor_events') {
      const dryRun = payload?.dry_run === true;
      const pageSize = 1000;
      const allRows: Record<string, unknown>[] = [];
      let start = 0;

      while (true) {
        const { data, error } = await supabaseAdmin
          .from('visitor_events')
          .select('id, event_name, ref_code, ip_hash, metadata, created_at')
          .order('created_at', { ascending: true })
          .range(start, start + pageSize - 1);
        if (error) throw error;
        const batch = data || [];
        allRows.push(...batch);
        if (batch.length < pageSize) break;
        start += pageSize;
      }

      const byIp = groupVisitorEventsByIp(allRows);
      const idsToDelete: string[] = [];
      for (const row of allRows) {
        const id = row.id;
        if (!id) continue;
        const ipKey = getVisitorEventIp(row) || String(row.ip_hash || 'unknown');
        if (!isTestVisitorFunnelEvent(row, byIp.get(ipKey))) continue;
        idsToDelete.push(String(id));
      }

      if (dryRun || idsToDelete.length === 0) {
        return new Response(
          JSON.stringify({
            success: true,
            data: { deleted: 0, would_delete: idsToDelete.length },
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }

      const chunk = 200;
      for (let i = 0; i < idsToDelete.length; i += chunk) {
        const slice = idsToDelete.slice(i, i + chunk);
        const { error: delErr } = await supabaseAdmin.from('visitor_events').delete().in('id', slice);
        if (delErr) throw delErr;
      }

      return new Response(
        JSON.stringify({
          success: true,
          data: { deleted: idsToDelete.length },
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    if (action === 'clear_test_banner_events') {
      const dryRun = payload?.dry_run === true;
      const pageSize = 1000;
      const allRows: Record<string, unknown>[] = [];
      let start = 0;

      while (true) {
        const { data, error } = await supabaseAdmin
          .from('banner_events')
          .select('id, event_type, banner_label, ip, user_agent, additional, created_at')
          .order('created_at', { ascending: true })
          .range(start, start + pageSize - 1);
        if (error) throw error;
        const batch = data || [];
        allRows.push(...batch);
        if (batch.length < pageSize) break;
        start += pageSize;
      }

      const idsToDelete: string[] = [];
      for (const row of allRows) {
        const id = row.id;
        if (!id) continue;
        if (!isTestBannerEvent(row)) continue;
        idsToDelete.push(String(id));
      }

      if (dryRun || idsToDelete.length === 0) {
        return new Response(
          JSON.stringify({
            success: true,
            data: { deleted: 0, would_delete: idsToDelete.length },
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }

      const chunk = 200;
      for (let i = 0; i < idsToDelete.length; i += chunk) {
        const slice = idsToDelete.slice(i, i + chunk);
        const { error: delErr } = await supabaseAdmin.from('banner_events').delete().in('id', slice);
        if (delErr) throw delErr;
      }

      return new Response(
        JSON.stringify({
          success: true,
          data: { deleted: idsToDelete.length },
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    if (action === 'clear_test_admin_stats') {
      const dryRun = payload?.dry_run === true;
      const pageSize = 1000;

      const visitorRows: Record<string, unknown>[] = [];
      let visitorStart = 0;
      while (true) {
        const { data, error } = await supabaseAdmin
          .from('visitor_events')
          .select('id, event_name, ref_code, ip_hash, metadata, created_at')
          .order('created_at', { ascending: true })
          .range(visitorStart, visitorStart + pageSize - 1);
        if (error) throw error;
        const batch = data || [];
        visitorRows.push(...batch);
        if (batch.length < pageSize) break;
        visitorStart += pageSize;
      }

      const bannerRows: Record<string, unknown>[] = [];
      let bannerStart = 0;
      while (true) {
        const { data, error } = await supabaseAdmin
          .from('banner_events')
          .select('id, event_type, banner_label, ip, user_agent, additional, created_at')
          .order('created_at', { ascending: true })
          .range(bannerStart, bannerStart + pageSize - 1);
        if (error) throw error;
        const batch = data || [];
        bannerRows.push(...batch);
        if (batch.length < pageSize) break;
        bannerStart += pageSize;
      }

      const visitorByIp = groupVisitorEventsByIp(visitorRows);
      const visitorIds: string[] = [];
      for (const row of visitorRows) {
        const id = row.id;
        if (!id) continue;
        const ipKey = getVisitorEventIp(row) || String(row.ip_hash || 'unknown');
        if (!isTestVisitorFunnelEvent(row, visitorByIp.get(ipKey))) continue;
        visitorIds.push(String(id));
      }

      const bannerIds: string[] = [];
      for (const row of bannerRows) {
        const id = row.id;
        if (!id) continue;
        if (!isTestBannerEvent(row)) continue;
        bannerIds.push(String(id));
      }

      if (dryRun) {
        return new Response(
          JSON.stringify({
            success: true,
            data: {
              deleted: 0,
              would_delete_visitor: visitorIds.length,
              would_delete_banner: bannerIds.length,
            },
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }

      const chunk = 200;
      if (visitorIds.length > 0) {
        for (let i = 0; i < visitorIds.length; i += chunk) {
          const slice = visitorIds.slice(i, i + chunk);
          const { error: delErr } = await supabaseAdmin.from('visitor_events').delete().in('id', slice);
          if (delErr) throw delErr;
        }
      }
      if (bannerIds.length > 0) {
        for (let i = 0; i < bannerIds.length; i += chunk) {
          const slice = bannerIds.slice(i, i + chunk);
          const { error: delErr } = await supabaseAdmin.from('banner_events').delete().in('id', slice);
          if (delErr) throw delErr;
        }
      }

      return new Response(
        JSON.stringify({
          success: true,
          data: {
            deleted_visitor: visitorIds.length,
            deleted_banner: bannerIds.length,
          },
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    if (action === 'get_interaction_stats') {
      const { data, error } = await supabaseAdmin
        .from('interaction_events')
        .select(
          'event_type, zone_id, path, x, y, viewport_w, viewport_h, scroll_y, scroll_depth_pct, visitor_id, session_id, ref_code, ab_variant, is_referred, metadata, created_at',
        )
        .order('created_at', { ascending: false })
        .limit(3000);
      if (error) throw error;
      return new Response(JSON.stringify({ success: true, data: data || [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'get_optimizer_experiments') {
      const { data, error } = await supabaseAdmin
        .from('optimizer_experiments')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return new Response(JSON.stringify({ success: true, data: data || [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'run_optimizer_autopilot') {
      const { runOptimizerAutopilotCycle } = await import('../_shared/optimizer-autopilot-run.ts');
      const dryRun = payload?.dry_run === true || payload?.dryRun === true;
      const result = await runOptimizerAutopilotCycle(supabaseAdmin, { dryRun });
      return new Response(JSON.stringify({ success: true, data: result }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'upsert_optimizer_experiment') {
      const row = payload?.experiment;
      if (!row || typeof row !== 'object') {
        return new Response(JSON.stringify({ success: false, error: 'experiment payload required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const name = String(row.name || '').trim();
      if (!name) {
        return new Response(JSON.stringify({ success: false, error: 'name required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const upsertRow = {
        id: row.id || undefined,
        name: name.slice(0, 120),
        hypothesis: row.hypothesis ? String(row.hypothesis).slice(0, 500) : null,
        status: String(row.status || 'draft'),
        segment: String(row.segment || 'all').slice(0, 64),
        primary_metric: String(row.primary_metric || 'ShareReferral').slice(0, 64),
        guard_metric: String(row.guard_metric || 'GetReferralLink').slice(0, 64),
        started_at: row.started_at || null,
        ended_at: row.ended_at || null,
        winner: row.winner ? String(row.winner).slice(0, 32) : null,
        notes: row.notes ? String(row.notes).slice(0, 1000) : null,
        updated_at: new Date().toISOString(),
      };
      const { data, error } = await supabaseAdmin
        .from('optimizer_experiments')
        .upsert(upsertRow, { onConflict: 'id' })
        .select('*')
        .single();
      if (error) throw error;
      return new Response(JSON.stringify({ success: true, data }), {
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

    if (action === 'get_funnel_notify_status') {
      return new Response(
        JSON.stringify({
          success: true,
          data: {
            enabled: isFunnelOffsiteNotifyEnabled(),
            importantOnly: isFunnelNotifyImportantOnly(),
            channel: getFunnelNotifyChannel(),
          },
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    if (action === 'post_telegram_marketing') {
      const { postTelegramMarketing, getGrowthPostTelegramChatId, isTelegramMarketingConfigured } =
        await import('../_shared/telegram-marketing.ts');
      if (!isTelegramMarketingConfigured()) {
        return new Response(
          JSON.stringify({ success: false, error: 'Telegram bot token not configured' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }
      const text = String(payload?.text || '').trim();
      if (!text) {
        return new Response(JSON.stringify({ success: false, error: 'text required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const result = await postTelegramMarketing({
        text,
        chatId: payload?.chatId ? String(payload.chatId) : undefined,
        imageBase64: payload?.imageBase64 ? String(payload.imageBase64) : undefined,
        imageMime: payload?.imageMime ? String(payload.imageMime) : undefined,
      });
      return new Response(
        JSON.stringify({
          success: result.ok,
          data: {
            messageId: result.messageId,
            chatId: result.chatId || getGrowthPostTelegramChatId(),
            channelUrl: 'https://t.me/viralrefer',
          },
          error: result.error,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    return new Response(JSON.stringify({ success: false, error: 'Unknown action' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    // Return 200 so Supabase client surfaces error JSON (non-2xx becomes a generic invoke error)
    return new Response(JSON.stringify({ success: false, error: err.message || 'Action failed' }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});