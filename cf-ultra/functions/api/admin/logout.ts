import { clearSessionCookie } from '../../_lib/admin-auth';
import { json } from '../../_lib/http';

export const onRequestPost: PagesFunction = async () => {
  return json({ ok: true }, { headers: { 'set-cookie': clearSessionCookie() } });
};
