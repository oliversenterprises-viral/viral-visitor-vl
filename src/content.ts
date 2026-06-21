import {
  setReferralBaseUrl,
  setShareMessageTemplate,
  setQrModalTitle,
} from './public/globals';

import { applyTextColors } from './colors';
import { supabase } from './lib/supabase';
import { latestEvents } from './lib/stats-helpers';

export const BANNER_EVENTS_KEY = 'viralrefer_banner_events';

export function getBannerKey(banner: { label?: string; redirectUrl?: string }): string {
  const lab = (banner.label || '').trim();
  const u = (banner.redirectUrl || '').trim();
  return lab && u ? `${lab}|${u}` : (u || lab || 'unknown');
}

export function getLocalBannerEvents(): Array<Record<string, unknown>> {
  try {
    return JSON.parse(localStorage.getItem(BANNER_EVENTS_KEY) || '[]');
  } catch {
    return [];
  }
}

export function clearBannerEvents(): void {
  localStorage.removeItem(BANNER_EVENTS_KEY);
}

export function computeBannerStats(events: Array<Record<string, any>>) {
  const perBannerMap: Record<string, { key: string; label: string; redirectUrl: string; impressions: number; clicks: number }> = {};

  for (const e of events) {
    const key = e.key || getBannerKey(e);
    if (!perBannerMap[key]) {
      perBannerMap[key] = {
        key,
        label: e.label || key.split('|')[0] || 'untitled',
        redirectUrl: e.redirectUrl || e.redirect_url || '',
        impressions: 0,
        clicks: 0,
      };
    }
    const eventType = String(e.type || e.event_type || '').toLowerCase();
    if (eventType === 'impression') perBannerMap[key].impressions++;
    else if (eventType === 'click') perBannerMap[key].clicks++;
  }

  return {
    perBanner: Object.values(perBannerMap),
    lastEvents: latestEvents(events, 5),
    total: events.length,
  };
}

export async function getBannerEventsForStats(): Promise<{
  events: Array<Record<string, any>>;
  source: 'server' | 'local';
  fetchError?: string;
}> {
  const local = getLocalBannerEvents();
  const adminSecret = import.meta.env.VITE_ADMIN_ACTION_SECRET || '';

  if (!adminSecret) {
    return { events: local, source: 'local', fetchError: 'Admin secret not configured in build' };
  }

  try {
    const { data, error } = await supabase.functions.invoke('admin-action', {
      body: { action: 'get_banner_stats' },
      headers: { 'x-admin-secret': adminSecret },
    });
    if (error) {
      return { events: local, source: 'local', fetchError: error.message || 'Server request failed' };
    }
    if (!data?.success) {
      return {
        events: local,
        source: 'local',
        fetchError: String(data?.error || 'get_banner_stats rejected'),
      };
    }
    if (!Array.isArray(data.data)) {
      return { events: local, source: 'local', fetchError: 'Invalid server response' };
    }
    const serverEvents = data.data.map((row: Record<string, any>) => ({
      type: row.type || row.event_type,
      label: row.label || row.banner_label,
      redirectUrl: row.redirect_url || row.redirectUrl,
      key: row.key || (row.additional?.key ?? row.additional?.Key),
      timestamp: row.created_at || row.timestamp,
    }));
    return { events: serverEvents, source: 'server' };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Network error';
    return { events: local, source: 'local', fetchError: msg };
  }
}

// Simple escaping helper to mitigate XSS in user-controlled content (banner, claims)
export function escapeHtml(str: string): string {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Basic banner event tracking (Phase 2 MVP)
 * Logs impression and click events.
 * Stores in localStorage for easy inspection + console output.
 */
function logBannerEvent(type: 'impression' | 'click', banner: any) {
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

// Expose a debug helper globally for admins/devs
(window as any).debugBannerEvents = () => {
  try {
    const events = getLocalBannerEvents();
    console.table(events);
    return events;
  } catch (_) {
    console.log('No banner events recorded yet.');
    return [];
  }
};

// Admin/dev helper: reset rotation counter so you immediately see the first banner again
(window as any).resetBannerRotation = () => {
  localStorage.removeItem('viralrefer_banner_rotation_index');
  console.log('[Banner] Rotation index reset. Reload the page to see banner #1 next.');
};

// Expose rotation helpers for console inspection / manual testing by admins
(window as any).parseBanners = parseBanners;
(window as any).selectBanner = selectBanner;

/**
 * Banner System v2 (Phase 2)
 * Data shape produced by the admin banners array editor + consumed on public site.
 */
export interface Banner {
  imageUrl: string;
  redirectUrl: string;
  label?: string;
  enabled?: boolean;
  weight?: number; // optional positive int; higher = shown more frequently in rotation
}

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
      .map((b: any) => ({
        imageUrl: String(b.imageUrl || '').trim(),
        redirectUrl: String(b.redirectUrl || '').trim(),
        label: b.label ? String(b.label).trim() : undefined,
        enabled: b.enabled !== false,
        weight: (typeof b.weight === 'number' && b.weight > 0) ? Math.floor(b.weight) : 1,
      }))
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
export async function updatePublicContent(content: Record<string, any>) {
  if (!content || typeof content !== 'object') return;

  // Small helper: set textContent if key present (safe, no HTML injection for v1)
  const apply = (elId: string, dbKey: string) => {
    const el = document.getElementById(elId);
    if (!el) return;
    const val = content[dbKey];
    if (val != null && val !== '') {
      // Safe display: primitives as string, objects/arrays as JSON (for future complex content like prize json)
      const display = (typeof val === 'object' && val !== null) ? JSON.stringify(val) : String(val);
      el.textContent = display;
    }
  };

  // HERO batch (granular ids added for safe dynamic updates without breaking gradient/branding)
  apply('hero-badge', 'hero_badge');
  apply('hero-title-line1', 'hero_title_line1');
  apply('hero-title-accent', 'hero_title_accent');
  apply('hero-subtitle', 'hero_subtitle');    // Note: overrides whole p (flattens inner <span>s for styled words; future batch can split)

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
  apply('min-referrals-value', 'min_referrals_for_claim');  // or 'min_referrals' - using seed convention
  apply('cash-amount-value', 'cash_amount');

  // Phase 2 Banner v2: Multiple banners with simple weighted rotation (option #1)
  // Uses parseBanners + selectBanner for clean, testable logic supporting weight field.
  const bannersRaw = content['banners'];
  const parsedBanners = parseBanners(bannersRaw);
  if (parsedBanners.length > 0) {
    const selection = selectBanner(parsedBanners);
    if (selection) {
      const { banner: activeBanner, displayIndex, total } = selection;
      const visualContainer = document.getElementById('prize-banner-visual');
      if (visualContainer) {
        logBannerEvent('impression', activeBanner);

        const link = document.createElement('a');
        link.href = activeBanner.redirectUrl || '#';
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        // LCP/hero-area paint isolation + transform hints (consistent with premium card strategy)
        link.style.contain = 'layout style paint';
        link.style.willChange = 'transform';
        link.className = 'block w-full max-w-[280px] rounded-3xl overflow-hidden shadow-2xl hover:scale-[1.02] transition-transform';

        const img = document.createElement('img');
        img.src = activeBanner.imageUrl;
        img.alt = activeBanner.label || 'Featured Banner';
        img.loading = 'lazy';
        img.className = 'w-full h-auto';
        img.style.backfaceVisibility = 'hidden';

        link.appendChild(img);

        if (activeBanner.label) {
          const labelDiv = document.createElement('div');
          labelDiv.className = 'bg-white/90 text-zinc-900 text-center py-1 text-xs font-medium';
          labelDiv.textContent = activeBanner.label;
          link.appendChild(labelDiv);
        }

        link.addEventListener('click', () => {
          logBannerEvent('click', activeBanner);
        }, { once: true });

        visualContainer.innerHTML = '';
        visualContainer.appendChild(link);

        // Rotation indicator (only when 2+ enabled banners exist)
        if (total > 1) {
          const note = document.createElement('div');
          note.className = 'text-[10px] text-center text-zinc-500 mt-1.5';
          note.textContent = `Showing ${displayIndex + 1} of ${total} (rotates)`;
          visualContainer.appendChild(note);
        }
      }
    }
  }
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
  apply('hero-stats-subtext', 'hero_stats_subtext');
  apply('footer-credit', 'footer_credit');

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
  // These provide immediate value on first load even before new granular keys are added via Admin → Edit Content
  apply('hero-title-accent', 'hero_title');
  apply('hero-subtitle', 'hero_subtitle');
  apply('min-referrals-value', 'min_referrals_for_claim');
  // Back-compat for older seeded keys

  // Note: if value is JSONB object, String() will be "[object Object]" — handle json types in future batch

  // Share message template (used by shareTo)
  const shareTpl = content['share_message_template'];
  if (shareTpl != null && shareTpl !== '') {
    setShareMessageTemplate(String(shareTpl));
  }

  // QR modal title (used by showQRModal)
  const qrModalTitle = content['qr_modal_title'];
  if (qrModalTitle != null && qrModalTitle !== '') {
    setQrModalTitle(String(qrModalTitle));
  }

  // Referral base URL — allows the admin to change the domain or path of the shared referral link
  // Example values: "https://viralrefer.app", "https://mybrand.com/join", "https://landing.mysite.com"
  const referralBase = content['referral_base_url'];
  if (referralBase != null && referralBase !== '') {
    setReferralBaseUrl(String(referralBase));
    // console.log('[ViralRefer] Using custom referral_base_url:', getReferralBaseUrl()); // silenced
  } else {
    // Default base URL for referral links (you can override this via Admin → Edit Content with key "referral_base_url")
    setReferralBaseUrl('https://viralrefer.app');
    // console.log('[ViralRefer] Using default referral_base_url:', getReferralBaseUrl()); // silenced
  }

  // Apply any dynamic text colors from site_content (color_* keys) — wired via the colors module
  applyTextColors(content);
}