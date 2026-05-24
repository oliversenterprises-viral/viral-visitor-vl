import {
  setReferralBaseUrl,
  getReferralBaseUrl,
  setShareMessageTemplate,
  setQrModalTitle,
} from './public/globals';

import { applyTextColors } from './colors';

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
    console.log('[ViralRefer] Using custom referral_base_url:', getReferralBaseUrl());
  } else {
    // Default base URL for referral links (you can override this via Admin → Edit Content with key "referral_base_url")
    setReferralBaseUrl('https://viralrefer.app');
    console.log('[ViralRefer] Using default referral_base_url:', getReferralBaseUrl());
  }

  // Apply any dynamic text colors from site_content (color_* keys) — wired via the colors module
  applyTextColors(content);
}