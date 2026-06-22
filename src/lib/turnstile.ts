/**
 * Shared Cloudflare Turnstile helpers (referral recording + prize claim).
 */

const TURNSTILE_SITEKEY = import.meta.env.VITE_TURNSTILE_SITEKEY || '';

export function getTurnstileSiteKey(): string {
  return TURNSTILE_SITEKEY;
}

/** Load Turnstile API script if not already present. */
export async function ensureTurnstileReady(): Promise<void> {
  if ((window as { turnstile?: unknown }).turnstile) return;

  const existing = document.querySelector('script[src*="turnstile"]');
  if (existing) {
    await new Promise<void>((resolve) => {
      existing.addEventListener('load', () => resolve(), { once: true });
      setTimeout(resolve, 2000);
    });
    return;
  }

  await new Promise<void>((resolve) => {
    const script = document.createElement('script');
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => resolve();
    document.head.appendChild(script);
  });
}

/** Render widget in container and resolve with token (dev bypass when no sitekey). */
export function getTurnstileToken(
  container: HTMLElement,
  siteKey: string = TURNSTILE_SITEKEY,
  devBypassLabel = 'Turnstile',
): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!siteKey) {
      console.warn(`[ViralRefer] VITE_TURNSTILE_SITEKEY not set — skipping ${devBypassLabel}`);
      resolve('dev-bypass-token');
      return;
    }

    container.innerHTML = '';
    const widgetDiv = document.createElement('div');
    container.appendChild(widgetDiv);

    (window as { turnstile?: { render: (el: HTMLElement, opts: Record<string, unknown>) => void } })
      .turnstile!.render(widgetDiv, {
        sitekey: siteKey,
        callback: (token: string) => resolve(token),
        'error-callback': () => reject(new Error('Turnstile verification failed')),
        'expired-callback': () => reject(new Error('Turnstile expired — please try again')),
      });
  });
}