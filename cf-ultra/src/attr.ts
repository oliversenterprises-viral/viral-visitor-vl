import { CODE_RE, hostnameFromUrl, normalizeWebsiteUrl } from '../functions/_lib/engine';

const ATTR_KEY = 'vr-ultra-attr-v1';
const KIT_KEY = 'vr-ultra-kit-open-v1';
const CREDITS_KEY = 'vr-ultra-last-credits-v1';

export type Attribution = { ref: string; url: string };

function readStored(): Attribution {
  try {
    const raw = sessionStorage.getItem(ATTR_KEY);
    if (!raw) return { ref: '', url: '' };
    const parsed = JSON.parse(raw) as Partial<Attribution>;
    const ref = typeof parsed.ref === 'string' && CODE_RE.test(parsed.ref.toUpperCase()) ? parsed.ref.toUpperCase() : '';
    const url = typeof parsed.url === 'string' ? parsed.url : '';
    return { ref, url };
  } catch {
    return { ref: '', url: '' };
  }
}

export function persistAttribution(ref?: string | null, url?: string | null): Attribution {
  const stored = readStored();
  const nextRef = ref && CODE_RE.test(ref.toUpperCase()) ? ref.toUpperCase() : stored.ref;
  const nextUrl = url && normalizeWebsiteUrl(url) ? normalizeWebsiteUrl(url)! : stored.url;
  const next = { ref: nextRef, url: nextUrl };
  try {
    sessionStorage.setItem(ATTR_KEY, JSON.stringify(next));
  } catch {
    /* private mode */
  }
  return next;
}

export function syncAttributionToUrl(attr: Attribution): void {
  const u = new URL(location.href);
  let dirty = false;
  if (attr.ref && u.searchParams.get('ref')?.toUpperCase() !== attr.ref) {
    u.searchParams.set('ref', attr.ref);
    dirty = true;
  }
  if (dirty) history.replaceState(null, '', `${u.pathname}${u.search}${u.hash}`);
}

export function rememberKitOpen(open: boolean): void {
  try {
    if (open) sessionStorage.setItem(KIT_KEY, '1');
    else sessionStorage.removeItem(KIT_KEY);
  } catch {
    /* ignore */
  }
}

export function shouldRestoreKit(): boolean {
  try {
    return sessionStorage.getItem(KIT_KEY) === '1';
  } catch {
    return false;
  }
}

export function lastKnownCredits(): number | null {
  try {
    const n = Number(sessionStorage.getItem(CREDITS_KEY));
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

export function rememberCredits(n: number): void {
  try {
    sessionStorage.setItem(CREDITS_KEY, String(n));
  } catch {
    /* ignore */
  }
}

export function previewHost(raw: string): string | null {
  const url = normalizeWebsiteUrl(raw);
  return url ? hostnameFromUrl(url) : null;
}
