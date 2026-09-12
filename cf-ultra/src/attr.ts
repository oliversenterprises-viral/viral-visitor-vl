import { parseCampaign } from '../functions/_lib/campaign';
import { hostnameFromUrl, normalizeReferralCode, normalizeWebsiteUrl } from '../functions/_lib/engine';
import { parseRefFromPathname } from '../functions/_lib/referral-url';

const ATTR_KEY = 'vr-ultra-attr-v1';
const KIT_KEY = 'vr-ultra-kit-open-v1';
const CREDITS_KEY = 'vr-ultra-last-credits-v1';

export type Attribution = { ref: string; url: string; src: string; camp: string; te: boolean };

function readStored(): Attribution {
  try {
    const raw = sessionStorage.getItem(ATTR_KEY);
    if (!raw) return { ref: '', url: '', src: '', camp: '', te: false };
    const parsed = JSON.parse(raw) as Partial<Attribution>;
    const ref = normalizeReferralCode(parsed.ref) || '';
    const url = typeof parsed.url === 'string' ? parsed.url : '';
    const camp = parseCampaign({ src: parsed.src, camp: parsed.camp });
    return { ref, url, src: camp.src, camp: camp.camp, te: camp.te || parsed.te === true };
  } catch {
    return { ref: '', url: '', src: '', camp: '', te: false };
  }
}

export function persistAttribution(
  ref?: string | null,
  url?: string | null,
  src?: string | null,
  camp?: string | null,
): Attribution {
  const stored = readStored();
  const nextRef = normalizeReferralCode(ref) || stored.ref;
  const nextUrl = url && normalizeWebsiteUrl(url) ? normalizeWebsiteUrl(url)! : stored.url;
  const parsed = parseCampaign({ src: src || stored.src, camp: camp || stored.camp });
  const next: Attribution = { ref: nextRef, url: nextUrl, src: parsed.src, camp: parsed.camp, te: parsed.te };
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
  const pathRef = parseRefFromPathname(u.pathname);
  if (attr.ref && !pathRef && u.searchParams.get('ref')?.toUpperCase() !== attr.ref) {
    u.searchParams.set('ref', attr.ref);
    dirty = true;
  }
  if (attr.te && u.searchParams.get('src') !== 'te') {
    u.searchParams.set('src', 'te');
    dirty = true;
  }
  if (attr.camp && u.searchParams.get('camp') !== attr.camp) {
    u.searchParams.set('camp', attr.camp);
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
