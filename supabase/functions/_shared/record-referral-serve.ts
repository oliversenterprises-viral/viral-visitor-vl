/** Factory used by record-referral/index.ts — testable without Deno.serve. */

import { handleRecordReferral, type RecordReferralDeps } from './record-referral-handler.ts';

/** Same handler contract as `Deno.serve(createRecordReferralServeHandler(deps))`. */
export function createRecordReferralServeHandler(deps: RecordReferralDeps) {
  return (req: Request) => handleRecordReferral(req, deps);
}