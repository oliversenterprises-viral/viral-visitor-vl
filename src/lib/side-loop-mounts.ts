/**
 * Helix Bet 2 — mount Weekly Sprint / community unlock only after gates.
 * Daily Crown is not product UI. They must not exist in cold-land HTML.
 */

export function isShareLocked(): boolean {
  return document.documentElement.hasAttribute('data-vr-share-locked');
}

function insertBeforeLeaderboard(el: HTMLElement): void {
  const leaderboard = document.getElementById('leaderboard');
  if (leaderboard?.parentElement) {
    leaderboard.parentElement.insertBefore(el, leaderboard);
    return;
  }
  document.body.appendChild(el);
}

export function ensureCommunityUnlockMount(): HTMLElement {
  const existing = document.getElementById('community-unlock-meter');
  if (existing) return existing;
  const root = document.createElement('div');
  root.id = 'community-unlock-meter';
  root.dataset.vrZone = 'community-unlock';
  root.className =
    'hidden community-unlock-meter mt-12 rounded-3xl border border-cyan-400/25 bg-gradient-to-br from-cyan-500/10 via-zinc-900/80 to-violet-500/5 px-6 py-5';
  root.setAttribute('role', 'status');
  root.setAttribute('aria-live', 'polite');
  root.innerHTML = `
    <div class="flex flex-wrap items-center justify-between gap-2 mb-2">
      <div class="flex items-center gap-2">
        <i class="fa-solid fa-users text-cyan-300 text-sm" aria-hidden="true"></i>
        <span class="text-xs uppercase tracking-wider font-bold text-cyan-200">Community unlock</span>
      </div>
      <span data-community-pct class="text-sm font-bold text-cyan-300 tabular-nums"></span>
    </div>
    <p data-community-label class="text-sm text-zinc-100"></p>
    <div class="h-2.5 bg-zinc-800 rounded-full overflow-hidden my-3">
      <div data-community-fill class="community-unlock-meter__fill h-full bg-gradient-to-r from-cyan-400 to-violet-400 transition-all duration-700" style="width:0%"></div>
    </div>
    <p data-community-status class="text-[11px] text-zinc-400"></p>`;
  insertBeforeLeaderboard(root);
  return root;
}

export function ensureWeeklySprintMount(): HTMLElement {
  const existing = document.getElementById('weekly-sprint-board');
  if (existing) return existing;
  const root = document.createElement('div');
  root.id = 'weekly-sprint-board';
  root.dataset.vrZone = 'weekly-sprint';
  root.className = 'hidden mt-8';
  root.innerHTML = `
    <div class="flex items-center gap-3 mb-4">
      <h2 class="text-3xl font-bold tracking-tight text-white">Weekly Sprint</h2>
      <span class="px-2.5 py-0.5 bg-cyan-500/15 text-cyan-300 text-[10px] font-bold uppercase tracking-wide rounded-full border border-cyan-400/30">7-day board</span>
    </div>
    <p class="text-sm text-zinc-400 mb-4">Mini-leaderboard for referrals in the last 7 days — separate from the main board.</p>
    <div id="weekly-sprint-container" class="min-h-[120px]" aria-busy="true"></div>`;
  insertBeforeLeaderboard(root);
  return root;
}

export function ensureDailyChampionStrip(): HTMLElement {
  const existing = document.getElementById('daily-champion-strip');
  if (existing) {
    existing.classList.add('hidden');
    existing.setAttribute('hidden', '');
    existing.innerHTML = '';
    return existing;
  }
  const strip = document.createElement('div');
  strip.id = 'daily-champion-strip';
  strip.className = 'hidden';
  strip.setAttribute('hidden', '');
  strip.setAttribute('aria-hidden', 'true');
  return strip;
}

export function ensureDailyCrownMount(): HTMLElement {
  const existing = document.getElementById('daily-crown-section');
  if (existing) {
    existing.classList.add('hidden');
    existing.setAttribute('hidden', '');
    existing.innerHTML = '';
    return existing;
  }
  const root = document.createElement('div');
  root.id = 'daily-crown-section';
  root.className = 'hidden';
  root.setAttribute('hidden', '');
  root.setAttribute('aria-hidden', 'true');
  return root;
}
