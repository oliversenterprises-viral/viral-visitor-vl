/**
 * Public layer — everything the public HTML depends on via onclick / global.
 *
 * ## Usage
 * - Call `initPublic()` early during app bootstrap to register all global handlers.
 * - The core public action functions are re-exported for programmatic use if needed.
 *
 * ## Available exports
 * - `initPublic()`
 * - `shareTo(platform)`
 * - `claimBanner()`
 * - `joinViaReferral()`
 * - `simulateNewReferral()`
 * - `debugReferral()`
 */
import './modals';
import './handlers';
import './debug';
import '../timer';

export function initPublic(): void {
  // All registration happens via the side-effect imports above.
  // This function exists for explicit, readable initialization flow.
}

// Re-export the main public action functions for programmatic use
export {
  shareTo,
  claimBanner,
  joinViaReferral,
} from './handlers';

export {
  simulateNewReferral,
  debugReferral,
} from './debug';
