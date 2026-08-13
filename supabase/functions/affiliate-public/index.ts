// Public Edge — promoter signup + safe aggregate stats. No visitor PII.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import { blockedActivityResponse, isBlockedActivityIp } from '../_shared/blocked-ips.ts';
import { getTrustedClientIp } from '../_shared/trusted-ip.ts';
import { isAutomationUserAgent } from '../_shared/test-referral.ts';
import { dispatchPromoterSignupNotify } from '../_shared/funnel-notify.ts';
import { isTestVisitorFunnelEvent } from '../_shared/visitor-funnel-test.ts';
import {
  AFFILIATES_SITE_CONTENT_KEY,
  addAffiliate,
  computeAffiliateRewards,
  computeAffiliateStats,
  countRecentSignupsForIp,
  parseAffiliatesProgram,
  pickWeeklyTopFromLedger,
  normalizeAffiliateCode,
  type AffiliatesProgram,
} from '../_shared/affiliate.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const MAX_SIGNUPS_PER_IP_DAY = 5;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function hashIp(ip: string): Promise<string> {
  if (!ip) return '';
  const salt = Deno.env.get('VISITOR_IP_HASH_SALT') || 'viralrefer-visitor-v1';
  const data = new TextEncoder().encode(`${salt}:aff:${ip}`);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 16);
}

function adminClient() {
  return createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', {
    auth: { persistSession: false },
  });
}

async function loadProgram(supabaseAdmin: ReturnType<typeof adminClient>): Promise<AffiliatesProgram> {
  const { data, error } = await supabaseAdmin
    .from('site_content')
    .select('value')
    .eq('key', AFFILIATES_SITE_CONTENT_KEY)
    .maybeSingle();
  if (error) throw error;
  return parseAffiliatesProgram(data?.value);
}

async function saveProgram(
  supabaseAdmin: ReturnType<typeof adminClient>,
  program: AffiliatesProgram,
): Promise<void> {
  const { error } = await supabaseAdmin.from('site_content').upsert(
    {
      key: AFFILIATES_SITE_CONTENT_KEY,
      value: program,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'key' },
  );
  if (error) throw error;
}

async function loadEventsForCode(
  supabaseAdmin: ReturnType<typeof adminClient>,
  code: string,
): Promise<Record<string, unknown>[]> {
  const { data, error } = await supabaseAdmin
    .from('visitor_events')
    .select('event_name, visitor_id, metadata, created_at')
    .eq('metadata->>aff_code', code)
    .order('created_at', { ascending: false })
    .limit(400);
  if (error) throw error;
  return ((data || []) as Record<string, unknown>[]).filter((row) => !isTestVisitorFunnelEvent(row));
}

async function loadWeeklyLedger(
  supabaseAdmin: ReturnType<typeof adminClient>,
): Promise<Array<{ affiliate_code?: string | null }>> {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabaseAdmin
    .from('ad_board_credit_ledger')
    .select('affiliate_code')
    .gte('created_at', since)
    .limit(400);
  if (error) {
    console.error('[affiliate-public] weekly ledger', error.message || error);
    return [];
  }
  return (data || []) as Array<{ affiliate_code?: string | null }>;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ success: false, error: 'Method not allowed' }, 405);

  try {
    const ip = getTrustedClientIp(req);
    if (isBlockedActivityIp(ip === 'unknown' ? '' : ip)) {
      return blockedActivityResponse(corsHeaders);
    }

    const body = await req.json().catch(() => ({}));
    const action = String(body.action || body.op || '').trim().toLowerCase();
    const supabaseAdmin = adminClient();

    if (action === 'board') {
      const [program, grants] = await Promise.all([
        loadProgram(supabaseAdmin),
        loadWeeklyLedger(supabaseAdmin),
      ]);
      const top = pickWeeklyTopFromLedger(grants, program);
      return json({
        success: true,
        data: {
          top,
          bounty_label: program.bounty_label,
          cash_threshold: program.cash_threshold,
          ad_board_url: program.ad_board_url,
          payout_note: program.payout_note,
        },
      });
    }

    if (action === 'stats') {
      const code = String(body.code || '').trim();
      const wanted = normalizeAffiliateCode(code);
      const [program, events] = await Promise.all([
        loadProgram(supabaseAdmin),
        loadEventsForCode(supabaseAdmin, wanted),
      ]);
      const row = program.affiliates.find((a) => a.code === wanted);
      if (!row || !row.active) {
        return json({ success: false, error: 'Unknown promoter code' }, 404);
      }
      const stats = computeAffiliateStats(events, row.code, row.paid_count);
      const rewards = computeAffiliateRewards(stats, program, row);
      const { data: wallet } = await supabaseAdmin
        .from('ad_board_affiliates')
        .select('credit_days')
        .eq('code', row.code)
        .maybeSingle();
      return json({
        success: true,
        data: {
          code: row.code,
          name: row.name,
          stats,
          rewards,
          credit_days: Number(wallet?.credit_days) || rewards.adCreditGranted || 0,
          bounty_label: program.bounty_label,
          ad_board_url: `${program.ad_board_url.split('#')[0]}?promoter=${encodeURIComponent(row.code)}`,
          payout_note: program.payout_note,
        },
      });
    }

    if (action === 'register') {
      if (isAutomationUserAgent(req.headers.get('user-agent'))) {
        return json({ success: true, skipped: true, error: 'Automation skipped' });
      }
      const name = String(body.name || '').trim().slice(0, 80);
      if (!name) return json({ success: false, error: 'Need a name' }, 400);

      const ipHash = await hashIp(ip === 'unknown' ? '' : ip);
      let lastError = 'Could not save';
      for (let attempt = 0; attempt < 3; attempt++) {
        const program = await loadProgram(supabaseAdmin);
        if (ipHash && countRecentSignupsForIp(program, ipHash) >= MAX_SIGNUPS_PER_IP_DAY) {
          return json({ success: false, error: 'Too many promoter links from this computer today' }, 429);
        }
        const next = addAffiliate(program, { name, source: 'self', created_ip_hash: ipHash || undefined });
        if (next.error || !next.row) {
          return json({ success: false, error: next.error || 'Could not create' }, 400);
        }
        try {
          await saveProgram(supabaseAdmin, next.program);
          const link = `https://www.viralrefer.app/a/${next.row.code}`;
          dispatchPromoterSignupNotify({
            name: next.row.name,
            code: next.row.code,
            link,
          }).catch((notifyErr) => {
            console.error('[affiliate-public] promoter notify:', notifyErr);
          });
          return json({
            success: true,
            data: {
              code: next.row.code,
              name: next.row.name,
              link,
              bounty_label: next.program.bounty_label,
              cash_threshold: next.program.cash_threshold,
              ad_board_url: next.program.ad_board_url,
              payout_note: next.program.payout_note,
            },
          });
        } catch (err) {
          lastError = err instanceof Error ? err.message : 'Could not save';
        }
      }
      return json({ success: false, error: lastError }, 500);
    }

    return json({ success: false, error: 'Unknown action' }, 400);
  } catch (err) {
    console.error('[affiliate-public]', err);
    return json({ success: false, error: 'Logged server-side' }, 200);
  }
});
