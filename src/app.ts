import {
  fetchLeaderboard,
  fetchTotalReferrers,
  fetchUniqueReferrerCount,
  fetchPublicGetLinkStats,
  fetchPublicRecentActivity,
  fetchSiteContent,
  fetchMyReferralCount,
  fetchMyLeaderboardRank,
  isSupabaseConfigured,
  supabase,
} from './lib/supabase';
import { applyExistingReferralLink, syncMobileReferralCta } from './referral';
import { buildActivityVelocityHtml, type PublicActivityRow } from './lib/public-activity';
import { setFunnelTickerVisible } from './lib/funnel-ticker';
import { applyWorldwideReferralTotal } from './lib/worldwide-referral-total';
import { renderHeroSocialProof } from './lib/referred-landing-social-proof';
import { applyHeroStatsSubtext } from './lib/public-clarity';
import { renderHeroTrustPack } from './lib/referred-landing-trust-pack';
import {
  applyReferredLandingOverrides,
  initDirectLandingConversionBoost,
  isReferredLanding,
  type FunnelStep,
} from './lib/funnel-conversion';
import { applyHeroCtaVariant, lock844HomepageCopy } from './lib/hero-cta-variant';
import { reapplyI18n } from './lib/i18n';
import { applyUtmHeroCopy } from './lib/utm-hero-copy';
import { syncFunnelGuide } from './lib/funnel-guide';
import { initFunnelCopyFromContent } from './lib/funnel-copy';
import { registerGlobal, setWindowProp } from './lib/global';
import { initOptimizerFlagsFromContent } from './lib/optimizer-flags';
import { applyVisitorSlimFromFlags } from './lib/visitor-slim';
import {
  getEphemeralRankMoves,
  mergePublicActivityWithRankMoves,
  recordLeaderboardRankMoves,
} from './lib/rank-move-activity';

import { updatePublicContent } from './content';
import { getMyReferralCode } from './public/globals';
import {
  setShareGapToNextRank,
  setShareReferralCount,
  setShareLeaderboardRank,
} from './lib/share-context';
import { enrichClientReferralOgMeta } from './lib/client-og-meta';
import {
  buildComplianceBannerHtml,
  getReferrerComplianceNotice,
  maybeShowReferrerComplianceModal,
} from './lib/referrer-notices';
import { syncSharePowerUI } from './lib/share-ui';
import { buildLeaderboardHtml, buildRankGapSummary, pulseLeaderboardActivity } from './lib/leaderboard-ui';
import { dailyCrownFlairCodes, getCachedDailyCrownStatus } from './lib/daily-crown';
import { buildRecentActivityHtml, pulseRecentActivity } from './lib/activity-ui';
import {
  activitySkeletonHtml,
  leaderboardSkeletonHtml,
  statsSkeletonHtml,
  staggerReveal,
} from './lib/public-polish';
import { celebrateMilestonesIfAny } from './lib/referral-milestones';

import { initGrowthCommandCenter } from './lib/growth-command-center';
import { initPostLinkShare } from './lib/post-link-share';
import { initPostLinkStatus } from './lib/post-link-status';
import { initViralLoopUI, syncViralLoopUI } from './lib/viral-loop-ui';
import { initViralLoopsConfigFromContent } from './lib/viral-loops-config';
import { loadPublicViralLoops, onViralLoopsLinkReady, syncUserViralLoops } from './lib/viral-loops';
import { referralsToNextRank } from './lib/share-gap';
import type { LeaderboardEntry } from './lib/types';

/** Distinct people on the live board (unique referrer codes with ≥1 verified referral). */
let cachedUniqueReferrers = 0;
/** Sum of all verified worldwide referrals (excludes owner/smoke/test). */
let cachedTotalVerifiedReferrals = 0;
/** Unique people who tapped Get my referral link in the last 24h. */
let cachedPeopleGotLinkToday = 0;

// ------------------ PUBLIC SITE INITIALIZATION ------------------
// Central place for bootstrapping the public-facing homepage.
// Handles loading dynamic content, leaderboard, referral link prefill, etc.

let referralsChannel: { unsubscribe: () => void } | null = null;
let siteContentChannel: ReturnType<typeof supabase.channel> | null = null;
let publicActivityPollTimer: ReturnType<typeof setInterval> | null = null;
let cachedLeaderboard: LeaderboardEntry[] = [];

/** First screen must not wait on hung APIs. Extras fill in or time out. */
export const INIT_FETCH_TIMEOUT_MS = 2_500;
/** Disk IO: slower poll + pause when tab hidden (was 45s always-on). */
const PUBLIC_ACTIVITY_POLL_MS = 90_000;

async function withInitTimeout<T>(promise: Promise<T>, fallback: T): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), INIT_FETCH_TIMEOUT_MS)),
  ]);
}

function updateRealtimeStatus(status: string) {
  const el = document.getElementById('realtime-status');
  if (!el) return;
  if (status === 'SUBSCRIBED') {
    el.textContent = '• Realtime';
    el.className = 'ml-1 text-[10px] opacity-70 text-emerald-400';
  } else if (status === 'CHANNEL_ERROR' || status === 'CLOSED' || status === 'TIMED_OUT') {
    el.textContent = '• Offline';
    el.className = 'ml-1 text-[10px] opacity-70 text-amber-400';
  } else {
    el.textContent = '• Reconnecting...';
    el.className = 'ml-1 text-[10px] opacity-70 text-amber-400';
  }
}

function updateActivityVelocity(count: number): void {
  const el = document.getElementById('recent-activity-velocity');
  if (!el) return;
  const html = buildActivityVelocityHtml(count);
  if (html) {
    el.innerHTML = html;
    el.classList.remove('hidden');
  } else {
    el.innerHTML = '';
    el.classList.add('hidden');
  }
}

async function refreshFunnelTicker(_activityRows?: PublicActivityRow[]): Promise<void> {
  // Last-night lock: no LIVE WORLDWIDE ticker over the hero.
  setFunnelTickerVisible(false);
}

/** Call after GetReferralLink so the ticker appears immediately for new participants. */
export function onReferralLinkReadyForTicker(): void {
  void refreshFunnelTicker().catch(() => {
    /* circular import during tests / ticker optional */
  });
}

async function renderRecentActivity(options: { pulse?: boolean } = {}) {
  const actEl = document.getElementById('recent-activity');
  if (!actEl) return;
  if (!actEl.querySelector('.activity-row')) {
    actEl.innerHTML = activitySkeletonHtml();
  }
  try {
    const { rows, velocityLastHour } = await fetchPublicRecentActivity(10);
    const merged = mergePublicActivityWithRankMoves(rows, getEphemeralRankMoves(), 8);
    actEl.innerHTML = buildRecentActivityHtml(merged);
    staggerReveal(actEl, '.activity-row');
    actEl.setAttribute('aria-busy', 'false');
    updateActivityVelocity(velocityLastHour);
    const leaderCount = cachedLeaderboard[0]?.referral_count ?? 0;
    renderHeroSocialProof(merged, velocityLastHour, cachedUniqueReferrers, leaderCount);
    if (options.pulse) pulseRecentActivity();
    // Reuse activity rows so ticker refresh does not double-hit the public activity RPC
    void refreshFunnelTicker(rows);
  } catch {
    actEl.innerHTML = `<div class="text-center py-4 text-zinc-400 text-sm">Unable to load activity.</div>`;
  }
}

function initSiteContentRealtime() {
  if (siteContentChannel || !isSupabaseConfigured) return;

  siteContentChannel = supabase
    .channel('public-site-content-live')
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'site_content',
    }, () => {
      void loadSiteContent();
    })
    .subscribe();
}

/** Refresh verified total + get-link-today + unique board size (cheap RPCs; called on poll). */
async function refreshWorldwideReferralTotals(): Promise<void> {
  try {
    const [total, unique, getLink] = await Promise.all([
      fetchTotalReferrers(),
      fetchUniqueReferrerCount(),
      fetchPublicGetLinkStats(24),
    ]);
    cachedTotalVerifiedReferrals = total;
    // Prefer RPC unique count; fall back to leaderboard length when RPC empty
    cachedUniqueReferrers =
      unique > 0 ? unique : Math.max(cachedLeaderboard.length, cachedUniqueReferrers);
    cachedPeopleGotLinkToday = getLink.uniquePeople;
    paintWorldwideReferralTotal();
  } catch {
    /* non-critical social proof */
  }
}

function paintWorldwideReferralTotal(): void {
  applyWorldwideReferralTotal({
    total: cachedTotalVerifiedReferrals,
    uniqueReferrers: cachedUniqueReferrers,
    leaderCount: cachedLeaderboard[0]?.referral_count ?? 0,
    peopleGotLinkToday: cachedPeopleGotLinkToday,
  });
}

async function tickPublicActivityRefresh(): Promise<void> {
  if (typeof document !== 'undefined' && document.hidden) return;
  const boardBefore = [...cachedLeaderboard];
  await loadLeaderboard();
  recordLeaderboardRankMoves(boardBefore, cachedLeaderboard);
  await refreshWorldwideReferralTotals();
  await renderRecentActivity();
  const myCode = getMyReferralCode();
  if (myCode) await renderMyStats(myCode);
}

function startPublicActivityPolling() {
  if (publicActivityPollTimer || !isSupabaseConfigured) return;
  publicActivityPollTimer = setInterval(() => {
    void tickPublicActivityRefresh();
  }, PUBLIC_ACTIVITY_POLL_MS);

  // Resume with a single refresh when user returns (avoids IO while tab backgrounded)
  if (typeof document !== 'undefined' && !document.documentElement.dataset.vrPollVisBound) {
    document.documentElement.dataset.vrPollVisBound = '1';
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) void tickPublicActivityRefresh();
    });
  }
}

function initRealtimeSubscriptions() {
  if (referralsChannel) return;

  initSiteContentRealtime();
  referralsChannel = { unsubscribe: () => {} };
  updateRealtimeStatus('SUBSCRIBED');
  startPublicActivityPolling();
}

function cleanupRealtimeSubscriptions() {
  if (publicActivityPollTimer) {
    clearInterval(publicActivityPollTimer);
    publicActivityPollTimer = null;
  }
  referralsChannel = null;
  if (siteContentChannel) {
    supabase.removeChannel(siteContentChannel);
    siteContentChannel = null;
  }
}

/**
 * Loads and renders the public leaderboard.
 * Fetches the top referrers and displays them on the homepage.
 */
export async function loadLeaderboard(options: { pulseCode?: string } = {}) {
  const container = document.getElementById('leaderboard-container');
  if (!container) return;

  if (!container.querySelector('.leaderboard-row')) {
    container.innerHTML = leaderboardSkeletonHtml();
  }

  try {
    const entries = await fetchLeaderboard(0);
    cachedLeaderboard = entries || [];
    const crownCodes = dailyCrownFlairCodes(getCachedDailyCrownStatus());
    container.innerHTML = buildLeaderboardHtml(cachedLeaderboard, {
      myCode: getMyReferralCode(),
      crownCodes,
    });
    staggerReveal(container, '.leaderboard-row');
    container.setAttribute('aria-busy', 'false');
    if (options.pulseCode) pulseLeaderboardActivity(options.pulseCode);
    renderHeroTrustPack(cachedLeaderboard);
    paintWorldwideReferralTotal();
    // Keep legacy helper in sync for any i18n listeners still using board-size FOMO
    applyHeroStatsSubtext(
      cachedUniqueReferrers,
      cachedLeaderboard[0]?.referral_count ?? 0,
    );
    void import('./lib/prize-pull').then((m) => m.initPrizePullProof()).catch(() => {});
  } catch {
    container.innerHTML = `<div class="text-zinc-400">Leaderboard temporarily unavailable.</div>`;
  }
}

/**
 * Fetches dynamic content from the `site_content` table and applies it to the public site.
 * Delegates the actual DOM updates to `updatePublicContent` in content.ts.
 */
export async function loadSiteContent() {
  try {
    const content = await fetchSiteContent();
    initOptimizerFlagsFromContent(content);
    initViralLoopsConfigFromContent(content);
    initFunnelCopyFromContent(content);
    applyVisitorSlimFromFlags();
    await updatePublicContent(content);
    void import('./lib/prize-pull').then((m) => m.initPrizePullProof()).catch(() => {});
    if (isReferredLanding()) {
      applyReferredLandingOverrides();
    } else {
      applyHeroCtaVariant();
      applyUtmHeroCopy();
      initDirectLandingConversionBoost();
    }

    // Re-apply visitor language after CMS/hero A/B paint English over static HTML
    try {
      reapplyI18n();
    } catch {
      /* non-fatal */
    }

    // i18n rewrites data-i18n nodes — re-assert referred last, else lock 8:44
    if (isReferredLanding()) {
      applyReferredLandingOverrides();
    } else {
      lock844HomepageCopy();
    }

    const guideStep = document.documentElement.getAttribute('data-vr-funnel-guide-step');
    if (guideStep && !document.documentElement.hasAttribute('data-vr-funnel-complete')) {
      syncFunnelGuide(Number(guideStep) as FunnelStep);
    }
  } catch (err) {
    console.warn('[ViralRefer] Failed to load site_content, using static defaults:', err);
    try {
      reapplyI18n();
    } catch {
      /* non-fatal */
    }
    if (isReferredLanding()) {
      applyReferredLandingOverrides();
    } else {
      lock844HomepageCopy();
    }
  }
}

registerGlobal('loadSiteContent', loadSiteContent);

/**
 * Main public site initializer.
 * Runs on page load and orchestrates:
 *   - Admin button wiring
 *   - Loading dynamic site content
 *   - Populating stats, leaderboard, and recent activity
 *   - Prefilling the user's referral link (if they have a code)
 *   - Handling ?ref= attribution banners
 */
export async function initApp() {
  const myReferralCode = getMyReferralCode();

  try {
    // First screen is static HTML. Lock Site Drop English before any network.
    if (isReferredLanding()) applyReferredLandingOverrides();
    else lock844HomepageCopy();

    if (myReferralCode) {
      applyExistingReferralLink(myReferralCode);
    } else {
      syncMobileReferralCta();
      setFunnelTickerVisible(false);
    }

    initViralLoopUI();
    initGrowthCommandCenter();
    initPostLinkShare();
    initPostLinkStatus();
    void import('./lib/prize-slot')
      .then((m) => m.initWeekRaceClock())
      .catch(() => {});
    void import('./lib/promo-kit')
      .then((m) => m.initPromoKit())
      .catch(() => {});

    if (isSupabaseConfigured) {
      initRealtimeSubscriptions();
      window.addEventListener('beforeunload', cleanupRealtimeSubscriptions);
    }

    await Promise.all([
      withInitTimeout(loadSiteContent(), undefined),
      withInitTimeout(refreshWorldwideReferralTotals(), undefined),
      withInitTimeout(loadPublicViralLoops(myReferralCode), undefined),
      withInitTimeout(loadLeaderboard(), undefined),
      withInitTimeout(renderRecentActivity(), undefined),
      myReferralCode ? withInitTimeout(refreshFunnelTicker(), undefined) : Promise.resolve(),
      withInitTimeout(renderMyStats(myReferralCode), undefined),
    ]);
    paintWorldwideReferralTotal();
  } catch (err) {
    console.warn('[ViralRefer] initApp partial failure:', err);
  }
}

// Expose for referral.ts after code generation
setWindowProp('renderMyStats', renderMyStats);

/**
 * Renders the richer "Your Stats" section with actual personal progress.
 */
async function renderMyStats(myCode: string | null): Promise<void> {
  const container = document.getElementById('stats-content');
  if (!container) return;

  if (!myCode) {
    container.classList.remove('stats-content--loading');
    container.innerHTML = `
      <div class="text-center py-4">
        <div class="text-4xl mb-3">📈</div>
        <p class="text-zinc-300 font-medium mb-1">No link yet — takes about 30 seconds.</p>
        <p class="text-sm text-zinc-500 mb-4">Get your unique link below, then copy &amp; share on Reddit or anywhere. Stats update live here.</p>
        <button onclick="getMyReferralLinkInstant()" 
                class="px-6 py-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold rounded-2xl inline-flex items-center gap-2 transition-all active:scale-[0.985]">
          <i class="fa-solid fa-link"></i>
          <span>Get my link</span>
        </button>
      </div>
    `;
    return;
  }

  container.innerHTML = statsSkeletonHtml();
  container.classList.add('stats-content--loading');

  const [count, rank] = await Promise.all([
    fetchMyReferralCount(myCode),
    fetchMyLeaderboardRank(myCode),
  ]);
  const gap = referralsToNextRank(myCode, count, cachedLeaderboard);
  setShareReferralCount(count);
  setShareLeaderboardRank(rank);
  setShareGapToNextRank(gap);
  // Recovery: public count ≥ 1 means first friend joined → unlock link + promo kit
  if (count >= 1) {
    void import('./lib/share-deadline')
      .then((m) => m.unlockIfReferralCountUnlocked(count))
      .catch(() => {});
  }
  celebrateMilestonesIfAny(count, rank);
  void enrichClientReferralOgMeta(myCode);
  const linkInput = document.getElementById('ref-link') as HTMLInputElement | null;
  if (linkInput?.value?.trim()) syncSharePowerUI(linkInput.value.trim());
  syncViralLoopUI();
  const link = linkInput?.value?.trim() || '';
  syncUserViralLoops(myCode, count, rank, cachedLeaderboard, link || undefined);
  if (link) {
    onViralLoopsLinkReady(myCode, link, count, rank, cachedLeaderboard);
  }
  const progress = Math.min(Math.floor((count / 10) * 100), 100);
  const isOnLeaderboard = count >= 1;
  const rankBadge =
    rank === 1
      ? `<div class="text-3xl font-black text-amber-300 tabular-nums">#1 👑</div>`
      : rank
        ? `<div class="text-3xl font-bold text-violet-300 tabular-nums">#${rank}</div>`
        : '';
  const gapSummary = buildRankGapSummary(myCode, count, rank, cachedLeaderboard);

  container.classList.remove('stats-content--loading');
  container.setAttribute('aria-busy', 'false');
  const complianceNotice = getReferrerComplianceNotice(myCode);
  const complianceBanner = complianceNotice ? buildComplianceBannerHtml(complianceNotice) : '';
  if (complianceNotice) {
    // Owner-only modal (code in localStorage) — does not show to /r/ visitors
    try {
      maybeShowReferrerComplianceModal(myCode);
    } catch {
      /* non-fatal */
    }
  }
  container.innerHTML = `
    ${complianceBanner}
    <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 vr-reveal-row" style="--vr-stagger:0">
      <div class="bg-zinc-900/70 border border-white/10 rounded-2xl p-4 text-center">
        <div class="text-xs uppercase tracking-widest text-zinc-500 mb-1">Your Referrals</div>
        <div class="text-4xl font-bold text-emerald-400 tabular-nums">${count}</div>
        <div class="text-xs text-zinc-500 mt-0.5">signups via your link</div>
        ${gapSummary}
      </div>
      <div class="bg-zinc-900/70 border border-white/10 rounded-2xl p-4 text-center">
        <div class="text-xs uppercase tracking-widest text-zinc-500 mb-1">Progress to Feature</div>
        <div class="text-4xl font-bold text-amber-400 tabular-nums">${count}/10</div>
        <div class="text-xs text-zinc-500 mt-0.5">referrals for homepage feature</div>
        <div class="mt-2 h-2 bg-white/10 rounded-full overflow-hidden">
          <div class="h-full bg-gradient-to-r from-emerald-400 to-amber-400 transition-all" style="width: ${progress}%"></div>
        </div>
      </div>
      <div class="bg-zinc-900/70 border border-white/10 rounded-2xl p-4 flex flex-col justify-center text-center sm:text-left ${rank === 1 ? 'border-amber-400/30 bg-amber-500/5' : ''}">
        <div class="text-xs uppercase tracking-widest text-zinc-500 mb-1">Leaderboard Rank</div>
        ${rankBadge || `<div class="text-sm text-zinc-400">Share to rank</div>`}
        ${count === 0
          ? `<div class="text-xs text-zinc-500 mt-2">Get your first referral to appear here.</div>`
          : isOnLeaderboard
            ? `<div class="text-xs text-emerald-400/90 mt-2">Live on the public board</div>`
            : `<div class="text-xs text-amber-400/90 mt-2">Almost on the board</div>`
        }
        <button onclick="document.getElementById('referral-section').scrollIntoView({behavior:'smooth'})" 
                class="mt-3 text-xs px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/20 rounded-xl text-white self-center sm:self-start">
          View / Share Link
        </button>
      </div>
    </div>
    ${count === 0 ? `<p class="text-center text-xs text-emerald-400 mt-3">Next step: share your link to start seeing real numbers here.</p>` : ''}
  `;

  if (isReferredLanding()) {
    renderHeroTrustPack(cachedLeaderboard);
  }
}
