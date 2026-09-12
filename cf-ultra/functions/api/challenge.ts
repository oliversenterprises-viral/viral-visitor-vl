import { buildBoard } from '../_lib/engine';
import { json } from '../_lib/http';
import { loadState, type UltraEnv } from '../_lib/store';

export const onRequestGet: PagesFunction<UltraEnv> = async ({ env }) => {
  const { state, demoMode } = await loadState(env);
  const board = buildBoard(state, Date.now(), demoMode);
  return json({
    ok: true,
    demoMode,
    weekId: board.weekId,
    race: board.race,
    duel: board.duel,
    kingmakers: board.kingmakers,
  });
};
