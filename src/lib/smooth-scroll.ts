/**
 * Butter-smooth, motion-aware scrolling for first-visit + referred funnel.
 * Never throws; safe on SSR / missing elements.
 */

export function prefersReducedMotion(win: Window = window): boolean {
  try {
    if (typeof document !== 'undefined' && document.documentElement.hasAttribute('data-vr-reduced-motion')) {
      return true;
    }
    return win.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

/** True when most of the element is already in the visual viewport. */
export function isElementMostlyVisible(
  el: Element,
  opts?: { topPad?: number; bottomPad?: number; win?: Window },
): boolean {
  const win = opts?.win ?? window;
  const topPad = opts?.topPad ?? 88;
  const bottomPad = opts?.bottomPad ?? 96;
  const rect = el.getBoundingClientRect();
  const vh = win.innerHeight || 0;
  if (rect.height <= 0 || vh <= 0) return false;
  const visibleTop = Math.max(rect.top, topPad);
  const visibleBottom = Math.min(rect.bottom, vh - bottomPad);
  const visible = Math.max(0, visibleBottom - visibleTop);
  return visible >= Math.min(rect.height, 72) * 0.55;
}

export type SmoothScrollBlock = 'start' | 'center' | 'end' | 'nearest';

/**
 * Smooth-scroll to an element only when needed.
 * Uses instant scroll when reduced-motion is preferred.
 */
export function smoothScrollToElement(
  el: Element | null | undefined,
  opts?: {
    block?: SmoothScrollBlock;
    force?: boolean;
    win?: Window;
    delayMs?: number;
  },
): void {
  if (!el || typeof window === 'undefined') return;
  const win = opts?.win ?? window;
  const block = opts?.block ?? 'center';
  const force = opts?.force === true;
  const delayMs = Math.max(0, opts?.delayMs ?? 0);

  const run = () => {
    try {
      if (!force && isElementMostlyVisible(el, { win })) return;
      const behavior: ScrollBehavior = prefersReducedMotion(win) ? 'auto' : 'smooth';
      el.scrollIntoView({ behavior, block });
    } catch {
      /* ignore */
    }
  };

  if (delayMs > 0) {
    window.setTimeout(() => requestAnimationFrame(run), delayMs);
  } else {
    requestAnimationFrame(() => requestAnimationFrame(run));
  }
}

export function smoothScrollToId(
  id: string,
  opts?: {
    block?: SmoothScrollBlock;
    force?: boolean;
    delayMs?: number;
    fallbackIds?: string[];
  },
): void {
  const ids = [id, ...(opts?.fallbackIds || [])];
  let el: Element | null = null;
  for (const candidate of ids) {
    el = document.getElementById(candidate);
    if (el) break;
  }
  smoothScrollToElement(el, opts);
}
