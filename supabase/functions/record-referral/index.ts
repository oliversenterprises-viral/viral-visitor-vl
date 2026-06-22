// ============================================================================
// supabase/functions/record-referral/index.ts
// ViralRefer — Record Referral (production schema aligned)
// ============================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import {
  buildRecordReferralIndexDeps,
  createRecordReferralIndexHandler,
} from '../_shared/record-referral-index.ts';

Deno.serve(
  createRecordReferralIndexHandler(
    buildRecordReferralIndexDeps(
      Deno.env,
      createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
        { auth: { persistSession: false, autoRefreshToken: false } },
      ),
    ),
  ),
);