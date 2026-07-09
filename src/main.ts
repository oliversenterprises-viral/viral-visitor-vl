import { initApp } from './app';
import { applyClientReferralOgMeta, scheduleReferralOgEnrichment } from './lib/client-og-meta';
import { initOrganicSeo } from './lib/organic-seo';
import { captureReferralAttribution, revealReferralAttributionBanner } from './lib/referral-url';
import { initFunnelConversion } from './lib/funnel-conversion';
import { initAttributedReferralRecording, syncMobileReferralCta } from './referral';
import { captureUtmAttribution } from './lib/utm-attribution';
import { initVisitorTracking } from './lib/visitor-tracking';
import { initInteractionTracking } from './lib/interaction-tracking';
import { initVisitorSlim } from './lib/visitor-slim';
import { initMobileOptimize } from './lib/mobile-optimize';
import { initPublicClarity, refreshPublicClarityState } from './lib/public-clarity';
import { initPublicPolish } from './lib/public-polish';
import { initEmbedMode } from './lib/embed-mode';
import { initViralLoops } from './lib/viral-loops';
import { initI18n } from './lib/i18n';

// Public layer (all onclick handlers, modals, debug, etc.)
import { initPublic } from './public';

// === ROBUST COLOR SYSTEM ===
// Seed safe defaults for ALL --text-* variables as early as possible.
// This guarantees the hero title (and all other dynamic text) never goes dark/invisible
// even if Supabase fetch is slow, fails, or no color_* keys exist yet in site_content.
import { seedDefaultTextColors } from './colors';
seedDefaultTextColors();
initEmbedMode();
initMobileOptimize();
initPublicPolish();
initPublicClarity();
// Phase 1 i18n — browser language + picker (English fallback; never blocks)
try {
  initI18n();
} catch (err) {
  console.warn('[ViralRefer] i18n init skipped:', err);
}

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
captureUtmAttribution();
revealReferralAttributionBanner();
initFunnelConversion();
initViralLoops();
initVisitorSlim();
initAttributedReferralRecording();
initVisitorTracking();
initInteractionTracking();
initOrganicSeo();
applyClientReferralOgMeta();
scheduleReferralOgEnrichment();
initPublic();
initApp().catch((err) => {
  console.warn('[ViralRefer] initApp failed (degraded mode):', err);
}).finally(() => {
  document.documentElement.setAttribute('data-vr-ready', '1');
  syncMobileReferralCta();
  refreshPublicClarityState();
});
