/**
 * Edge helper for platform guard counters and flags.
 * Missing RPC is a no-op so older deploys keep working.
 */

export type PlatformGuardFlags = {
  dropNoise: boolean;
  skipRealtime: boolean;
};

type RpcClient = {
  rpc: (
    fn: string,
    args?: Record<string, unknown>,
  ) => PromiseLike<{ data: unknown; error: { message?: string } | null }>;
};

export function bumpPlatformGuardInvoke(admin: RpcClient): void {
  void Promise.resolve(admin.rpc('bump_platform_guard_invoke')).catch(() => {});
}

export async function readPlatformGuardFlags(admin: RpcClient): Promise<PlatformGuardFlags> {
  try {
    const { data, error } = await admin.rpc('get_platform_guard_public');
    if (error || data == null) return { dropNoise: false, skipRealtime: false };
    const row = (typeof data === 'object' ? data : {}) as Record<string, unknown>;
    return {
      dropNoise: row.dropNoise === true || row.drop_noise === true,
      skipRealtime: row.skipRealtime === true || row.skip_realtime === true,
    };
  } catch {
    return { dropNoise: false, skipRealtime: false };
  }
}
