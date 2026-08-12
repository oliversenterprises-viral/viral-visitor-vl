/** Browser storage for the claim ownership token minted at get-link. */

const STORAGE_KEY = 'vr_claim_ownership_token';

export function getClaimOwnershipToken(): string {
  try {
    return localStorage.getItem(STORAGE_KEY)?.trim() || '';
  } catch {
    return '';
  }
}

export function setClaimOwnershipToken(token: string): void {
  try {
    if (token) localStorage.setItem(STORAGE_KEY, token);
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* private mode */
  }
}

export function clearClaimOwnershipToken(): void {
  setClaimOwnershipToken('');
}
