import { describe, expect, it } from 'vitest';
import {
  mintAdminSessionToken,
  verifyAdminSessionToken,
} from '../../supabase/functions/_shared/admin-session.ts';

describe('admin-session edge tokens', () => {
  it('mints and verifies an HMAC session token', async () => {
    const secret = 'unit-test-admin-action-secret';
    const token = await mintAdminSessionToken(secret);
    expect(token.includes('.')).toBe(true);
    await expect(verifyAdminSessionToken(secret, token)).resolves.toBe(true);
    await expect(verifyAdminSessionToken(secret, `${token}x`)).resolves.toBe(false);
    await expect(verifyAdminSessionToken('wrong-secret', token)).resolves.toBe(false);
  });

  it('verifies tokens whose base64 payload needs padding restore', async () => {
    const secret = 'padding-test-secret';
    // Mint several times so payload length varies with exp timestamp
    for (let i = 0; i < 5; i++) {
      const token = await mintAdminSessionToken(secret);
      await expect(verifyAdminSessionToken(secret, `  ${token}  `)).resolves.toBe(true);
    }
  });
});