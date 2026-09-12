import { MY_REF_CODE_KEY } from '../functions/_lib/referral-url';
import { normalizeReferralCode } from '../functions/_lib/engine';

/** Same localStorage key as live Site Drops (`src/public/globals.ts`). */
export { MY_REF_CODE_KEY };

export function getMyReferralCode(): string | null {
  try {
    return normalizeReferralCode(localStorage.getItem(MY_REF_CODE_KEY));
  } catch {
    return null;
  }
}

export function setMyReferralCode(code: string): string | null {
  const normalized = normalizeReferralCode(code);
  if (!normalized) return getMyReferralCode();
  try {
    localStorage.setItem(MY_REF_CODE_KEY, normalized);
  } catch {
    /* private mode */
  }
  return normalized;
}
