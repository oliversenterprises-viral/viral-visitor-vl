// Public Edge — promote a qualifying Site Drop (Just entered / Rising / Challenger).
// Turnstile required. Stale pending is expired first so it cannot block new drops.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import { blockedActivityResponse, isBlockedActivityIp } from '../_shared/blocked-ips.ts';
import { getTrustedClientIp } from '../_shared/trusted-ip.ts';
import { isAutomationUserAgent, isTestReferrerCode } from '../_shared/test-referral.ts';
import {
  applySiteDropClimb,
  expireSiteDrops,
  normalizeWebsiteUrl,
  type SiteDropKind,
} from '../_shared/site-drops.ts';
import { loadSiteDropsState, saveSiteDropsState } from '../_shared/site-drops-store.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function verifyTurnstile(token: string, ip: string): Promise<{ success: boolean; error?: string }> {
  const secret = Deno.env.get('TURNSTILE_SECRET_KEY');
  if (!secret) return { success: false, error: 'Server misconfiguration' };

  const formData = new FormData();
  formData.append('secret', secret);
  formData.append('response', token);
  if (ip !== 'unknown') formData.append('remoteip', ip);

  const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    body: formData,
  });
  const outcome = await res.json();
  return { success: !!outcome.success, error: outcome.success ? undefined : (outcome['error-codes'] || 'failed') };
}

function allowDevTurnstileBypass(): boolean {
  return Deno.env.get('ALLOW_TURNSTILE_DEV_BYPASS') === 'true';
}

function parseKind(raw: unknown): SiteDropKind | null {
  const kind = String(raw || '').trim().toLowerCase();
  if (kind === 'entered' || kind === 'rising' || kind === 'challenger') return kind;
  return null;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ success: false, error: 'Method not allowed' }, 405);
  }

  if (isAutomationUserAgent(req.headers.get('user-agent'))) {
    return jsonResponse({ success: true, skipped: true, error: 'Automation skipped' });
  }

  let payload: Record<string, unknown>;
  try {
    payload = await req.json();
  } catch {
    return jsonResponse({ success: false, error: 'Invalid JSON' }, 400);
  }

  const kind = parseKind(payload.kind);
  const referrerCode = String(payload.referrerCode || payload.referrer_code || '')
    .trim()
    .toUpperCase();
  const website = normalizeWebsiteUrl(payload.website || payload.url);
  const label = String(payload.label || '').trim();
  const turnstileToken = String(payload.turnstileToken || payload.token || '').trim();
  const rank = Math.floor(Number(payload.rank) || 0);

  if (!kind) {
    return jsonResponse({ success: false, error: 'Invalid drop kind' }, 400);
  }
  if (!referrerCode || !/^VIRAL-[A-Z0-9_-]+$/.test(referrerCode)) {
    return jsonResponse({ success: false, error: 'Invalid referrer code' }, 400);
  }
  if (isTestReferrerCode(referrerCode)) {
    return jsonResponse({ success: true, skipped: true, error: 'Test code skipped' });
  }
  if (!website) {
    return jsonResponse({ success: false, error: 'Paste your website.' }, 400);
  }

  const ip = getTrustedClientIp(req);
  if (isBlockedActivityIp(ip)) {
    return blockedActivityResponse(corsHeaders);
  }

  const allowDevBypass = turnstileToken === 'dev-bypass-token' && allowDevTurnstileBypass();
  if (!allowDevBypass) {
    if (!turnstileToken) {
      return jsonResponse({ success: false, error: 'Could not verify you are human' }, 403);
    }
    const turnstileOk = await verifyTurnstile(turnstileToken, ip);
    if (!turnstileOk.success) {
      return jsonResponse({ success: false, error: 'Could not verify you are human' }, 403);
    }
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } },
    );

    const now = new Date();
    const current = expireSiteDrops(await loadSiteDropsState(supabaseAdmin), now);

    const { count, error: countErr } = await supabaseAdmin
      .from('referrals')
      .select('*', { count: 'exact', head: true })
      .eq('referrer_code', referrerCode);
    if (countErr) {
      return jsonResponse({ success: false, error: 'Temporarily unavailable. Please try again.' }, 503);
    }
    const verifiedLocks = count ?? 0;

    if (kind === 'rising' && verifiedLocks < 1) {
      return jsonResponse(
        { success: false, error: 'Need 1 verified friend who tapped Get my link.' },
        403,
      );
    }

    let boardRank = rank;
    if (!boardRank) {
      try {
        const { data: board } = await supabaseAdmin.rpc('get_leaderboard', { min_referrals: 1 });
        if (Array.isArray(board)) {
          const row = board.find(
            (entry: { referrer_code?: string; rank?: number }) =>
              String(entry?.referrer_code || '').toUpperCase() === referrerCode,
          ) as { rank?: number } | undefined;
          boardRank = Math.floor(Number(row?.rank) || 0);
        }
      } catch {
        boardRank = 0;
      }
    }

    const next = applySiteDropClimb(
      current,
      {
        code: referrerCode,
        url: website,
        label,
        locks: verifiedLocks,
        rank: boardRank || null,
      },
      now,
    );

    await saveSiteDropsState(supabaseAdmin, next);

    const mine = next.drops.filter((drop) => drop.code === referrerCode);
    const rung = mine.some((drop) => drop.kind === 'challenger')
      ? 'challenger'
      : mine.some((drop) => drop.kind === 'rising')
        ? 'rising'
        : 'entered';

    return jsonResponse({
      success: true,
      data: {
        state: next,
        kind: rung,
        code: referrerCode,
      },
    });
  } catch (err) {
    console.error('[submit-site-drop]', err);
    return jsonResponse({ success: false, error: 'Could not save Site Drop' }, 500);
  }
});
