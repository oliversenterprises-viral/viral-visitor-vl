/**
 * Traffic-exchange iframe embed — compact /embed route (frame-allowed via vercel.json).
 */

const EMBED_PATH_RE = /^\/embed\/?$/i;

export function isEmbedPathname(pathname: string): boolean {
  return EMBED_PATH_RE.test(pathname);
}

/** True on /embed or ?embed=1 / ?iframe=1 (latter only affects layout when not frame-blocked). */
export function isEmbedMode(loc: Location = location): boolean {
  if (EMBED_PATH_RE.test(loc.pathname)) return true;
  const params = new URLSearchParams(loc.search);
  return params.get('embed') === '1' || params.get('iframe') === '1';
}

/** Default UTMs when /embed has no attribution params. */
export function ensureEmbedDefaultUtms(loc: Location = location): void {
  if (!EMBED_PATH_RE.test(loc.pathname)) return;
  const params = new URLSearchParams(loc.search);
  if (params.get('utm_source')) return;

  params.set('utm_source', 'traffic_exchange');
  params.set('utm_medium', 'iframe');
  params.set('utm_campaign', 'embed');
  const next = `${loc.pathname}?${params.toString()}${loc.hash}`;
  history.replaceState(null, '', next);
}

function injectEmbedChrome(): void {
  if (document.getElementById('vr-embed-bar')) return;

  const bar = document.createElement('div');
  bar.id = 'vr-embed-bar';
  bar.className = 'vr-embed-bar';
  bar.innerHTML = `
    <span class="vr-embed-bar-label">ViralRefer contest</span>
    <a class="vr-embed-bar-link" href="https://www.viralrefer.app/?utm_source=traffic_exchange&utm_medium=iframe_exit&utm_campaign=embed" target="_top" rel="noopener">
      Open full site ↗
    </a>
  `;
  document.body.prepend(bar);
}

/** Bootstrap embed layout (call before UTM capture). */
export function initEmbedMode(loc: Location = location): void {
  if (!isEmbedMode(loc)) return;

  document.documentElement.setAttribute('data-vr-embed', '1');
  if (window.top !== window.self) {
    document.documentElement.setAttribute('data-vr-in-iframe', '1');
  }

  ensureEmbedDefaultUtms(loc);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectEmbedChrome, { once: true });
  } else {
    injectEmbedChrome();
  }
}