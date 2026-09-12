import { js } from './_lib/http';
import { embedScript } from './_lib/og';

export const onRequestGet: PagesFunction = async ({ request }) => {
  return js(embedScript(new URL(request.url).origin));
};
