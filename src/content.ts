import {
  setReferralBaseUrl,
  setShareMessageTemplate,
  setQrModalTitle,
} from './public/globals';

import { isAdminStatsReadOnlyRefresh } from './lib/admin-stats-refresh-guard';
import { registerGlobal, setWindowProp } from './lib/global';
import { applyTextColors } from './colors';
import {
  LOCKED_SHARE_TEXT,
  parseMinReferralsForClaim,
  paintPrizeSlot,
  paintPrizeThreshold,
  resolvePrizeSlot,
  sharePayloadHasBannerRace,
} from './lib/prize-slot';
import { supabase } from './lib/supabase';
import { normalizeSiteContentText } from './lib/site-content-value';

// Banner helpers live in leaf modules so admin panels avoid circular imports via content.ts
export {
  BANNER_EVENTS_KEY,
  clearBannerEvents,
  computeBannerStats,
  getBannerKey,
  getLocalBannerEvents,
} from './lib/banner-events';
export { getBannerEventsForStats } from './lib/banner-stats-fetch';

import {
  BANNER_EVENTS_KEY,
  getBannerKey,
  getLocalBannerEvents,
} from './lib/banner-events';

// Re-export from leaf module (admin panels should import escape-html directly to avoid cycles)
export { escapeHtml } from './lib/escape-html';

export interface Banner {
  imageUrl: string;
  redirectUrl: string;
  label?: string;
  enabled?: boolean;
  weight?: number;
}

/**
 * Basic banner event tracking (Phase 2 MVP)
 * Logs impression and click events.
 * Stores in localStorage for easy inspection + console output.
 */
function logBannerEvent(type: 'impression' | 'click', banner: Banner) {
  if (isAdminStatsReadOnlyRefresh()) return;
  const event = {
    type,
    label: banner.label || 'untitled',
    redirectUrl: banner.redirectUrl,
    key: getBannerKey(banner),
    timestamp: new Date().toISOString(),
  };

  try {
    const existing = getLocalBannerEvents();
    existing.push(event);
    localStorage.setItem(BANNER_EVENTS_KEY, JSON.stringify(existing.slice(-50)));
  } catch {
    // non-critical
  }

  // Best-effort server persistence (never blocks public render)
  supabase.functions.invoke('record-banner-event', {
    body: {
      type: event.type,
      label: event.label,
      redirectUrl: event.redirectUrl,
      key: event.key,
      timestamp: event.timestamp,
    },
  }).catch(() => {});
}

setWindowProp('debugBannerEvents', () => {
  try {
    const events = getLocalBannerEvents();
    console.table(events);
    return events;
  } catch {
    console.log('No banner events recorded yet.');
    return [];
  }
});

setWindowProp('resetBannerRotation', () => {
  localStorage.removeItem('viralrefer_banner_rotation_index');
  console.log('[Banner] Rotation index reset. Reload the page to see banner #1 next.');
});

setWindowProp('parseBanners', parseBanners);
setWindowProp('selectBanner', selectBanner);

/**
 * Parses raw banners value (string JSON or array) into clean Banner objects.
 * Filters out invalid entries (missing imageUrl).
 */
export function parseBanners(raw: unknown): Banner[] {
  if (!raw) return [];
  try {
    const arr = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!Array.isArray(arr)) return [];
    return arr
      .map((raw) => {
        const b = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
        return {
          imageUrl: String(b.imageUrl || '').trim(),
          redirectUrl: String(b.redirectUrl || '').trim(),
          label: b.label ? String(b.label).trim() : undefined,
          enabled: b.enabled !== false,
          weight: typeof b.weight === 'number' && b.weight > 0 ? Math.floor(b.weight) : 1,
        };
      })
      .filter(b => b.imageUrl.length > 0 && b.redirectUrl.length > 0);
  } catch {
    return [];
  }
}

/**
 * Simple rotation selector (logical option #1).
 * - Pure round-robin when all weights are 1 (default).
 * - Weighted round-robin when any banner has weight > 1: higher weight banners appear proportionally more often.
 * - Uses a single localStorage counter for deterministic, cross-visit rotation (no randomness).
 * - Returns the chosen banner + display info for the "+N of M" indicator.
 */
export function selectBanner(banners: Banner[]): { banner: Banner; displayIndex: number; total: number } | null {
  const enabled = banners.filter(b => b.enabled !== false);
  if (enabled.length === 0) return null;

  const rotationKey = 'viralrefer_banner_rotation_index';
  const counter = parseInt(localStorage.getItem(rotationKey) || '0', 10);

  // Weighted round-robin: treat the cycle length as sum of weights
  const totalWeight = enabled.reduce((sum, b) => sum + (b.weight || 1), 0) || 1;
  const pick = counter % totalWeight;

  let chosen: Banner | null = null;
  let chosenDisplayIndex = 0;
  let cumulative = 0;

  for (let i = 0; i < enabled.length; i++) {
    const w = enabled[i].weight || 1;
    cumulative += w;
    if (pick < cumulative) {
      chosen = enabled[i];
      chosenDisplayIndex = i;
      break;
    }
  }

  if (!chosen) {
    chosen = enabled[0];
    chosenDisplayIndex = 0;
  }

  // Advance counter (cap growth to avoid huge numbers over time)
  const nextCounter = (counter + 1) % (totalWeight * 12 + 7);
  localStorage.setItem(rotationKey, nextCounter.toString());

  return {
    banner: chosen,
    displayIndex: chosenDisplayIndex,
    total: enabled.length,
  };
}

/**
 * Dynamic Site Content System
 *
 * Applies all dynamic text, labels, and values from the `site_content` table
 * to the public homepage. Content is grouped logically for easier management
 * in the admin editor.
 */

/**
 * Applies dynamic content from the `site_content` table to the public homepage.
 *
 * This is the central function that wires all the editable text, labels, badges,
 * and non-DOM values (share message template, referral base URL, etc.).
 *
 * Content is applied in logical sections (hero, how-it-works, prizes, etc.) for maintainability.
 *
 * @param content - Record of key → value pairs fetched from Supabase `site_content` table
 */
export async function updatePublicContent(content: Record<string, unknown>) {
  if (!content || typeof content !== 'object') return;

  // Small helper: set textContent if key present (safe, no HTML injection for v1)
  const apply = (elId: string, dbKey: string) => {
    const el = document.getElementById(elId);
    if (!el) return;
    const display = normalizeSiteContentText(content[dbKey]);
    if (display != null) el.textContent = display;
  };

  const applyButtonLabel = (buttonId: string, dbKey: string) => {
    const btn = document.getElementById(buttonId);
    if (!btn) return;
    const display = normalizeSiteContentText(content[dbKey]);
    if (display == null) return;
    const span = btn.querySelector('span');
    if (span) span.textContent = display;
    else btn.textContent = display;
  };

  // 8:44 lock: do not let CMS rewrite homepage title / sub / CTA.
  apply('hero-badge', 'hero_badge');
  apply('hero-trust-line', 'hero_trust_line');

  // HOW IT WORKS batch (high priority)
  apply('how-it-works-title', 'how_it_works_title');
  apply('how-it-works-subtitle', 'how_it_works_subtitle');
  apply('how-step1-title', 'how_step1_title');
  apply('how-step1-desc', 'how_step1_desc');
  apply('how-step2-title', 'how_step2_title');
  apply('how-step2-desc', 'how_step2_desc');
  apply('how-it-works-step3', 'how_it_works_step3');

  // PRIZE SECTION batch (numbers + text)
  apply('prize-title', 'prize_title');
  apply('prize-description', 'prize_description');
  apply('prize-banner-line1', 'prize_banner_line1');
  apply('prize-banner-line2', 'prize_banner_line2');
  apply('prize-banner-description', 'prize_banner_description');
  apply('cash-amount-value', 'cash_amount');

  // 8:44 lock: empty 7-day slot unless a claimed winner banner exists.
  const bannersRaw = content['banners'];
  const parsedBanners = parseBanners(bannersRaw);
  const selection = parsedBanners.length > 0 ? selectBanner(parsedBanners) : null;
  const slot = resolvePrizeSlot({
    banners: parsedBanners,
    selected: selection?.banner ?? null,
  });
  paintPrizeSlot(slot);
  if (selection) {
    logBannerEvent('impression', selection.banner);
    const slotLink = document.getElementById('prize-slot-site');
    if (slotLink) {
      slotLink.addEventListener('click', () => {
        logBannerEvent('click', selection.banner);
      }, { once: true });
    }
    if (selection.total > 1) {
      const visualContainer = document.getElementById('prize-banner-visual');
      if (visualContainer && !visualContainer.querySelector('[data-prize-rotation]')) {
        const note = document.createElement('div');
        note.dataset.prizeRotation = '1';
        note.className = 'text-[10px] text-center text-zinc-500 mt-1.5';
        note.textContent = `Showing ${selection.displayIndex + 1} of ${selection.total} (rotates)`;
        visualContainer.appendChild(note);
      }
    }
  }
  paintPrizeThreshold(
    parseMinReferralsForClaim(content['min_referrals_for_claim'] ?? content['min_referrals']),
  );
  apply('claim-cash-value', 'cash_amount');

  // High-visibility public headings and descriptions
  apply('leaderboard-title', 'leaderboard_title');
  apply('leaderboard-description', 'leaderboard_description');
  apply('winning-link-title', 'winning_link_title');
  apply('winning-link-description', 'winning_link_description');
  apply('unique-referral-link-title', 'unique_referral_link_title');
  apply('stats-title', 'stats_title');
  apply('recent-activity-title', 'recent_activity_title');
  apply('recent-activity-description', 'recent_activity_description');
  apply('how-step3-title', 'how_step3_title');

  // Newly wired for hero campaign copy + footer credit (enables instant Admin-driven updates, no deploy needed for these strings)
  apply('hero-campaign-badge', 'hero_campaign_badge');
  // Do NOT apply hero_stats_subtext over #hero-stats-subtext — it hosts the live
  // verified worldwide total (#total-referrers). CMS copy would wipe that counter.
  apply('footer-credit', 'footer_credit');
  applyButtonLabel('hero-leaderboard-btn', 'leaderboard_button_text');

  // Funnel journey (above-fold) — editable in Admin → Edit Content
  apply('funnel-journey-badge', 'funnel_journey_badge');
  apply('funnel-step1-label', 'funnel_step1_label');
  apply('funnel-step2-label', 'funnel_step2_label');
  apply('funnel-step3-label', 'funnel_step3_label');
  apply('funnel-credit-gate-title', 'funnel_credit_gate_title');

  // First-time visitor focused messaging (wired for Admin control)
  apply('referral-next-step', 'referral_next_step_hint');
  apply('your-stats-line1', 'your_stats_line1');
  apply('your-stats-line2', 'your_stats_line2');
  apply('your-stats-line3', 'your_stats_line3');

  // Referral section controls + footer + share template
  apply('new-code-button', 'new_code_button');
  apply('qr-scan-text', 'qr_scan_text');
  apply('qr-mobile-text', 'qr_mobile_text');
  apply('qr-show-larger', 'qr_show_larger');
  apply('share-link-heading', 'share_link_heading');
  apply('share-x-label', 'share_x_label');
  apply('share-whatsapp-label', 'share_whatsapp_label');
  apply('share-linkedin-label', 'share_linkedin_label');
  apply('share-facebook-label', 'share_facebook_label');
  apply('share-telegram-label', 'share_telegram_label');
  apply('share-sms-label', 'share_sms_label');
  apply('share-email-label', 'share_email_label');
  apply('footer-legal-disclaimer', 'footer_legal_disclaimer');
  apply('footer-link-rules', 'footer_link_rules');
  apply('footer-link-privacy', 'footer_link_privacy');
  apply('footer-link-terms', 'footer_link_terms');
  apply('footer-tech-attribution', 'footer_tech_attribution');

  // Badges and labels in hero/prize/how sections
  apply('how-it-works-badge', 'how_it_works_badge');
  apply('prize-badge', 'prize_badge');
  apply('current-winner-badge', 'current_winner_badge');
  apply('featured-partner-label', 'featured_partner_label');
  apply('your-website-label', 'your_website_label');
  apply('featured-on-viralrefer-label', 'featured_on_viralrefer_label');

  // Lower-visibility but important content (prize pool, rules)
  apply('prize-pool', 'prize_pool');
  apply('rules-text', 'rules_text');
  apply('rules-full-content', 'rules_full');

  // Back-compat wiring for existing seeded keys in 0001_init_rls.sql (hero_title, hero_subtitle, min_referrals_for_claim, prize_pool, rules_text)
  // 8:44 lock: skip hero_title / hero_subtitle CMS overwrite.
  paintPrizeThreshold(
    parseMinReferralsForClaim(content['min_referrals_for_claim'] ?? content['min_referrals']),
  );

  // Note: if value is JSONB object, String() will be "[object Object]" — handle json types in future batch

  // Share message template (used by shareTo)
  const shareTpl = content['share_message_template'];
  if (shareTpl != null && String(shareTpl).trim()) {
    const text = String(shareTpl);
    setShareMessageTemplate(sharePayloadHasBannerRace(text) ? text : LOCKED_SHARE_TEXT);
  } else {
    setShareMessageTemplate(LOCKED_SHARE_TEXT);
  }

  // QR modal title (used by showQRModal)
  const qrModalTitle = content['qr_modal_title'];
  if (qrModalTitle != null && qrModalTitle !== '') {
    setQrModalTitle(String(qrModalTitle));
  }

  applyReferralBaseFromSiteContent(content);

  // Owner → everyone in-app message (optional CMS keys; missing = no banner)
  try {
    const { applyOwnerBroadcast } = await import('./lib/owner-broadcast');
    applyOwnerBroadcast(content as Record<string, unknown>);
  } catch {
    /* non-fatal */
  }

  try {
    const { applySiteDropsFromContent, initSiteDropForm } = await import('./lib/site-drops-ui');
    applySiteDropsFromContent(content as Record<string, unknown>);
    initSiteDropForm();
  } catch {
    /* non-fatal — 8:44 homepage may omit drop nodes */
  }

  // Apply any dynamic text colors from site_content (color_* keys) — wired via the colors module
  applyTextColors(content);
}

/** Apply referral_base_url from site_content (pure seam — tested independently). */
export function applyReferralBaseFromSiteContent(content: Record<string, unknown>): void {
  const referralBase = content['referral_base_url'];
  if (referralBase != null && referralBase !== '') {
    setReferralBaseUrl(String(referralBase));
  } else {
    setReferralBaseUrl('https://www.viralrefer.app');
  }
}

registerGlobal('updatePublicContent', updatePublicContent);