/** Parse Supabase Edge Function invoke results (including non-2xx JSON bodies). */

export type EdgeJsonBody = {
  success?: boolean;
  duplicate?: boolean;
  error?: string;
  details?: string;
  message?: string;
};

export async function parseEdgeFunctionBody(
  data: unknown,
  error: unknown,
): Promise<EdgeJsonBody | null> {
  if (data && typeof data === 'object') {
    return data as EdgeJsonBody;
  }

  if (error && typeof error === 'object' && 'context' in error) {
    const ctx = (error as { context?: Response }).context;
    if (ctx && typeof ctx.json === 'function') {
      try {
        const json = await ctx.json();
        if (json && typeof json === 'object') return json as EdgeJsonBody;
      } catch {
        // ignore
      }
    }
  }

  return null;
}