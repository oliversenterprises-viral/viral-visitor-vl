/**
 * Referrer link lifecycle:
 * - pending_share until first *real referral credit* (not self-confirm, not share sheet)
 * - optional grace extensions when they open a real share path (record-share)
 * - expired if deadline_at passes with zero activations
 */

import { isOwnerReferralIp } from './test-referral.ts';

/** Base window to land first referral (slow friends get time). */
export const SHARE_DEADLINE_MS = 48 * 60 * 60 * 1000;
/** Each real share attempt may extend once (up to MAX_GRACE_EXTENSIONS). */
export const SHARE_GRACE_MS = 12 * 60 * 60 * 1000;
export const MAX_GRACE_EXTENSIONS = 2;

/**
 * Platforms that never count as share *activity* for grace (clipboard / downloads).
 * Keep in sync with client `src/lib/share-deadline.ts`.
 */
const NON_VERIFIED = new Set([
  'copy',
  'copy-message',
  'copy-code',
  'embed',
  'markdown',
  'other',
  '',
  'discord',
  'tiktok',
  'snapchat',
  'story-image',
  'x-image',
  'share-pack',
  'winner-pack',
]);

/** Special activation platform when first referral lands. */
export const LOCK_PLATFORM_FIRST_REFERRAL = 'first_referral';

export type ReferrerLinkStatus = 'pending_share' | 'active' | 'expired';

export function normalizeSharePlatform(raw: string): string {
  const p = String(raw || 'other').toLowerCase().trim();
  if (p === 'x') return 'twitter';
  return p || 'other';
}

/** Real share path (intent/native) — may earn grace, never alone locks. */
export function isVerifiedSharePlatform(raw: string): boolean {
  const p = normalizeSharePlatform(raw);
  if (p === LOCK_PLATFORM_FIRST_REFERRAL) return true;
  return !NON_VERIFIED.has(p);
}

export function deadlineIsoFromCreated(createdAt: string | Date, extraMs = 0): string {
  const t = typeof createdAt === 'string' ? Date.parse(createdAt) : createdAt.getTime();
  return new Date(t + SHARE_DEADLINE_MS + extraMs).toISOString();
}

/** Resolve effective deadline from row fields. */
export function resolveDeadlineAt(row: {
  created_at?: string | null;
  deadline_at?: string | null;
  share_grace_count?: number | null;
}): string {
  if (row.deadline_at) {
    const d = Date.parse(row.deadline_at);
    if (Number.isFinite(d)) return new Date(d).toISOString();
  }
  const created = row.created_at || new Date().toISOString();
  const grace = Math.min(
    Math.max(0, Number(row.share_grace_count) || 0),
    MAX_GRACE_EXTENSIONS,
  );
  return deadlineIsoFromCreated(created, grace * SHARE_GRACE_MS);
}

export function isPastDeadline(deadlineAt: string | Date, now = Date.now()): boolean {
  const t = typeof deadlineAt === 'string' ? Date.parse(deadlineAt) : deadlineAt.getTime();
  if (!Number.isFinite(t)) return false;
  return now >= t;
}

/** @deprecated use isPastDeadline(resolveDeadlineAt(row)) */
export function isPastShareDeadline(createdAt: string | Date, now = Date.now()): boolean {
  return isPastDeadline(deadlineIsoFromCreated(createdAt), now);
}

type Supa = {
  from: (table: string) => any;
};

/** Mark pending rows past deadline_at (or legacy created+base) as expired. */
export async function expireStalePendingLinks(supabase: Supa, now = Date.now()): Promise<number> {
  const nowIso = new Date(now).toISOString();
  const legacyCutoff = new Date(now - SHARE_DEADLINE_MS).toISOString();
  try {
    // Prefer deadline_at when present
    const { data: withDl, error: e1 } = await supabase
      .from('referrer_links')
      .update({ status: 'expired', expired_at: nowIso })
      .eq('status', 'pending_share')
      .not('deadline_at', 'is', null)
      .lt('deadline_at', nowIso)
      .select('referrer_code');

    if (e1) {
      console.warn('[referrer-share-deadline] expire deadline_at failed:', e1.message);
    }

    // Legacy rows without deadline_at: use base window from created_at
    const { data: legacy, error: e2 } = await supabase
      .from('referrer_links')
      .update({ status: 'expired', expired_at: nowIso })
      .eq('status', 'pending_share')
      .is('deadline_at', null)
      .lt('created_at', legacyCutoff)
      .select('referrer_code');

    if (e2) {
      console.warn('[referrer-share-deadline] expire legacy failed:', e2.message);
    }

    const n1 = Array.isArray(withDl) ? withDl.length : 0;
    const n2 = Array.isArray(legacy) ? legacy.length : 0;
    return n1 + n2;
  } catch (err) {
    console.warn('[referrer-share-deadline] expire exception:', err);
    return 0;
  }
}

/**
 * Ensure a pending registration exists for a new link.
 * Owner IPs are fully exempt — no pending clock.
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
  share_grace_count?: number;
}> {
  const code = String(referrerCode || '').trim().toUpperCase();
  if (!code) return { ok: false, status: 'unknown', error: 'Missing code' };

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
          deadline_at: null,
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
      .select('referrer_code, created_at, status, first_verified_share_at, deadline_at, share_grace_count')
      .eq('referrer_code', code)
      .maybeSingle();

    if (selErr) {
      console.warn('[referrer-share-deadline] select failed:', selErr.message);
      return { ok: true, status: 'unknown', error: selErr.message };
    }

    if (existing) {
      const status = existing.status as ReferrerLinkStatus;
      const deadline_at = resolveDeadlineAt(existing);

      if (status === 'pending_share' && isPastDeadline(deadline_at)) {
        await supabase
          .from('referrer_links')
          .update({ status: 'expired', expired_at: new Date().toISOString() })
          .eq('referrer_code', code);
        return {
          ok: false,
          status: 'expired',
          created_at: existing.created_at,
          deadline_at,
          error: 'Deadline passed — land a referral sooner next time, or generate a new link',
        };
      }
      return {
        ok: status !== 'expired',
        status,
        created_at: existing.created_at,
        deadline_at,
        share_grace_count: existing.share_grace_count ?? 0,
        error: status === 'expired' ? 'Link expired — generate a new link' : undefined,
      };
    }

    const created_at = new Date().toISOString();
    const deadline_at = deadlineIsoFromCreated(created_at);
    const { error: insErr } = await supabase.from('referrer_links').insert({
      referrer_code: code,
      created_at,
      status: 'pending_share',
      deadline_at,
      share_grace_count: 0,
    });

    if (insErr) {
      if (String(insErr.code) === '23505' || /duplicate|unique/i.test(insErr.message || '')) {
        return registerReferrerLink(supabase, code);
      }
      // Column may not exist yet — retry without deadline_at
      if (/deadline_at|share_grace/i.test(insErr.message || '')) {
        const { error: ins2 } = await supabase.from('referrer_links').insert({
          referrer_code: code,
          created_at,
          status: 'pending_share',
        });
        if (!ins2) {
          return {
            ok: true,
            status: 'pending_share',
            created_at,
            deadline_at: deadlineIsoFromCreated(created_at),
          };
        }
      }
      console.warn('[referrer-share-deadline] insert failed:', insErr.message);
      return { ok: true, status: 'unknown', error: insErr.message };
    }

    return {
      ok: true,
      status: 'pending_share',
      created_at,
      deadline_at,
      share_grace_count: 0,
    };
  } catch (err) {
    console.warn('[referrer-share-deadline] register exception:', err);
    return { ok: true, status: 'unknown' };
  }
}

/**
 * Activate code after first real referral credit (or owner path).
 * platform should be first_referral or a verified channel label for analytics.
 */
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
      await supabase.from('referrer_links').upsert(
        {
          referrer_code: code,
          created_at: now,
          first_verified_share_at: now,
          first_share_platform: normalizeSharePlatform(platform),
          status: 'active',
          expired_at: null,
          deadline_at: null,
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
        deadline_at: null,
      })
      .eq('referrer_code', code);
  } catch (err) {
    console.warn('[referrer-share-deadline] mark shared failed:', err);
  }
}

/**
 * Share attempt grace: extend deadline_at by SHARE_GRACE_MS up to MAX_GRACE_EXTENSIONS.
 * Does NOT activate the link.
 */
export async function extendShareDeadlineGrace(
  supabase: Supa,
  referrerCode: string,
  platform: string,
): Promise<{ extended: boolean; deadline_at?: string; grace_count?: number }> {
  if (!isVerifiedSharePlatform(platform)) {
    return { extended: false };
  }
  if (normalizeSharePlatform(platform) === LOCK_PLATFORM_FIRST_REFERRAL) {
    return { extended: false };
  }

  const code = String(referrerCode || '').trim().toUpperCase();
  if (!code) return { extended: false };

  try {
    const { data: existing, error } = await supabase
      .from('referrer_links')
      .select('status, created_at, deadline_at, share_grace_count')
      .eq('referrer_code', code)
      .maybeSingle();

    if (error || !existing) return { extended: false };
    if (existing.status !== 'pending_share') {
      return { extended: false, deadline_at: resolveDeadlineAt(existing) };
    }

    const count = Math.max(0, Number(existing.share_grace_count) || 0);
    if (count >= MAX_GRACE_EXTENSIONS) {
      return {
        extended: false,
        deadline_at: resolveDeadlineAt(existing),
        grace_count: count,
      };
    }

    const currentDeadline = Date.parse(resolveDeadlineAt(existing));
    const nextDeadline = new Date(
      (Number.isFinite(currentDeadline) ? currentDeadline : Date.now()) + SHARE_GRACE_MS,
    ).toISOString();
    const nextCount = count + 1;

    const { error: upErr } = await supabase
      .from('referrer_links')
      .update({
        deadline_at: nextDeadline,
        share_grace_count: nextCount,
      })
      .eq('referrer_code', code)
      .eq('status', 'pending_share');

    if (upErr) {
      // Migration not applied — soft no-op
      console.warn('[referrer-share-deadline] grace extend failed:', upErr.message);
      return { extended: false };
    }

    return { extended: true, deadline_at: nextDeadline, grace_count: nextCount };
  } catch (err) {
    console.warn('[referrer-share-deadline] grace exception:', err);
    return { extended: false };
  }
}

/**
 * Whether this code may still earn referrals.
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
      .select('status, created_at, deadline_at, share_grace_count')
      .eq('referrer_code', code)
      .maybeSingle();

    if (error) {
      console.warn('[referrer-share-deadline] assert select failed:', error.message);
      return { allowed: true, status: 'unknown' };
    }

    if (!data) {
      return { allowed: true, status: 'grandfathered' };
    }

    if (data.status === 'active') return { allowed: true, status: 'active' };

    if (data.status === 'expired') {
      return {
        allowed: false,
        status: 'expired',
        reason:
          'This referral link expired — no one completed Get link through it before the deadline.',
      };
    }

    if (data.status === 'pending_share') {
      const deadline_at = resolveDeadlineAt(data);
      if (isPastDeadline(deadline_at)) {
        await supabase
          .from('referrer_links')
          .update({ status: 'expired', expired_at: new Date().toISOString() })
          .eq('referrer_code', code);
        return {
          allowed: false,
          status: 'expired',
          reason:
            'This referral link expired — no one completed Get link through it before the deadline.',
        };
      }
      // Pending: still allow credits so the first referral can land and lock
      return { allowed: true, status: 'pending_share' };
    }

    return { allowed: true, status: data.status };
  } catch (err) {
    console.warn('[referrer-share-deadline] assert exception:', err);
    return { allowed: true, status: 'unknown' };
  }
}
