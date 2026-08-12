#!/usr/bin/env node
/**
 * Read-only: list duplicate (referrer_code, referred_ip) rows.
 * Run before applying supabase/migrations/0046_referrals_unique_ip_per_code.sql
 * Does not write. Uses linked supabase CLI if available.
 */
import { execSync } from 'child_process';

const sql = `
SELECT referrer_code, referred_ip, COUNT(*) AS n
FROM public.referrals
WHERE referred_ip IS NOT NULL
GROUP BY 1, 2
HAVING COUNT(*) > 1
ORDER BY n DESC
LIMIT 50;
`;

try {
  const out = execSync('npx supabase db query --linked', {
    input: sql,
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  console.log(out || '(no duplicate rows)');
} catch (err) {
  console.error('Read-only check failed (not applied). Link supabase or run the SQL in the dashboard.');
  console.error(String(err?.stderr || err?.message || err));
  process.exit(1);
}
