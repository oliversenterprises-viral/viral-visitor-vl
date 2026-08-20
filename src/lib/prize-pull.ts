/**
 * A+B+C prize-pull proof on the homepage ad slot.
 * C is the /tools/ example (prize-slot). A+B hydrate after public RPCs.
 */

import { fetchLeaderboard, fetchPublicPrizePull } from './supabase';
import { paintPrizePullProof, type PrizeSlotKind } from './prize-slot';

function slotKindFromDom(): PrizeSlotKind {
  const raw = document.getElementById('hero-banner-mock')?.getAttribute('data-vr-prize-slot');
  if (raw === 'winner' || raw === 'empty' || raw === 'example') return raw;
  return 'empty';
}

export async function initPrizePullProof(): Promise<void> {
  const pull = await fetchPublicPrizePull();
  let leader = pull.leaderReferrals;
  if (leader <= 0) {
    const board = await fetchLeaderboard(0);
    leader = Number(board[0]?.referral_count) || 0;
  }
  paintPrizePullProof({
    visits7d: pull.visits7d,
    leaderReferrals: leader,
    minForClaim: pull.minForClaim,
    kind: slotKindFromDom(),
  });
}
