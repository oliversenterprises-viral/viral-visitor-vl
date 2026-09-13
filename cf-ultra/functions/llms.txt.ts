import { buildLlmsTxt } from '../src/lib/organic-seo';
import { originFromRequest, textPublic } from './_lib/seo-http';

export const onRequestGet: PagesFunction = async ({ request }) => {
  return textPublic(buildLlmsTxt(originFromRequest(request)), 'text/plain');
};
