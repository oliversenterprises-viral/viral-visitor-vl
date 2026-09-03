import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearAdminSessionToken, getAdminSessionToken } from '../../src/lib/admin-session';

const verifyMock = vi.fn();

vi.mock('../../src/lib/verify-owner-password', () => ({
  verifyOwnerPassword: (...args: unknown[]) => verifyMock(...args),
}));

describe('continueOwnerGate', () => {
  beforeEach(() => {
    clearAdminSessionToken();
    verifyMock.mockReset();
  });

  afterEach(() => {
    clearAdminSessionToken();
    verifyMock.mockReset();
  });

  it('restores Continue as soon as verify returns and does not await openAdminPanel', async () => {
    verifyMock.mockResolvedValue({ authorized: true, sessionToken: 'tok-ok' });

    let panelStarted = false;
    let panelResolved = false;
    let continueRestoredAt = 0;
    let panelStartedAt = 0;

    const { continueOwnerGate } = await import('../../src/lib/owner-gate-continue');

    const gateDone = continueOwnerGate({
      password: 'secret',
      restoreContinue: () => {
        continueRestoredAt = Date.now();
      },
      onSuccess: () => undefined,
      onDenied: () => {
        throw new Error('should not deny');
      },
      openAdminPanel: () =>
        new Promise<void>((resolve) => {
          panelStarted = true;
          panelStartedAt = Date.now();
          setTimeout(() => {
            panelResolved = true;
            resolve();
          }, 30_000);
        }),
    });

    await expect(gateDone).resolves.toBeUndefined();
    expect(continueRestoredAt).toBeGreaterThan(0);
    expect(getAdminSessionToken()).toBe('tok-ok');
    expect(panelResolved).toBe(false);
    expect(panelStarted).toBe(true);
    expect(panelStartedAt).toBeGreaterThanOrEqual(continueRestoredAt);
  });

  it('leaves Verifying even when verify denies', async () => {
    verifyMock.mockResolvedValue({ authorized: false, sessionToken: '' });
    let restored = false;
    let denied = false;
    let opened = false;

    const { continueOwnerGate } = await import('../../src/lib/owner-gate-continue');
    await continueOwnerGate({
      password: 'wrong',
      restoreContinue: () => {
        restored = true;
      },
      onSuccess: () => {
        throw new Error('should not succeed');
      },
      onDenied: () => {
        denied = true;
      },
      openAdminPanel: () => {
        opened = true;
      },
    });

    expect(restored).toBe(true);
    expect(denied).toBe(true);
    expect(opened).toBe(false);
    expect(getAdminSessionToken()).toBe('');
  });

  it('restores Continue if verify throws', async () => {
    verifyMock.mockRejectedValue(new Error('edge down'));
    let restored = false;

    const { continueOwnerGate } = await import('../../src/lib/owner-gate-continue');
    await continueOwnerGate({
      password: 'x',
      restoreContinue: () => {
        restored = true;
      },
      onSuccess: () => {
        throw new Error('should not succeed');
      },
      onDenied: () => undefined,
      openAdminPanel: () => {
        throw new Error('should not open');
      },
    });

    expect(restored).toBe(true);
  });
});
