import { serveDecoratedHomepage, type HomepageAssets } from './_lib/homepage-seo';

type HomeEnv = { ASSETS?: HomepageAssets };

export const onRequestGet: PagesFunction<HomeEnv> = async (context) => {
  return serveDecoratedHomepage(context.request, context.env.ASSETS, () => context.next());
};
