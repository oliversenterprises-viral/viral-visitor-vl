import { initApp } from './app';
import { captureReferralAttribution, revealReferralAttributionBanner } from './lib/referral-url';
import { initAttributedReferralRecording, syncMobileReferralCta } from './referral';
import { initRedditTracking } from './lib/reddit-tracking';
import { initVisitorTracking } from './lib/visitor-tracking';

// Public layer (all onclick handlers, modals, debug, etc.)
import { initPublic } from './public';

// === ROBUST COLOR SYSTEM ===
// Seed safe defaults for ALL --text-* variables as early as possible.
// This guarantees the hero title (and all other dynamic text) never goes dark/invisible
// even if Supabase fetch is slow, fails, or no color_* keys exist yet in site_content.
import { seedDefaultTextColors } from './colors';
seedDefaultTextColors();

// console.log('%c[ViralRefer] main.ts module loaded', 'color:#64748b'); // silenced for prod (audit cleanup)

// =====================================================
// VIRALREFER PREMIUM — main.ts (pure bootstrap)
// =====================================================
//
// This file intentionally contains almost nothing.
// See ARCHITECTURE.md for the full picture.
//
// Only responsibilities:
//   - Call explicit initializers (public registrations + app bootstrap)
// =====================================================

captureReferralAttribution();
revealReferralAttributionBanner();
initAttributedReferralRecording();
initRedditTracking();
initVisitorTracking();
initPublic();
initApp().catch((err) => {
  console.warn('[ViralRefer] initApp failed (degraded mode):', err);
}).finally(() => {
  document.documentElement.setAttribute('data-vr-ready', '1');
  syncMobileReferralCta();
});
