// ============================================================================
// supabase/functions/relay/index.ts
// ViralRefer Relay — state bootstrap, view credit, enqueue Hot Seat.
// Service-role only writes. Actions: state | view | enqueue | session
// ============================================================================

import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import { blockedActivityResponse, isBlockedActivityIp } from '../_shared/blocked-ips.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const BLOCKED_HOST_FRAGMENTS = [
  'localhost',
  '127.0.0.1',
  '0.0.0.0',
  '::1',
  'example.com',
  'example.org',
  'example.net',
];

type RelayConfig = {
  id: number;
  enabled: boolean;
  min_dwell_seconds: number;
  views_per_seat: number;
  house_url: string;
  house_label: string;
  banner_url: string;
  enqueue_cooldown_seconds: number;
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function getClientIp(req: Request): string {
  const cfIp = req.headers.get('cf-connecting-ip');
  if (cfIp) return cfIp.trim();
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return '';
}

async function hashIp(ip: string): Promise<string | null> {
  if (!ip) return null;
  const salt = Deno.env.get('VISITOR_IP_HASH_SALT') || 'viralrefer-relay-v1';
  const data = new TextEncoder().encode(`${salt}:${ip}`);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 24);
}

function normalizeClientKey(raw: unknown): string | null {
  const s = String(raw || '').trim();
  if (!/^[a-zA-Z0-9_-]{16,80}$/.test(s)) return null;
  return s.slice(0, 80);
}

function normalizeUrl(raw: unknown): { ok: true; url: string; domain: string } | { ok: false; error: string } {
  const input = String(raw || '').trim();
  if (!input || input.length > 2048) return { ok: false, error: 'Invalid URL length' };

  let parsed: URL;
  try {
    parsed = new URL(input.includes('://') ? input : `https://${input}`);
  } catch {
    return { ok: false, error: 'Invalid URL' };
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { ok: false, error: 'Only http(s) URLs allowed' };
  }

  const host = parsed.hostname.toLowerCase().replace(/\.$/, '');
  if (!host || host.length < 3) return { ok: false, error: 'Invalid host' };
  if (BLOCKED_HOST_FRAGMENTS.some((b) => host === b || host.endsWith(`.${b}`))) {
    return { ok: false, error: 'That host is not allowed' };
  }
  // Keep viralrefer.app allowed so people can promote their /r/ links if they want
  if (host.includes(' ') || /[^a-z0-9.-]/i.test(host)) {
    return { ok: false, error: 'Invalid host characters' };
  }

  parsed.hash = '';
  // Strip common tracking spam from submitted sites later if needed; keep as-is for MVP
  return { ok: true, url: parsed.toString(), domain: host.replace(/^www\./, '') };
}

async function loadConfig(admin: SupabaseClient): Promise<RelayConfig | null> {
  const { data, error } = await admin.from('relay_config').select('*').eq('id', 1).maybeSingle();
  if (error || !data) return null;
  return data as RelayConfig;
}

async function upsertSession(
  admin: SupabaseClient,
  clientKey: string,
  ipHash: string | null,
  userAgent: string | null,
): Promise<{ id: string; credits: number } | null> {
  const now = new Date().toISOString();
  const { data: existing } = await admin
    .from('relay_sessions')
    .select('id, credits')
    .eq('client_key', clientKey)
    .maybeSingle();

  if (existing?.id) {
    await admin
      .from('relay_sessions')
      .update({ last_seen_at: now, ip_hash: ipHash, user_agent: userAgent?.slice(0, 400) || null })
      .eq('id', existing.id);
    return { id: existing.id, credits: existing.credits ?? 0 };
  }

  const { data: created, error } = await admin
    .from('relay_sessions')
    .insert({
      client_key: clientKey,
      credits: 0,
      ip_hash: ipHash,
      user_agent: userAgent?.slice(0, 400) || null,
      last_seen_at: now,
    })
    .select('id, credits')
    .single();

  if (error || !created) return null;
  return { id: created.id, credits: created.credits ?? 0 };
}

async function publicState(admin: SupabaseClient) {
  const { data, error } = await admin.rpc('get_relay_public_state');
  if (error) throw error;
  return data;
}

async function promoteNext(
  admin: SupabaseClient,
  viewsPerSeat: number,
): Promise<void> {
  const { data: next } = await admin
    .from('relay_links')
    .select('id')
    .eq('status', 'queued')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!next?.id) return;

  await admin
    .from('relay_links')
    .update({
      status: 'live',
      live_at: new Date().toISOString(),
      views_remaining: viewsPerSeat,
    })
    .eq('id', next.id)
    .eq('status', 'queued');
}

async function completeLiveAndPromote(
  admin: SupabaseClient,
  liveId: string,
  viewsPerSeat: number,
): Promise<void> {
  await admin
    .from('relay_links')
    .update({
      status: 'completed',
      completed_at: new Date().toISOString(),
      views_remaining: 0,
    })
    .eq('id', liveId)
    .eq('status', 'live');

  await promoteNext(admin, viewsPerSeat);
}

async function countRecentViews(admin: SupabaseClient, sessionId: string, minutes: number): Promise<number> {
  const since = new Date(Date.now() - minutes * 60_000).toISOString();
  const { count } = await admin
    .from('relay_views')
    .select('id', { count: 'exact', head: true })
    .eq('session_id', sessionId)
    .gte('created_at', since);
  return count ?? 0;
}

async function countRecentEnqueues(admin: SupabaseClient, sessionId: string, minutes: number): Promise<number> {
  const since = new Date(Date.now() - minutes * 60_000).toISOString();
  const { count } = await admin
    .from('relay_links')
    .select('id', { count: 'exact', head: true })
    .eq('submitter_session_id', sessionId)
    .gte('created_at', since);
  return count ?? 0;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return json({ success: false, error: 'Method not allowed' }, 405);
  }

  try {
    const admin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } },
    );

    const body = await req.json().catch(() => ({}));
    const action = String(body.action || 'state').toLowerCase().trim();
    const ip = getClientIp(req);
    if (isBlockedActivityIp(ip)) {
      return blockedActivityResponse(corsHeaders);
    }
    const ipHash = await hashIp(ip);
    const userAgent = req.headers.get('user-agent');

    if (action === 'state') {
      const clientKey = normalizeClientKey(body.client_key || body.clientKey);
      let session: { id: string; credits: number } | null = null;
      if (clientKey) {
        session = await upsertSession(admin, clientKey, ipHash, userAgent);
      }
      const state = await publicState(admin);
      return json({
        success: true,
        state,
        session: session
          ? { client_key: clientKey, credits: session.credits, id: session.id }
          : null,
      });
    }

    if (action === 'session') {
      const clientKey = normalizeClientKey(body.client_key || body.clientKey);
      if (!clientKey) return json({ success: false, error: 'client_key required' }, 400);
      const session = await upsertSession(admin, clientKey, ipHash, userAgent);
      if (!session) return json({ success: false, error: 'session_failed' }, 500);
      return json({ success: true, session: { client_key: clientKey, credits: session.credits, id: session.id } });
    }

    const cfg = await loadConfig(admin);
    if (!cfg || !cfg.enabled) {
      return json({ success: false, error: 'Relay is temporarily disabled' }, 503);
    }

    const clientKey = normalizeClientKey(body.client_key || body.clientKey);
    if (!clientKey) return json({ success: false, error: 'client_key required' }, 400);
    const session = await upsertSession(admin, clientKey, ipHash, userAgent);
    if (!session) return json({ success: false, error: 'session_failed' }, 500);

    if (action === 'view') {
      const dwellMs = Math.max(0, Math.floor(Number(body.dwell_ms ?? body.dwellMs ?? 0)));
      const focused = Boolean(body.focused ?? true);
      const minMs = cfg.min_dwell_seconds * 1000;
      if (dwellMs < minMs) {
        return json({
          success: false,
          error: `View at least ${cfg.min_dwell_seconds} seconds`,
          min_dwell_seconds: cfg.min_dwell_seconds,
        }, 400);
      }

      const recentViews = await countRecentViews(admin, session.id, 60);
      if (recentViews >= 30) {
        return json({ success: false, error: 'Rate limit — try again later' }, 429);
      }

      const liveState = await publicState(admin) as {
        live?: { id?: string | null; is_house?: boolean; url?: string } | null;
      };
      const live = liveState?.live;
      const isHouse = Boolean(live?.is_house) || !live?.id;
      const targetLinkId = isHouse ? null : (live?.id || null);

      // Anti double-credit: one credit per session per target within 2 minutes
      const since = new Date(Date.now() - 2 * 60_000).toISOString();
      let dupQuery = admin
        .from('relay_views')
        .select('id')
        .eq('session_id', session.id)
        .eq('credited', true)
        .gte('created_at', since)
        .limit(1);
      if (isHouse) {
        dupQuery = dupQuery.eq('is_house', true);
      } else if (targetLinkId) {
        dupQuery = dupQuery.eq('target_link_id', targetLinkId);
      }
      const { data: dup } = await dupQuery.maybeSingle();
      if (dup?.id) {
        return json({
          success: true,
          credited: false,
          duplicate: true,
          credits: session.credits,
          message: 'Already credited for this seat recently',
          state: await publicState(admin),
        });
      }

      const { error: viewErr } = await admin.from('relay_views').insert({
        session_id: session.id,
        target_link_id: targetLinkId,
        is_house: isHouse,
        dwell_ms: dwellMs,
        focused,
        credited: true,
        ip_hash: ipHash,
      });
      if (viewErr) {
        return json({ success: false, error: 'view_insert_failed' }, 500);
      }

      const newCredits = session.credits + 1;
      await admin.from('relay_sessions').update({ credits: newCredits, last_seen_at: new Date().toISOString() }).eq('id', session.id);

      if (!isHouse && targetLinkId) {
        const { data: liveRow } = await admin
          .from('relay_links')
          .select('id, views_remaining, views_delivered')
          .eq('id', targetLinkId)
          .eq('status', 'live')
          .maybeSingle();

        if (liveRow?.id) {
          const remaining = Math.max(0, (liveRow.views_remaining ?? 1) - 1);
          const delivered = (liveRow.views_delivered ?? 0) + 1;
          await admin
            .from('relay_links')
            .update({ views_remaining: remaining, views_delivered: delivered })
            .eq('id', liveRow.id);

          if (remaining <= 0) {
            await completeLiveAndPromote(admin, liveRow.id, cfg.views_per_seat);
          }
        }
      }

      return json({
        success: true,
        credited: true,
        credits: newCredits,
        state: await publicState(admin),
        message: 'View credited — you earned 1 Relay credit',
      });
    }

    if (action === 'enqueue') {
      const parsed = normalizeUrl(body.url);
      if (!parsed.ok) return json({ success: false, error: parsed.error }, 400);

      if (session.credits < 1) {
        return json({
          success: false,
          error: 'You need 1 credit — view the LIVE site first',
          credits: session.credits,
        }, 400);
      }

      const recentEnq = await countRecentEnqueues(admin, session.id, 60);
      if (recentEnq >= 10) {
        return json({ success: false, error: 'Rate limit — try again later' }, 429);
      }

      // Cooldown same domain
      const cooldownSec = cfg.enqueue_cooldown_seconds ?? 120;
      if (cooldownSec > 0) {
        const since = new Date(Date.now() - cooldownSec * 1000).toISOString();
        const { data: recentDomain } = await admin
          .from('relay_links')
          .select('id')
          .eq('domain', parsed.domain)
          .gte('created_at', since)
          .limit(1)
          .maybeSingle();
        if (recentDomain?.id) {
          return json({
            success: false,
            error: `That domain was just submitted — wait ${cooldownSec}s`,
          }, 429);
        }
      }

      // Deduct credit first
      const newCredits = session.credits - 1;
      const { error: creditErr } = await admin
        .from('relay_sessions')
        .update({ credits: newCredits, last_seen_at: new Date().toISOString() })
        .eq('id', session.id)
        .eq('credits', session.credits);
      if (creditErr) {
        return json({ success: false, error: 'credit_update_failed' }, 500);
      }

      const { data: liveNow } = await admin
        .from('relay_links')
        .select('id')
        .eq('status', 'live')
        .maybeSingle();

      const goLive = !liveNow?.id;
      const insertRow = {
        url: parsed.url,
        domain: parsed.domain,
        submitter_session_id: session.id,
        status: goLive ? 'live' : 'queued',
        views_remaining: goLive ? cfg.views_per_seat : 0,
        views_delivered: 0,
        live_at: goLive ? new Date().toISOString() : null,
      };

      const { data: link, error: linkErr } = await admin
        .from('relay_links')
        .insert(insertRow)
        .select('id, status, domain, url, views_remaining')
        .single();

      if (linkErr || !link) {
        // Refund credit on failure
        await admin.from('relay_sessions').update({ credits: session.credits }).eq('id', session.id);
        return json({ success: false, error: 'enqueue_failed' }, 500);
      }

      const state = await publicState(admin);
      return json({
        success: true,
        credits: newCredits,
        link,
        went_live: goLive,
        state,
        house_cta: {
          get_link_url: 'https://www.viralrefer.app/?utm_source=relay&utm_medium=post_enqueue&utm_campaign=get_link#get-link',
          banner_url: cfg.banner_url,
          share_hint:
            'I’m on ViralRefer Relay — a free reciprocal traffic exchange. You view the LIVE site, earn a credit, then queue yours so the next visitors see your site: https://www.viralrefer.app/relay',
        },
        message: goLive
          ? 'You’re LIVE in the exchange — next visitors will open your site'
          : 'You’re in the reciprocal queue — share Relay so more people view LIVE',
      });
    }

    return json({ success: false, error: 'Unknown action' }, 400);
  } catch (err) {
    console.error('relay error', err);
    return json({ success: false, error: 'Internal error' }, 500);
  }
});
