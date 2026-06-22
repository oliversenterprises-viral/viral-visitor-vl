import type { SupabaseClient } from '@supabase/supabase-js';

export type StubInvokeCall = {
  name: string;
  options: unknown;
};

const invokeLog: StubInvokeCall[] = [];

export function getStubInvokeLog(): StubInvokeCall[] {
  return [...invokeLog];
}

export function clearStubInvokeLog(): void {
  invokeLog.length = 0;
}

/** Inert client — no network, no WebSocket, safe for builds without env. */
export function createSupabaseStub(): SupabaseClient {
  const empty = Promise.resolve({ data: null, error: null, count: 0, status: 200, statusText: 'OK' });

  const query = () => ({
    select: () => query(),
    eq: () => query(),
    order: () => query(),
    limit: () => query(),
    delete: () => query(),
    insert: () => query(),
    update: () => query(),
    single: () => empty,
    maybeSingle: () => empty,
    then: empty.then.bind(empty),
  });

  return {
    from: () => query(),
    rpc: () => empty,
    functions: {
      invoke: (name: string, options?: unknown) => {
        invokeLog.push({ name, options });
        return Promise.resolve({ data: null, error: new Error('Supabase not configured') });
      },
    },
    channel: () => ({
      on: () => ({ subscribe: () => 'SUBSCRIBED' }),
    }),
    removeChannel: () => {},
    auth: {
      getSession: () => Promise.resolve({ data: { session: null }, error: null }),
      signInWithOtp: () => Promise.resolve({ data: {}, error: null }),
      signOut: () => Promise.resolve({ error: null }),
    },
  } as unknown as SupabaseClient;
}