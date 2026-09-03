import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

describe('verifyOwnerPassword', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    vi.useRealTimers();
    vi.resetModules();
  });

  it('POSTs verify_owner_password via fetch with AbortController ≤8s', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon-key');
    const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
      expect(init.signal).toBeInstanceOf(AbortSignal);
      return {
        status: 200,
        text: async () => JSON.stringify({ success: true, session_token: 'sess-1' }),
      };
    });
    vi.stubGlobal('fetch', fetchMock);
    vi.resetModules();
    const { verifyOwnerPassword, OWNER_VERIFY_TIMEOUT_MS } = await import(
      '../../src/lib/verify-owner-password'
    );
    expect(OWNER_VERIFY_TIMEOUT_MS).toBeLessThanOrEqual(8000);

    const result = await verifyOwnerPassword('owner-secret');
    expect(result).toEqual({ authorized: true, sessionToken: 'sess-1' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://example.supabase.co/functions/v1/admin-action');
    expect(init.method).toBe('POST');
    expect(init.signal).toBeInstanceOf(AbortSignal);
    const body = JSON.parse(String(init.body));
    expect(body).toEqual({
      action: 'verify_owner_password',
      payload: { password: 'owner-secret' },
    });
  });

  it('returns denied when fetch hangs past the abort timeout', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon-key');
    vi.useFakeTimers();
    vi.stubGlobal(
      'fetch',
      vi.fn((_url: string, init: RequestInit) => {
        return new Promise((_resolve, reject) => {
          init.signal?.addEventListener('abort', () => {
            const err = new Error('The operation was aborted');
            err.name = 'AbortError';
            reject(err);
          });
        });
      }),
    );
    vi.resetModules();
    const { verifyOwnerPassword, OWNER_VERIFY_TIMEOUT_MS } = await import(
      '../../src/lib/verify-owner-password'
    );

    const pending = verifyOwnerPassword('slow');
    await vi.advanceTimersByTimeAsync(OWNER_VERIFY_TIMEOUT_MS);
    await expect(pending).resolves.toEqual({ authorized: false, sessionToken: '' });
  });

  it('never reads the owner password from VITE_', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon-key');
    vi.stubEnv('VITE_ADMIN_PASSWORD', 'must-not-be-used');
    vi.stubEnv('VITE_OWNER_PASSWORD', 'must-not-be-used');
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        status: 200,
        text: async () => JSON.stringify({ success: false }),
      })),
    );
    vi.resetModules();
    const { verifyOwnerPassword } = await import('../../src/lib/verify-owner-password');
    await verifyOwnerPassword('typed-password');
    const [, init] = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0] as [
      string,
      RequestInit,
    ];
    const body = JSON.parse(String(init.body));
    expect(body.payload.password).toBe('typed-password');
    expect(JSON.stringify(body)).not.toContain('must-not-be-used');
  });
});

describe('owner verify source contract', () => {
  it('uses fetch + AbortController and does not invoke or VITE_ the password', () => {
    const verify = readFileSync(resolve(ROOT, 'src/lib/verify-owner-password.ts'), 'utf8');
    const continueSrc = readFileSync(resolve(ROOT, 'src/lib/owner-gate-continue.ts'), 'utf8');
    const modals = readFileSync(resolve(ROOT, 'src/public/modals.ts'), 'utf8');
    expect(verify).toContain('AbortController');
    expect(verify).toMatch(/OWNER_VERIFY_TIMEOUT_MS\s*=\s*8_?000/);
    expect(verify).not.toContain('functions.invoke');
    expect(verify).not.toMatch(/VITE_ADMIN_PASSWORD|VITE_OWNER_PASSWORD/);
    expect(continueSrc).not.toContain('functions.invoke');
    expect(continueSrc).not.toMatch(/await\s+\w*openAdminPanel/);
    expect(continueSrc).toContain('restoreContinue()');
    expect(modals).not.toContain('functions.invoke');
    expect(modals).toContain('continueOwnerGate');
  });
});
