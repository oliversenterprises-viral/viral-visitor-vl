/** 24h verified-share activation for referrer codes. */

import { isOwnerReferralIp } from './test-referral.ts';

export const SHARE_DEADLINE_MS = 24 * 60 * 60 * 1000;

/** Platforms that do NOT count as a verified share attempt. */
const NON_VERIFIED = new Set([
  'copy',
  'copy-message',
  'embed',
  'other',
  '',
]);

export type ReferrerLinkStatus = 'pending_share' | 'active' | 'expired';

export function normalizeSharePlatform(raw: string): string {
  const p = String(raw || 'other').toLowerCase().trim();
  if (p === 'x') return 'twitter';
  return p || 'other';
}

/** WhatsApp, X, SMS, Reddit, native share sheet, etc. — not clipboard-only. */
export function isVerifiedSharePlatform(raw: string): boolean {
  const p = normalizeSharePlatform(raw);
  return !NON_VERIFIED.has(p);
}

export function deadlineIsoFromCreated(createdAt: string | Date): string {
  const t = typeof createdAt === 'string' ? Date.parse(createdAt) : createdAt.getTime();
  return new Date(t + SHARE_DEADLINE_MS).toISOString();
}

export function isPastShareDeadline(createdAt: string | Date, now = Date.now()): boolean {
  const t = typeof createdAt === 'string' ? Date.parse(createdAt) : createdAt.getTime();
  if (!Number.isFinite(t)) return false;
  return now - t >= SHARE_DEADLINE_MS;
}

type Supa = {
  from: (table: string) => any;
};

/** Mark pending rows older than 24h as expired. Best-effort. */
export async function expireStalePendingLinks(supabase: Supa, now = Date.now()): Promise<number> {
  const cutoff = new Date(now - SHARE_DEADLINE_MS).toISOString();
  try {
    const { data, error } = await supabase
      .from('referrer_links')
      .update({ status: 'expired', expired_at: new Date(now).toISOString() })
      .eq('status', 'pending_share')
      .lt('created_at', cutoff)
      .select('referrer_code');
    if (error) {
      // Table may not exist yet — never break callers
      console.warn('[referrer-share-deadline] expire failed:', error.message);
      return 0;
    }
    return Array.isArray(data) ? data.length : 0;
  } catch (err) {
    console.warn('[referrer-share-deadline] expire exception:', err);
    return 0;
  }
}

/**
 * Ensure a pending registration exists for a new link.
 * Does not revive expired codes (caller should mint a new code).
 * Owner IPs (ADMIN_FUNNEL_EXCLUDED_IPS) are fully exempt — no pending clock.
 */
export async function registerReferrerLink(
  supabase: Supa,
  referrerCode: string,
  opts?: { clientIp?: string | null },
): Promise<{
  ok: boolean;
  status: ReferrerLinkStatus | 'unknown';
  created_at?: string;
  deadline_at?: string;
  exempt?: boolean;
  error?: string;
}> {
  const code = String(referrerCode || '').trim().toUpperCase();
  if (!code) return { ok: false, status: 'unknown', error: 'Missing code' };

  // Owner / admin egress IPs never enter the 24h share deadline system
  if (isOwnerReferralIp(opts?.clientIp)) {
    const now = new Date().toISOString();
    try {
      await supabase.from('referrer_links').upsert(
        {
          referrer_code: code,
          created_at: now,
          first_verified_share_at: now,
          first_share_platform: 'owner_ip_exempt',
          status: 'active',
          expired_at: null,
        },
        { onConflict: 'referrer_code' },
      );
    } catch (err) {
      console.warn('[referrer-share-deadline] owner exempt upsert failed:', err);
    }
    return {
      ok: true,
      status: 'active',
      created_at: now,
      deadline_at: undefined,
      exempt: true,
    };
  }

  await expireStalePendingLinks(supabase);

  try {
    const { data: existing, error: selErr } = await supabase
      .from('referrer_links')
      .select('referrer_code, created_at, status, first_verified_share_at')
      .eq('referrer_code', code)
      .maybeSingle();

    if (selErr) {
      console.warn('[referrer-share-deadline] select failed:', selErr.message);
      return { ok: true, status: 'unknown', error: selErr.message };
    }

    if (existing) {
      const status = existing.status as ReferrerLinkStatus;
      if (status === 'pending_share' && isPastShareDeadline(existing.created_at)) {
        await supabase
          .from('referrer_links')
          .update({ status: 'expired', expired_at: new Date().toISOString() })
          .eq('referrer_code', code);
        return {
          ok: false,
          status: 'expired',
          created_at: existing.created_at,
          deadline_at: deadlineIsoFromCreated(existing.created_at),
          error: 'Share deadline passed — generate a new link',
        };
      }
      return {
        ok: status !== 'expired',
        status,
        created_at: existing.created_at,
        deadline_at: deadlineIsoFromCreated(existing.created_at),
        error: status === 'expired' ? 'Link expired — generate a new link' : undefined,
      };
    }

    const created_at = new Date().toISOString();
    const { error: insErr } = await supabase.from('referrer_links').insert({
      referrer_code: code,
      created_at,
      status: 'pending_share',
    });

    if (insErr) {
      // Race: another request inserted — re-read
      if (String(insErr.code) === '23505' || /duplicate|unique/i.test(insErr.message || '')) {
        return registerReferrerLink(supabase, code);
      }
      console.warn('[referrer-share-deadline] insert failed:', insErr.message);
      return { ok: true, status: 'unknown', error: insErr.message };
    }

    return {
      ok: true,
      status: 'pending_share',
      created_at,
      deadline_at: deadlineIsoFromCreated(created_at),
    };
  } catch (err) {
    console.warn('[referrer-share-deadline] register exception:', err);
    return { ok: true, status: 'unknown' };
  }
}

/** Mark code active after a verified share platform event. */
export async function markReferrerLinkShared(
  supabase: Supa,
  referrerCode: string,
  platform: string,
): Promise<void> {
  if (!isVerifiedSharePlatform(platform)) return;
  const code = String(referrerCode || '').trim().toUpperCase();
  if (!code) return;

  const now = new Date().toISOString();
  try {
    const { data: existing } = await supabase
      .from('referrer_links')
      .select('status, first_verified_share_at')
      .eq('referrer_code', code)
      .maybeSingle();

    if (!existing) {
      // Share without prior register — activate immediately
      await supabase.from('referrer_links').upsert(
        {
          referrer_code: code,
          created_at: now,
          first_verified_share_at: now,
          first_share_platform: normalizeSharePlatform(platform),
          status: 'active',
        },
        { onConflict: 'referrer_code' },
      );
      return;
    }

    if (existing.status === 'expired') return;

    if (existing.status === 'active' && existing.first_verified_share_at) return;

    await supabase
      .from('referrer_links')
      .update({
        status: 'active',
        first_verified_share_at: existing.first_verified_share_at || now,
        first_share_platform: normalizeSharePlatform(platform),
        expired_at: null,
      })
      .eq('referrer_code', code);
  } catch (err) {
    console.warn('[referrer-share-deadline] mark shared failed:', err);
  }
}

/**
 * Whether this code may still earn referrals.
 * No row → grandfather (pre-feature codes keep working).
 * Fail-open on DB errors so production never bricks referrals.
 */
export async function assertReferrerLinkAllowsReferrals(
  supabase: Supa,
  referrerCode: string,
): Promise<{ allowed: boolean; reason?: string; status?: string }> {
  const code = String(referrerCode || '').trim().toUpperCase();
  if (!code) return { allowed: false, reason: 'Invalid referrer code' };

  try {
    await expireStalePendingLinks(supabase);

    const { data, error } = await supabase
      .from('referrer_links')
      .select('status, created_at')
      .eq('referrer_code', code)
      .maybeSingle();

    if (error) {
      console.warn('[referrer-share-deadline] assert select failed:', error.message);
      return { allowed: true, status: 'unknown' };
    }

    if (!data) {
      // Pre-feature or unregistered codes continue to work
      return { allowed: true, status: 'grandfathered' };
    }

    if (data.status === 'active') return { allowed: true, status: 'active' };

    if (data.status === 'expired') {
      return {
        allowed: false,
        status: 'expired',
        reason: 'This referral link expired — the owner did not share within 24 hours.',
      };
    }

    if (data.status === 'pending_share') {
      if (isPastShareDeadline(data.created_at)) {
        await supabase
          .from('referrer_links')
          .update({ status: 'expired', expired_at: new Date().toISOString() })
          .eq('referrer_code', code);
        return {
          allowed: false,
          status: 'expired',
          reason: 'This referral link expired — the owner did not share within 24 hours.',
        };
      }
      // Still inside 24h window — allow credits so early shares can convert
      return { allowed: true, status: 'pending_share' };
    }

    return { allowed: true, status: data.status };
  } catch (err) {
    console.warn('[referrer-share-deadline] assert exception:', err);
    return { allowed: true, status: 'unknown' };
  }
}
