import { serveReferralPath, type ReferralEnv } from '../_lib/referral-path';

/** Same VIRAL- identity as /r/CODE — humans get the Site Drops homepage, crawlers get OG. */
export const onRequestGet: PagesFunction<ReferralEnv> = async ({ params, request, env }) => {
  return serveReferralPath(request, env, String(params.code || ''), 'a');
};
