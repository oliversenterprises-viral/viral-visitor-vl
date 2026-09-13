import { buildLlmsFullTxt } from '../src/lib/organic-seo';
import { originFromRequest, textPublic } from './_lib/seo-http';

export const onRequestGet: PagesFunction = async ({ request }) => {
  return textPublic(buildLlmsFullTxt(originFromRequest(request)), 'text/plain');
};
