import { buildSitemapXml, SEO_LASTMOD } from '../src/lib/organic-seo';
import { originFromRequest, textPublic } from './_lib/seo-http';

export const onRequestGet: PagesFunction = async ({ request }) => {
  return textPublic(buildSitemapXml(originFromRequest(request), SEO_LASTMOD), 'application/xml');
};
