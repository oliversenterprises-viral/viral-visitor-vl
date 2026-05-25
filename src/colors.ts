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
    console.log(`[ViralRefer] Applied ${count} dynamic text colors from site_content`);
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

    // Sharing & Footer
    { group: 'Sharing & Footer', key: 'color_share_label', label: 'Share Button Labels', default: '#d4d4d8' },
    { group: 'Sharing & Footer', key: 'color_footer', label: 'Footer & Legal Text', default: '#a1a1aa' },
  ];
}

// Also re-export applyTextColors under a namespace-friendly name if needed
export { applyTextColors as applyDynamicTextColors };
