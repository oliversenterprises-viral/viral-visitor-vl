import { describe, expect, it } from 'vitest';
import { parseEdgeFunctionBody } from '../../src/lib/edge-response';

describe('parseEdgeFunctionBody', () => {
  it('returns data when invoke succeeded', async () => {
    const body = await parseEdgeFunctionBody({ success: true, duplicate: false }, null);
    expect(body?.success).toBe(true);
  });

  it('parses JSON from FunctionsHttpError context', async () => {
    const error = {
      message: 'Edge Function returned a non-2xx status code',
      context: new Response(
        JSON.stringify({ success: false, error: 'Bot verification failed', details: 'invalid-input-response' }),
        { status: 403, headers: { 'Content-Type': 'application/json' } },
      ),
    };
    const body = await parseEdgeFunctionBody(null, error);
    expect(body?.error).toBe('Bot verification failed');
    expect(body?.details).toBe('invalid-input-response');
  });
});