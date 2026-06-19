import { initApp } from './app';
import { initRedditTracking } from './lib/reddit-tracking';

// Public layer (all onclick handlers, modals, debug, etc.)
import { initPublic } from './public';

console.log('%c[ViralRefer] main.ts module loaded', 'color:#64748b');

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

initRedditTracking();
initPublic();
initApp();
