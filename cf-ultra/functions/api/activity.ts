import { json } from '../_lib/http';
import { loadState, type UltraEnv } from '../_lib/store';

export const onRequestGet: PagesFunction<UltraEnv> = async ({ env }) => {
  const { state, demoMode } = await loadState(env);
  return json({ ok: true, demoMode, activity: state.activity.slice(0, 40) });
};
