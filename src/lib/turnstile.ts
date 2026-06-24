/**
 * Shared Cloudflare Turnstile helpers (referral recording + prize claim).
 */

const TURNSTILE_SCRIPT_URL = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
const TURNSTILE_SITEKEY = import.meta.env.VITE_TURNSTILE_SITEKEY || '';
const DEFAULT_TOKEN_TIMEOUT_MS = 30_000;

type TurnstileApi = {
  render: (el: HTMLElement, opts: Record<string, unknown>) => string;
  execute: (target: string | HTMLElement) => void;
  remove: (widgetId: string) => void;
  reset: (widgetId: string) => void;
};

export type TurnstileRenderOptions = {
  /** Use invisible widget (requires visible container + execute on some browsers). */
  invisible?: boolean;
  /** Reject if no token within this window (avoids hung recording). */
  timeoutMs?: number;
  size?: 'normal' | 'compact' | 'flexible';
  theme?: 'light' | 'dark' | 'auto';
  appearance?: 'always' | 'execute' | 'interaction-only';
  action?: string;
};

export function getTurnstileSiteKey(): string {
  return TURNSTILE_SITEKEY;
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
  siteKey: string = TURNSTILE_SITEKEY,
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

    if (options.invisible) {
      renderOpts.size = 'invisible';
    } else {
      renderOpts.size = options.size ?? 'compact';
    }

    try {
      widgetId = api.render(widgetDiv, renderOpts);
      if (options.invisible && api.execute) {
        window.setTimeout(() => {
          try {
            api.execute(widgetId!);
          } catch {
            try {
              api.execute(widgetDiv);
            } catch {
              // render-mode invisible may still auto-run
            }
          }
        }, 0);
      }
    } catch (err) {
      finish(() => reject(err instanceof Error ? err : new Error(String(err))));
    }
  });
}

/**
 * Best-effort Turnstile token for referral hardening. Never blocks recording — returns null on failure/timeout.
 */
export async function tryOptionalTurnstileToken(timeoutMs = 2500): Promise<string | null> {
  if (!TURNSTILE_SITEKEY) return null;

  const container = document.createElement('div');
  container.setAttribute('aria-hidden', 'true');
  container.style.cssText =
    'position:fixed;left:0;bottom:0;width:1px;height:1px;opacity:0;pointer-events:none;z-index:-1;';
  document.body.appendChild(container);

  try {
    await ensureTurnstileReady();
    const token = await Promise.race([
      getTurnstileToken(container, TURNSTILE_SITEKEY, 'optional referral', {
        invisible: true,
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