/** HTTP handler for record-referral — imported by edge index.ts and unit integration tests. */

import { isSelfReferral, parseRecordReferralRequest } from './record-referral-request.ts';
import { shouldSkipReferralCrediting } from './test-referral.ts';
import { assertReferrerLinkAllowsReferrals } from './referrer-share-deadline.ts';

export const RECORD_REFERRAL_CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

const DEFAULT_RATE_LIMIT_WINDOW_MS = 60_000;
const DEFAULT_RATE_LIMIT_MAX = 2;
const DEFAULT_DEDUPE_WINDOW_MS = 24 * 60 * 60 * 1000;
/** Max referrals any single IP can credit (any referrer) per 24h — slows VPN farms. */
const GLOBAL_IP_DAILY_MAX = 8;
const UNKNOWN_IP_RATE_WINDOW_MS = 5 * 60_000;
const UNKNOWN_IP_RATE_MAX = 1;

export function getClientIp(req: Request): string {
  const cfIp = req.headers.get('cf-connecting-ip');
  if (cfIp) return cfIp.trim();

  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();

  return 'unknown';
}

export type RecordReferralDeps = {
  verifyTurnstile: (token: string, ip: string) => Promise<{ success: boolean; error?: string }>;
  supabaseAdmin: {
    from: (table: string) => Record<string, unknown>;
  };
  rateLimitWindowMs?: number;
  rateLimitMax?: number;
  dedupeWindowMs?: number;
};

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...RECORD_REFERRAL_CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

/** Full record-referral request flow (same path as production index.ts). */
export async function handleRecordReferral(req: Request, deps: RecordReferralDeps): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: RECORD_REFERRAL_CORS_HEADERS });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ success: false, error: 'Method not allowed' }, 405);
  }

  let referrerCode: string;
  let turnstileToken: string | null = null;
  let referredCode: string | null = null;

  try {
    const body = await req.json();
    const parsed = parseRecordReferralRequest(body);
    referrerCode = parsed.referrerCode;
    turnstileToken = parsed.turnstileToken;
    referredCode = parsed.referredCode;
  } catch (parseErr) {
    console.warn('[record-referral] Invalid request body:', parseErr);
    return jsonResponse({ success: false, error: 'Invalid request payload' }, 400);
  }

  if (isSelfReferral(referrerCode, referredCode)) {
    return jsonResponse({ success: false, error: 'Self-referral is not allowed.' }, 403);
  }

  const ip = getClientIp(req);
  const userAgent = req.headers.get('user-agent') || '';

  if (shouldSkipReferralCrediting({ referrerCode, referredIp: ip, userAgent })) {
    return jsonResponse(
      {
        success: true,
        skipped: true,
        message: 'Test or owner traffic is not credited',
      },
      200,
    );
  }

  // 24h verified-share deadline — expired codes cannot earn new referrals
  try {
    const gate = await assertReferrerLinkAllowsReferrals(deps.supabaseAdmin as never, referrerCode);
    if (!gate.allowed) {
      return jsonResponse(
        {
          success: false,
          error: gate.reason || 'This referral link is no longer active.',
          code_status: gate.status,
        },
        410,
      );
    }
  } catch (gateErr) {
    console.warn('[record-referral] share-deadline gate skipped:', gateErr);
  }

  const rateLimitWindowMs = deps.rateLimitWindowMs ?? DEFAULT_RATE_LIMIT_WINDOW_MS;
  const rateLimitMax = deps.rateLimitMax ?? DEFAULT_RATE_LIMIT_MAX;
  const dedupeWindowMs = deps.dedupeWindowMs ?? DEFAULT_DEDUPE_WINDOW_MS;

  const shouldVerifyTurnstile = Boolean(
    turnstileToken && turnstileToken !== 'dev-bypass-token',
  );

  if (shouldVerifyTurnstile) {
    const turnstileResult = await deps.verifyTurnstile(turnstileToken!, ip);
    if (!turnstileResult.success) {
      // Never block real referrals when Turnstile is misconfigured or tokens fail.
      console.warn('[record-referral] Turnstile failed — continuing with server limits:', turnstileResult.error);
    }
  }

  const supabaseAdmin = deps.supabaseAdmin;

  const rateWindowMs = ip === 'unknown' ? UNKNOWN_IP_RATE_WINDOW_MS : rateLimitWindowMs;
  const rateMax = ip === 'unknown' ? UNKNOWN_IP_RATE_MAX : rateLimitMax;

  try {
    const windowStart = new Date(Date.now() - rateWindowMs).toISOString();
    const rateQuery = supabaseAdmin.from('referrals') as {
      select: (
        cols: string,
        opts: { count: string; head: boolean },
      ) => {
        eq: (col: string, val: string) => {
          gte: (col: string, val: string) => Promise<{ count: number | null; error: unknown }>;
        };
      };
    };
    const { count, error: rateError } = await rateQuery
      .select('*', { count: 'exact', head: true })
      .eq('referred_ip', ip)
      .gte('created_at', windowStart);

    if (rateError) {
      // Fail closed: do not credit when rate-limit DB is degraded
      console.error('[record-referral] Rate limit query error:', rateError);
      return jsonResponse(
        { success: false, error: 'Temporarily unavailable. Please try again.' },
        503,
      );
    } else if ((count ?? 0) >= rateMax) {
      return jsonResponse(
        { success: false, error: 'Rate limit exceeded. Please wait before trying again.' },
        429,
      );
    }
  } catch (rateErr) {
    console.error('[record-referral] Rate limiting exception:', rateErr);
    return jsonResponse(
      { success: false, error: 'Temporarily unavailable. Please try again.' },
      503,
    );
  }

  if (ip !== 'unknown') {
    try {
      const dayStart = new Date(Date.now() - DEFAULT_DEDUPE_WINDOW_MS).toISOString();
      const dailyQuery = supabaseAdmin.from('referrals') as {
        select: (
          cols: string,
          opts: { count: string; head: boolean },
        ) => {
          eq: (col: string, val: string) => {
            gte: (col: string, val: string) => Promise<{ count: number | null; error: unknown }>;
          };
        };
      };
      const { count: dailyCount, error: dailyError } = await dailyQuery
        .select('*', { count: 'exact', head: true })
        .eq('referred_ip', ip)
        .gte('created_at', dayStart);

      if (dailyError) {
        console.error('[record-referral] Daily IP cap query error:', dailyError);
        return jsonResponse(
          { success: false, error: 'Temporarily unavailable. Please try again.' },
          503,
        );
      } else if ((dailyCount ?? 0) >= GLOBAL_IP_DAILY_MAX) {
        return jsonResponse(
          { success: false, error: 'Daily referral limit reached for this network. Try again tomorrow.' },
          429,
        );
      }
    } catch (dailyErr) {
      console.error('[record-referral] Daily IP cap exception:', dailyErr);
      return jsonResponse(
        { success: false, error: 'Temporarily unavailable. Please try again.' },
        503,
      );
    }
  }

  if (ip !== 'unknown') {
    const dedupeStart = new Date(Date.now() - dedupeWindowMs).toISOString();
    const dedupeQuery = supabaseAdmin.from('referrals') as {
      select: (cols: string) => {
        eq: (col: string, val: string) => {
          eq: (col: string, val: string) => {
            gte: (col: string, val: string) => {
              order: (col: string, opts: { ascending: boolean }) => {
                limit: (n: number) => {
                  maybeSingle: () => Promise<{
                    data: { id: string; created_at: string } | null;
                    error: unknown;
                  }>;
                };
              };
            };
          };
        };
      };
    };
    const { data: existing, error: dedupeError } = await dedupeQuery
      .select('id, created_at')
      .eq('referrer_code', referrerCode)
      .eq('referred_ip', ip)
      .gte('created_at', dedupeStart)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (dedupeError) {
      console.error('[record-referral] Dedupe query error:', dedupeError);
    } else if (existing) {
      return jsonResponse(
        {
          success: true,
          message: 'Referral already recorded',
          duplicate: true,
          referralId: existing.id,
          recordedAt: existing.created_at,
        },
        200,
      );
    }
  }

  const insertPayload = {
    referrer_code: referrerCode,
    referred_ip: ip === 'unknown' ? null : ip,
    user_agent: userAgent || null,
  };

  const insertQuery = supabaseAdmin.from('referrals') as {
    insert: (payload: unknown) => {
      select: (cols: string) => {
        single: () => Promise<{
          data: { id: string; created_at: string } | null;
          error: { code?: string } | null;
        }>;
      };
    };
  };

  const { data: inserted, error: insertError } = await insertQuery
    .insert(insertPayload)
    .select('id, created_at')
    .single();

  if (insertError) {
    if (insertError.code === '23505') {
      return jsonResponse(
        { success: true, message: 'Referral already recorded', duplicate: true },
        200,
      );
    }

    console.error('[record-referral] Insert failed:', insertError);
    return jsonResponse({ success: false, error: 'Failed to record referral' }, 500);
  }

  return jsonResponse(
    {
      success: true,
      referralId: inserted!.id,
      recordedAt: inserted!.created_at,
    },
    200,
  );
}