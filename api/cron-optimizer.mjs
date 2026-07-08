/**
 * Vercel Cron — daily optimizer autopilot (Phase 3a).
 * Secured with CRON_SECRET (Vercel sends Authorization: Bearer <CRON_SECRET>).
 *
 * Invokes Supabase optimizer-cron edge function; respects auto_pilot flag + guardrails.
 */

const SUPABASE_URL =
  process.env.SUPABASE_URL ||
  process.env.VITE_SUPABASE_URL ||
  'https://wqbefjzpgsezzwdrvvua.supabase.co';

const SUPABASE_ANON_KEY =
  process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

const CRON_SECRET = process.env.CRON_SECRET || '';
const OPTIMIZER_SECRET =
  process.env.OPTIMIZER_CRON_SECRET ||
  process.env.ADMIN_ACTION_SECRET ||
  process.env.VITE_ADMIN_ACTION_SECRET ||
  '';

function isAuthorized(req) {
  const header = req.headers?.authorization || req.headers?.Authorization || '';
  if (!CRON_SECRET) return false;
  return String(header).trim() === `Bearer ${CRON_SECRET}`;
}

export default async function handler(req, res) {
  const sendJson = (status, body) => {
    res.status(status);
    res.setHeader('Content-Type', 'application/json');
    res.send(JSON.stringify(body));
  };

  if (req.method !== 'GET' && req.method !== 'POST') {
    sendJson(405, { success: false, error: 'Method not allowed' });
    return;
  }

  if (!isAuthorized(req)) {
    sendJson(401, { success: false, error: 'Unauthorized' });
    return;
  }

  if (!SUPABASE_ANON_KEY || !OPTIMIZER_SECRET) {
    sendJson(500, {
      success: false,
      error: 'Server missing SUPABASE_ANON_KEY or OPTIMIZER_CRON_SECRET',
    });
    return;
  }

  const dryRun = req.query?.dry_run === '1' || req.query?.dry_run === 'true';

  try {
    const edgeUrl = `${SUPABASE_URL.replace(/\/$/, '')}/functions/v1/optimizer-cron`;
    const edgeRes = await fetch(edgeUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        'x-optimizer-cron-secret': OPTIMIZER_SECRET,
      },
      body: JSON.stringify({ dry_run: dryRun }),
    });

    const text = await edgeRes.text();
    let json;
    try {
      json = JSON.parse(text);
    } catch {
      sendJson(502, { success: false, error: 'Invalid edge response', raw: text.slice(0, 200) });
      return;
    }

    sendJson(edgeRes.ok && json.success ? 200 : 502, {
      success: !!json.success,
      source: 'vercel-cron',
      dryRun,
      data: json.data ?? null,
      error: json.error ?? null,
    });
  } catch (err) {
    sendJson(500, {
      success: false,
      error: err instanceof Error ? err.message : 'Cron invoke failed',
    });
  }
}