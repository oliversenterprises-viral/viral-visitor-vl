import { fetchLeaderboard, fetchTotalReferrers, fetchRecentActivity, fetchSiteContent } from './lib/supabase';
import * as Referral from './referral';

import { updatePublicContent } from './content';
import { getMyReferralCode } from './public/globals';

// ------------------ PUBLIC SITE INITIALIZATION ------------------
// Central place for bootstrapping the public-facing homepage.
// Handles loading dynamic content, leaderboard, referral link prefill, etc.

const buildReferralLink = Referral.buildReferralLink;

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
    updatePublicContent(content);
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

  console.log('%c[ViralRefer] === App Initialization Started ===', 'color:#34d399; font-weight:bold');

  const adminBtn = document.getElementById('admin-btn');
  if (adminBtn) {
    adminBtn.addEventListener('click', () => {
      const pw = document.getElementById('admin-password-modal');
      if (pw) pw.classList.remove('hidden');
    });
  }

  console.log('[ViralRefer] Loading site content...');
  await loadSiteContent();
  console.log('[ViralRefer] Site content loaded and applied.');

  try {
    const totalEl = document.getElementById('total-referrers');
    if (totalEl) {
      const count = await fetchTotalReferrers();
      totalEl.textContent = count.toLocaleString();
    }
  } catch {}

  await loadLeaderboard();

  try {
    const recent = await fetchRecentActivity(6);
    const actEl = document.getElementById('recent-activity');
    if (actEl) {
      if (recent.length) {
        actEl.innerHTML = recent.map((a) => `
          <div class="flex justify-between text-xs bg-zinc-900/70 px-4 py-2 rounded-2xl">
            <span class="font-mono text-emerald-400">${a.referrer_code}</span>
            <span class="text-zinc-400">${new Date(a.created_at).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
          </div>`).join('');
      } else {
        actEl.innerHTML = `<div class="text-center py-4 text-zinc-400 text-sm">Early activity from the first participants will appear here.</div>`;
      }
    }
  } catch {}

  if (myReferralCode) {
    const input = document.getElementById('ref-link') as HTMLInputElement | null;
    if (input) {
      input.value = buildReferralLink(myReferralCode);
    }
    const qr = document.getElementById('qr-code') as HTMLImageElement | null;
    if (qr && input?.value) {
      qr.src = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(input.value)}`;
    }
  }

  // Exact "Your Stats" empty state the user requested (simple, no extra features)
  // Now supports Admin-driven overrides via site_content keys
  const statsContent = document.getElementById('stats-content');
  if (statsContent) {
    const current = statsContent.innerHTML.trim();
    if (!current || !current.includes('You haven’t received any referrals yet')) {
      statsContent.innerHTML = `
        <div class="text-center py-3">
          <p id="your-stats-line1" class="text-zinc-400 mb-1">You haven’t received any referrals yet.</p>
          <p id="your-stats-line2" class="text-sm text-zinc-500 mb-2">Once people sign up using your link, you’ll see your stats and progress here.</p>
          <p id="your-stats-line3" class="text-xs text-emerald-400">Share your link to get started!</p>
        </div>
      `;
    }
  }

  const params = new URLSearchParams(location.search);
  const refCode = params.get('ref');
  if (refCode) {
    console.log('[ViralRefer] Referral attribution detected:', refCode);
    const banner = document.getElementById('referral-attribution');
    const disp = document.getElementById('referrer-code-display');
    if (banner && disp) {
      disp.textContent = refCode;
      banner.classList.remove('hidden');
    }
  }

  console.log('%c[ViralRefer] === Full app initialized successfully ===', 'color:#34d399; font-weight:bold');
}
