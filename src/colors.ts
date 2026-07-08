/**
 * Text Colors / Dynamic Color System
 *
 * This module handles the admin-controllable text colors using CSS custom properties.
 * Any key in site_content starting with "color_" gets mapped to a --text-* variable.
 */

export interface ColorControl {
  group: string;
  key: string;
  label: string;
  default: string;
}

/**
 * Applies admin-controlled text colors from site_content.
 * Any key starting with "color_" becomes a CSS variable:
 *   color_prize_title      →  --text-prize-title
 *   color_minimum_label    →  --text-minimum-label
 *   etc.
 */
export function applyTextColors(content: Record<string, any>) {
  if (!content || typeof content !== 'object') return;

  const root = document.documentElement;
  let count = 0;

  Object.keys(content).forEach((key) => {
    if (key.startsWith('color_')) {
      const cssVarName = '--text-' + key.replace(/^color_/, '').replace(/_/g, '-');
      const value = content[key];
      if (value != null && String(value).trim() !== '') {
        root.style.setProperty(cssVarName, String(value).trim());
        count++;
      }
    }
  });

  if (count > 0) {
    // console.log(`[ViralRefer] Applied ${count} dynamic text colors from site_content`); // silenced for prod (audit)
  }
}

/**
 * Returns the full list of color controls shown in the Text Colors admin tab.
 * This is the single source of truth for what colors can be edited.
 */
export function getColorControls(): ColorControl[] {
  return [
    // Hero
    { group: 'Hero', key: 'color_hero_badge', label: 'Hero Badge', default: '#e0e7ff' },
    { group: 'Hero', key: 'color_hero_title', label: 'Hero Main Title', default: '#ffffff' },
    { group: 'Hero', key: 'color_hero_accent', label: 'Hero Accent / Highlights', default: '#c084fc' },

    // Prize Cards
    { group: 'Prize Cards', key: 'color_prize_badge', label: 'PREMIUM PRIZE Badge', default: '#fbbf24' },
    { group: 'Prize Cards', key: 'color_prize_title', label: 'Left Prize Title', default: '#ffffff' },
    { group: 'Prize Cards', key: 'color_prize_banner_title', label: 'Right Banner Title', default: '#ffffff' },
    { group: 'Prize Cards', key: 'color_minimum_label', label: 'Minimum / Referrals Labels', default: '#c4b4ff' },
    { group: 'Prize Cards', key: 'color_instant_label', label: 'Instant / Cash App Labels', default: '#34d399' },

    // How it Works
    { group: 'How it Works', key: 'color_how_badge', label: 'How it Works Badge', default: '#a5b4fc' },
    { group: 'How it Works', key: 'color_how_title', label: 'How it Works Main Title', default: '#ffffff' },
    { group: 'How it Works', key: 'color_how_step_title', label: 'Step Titles (1. 2. 3.)', default: '#ffffff' },

    // Leaderboard & Referral
    { group: 'Leaderboard & Referral', key: 'color_leaderboard_title', label: 'Leaderboard Title', default: '#ffffff' },
    { group: 'Leaderboard & Referral', key: 'color_stats_title', label: 'Your Stats Title', default: '#ffffff' },
    { group: 'Leaderboard & Referral', key: 'color_activity_title', label: 'Recent Activity Title', default: '#ffffff' },
    { group: 'Leaderboard & Referral', key: 'color_referral_heading', label: 'Referral / Winning Link Headings', default: '#ffffff' },
    { group: 'Leaderboard & Referral', key: 'color_referral_link', label: 'Referral Link Text (the URL itself)', default: '#15803d' },
    { group: 'Leaderboard & Referral', key: 'color_referral_link_icon', label: 'Referral Link Icon', default: '#a1a1aa' },
    { group: 'Leaderboard & Referral', key: 'color_referral_qr_icon', label: 'QR Icon (next to COPY button)', default: '#a1a1aa' },
    { group: 'Leaderboard & Referral', key: 'color_referral_copy_btn_bg', label: 'Copy Button Background', default: '#7c3aed' },
    { group: 'Leaderboard & Referral', key: 'color_referral_copy_btn_text', label: 'Copy Button Text & Icon', default: '#ffffff' },
    { group: 'Leaderboard & Referral', key: 'color_referral_qr_border', label: 'QR Code Border', default: 'rgba(255,255,255,0.1)' },
    { group: 'Leaderboard & Referral', key: 'color_referral_input_border', label: 'Referral Input Container Border', default: 'rgba(255,255,255,0.2)' },
    { group: 'Leaderboard & Referral', key: 'color_qr_scan_text', label: 'QR "Scan to share" Text', default: '#34d399' },
    { group: 'Leaderboard & Referral', key: 'color_qr_show_larger_bg', label: 'Show Larger QR Button BG', default: 'rgba(255,255,255,0.05)' },
    { group: 'Leaderboard & Referral', key: 'color_qr_show_larger_text', label: 'Show Larger QR Button Text', default: '#d4d4d8' },

    // Funnel Journey
    { group: 'Funnel Journey', key: 'color_funnel_active', label: 'Active Step Text', default: '#e9d5ff' },
    { group: 'Funnel Journey', key: 'color_funnel_done', label: 'Completed Step Text', default: '#34d399' },
    { group: 'Funnel Journey', key: 'color_funnel_coach', label: 'Coach Strip Text', default: '#e4e4e7' },
    { group: 'Funnel Journey', key: 'color_funnel_arrow', label: 'Step Arrow (active flow)', default: '#a78bfa' },

    // Sharing & Footer
    { group: 'Sharing & Footer', key: 'color_share_label', label: 'Share Button Labels', default: '#d4d4d8' },
    { group: 'Sharing & Footer', key: 'color_footer', label: 'Footer & Legal Text', default: '#a1a1aa' },
  ];
}

// Also re-export applyTextColors under a namespace-friendly name if needed
export { applyTextColors as applyDynamicTextColors };

/**
 * Returns the authoritative default values for all text color CSS variables.
 * This is now the single source of truth (used by seed + fallbacks + admin reset).
 */
export function getDefaultTextColorVars(): Record<string, string> {
  return {
    '--text-hero-badge': '#e0e7ff',
    '--text-hero-title': '#ffffff',
    '--text-hero-accent': '#c084fc',
    '--text-prize-title': '#ffffff',
    '--text-prize-description': '#d4d4d8',
    '--text-minimum-label': '#c4b4ff',
    '--text-instant-label': '#34d399',
    '--text-prize-badge': '#fbbf24',
    '--text-prize-banner-title': '#ffffff',
    '--text-prize-banner-description': '#d4d4d8',
    '--text-current-winner-badge': '#ffffff',
    '--text-how-badge': '#a5b4fc',
    '--text-how-title': '#ffffff',
    '--text-how-step-title': '#ffffff',
    '--text-step-desc': '#a1a1aa',
    '--text-heading': '#ffffff',
    '--text-muted': '#a1a1aa',
    '--text-accent-violet': '#c4b4ff',
    '--text-accent-emerald': '#34d399',
    '--text-share-label': '#d4d4d8',
    '--text-footer': '#a1a1aa',
    '--text-leaderboard-title': '#ffffff',
    '--text-stats-title': '#ffffff',
    '--text-activity-title': '#ffffff',
    '--text-referral-heading': '#ffffff',
    '--text-referral-link': '#34d399',
    '--text-referral-link-icon': '#a1a1aa',
    '--referral-copy-btn-bg': '#7c3aed',
    '--referral-copy-btn-text': '#ffffff',
    '--referral-qr-border': 'rgba(255, 255, 255, 0.1)',
    '--referral-input-border': 'rgba(255, 255, 255, 0.2)',
    '--qr-scan-text': '#34d399',
    '--qr-show-larger-bg': 'rgba(255, 255, 255, 0.05)',
    '--qr-show-larger-text': '#d4d4d8',
    '--referral-qr-icon': '#a1a1aa',
    '--text-funnel-active': '#e9d5ff',
    '--text-funnel-done': '#34d399',
    '--text-funnel-coach': '#e4e4e7',
    '--text-funnel-arrow': '#a78bfa',
  };
}

/**
 * Seeds all critical text color CSS variables with safe defaults.
 * Call this as early as possible (top of main.ts) so first paint is always correct,
 * even before any Supabase fetch or admin overrides.
 * This is the key defense against the "dark text on dark hero" class of bugs.
 */
export function seedDefaultTextColors(): void {
  const root = document.documentElement;
  const defaults = getDefaultTextColorVars();

  Object.entries(defaults).forEach(([varName, value]) => {
    // Only set if not already explicitly overridden by admin/DB this session
    if (!root.style.getPropertyValue(varName)) {
      root.style.setProperty(varName, value);
    }
  });
}

/**
 * Clears any admin overrides (used on full reset in admin tab).
 */
export function clearAllTextColorOverrides(): void {
  const root = document.documentElement;
  const defaults = getDefaultTextColorVars();

  Object.keys(defaults).forEach((varName) => {
    root.style.removeProperty(varName);
  });
}
