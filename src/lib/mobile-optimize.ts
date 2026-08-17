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

export function isShortViewport(maxHeight = 740, win: Window = window): boolean {
  return win.matchMedia(`(max-height: ${maxHeight}px)`).matches;
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

  if (isShortViewport(740, win)) {
    root.setAttribute('data-vr-short', '1');
  }
  if (isShortViewport(500, win)) {
    root.setAttribute('data-vr-tiny', '1');
  }

  try {
    if (win.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      root.setAttribute('data-vr-reduced-motion', '1');
    }
  } catch {
    /* ignore */
  }

  if (resizeBound) return;
  resizeBound = true;

  const onResize = () => {
    applyViewportHeightVar(computeViewportHeight(win), root);
    if (isNarrowViewport(767, win)) root.setAttribute('data-vr-mobile', '1');
    else root.removeAttribute('data-vr-mobile');
    if (isShortViewport(740, win)) root.setAttribute('data-vr-short', '1');
    else root.removeAttribute('data-vr-short');
    if (isShortViewport(500, win)) root.setAttribute('data-vr-tiny', '1');
    else root.removeAttribute('data-vr-tiny');
  };

  win.addEventListener('resize', onResize, { passive: true });
  win.visualViewport?.addEventListener('resize', onResize, { passive: true });

  try {
    const mq = win.matchMedia('(prefers-reduced-motion: reduce)');
    const onMotion = () => {
      if (mq.matches) root.setAttribute('data-vr-reduced-motion', '1');
      else root.removeAttribute('data-vr-reduced-motion');
    };
    mq.addEventListener?.('change', onMotion);
  } catch {
    /* ignore */
  }
}