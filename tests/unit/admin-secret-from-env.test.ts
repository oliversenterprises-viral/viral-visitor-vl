import { afterEach, describe, expect, it } from 'vitest';
import { resolveAdminActionSecret } from '../../scripts/admin-secret-from-env.mjs';

describe('resolveAdminActionSecret', () => {
  const prevAction = process.env.ADMIN_ACTION_SECRET;
  const prevVite = process.env.VITE_ADMIN_ACTION_SECRET;

  afterEach(() => {
    if (prevAction === undefined) delete process.env.ADMIN_ACTION_SECRET;
    else process.env.ADMIN_ACTION_SECRET = prevAction;
    if (prevVite === undefined) delete process.env.VITE_ADMIN_ACTION_SECRET;
    else process.env.VITE_ADMIN_ACTION_SECRET = prevVite;
  });

  it('returns ADMIN_ACTION_SECRET from env', () => {
    process.env.ADMIN_ACTION_SECRET = 'unit-test-admin-secret-value';
    delete process.env.VITE_ADMIN_ACTION_SECRET;
    expect(resolveAdminActionSecret()).toBe('unit-test-admin-secret-value');
  });

  it('does not accept VITE_ADMIN_ACTION_SECRET as a fallback', () => {
    delete process.env.ADMIN_ACTION_SECRET;
    process.env.VITE_ADMIN_ACTION_SECRET = 'must-not-be-used';
    expect(() => resolveAdminActionSecret()).toThrow(/ADMIN_ACTION_SECRET/);
  });
});
