/**
 * Shared Cloudflare Turnstile helpers (referral recording + prize claim).
 */

const TURNSTILE_SCRIPT_URL = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
const TURNSTILE_SITEKEY = import.meta.env.VITE_TURNSTILE_SITEKEY || '';
const DEFAULT_TOKEN_TIMEOUT_MS = 25_000;

export type TurnstileRenderOptions = {
  /** Use invisible widget (recommended for background referral recording). */
  invisible?: boolean;
  /** Reject if no token within this window (avoids hung recording). */
  timeoutMs?: number;
};

export function getTurnstileSiteKey(): string {
  return TURNSTILE_SITEKEY;
}

function waitForTurnstileApi(maxMs = 12_000): Promise<void> {
  if ((window as { turnstile?: unknown }).turnstile) return Promise.resolve();

  return new Promise((resolve) => {
    const started = Date.now();
    const tick = () => {
      if ((window as { turnstile?: unknown }).turnstile) {
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
  if ((window as { turnstile?: unknown }).turnstile) return;

  const existing = document.querySelector('script[src*="turnstile"]');
  if (existing) {
    await new Promise<void>((resolve) => {
      existing.addEventListener('load', () => resolve(), { once: true });
      setTimeout(resolve, 8000);
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

    const api = (window as {
      turnstile?: { render: (el: HTMLElement, opts: Record<string, unknown>) => string };
    }).turnstile;

    if (!api?.render) {
      reject(new Error('Turnstile API not available'));
      return;
    }

    let settled = false;
    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      fn();
    };

    const timer = window.setTimeout(() => {
      finish(() => reject(new Error('Turnstile timed out — please try again')));
    }, timeoutMs);

    container.innerHTML = '';
    const widgetDiv = document.createElement('div');
    container.appendChild(widgetDiv);

    const renderOpts: Record<string, unknown> = {
      sitekey: siteKey,
      callback: (token: string) => finish(() => resolve(token)),
      'error-callback': () => finish(() => reject(new Error('Turnstile verification failed'))),
      'expired-callback': () => finish(() => reject(new Error('Turnstile expired — please try again'))),
    };

    if (options.invisible) {
      renderOpts.size = 'invisible';
    }

    try {
      api.render(widgetDiv, renderOpts);
    } catch (err) {
      finish(() => reject(err instanceof Error ? err : new Error(String(err))));
    }
  });
}