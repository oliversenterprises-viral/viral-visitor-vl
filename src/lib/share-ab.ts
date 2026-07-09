/**
 * A/B share message variants — stable per referral code, user can override.
 */

import { getOptimizerShareAbDefault } from './optimizer-flags';

export type ShareAbVariant = 'a' | 'b';

const STORAGE_KEY = 'vr_share_ab_variant';

export const SHARE_AB_TEMPLATES: Record<ShareAbVariant, string> = {
  a: 'Worldwide free leaderboard — join in ~30 sec. #1 can claim a homepage feature. {link}',
  b: 'Open worldwide — real-time referral board. Grab your free link in ~30 sec. Top referrer claims homepage feature. {link}',
};

/** Stable default variant from referral code (50/50 split). */
export function defaultShareAbVariant(code: string): ShareAbVariant {
  let hash = 0;
  for (let i = 0; i < code.length; i++) {
    hash = (hash * 31 + code.charCodeAt(i)) >>> 0;
  }
  return hash % 2 === 0 ? 'a' : 'b';
}

export function getStoredShareAbVariant(): ShareAbVariant | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw === 'a' || raw === 'b' ? raw : null;
  } catch {
    return null;
  }
}

export function setStoredShareAbVariant(variant: ShareAbVariant): void {
  try {
    localStorage.setItem(STORAGE_KEY, variant);
  } catch {
    // non-fatal
  }
}

/** Resolved variant: user override → optimizer promote → stable code hash → A. */
export function resolveShareAbVariant(code: string): ShareAbVariant {
  return (
    getStoredShareAbVariant() ??
    getOptimizerShareAbDefault() ??
    defaultShareAbVariant(code)
  );
}

export function getShareAbTemplate(variant: ShareAbVariant): string {
  return SHARE_AB_TEMPLATES[variant];
}

export function shareAbVariantLabel(variant: ShareAbVariant): string {
  return variant === 'a' ? 'Variant A — feature focus' : 'Variant B — board urgency';
}