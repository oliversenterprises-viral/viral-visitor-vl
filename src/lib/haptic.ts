/** Light haptic feedback on supported mobile browsers (best-effort). */
export function tryHapticPulse(pattern: number | number[] = 12): void {
  if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return;
  try {
    navigator.vibrate(pattern);
  } catch {
    /* blocked or unsupported */
  }
}