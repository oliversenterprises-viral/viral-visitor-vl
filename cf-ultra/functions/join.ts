import { campaignFromSearch } from './_lib/campaign';

/** /join → homepage with campaign tags intact (TE-friendly destination). */
export const onRequestGet: PagesFunction = async ({ request }) => {
  const incoming = new URL(request.url);
  const dest = new URL('/', incoming);
  for (const [k, v] of incoming.searchParams) dest.searchParams.set(k, v);
  const camp = campaignFromSearch(incoming.searchParams);
  if (camp.te) dest.searchParams.set('src', 'te');
  if (camp.camp) dest.searchParams.set('camp', camp.camp);
  return Response.redirect(dest.toString(), 302);
};
