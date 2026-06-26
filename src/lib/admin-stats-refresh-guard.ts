/** Suppresses visitor/banner event writes during admin read-only stats refresh. */

let readOnlyRefreshDepth = 0;

export function isAdminStatsReadOnlyRefresh(): boolean {
  return readOnlyRefreshDepth > 0;
}

export async function withAdminStatsReadOnlyRefresh<T>(fn: () => Promise<T>): Promise<T> {
  readOnlyRefreshDepth += 1;
  try {
    return await fn();
  } finally {
    readOnlyRefreshDepth = Math.max(0, readOnlyRefreshDepth - 1);
  }
}

/** Vitest-only reset. */
export function resetAdminStatsRefreshGuardForTests(): void {
  readOnlyRefreshDepth = 0;
}