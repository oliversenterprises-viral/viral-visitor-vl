/**
 * Elite vClock Replica — Public entry + registration
 * Non-breaking integration via existing global + public side-effect pattern.
 */

import { registerGlobal } from '../lib/global';
import * as Engine from './engine';
import { openTimerOverlay, closeTimerOverlay, refreshTimerUI } from './ui';

// Register the launcher (onclick="openTimer()" works immediately)
export function openTimer() {
  openTimerOverlay();
}

// Also provide a namespaced version
registerGlobal('openTimer', openTimer);
registerGlobal('closeTimer', closeTimerOverlay);

// Optional: allow deep link control e.g. ViralRefer.openTimerWith({durationMs: 300000})
registerGlobal('openTimerWith', (cfg: unknown) => {
  if (cfg && typeof cfg === 'object') {
    const opts = cfg as { durationMs?: unknown; label?: unknown; soundKey?: unknown };
    if (typeof opts.durationMs === 'number') Engine.setDuration(opts.durationMs);
    if (typeof opts.label === 'string') Engine.setLabel(opts.label);
    if (typeof opts.soundKey === 'string') Engine.setSound(opts.soundKey);
  }
  openTimerOverlay();
});

// Side-effect: also expose a tiny refresh hook (used by embed flow if needed)
registerGlobal('refreshEliteTimer', refreshTimerUI);

// Auto side-effect import registers everything when public/index pulls this in.
export { openTimerOverlay, closeTimerOverlay };
