import { describe, expect, it } from 'vitest';
import {
  hashClaimOwnershipToken,
  mintClaimOwnershipToken,
  resolveClaimOwnershipSecret,
  verifyClaimOwnershipToken,
} from '../../supabase/functions/_shared/claim-ownership';

const secret = 'test-claim-secret';

describe('claim ownership tokens', () => {
  it('mints a token that verifies for the same code', async () => {
    const token = await mintClaimOwnershipToken(secret, 'viral-abc');
    expect(await verifyClaimOwnershipToken(secret, token, 'VIRAL-ABC')).toBe(true);
    expect(await verifyClaimOwnershipToken(secret, token, 'VIRAL-OTHER')).toBe(false);
  });

  it('rejects tampered signatures', async () => {
    const token = await mintClaimOwnershipToken(secret, 'VIRAL-ABC');
    expect(await verifyClaimOwnershipToken(secret, `${token}x`, 'VIRAL-ABC')).toBe(false);
  });

  it('hashes are stable for the same token', async () => {
    const token = await mintClaimOwnershipToken(secret, 'VIRAL-ABC');
    const a = await hashClaimOwnershipToken(secret, token);
    const b = await hashClaimOwnershipToken(secret, token);
    expect(a).toBe(b);
  });

  it('resolveClaimOwnershipSecret prefers CLAIM_OWNERSHIP_SECRET', () => {
    expect(
      resolveClaimOwnershipSecret({
        get: (k) => (k === 'CLAIM_OWNERSHIP_SECRET' ? 'a' : k === 'ADMIN_ACTION_SECRET' ? 'b' : undefined),
      }),
    ).toBe('a');
  });
});
