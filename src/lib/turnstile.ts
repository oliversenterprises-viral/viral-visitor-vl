/**
 * Shared Cloudflare Turnstile helpers (referral recording + prize claim).
 */

const TURNSTILE_SCRIPT_URL = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
function readTurnstileSiteKey(): string {
  return String(import.meta.env.VITE_TURNSTILE_SITEKEY || '').trim();
}
const DEFAULT_TOKEN_TIMEOUT_MS = 30_000;

type TurnstileApi = {
  render: (el: HTMLElement, opts: Record<string, unknown>) => string;
  execute: (target: string | HTMLElement) => void;
  remove: (widgetId: string) => void;
  reset: (widgetId: string) => void;
};

/** Cloudflare Turnstile sizes — "invisible" was removed and now errors. */
export const TURNSTILE_SIZES = ['compact', 'flexible', 'normal'] as const;
export type TurnstileSize = (typeof TURNSTILE_SIZES)[number];

export type TurnstileRenderOptions = {
  /** Reject if no token within this window (avoids hung recording). */
  timeoutMs?: number;
  size?: TurnstileSize;
  theme?: 'light' | 'dark' | 'auto';
  appearance?: 'always' | 'execute' | 'interaction-only';
  action?: string;
  /** Call turnstile.execute after render (managed execute appearance). */
  execute?: boolean;
};

export function normalizeTurnstileSize(raw: unknown): TurnstileSize {
  const size = String(raw || '').trim().toLowerCase();
  if (size === 'flexible' || size === 'normal') return size;
  return 'compact';
}

export function getTurnstileSiteKey(): string {
  return readTurnstileSiteKey();
}

function getTurnstileApi(): TurnstileApi | null {
  return (window as { turnstile?: TurnstileApi }).turnstile ?? null;
}

function waitForTurnstileApi(maxMs = 15_000): Promise<void> {
  if (getTurnstileApi()) return Promise.resolve();

  return new Promise((resolve) => {
    const started = Date.now();
    const tick = () => {
      if (getTurnstileApi()) {
        resolve();
        return;
      }
      if (Date.now() - started >= maxMs) {
        resolve();
        return;
      }
      requestAnimationFrame(tick);
    };
    tick();
  });
}

/** Load Turnstile API script if not already present. */
export async function ensureTurnstileReady(): Promise<void> {
  if (getTurnstileApi()) return;

  const existing = document.querySelector('script[src*="turnstile"]');
  if (existing) {
    await new Promise<void>((resolve) => {
      existing.addEventListener('load', () => resolve(), { once: true });
      setTimeout(resolve, 10_000);
    });
    await waitForTurnstileApi();
    return;
  }

  await new Promise<void>((resolve) => {
    const script = document.createElement('script');
    script.src = TURNSTILE_SCRIPT_URL;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => resolve();
    document.head.appendChild(script);
  });
  await waitForTurnstileApi();
}

/** Remove a rendered widget before re-render (safe between retries). */
export function removeTurnstileWidget(widgetId: string | null | undefined): void {
  if (!widgetId) return;
  try {
    getTurnstileApi()?.remove(widgetId);
  } catch {
    // non-fatal
  }
}

/** Render widget in container and resolve with token (dev bypass when no sitekey). */
export function getTurnstileToken(
  container: HTMLElement,
  siteKey: string = readTurnstileSiteKey(),
  devBypassLabel = 'Turnstile',
  options: TurnstileRenderOptions = {},
): Promise<string> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TOKEN_TIMEOUT_MS;

  return new Promise((resolve, reject) => {
    if (!siteKey) {
      console.warn(`[ViralRefer] VITE_TURNSTILE_SITEKEY not set — skipping ${devBypassLabel}`);
      resolve('dev-bypass-token');
      return;
    }

    const api = getTurnstileApi();
    if (!api?.render) {
      reject(new Error('Turnstile API not available'));
      return;
    }

    let settled = false;
    let widgetId: string | null = null;

    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      fn();
    };

    const timer = window.setTimeout(() => {
      finish(() => {
        removeTurnstileWidget(widgetId);
        reject(new Error('Turnstile timed out — please try again'));
      });
    }, timeoutMs);

    container.innerHTML = '';
    const widgetDiv = document.createElement('div');
    container.appendChild(widgetDiv);

    const renderOpts: Record<string, unknown> = {
      sitekey: siteKey,
      theme: options.theme ?? 'dark',
      appearance: options.appearance ?? 'interaction-only',
      callback: (token: string) => finish(() => resolve(token)),
      'error-callback': (code?: string) =>
        finish(() => {
          removeTurnstileWidget(widgetId);
          reject(new Error(`Turnstile verification failed${code ? ` (${code})` : ''}`));
        }),
      'expired-callback': () =>
        finish(() => {
          removeTurnstileWidget(widgetId);
          reject(new Error('Turnstile expired — please try again'));
        }),
      'timeout-callback': () =>
        finish(() => {
          removeTurnstileWidget(widgetId);
          reject(new Error('Turnstile challenge timed out'));
        }),
    };

    if (options.action) renderOpts.action = options.action;

    const size = normalizeTurnstileSize(options.size);
    renderOpts.size = size;

    const shouldExecute =
      options.execute === true || options.appearance === 'execute';

    try {
      widgetId = api.render(widgetDiv, renderOpts);
      if (shouldExecute && api.execute) {
        window.setTimeout(() => {
          try {
            api.execute(widgetId!);
          } catch {
            try {
              api.execute(widgetDiv);
            } catch {
              // appearance:execute may still auto-run
            }
          }
        }, 0);
      }
    } catch (err) {
      finish(() => reject(err instanceof Error ? err : new Error(String(err))));
    }
  });
}

function hostIsUsable(el: HTMLElement | null): el is HTMLElement {
  if (!el) return false;
  if (el.hidden || el.classList.contains('hidden')) return false;
  if (el.style.display === 'none' || el.style.visibility === 'hidden') return false;
  return true;
}

function hostIsPainted(el: HTMLElement | null): el is HTMLElement {
  if (!hostIsUsable(el)) return false;
  try {
    const style = window.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
      return false;
    }
    const r = el.getBoundingClientRect();
    if (r.width < 130 || r.height < 50) return false;
    return true;
  } catch {
    return true;
  }
}

function prepareVisibleTurnstileHost(container: HTMLElement): void {
  container.hidden = false;
  container.removeAttribute('hidden');
  container.classList.remove('hidden');
  if (container.style.display === 'none') container.style.removeProperty('display');
  if (container.style.visibility === 'hidden') container.style.removeProperty('visibility');
  if (container.style.opacity === '0') container.style.removeProperty('opacity');
  container.classList.add('referral-credit-turnstile');
}

function resolveCreditTurnstileHost(container: HTMLElement): HTMLElement {
  const section = document.getElementById('referral-section');
  if (hostIsUsable(section) && hostIsPainted(section)) return section;
  if (hostIsPainted(container.parentElement as HTMLElement | null)) {
    return container.parentElement as HTMLElement;
  }
  return document.body;
}

/**
 * Token for record-referral. Server requires Turnstile — do not POST without one
 * when a site key is configured. Empty site key (local/unit) uses the same
 * dev-bypass token as claims; production always has a site key.
 *
 * Cloudflare rejects size "invisible" and widgets hidden with display:none /
 * opacity:0 / 1×1 boxes. Friend /r/ credit uses a visible compact widget.
 */
export async function getCreditTurnstileToken(timeoutMs = 20_000): Promise<string | null> {
  const siteKey = readTurnstileSiteKey();
  if (!siteKey) return 'dev-bypass-token';

  const existing = document.getElementById('referral-turnstile-container');
  let container = existing;
  let created = false;
  if (!container) {
    container = document.createElement('div');
    container.id = 'referral-turnstile-container';
    created = true;
  }
  const host = resolveCreditTurnstileHost(container);
  if (container.parentElement !== host) host.appendChild(container);
  prepareVisibleTurnstileHost(container);

  try {
    await ensureTurnstileReady();
    const token = await getTurnstileToken(container, siteKey, 'referral credit', {
      size: 'compact',
      appearance: 'always',
      timeoutMs,
      action: 'record-referral',
    });
    return typeof token === 'string' && token ? token : null;
  } catch {
    return null;
  } finally {
    if (created) container.remove();
  }
}

export async function tryOptionalTurnstileToken(timeoutMs = 2500): Promise<string | null> {
  if (!readTurnstileSiteKey()) return null;

  const container = document.createElement('div');
  container.className = 'referral-credit-turnstile';
  document.body.appendChild(container);
  prepareVisibleTurnstileHost(container);

  try {
    await ensureTurnstileReady();
    const token = await Promise.race([
      getTurnstileToken(container, readTurnstileSiteKey(), 'optional referral', {
        size: 'compact',
        appearance: 'always',
        timeoutMs,
      }),
      new Promise<null>((resolve) => window.setTimeout(() => resolve(null), timeoutMs)),
    ]);
    return typeof token === 'string' && token ? token : null;
  } catch {
    return null;
  } finally {
    container.remove();
  }
}