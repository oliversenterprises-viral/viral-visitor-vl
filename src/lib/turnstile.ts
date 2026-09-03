/**
 * Shared Cloudflare Turnstile helpers (referral recording + prize claim).
 * Fail-fast: script load, API wait, and token must never hang.
 */

const TURNSTILE_SCRIPT_URL = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
const TURNSTILE_SITEKEY = import.meta.env.VITE_TURNSTILE_SITEKEY || '';

/** Fail-fast window for script + API. Hidden-tab rAF must not be the clock. */
export const TURNSTILE_READY_TIMEOUT_MS = 4_000;
/** Fail-fast window for a rendered widget to produce a token. */
export const DEFAULT_TOKEN_TIMEOUT_MS = 8_000;
export const HUMAN_CHECK_STALL_MESSAGE = 'Human check stalled — try again';

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

export function isHumanCheckStallError(err: unknown): boolean {
  return err instanceof Error && err.message === HUMAN_CHECK_STALL_MESSAGE;
}

function getTurnstileApi(): TurnstileApi | null {
  return (window as { turnstile?: TurnstileApi }).turnstile ?? null;
}

function waitForTurnstileApi(maxMs = TURNSTILE_READY_TIMEOUT_MS): Promise<void> {
  if (getTurnstileApi()) return Promise.resolve();

  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      window.clearInterval(poll);
      reject(new Error(HUMAN_CHECK_STALL_MESSAGE));
    }, maxMs);
    const poll = window.setInterval(() => {
      if (getTurnstileApi()) {
        window.clearTimeout(timeout);
        window.clearInterval(poll);
        resolve();
      }
    }, 25);
  });
}

function injectTurnstileScript(): void {
  if (document.querySelector('script[src*="turnstile"]')) return;
  const script = document.createElement('script');
  script.src = TURNSTILE_SCRIPT_URL;
  script.async = true;
  script.defer = true;
  document.head.appendChild(script);
}

/** Load Turnstile API script if not already present. Rejects if the human-check stalls. */
export async function ensureTurnstileReady(
  maxMs = TURNSTILE_READY_TIMEOUT_MS,
): Promise<void> {
  if (getTurnstileApi()) return;
  injectTurnstileScript();
  await waitForTurnstileApi(maxMs);
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
        reject(new Error(HUMAN_CHECK_STALL_MESSAGE));
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
          reject(new Error(HUMAN_CHECK_STALL_MESSAGE));
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
 * Best-effort Turnstile token for referral hardening. Never blocks recording —
 * returns null on failure/timeout, including a stalled script load.
 */
export async function tryOptionalTurnstileToken(timeoutMs = 2500): Promise<string | null> {
  if (!TURNSTILE_SITEKEY) return null;

  const container = document.createElement('div');
  container.setAttribute('aria-hidden', 'true');
  container.style.cssText =
    'position:fixed;left:0;bottom:0;width:1px;height:1px;opacity:0;pointer-events:none;z-index:-1;';
  document.body.appendChild(container);

  try {
    const token = await Promise.race([
      (async () => {
        await ensureTurnstileReady(timeoutMs);
        return getTurnstileToken(container, TURNSTILE_SITEKEY, 'optional referral', {
          invisible: true,
          timeoutMs,
        });
      })(),
      new Promise<null>((resolve) => window.setTimeout(() => resolve(null), timeoutMs)),
    ]);
    return typeof token === 'string' && token ? token : null;
  } catch {
    return null;
  } finally {
    container.remove();
  }
}
