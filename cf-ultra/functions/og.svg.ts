import { homepageOgSvg } from '../src/lib/organic-seo';
import { svg } from './_lib/http';

export const onRequestGet: PagesFunction = async () => {
  return svg(homepageOgSvg(), {
    headers: { 'cache-control': 'public, max-age=86400, s-maxage=86400' },
  });
};
