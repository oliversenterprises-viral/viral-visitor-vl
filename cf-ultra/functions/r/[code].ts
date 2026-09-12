import { serveReferralPath, type ReferralEnv } from '../_lib/referral-path';

export const onRequestGet: PagesFunction<ReferralEnv> = async ({ params, request, env }) => {
  return serveReferralPath(request, env, String(params.code || ''), 'r');
};
