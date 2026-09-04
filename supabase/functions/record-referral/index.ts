// ============================================================================
// supabase/functions/record-referral/index.ts
// ViralRefer — Record Referral (production schema aligned)
// ============================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import { bumpPlatformGuardInvoke } from '../_shared/platform-guard.ts';
import {
  buildRecordReferralIndexDeps,
  createRecordReferralIndexHandler,
} from '../_shared/record-referral-index.ts';

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  { auth: { persistSession: false, autoRefreshToken: false } },
);
const inner = createRecordReferralIndexHandler(
  buildRecordReferralIndexDeps(Deno.env, supabaseAdmin),
);

Deno.serve((req: Request) => {
  if (req.method === 'POST') bumpPlatformGuardInvoke(supabaseAdmin);
  return inner(req);
});