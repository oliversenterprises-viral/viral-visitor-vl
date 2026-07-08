/**
 * Mobile viewport + touch helpers — iOS dvh fix, coarse-pointer detection.
 */

export function computeViewportHeight(win: Window = window): number {
  return win.visualViewport?.height ?? win.innerHeight;
}

/** Set --vr-vh for stable full-height layouts when mobile browser chrome shows/hides. */
export function applyViewportHeightVar(
  height = computeViewportHeight(),
  root: HTMLElement = document.documentElement,
): void {
  const vhUnit = Math.round(height) / 100;
  root.style.setProperty('--vr-vh', `${Math.round(height)}px`);
  root.style.setProperty('--vr-vh-unit', `${vhUnit}px`);
}

export function isCoarsePointer(win: Window = window): boolean {
  return win.matchMedia('(pointer: coarse)').matches;
}

export function isNarrowViewport(maxWidth = 767, win: Window = window): boolean {
  return win.matchMedia(`(max-width: ${maxWidth}px)`).matches;
}

let resizeBound = false;

/** Bootstrap mobile optimizations (idempotent). */
export function initMobileOptimize(win: Window = window): void {
  if (typeof document === 'undefined') return;

  const root = document.documentElement;
  applyViewportHeightVar(computeViewportHeight(win), root);

  if (isCoarsePointer(win)) {
    root.setAttribute('data-vr-touch', '1');
  }

  if (isNarrowViewport(767, win)) {
    root.setAttribute('data-vr-mobile', '1');
  }

  if (resizeBound) return;
  resizeBound = true;

  const onResize = () => {
    applyViewportHeightVar(computeViewportHeight(win), root);
    if (isNarrowViewport(767, win)) root.setAttribute('data-vr-mobile', '1');
    else root.removeAttribute('data-vr-mobile');
  };

  win.addEventListener('resize', onResize, { passive: true });
  win.visualViewport?.addEventListener('resize', onResize, { passive: true });
}