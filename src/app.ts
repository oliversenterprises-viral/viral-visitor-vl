import {
  fetchLeaderboard,
  fetchTotalReferrers,
  fetchRecentActivity,
  fetchSiteContent,
  fetchMyReferralCount,
  isSupabaseConfigured,
  supabase,
} from './lib/supabase';
import { applyExistingReferralLink, syncMobileReferralCta } from './referral';

import { updatePublicContent } from './content';
import { getMyReferralCode } from './public/globals';

// ------------------ PUBLIC SITE INITIALIZATION ------------------
// Central place for bootstrapping the public-facing homepage.
// Handles loading dynamic content, leaderboard, referral link prefill, etc.

let referralsChannel: any = null;

const INIT_FETCH_TIMEOUT_MS = 12_000;

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

async function renderRecentActivity() {
  const actEl = document.getElementById('recent-activity');
  if (!actEl) return;
  try {
    const recent = await fetchRecentActivity(6);
    if (recent.length) {
      actEl.innerHTML = recent.map((a) => `
        <div class="flex justify-between text-xs bg-zinc-900/70 px-4 py-2 rounded-2xl">
          <span class="font-mono text-emerald-400">${a.referrer_code}</span>
          <span class="text-zinc-400">${new Date(a.created_at).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
        </div>`).join('');
    } else {
      actEl.innerHTML = `<div class="text-center py-4 text-zinc-400 text-sm">Early activity from the first participants will appear here.</div>`;
    }
  } catch {
    actEl.innerHTML = `<div class="text-center py-4 text-zinc-400 text-sm">Unable to load activity.</div>`;
  }
}

function initRealtimeSubscriptions() {
  if (referralsChannel) return;

  referralsChannel = supabase
    .channel('referrals-live')
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'referrals',
    }, async (payload) => {
      // console.log('[ViralRefer Realtime] New referral recorded:', payload.new); // silenced for prod (audit)

      // Live refresh all public views
      await loadLeaderboard();
      await renderRecentActivity();

      // Personal stats only for the affected referrer
      const myCode = getMyReferralCode();
      if (myCode && payload.new && payload.new.referrer_code === myCode) {
        await renderMyStats(myCode);
      }
    })
    .subscribe((status) => {
      updateRealtimeStatus(status);
    });
}

function cleanupRealtimeSubscriptions() {
  if (referralsChannel) {
    supabase.removeChannel(referralsChannel);
    referralsChannel = null;
  }
}

/**
 * Loads and renders the public leaderboard.
 * Fetches the top referrers and displays them on the homepage.
 */
export async function loadLeaderboard() {
  const container = document.getElementById('leaderboard-container');
  if (!container) return;

  try {
    const entries = await fetchLeaderboard(0);
    if (!entries || entries.length === 0) {
      container.innerHTML = `<div class="text-center py-8 text-zinc-400">The leaderboard is just getting started.<br>Be one of the first to get on it!</div>`;
      return;
    }
    let h = '<div class="space-y-2">';
    entries.slice(0, 12).forEach((e) => {
      h += `
        <div class="leaderboard-row flex justify-between items-center px-5 py-3 bg-zinc-900/70 border border-white/10 rounded-2xl hover:bg-primary/8 transition-colors">
          <div class="flex items-center gap-3">
            <div class="w-7 h-7 rounded-full bg-violet-600 flex items-center justify-center text-xs font-bold">${e.rank}</div>
            <div class="font-mono text-emerald-400">${e.referrer_code}</div>
          </div>
          <div class="font-semibold text-emerald-400">${e.referral_count} <span class="text-xs text-zinc-400">refs</span></div>
        </div>`;
    });
    h += '</div>';
    container.innerHTML = h;
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
    await updatePublicContent(content);
  } catch (err) {
    console.warn('[ViralRefer] Failed to load site_content, using static defaults:', err);
  }
}

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
    await withInitTimeout(loadSiteContent(), undefined);

    try {
      const totalEl = document.getElementById('total-referrers');
      if (totalEl) {
        const count = await withInitTimeout(fetchTotalReferrers(), 0);
        totalEl.textContent = count.toLocaleString();
      }
    } catch {
      /* best-effort, non-critical */
    }

    await withInitTimeout(loadLeaderboard(), undefined);
    await withInitTimeout(renderRecentActivity(), undefined);

    if (myReferralCode) {
      applyExistingReferralLink(myReferralCode);
    } else {
      syncMobileReferralCta();
    }

    await withInitTimeout(renderMyStats(myReferralCode), undefined);

    if (isSupabaseConfigured) {
      initRealtimeSubscriptions();
      window.addEventListener('beforeunload', cleanupRealtimeSubscriptions);
    }
  } catch (err) {
    console.warn('[ViralRefer] initApp partial failure:', err);
  }
}

// Expose for referral.ts after code generation
(window as any).renderMyStats = renderMyStats;

/**
 * Renders the richer "Your Stats" section with actual personal progress.
 */
async function renderMyStats(myCode: string | null): Promise<void> {
  const container = document.getElementById('stats-content');
  if (!container) return;

  if (!myCode) {
    container.innerHTML = `
      <div class="text-center py-4">
        <div class="text-4xl mb-3">📈</div>
        <p class="text-zinc-300 font-medium mb-1">No referrals tracked yet for you.</p>
        <p class="text-sm text-zinc-500 mb-4">Get your unique link and share it. Your stats and progress will update live here.</p>
        <button onclick="getMyReferralLinkInstant()" 
                class="px-6 py-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold rounded-2xl inline-flex items-center gap-2 transition-all active:scale-[0.985]">
          <i class="fa-solid fa-link"></i>
          <span>Get my referral link</span>
        </button>
      </div>
    `;
    return;
  }

  const count = await fetchMyReferralCount(myCode);
  const progress = Math.min(Math.floor((count / 10) * 100), 100);
  const isOnLeaderboard = count >= 1;

  container.innerHTML = `
    <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <div class="bg-zinc-900/70 border border-white/10 rounded-2xl p-4 text-center">
        <div class="text-xs uppercase tracking-widest text-zinc-500 mb-1">Your Referrals</div>
        <div class="text-4xl font-bold text-emerald-400 tabular-nums">${count}</div>
        <div class="text-xs text-zinc-500 mt-0.5">signups via your link</div>
      </div>
      <div class="bg-zinc-900/70 border border-white/10 rounded-2xl p-4 text-center">
        <div class="text-xs uppercase tracking-widest text-zinc-500 mb-1">Progress to Prize</div>
        <div class="text-4xl font-bold text-amber-400 tabular-nums">${count}/10</div>
        <div class="text-xs text-zinc-500 mt-0.5">referrals needed</div>
        <div class="mt-2 h-2 bg-white/10 rounded-full overflow-hidden">
          <div class="h-full bg-gradient-to-r from-emerald-400 to-amber-400 transition-all" style="width: ${progress}%"></div>
        </div>
      </div>
      <div class="bg-zinc-900/70 border border-white/10 rounded-2xl p-4 flex flex-col justify-center text-center sm:text-left">
        <div class="text-xs uppercase tracking-widest text-zinc-500 mb-1">Status</div>
        ${count === 0 
          ? `<div class="text-sm text-emerald-400 font-medium">Ready to go live!<br><span class="text-zinc-400 text-xs">Share your link anywhere to get your first referral.</span></div>`
          : isOnLeaderboard 
            ? `<div class="text-sm text-emerald-400 font-medium">You're on the leaderboard!<br><span class="text-zinc-400 text-xs">Keep sharing to climb higher.</span></div>`
            : `<div class="text-sm text-amber-400 font-medium">First referral incoming.<br><span class="text-zinc-400 text-xs">You're in the race.</span></div>`
        }
        <button onclick="document.getElementById('referral-section').scrollIntoView({behavior:'smooth'})" 
                class="mt-3 text-xs px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/20 rounded-xl text-white self-center sm:self-start">
          View / Share Link
        </button>
      </div>
    </div>
    ${count === 0 ? `<p class="text-center text-xs text-emerald-400 mt-3">Next step: share your link to start seeing real numbers here.</p>` : ''}
  `;
}
