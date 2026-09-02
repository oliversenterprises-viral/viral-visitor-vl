/**
 * Helix Bet 2 — homepage banner slot as a visible, time-boxed prize.
 * Single source for threshold copy, empty-slot mock, locked share/OG, weekly gates.
 */

export const DEFAULT_MIN_REFERRALS_FOR_CLAIM = 10;
export const WEEKLY_SIDE_WIDGET_MIN = 10;

export const EMPTY_SLOT_NAME = 'Your site here';
export const EMPTY_SLOT_META = 'Your site here · 7 days';
export const EMPTY_BOARD_LINE = 'Board is open. #1 is winnable this week.';
export const DAILY_CROWN_NOT_BANNER = 'Not the homepage banner.';

export const LOCKED_SHARE_TEXT =
  "I'm racing for the homepage this week. #1 puts their site on this page for 7 days. Tap Get my link. Visiting does not count. {link}";

export const LOCKED_OG_TITLE = 'Win the ViralRefer homepage — Site Drops + #1 banner';

export const LOCKED_OG_DESCRIPTION =
  "I'm racing on ViralRefer — Site Drops put my site on the homepage as I climb. #1 gets the banner. Get a free link and try to beat me.";

export const PRIZE_FOMO_LINE = 'The board is this week only. Take #1 and claim it before the week ends.';

/** Live Site Drop ladder — first screen prize sentence. */
export const ONE_PRIZE_SENTENCE =
  'Paste your website in the slot. 1 friend → Rising drop. 2 → text line. #1 (not the owner) with 3+ friends → 7-day banner.';

export const AD_SLOT_KICKER = 'This homepage · viralrefer.app · 7 days';
export const EMPTY_AD_NOTE = 'Empty right now. #1 this week puts their site here.';
export const EMPTY_AD_KICKER_KIND = 'This homepage';
export const EMPTY_AD_MARK = '#';
export const WEEK_RACE_CLOCK_SUFFIX = 'Send now.';

/** Valid 1×1 gif so #hero-slot-thumb / #prize-slot-thumb never have an empty src. */
export const EMPTY_SLOT_THUMB_SRC =
  'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

export const EXAMPLE_SLOT_HREF = 'https://www.viralrefer.app/tools/';
export const EXAMPLE_SLOT_NAME = 'ViralRefer Tools';
export const EXAMPLE_SLOT_META = 'Example — this is what #1 gets';
export const EXAMPLE_AD_NOTE = 'Example — this is what #1 gets. Slot still empty.';
export const EXAMPLE_SLOT_IMAGE = 'https://www.viralrefer.app/assets/hero.png';

export type PrizeBannerInput = {
  imageUrl?: string;
  redirectUrl?: string;
  label?: string;
  enabled?: boolean;
};

export type PrizeSlotKind = 'empty' | 'example' | 'winner';

export type PrizeSlot = {
  kind: PrizeSlotKind;
  siteName: string;
  meta: string;
  href: string | null;
  imageUrl?: string;
};

export function parseMinReferralsForClaim(raw: unknown): number {
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    return clampMinReferrals(raw);
  }
  if (typeof raw === 'string') {
    const parsed = parseInt(raw.trim(), 10);
    if (!Number.isNaN(parsed)) return clampMinReferrals(parsed);
  }
  if (raw && typeof raw === 'object') {
    const obj = raw as { minReferrals?: unknown; min_referrals?: unknown; value?: unknown };
    const nested = obj.minReferrals ?? obj.min_referrals ?? obj.value;
    if (nested != null && nested !== raw) return parseMinReferralsForClaim(nested);
  }
  return DEFAULT_MIN_REFERRALS_FOR_CLAIM;
}

function clampMinReferrals(n: number): number {
  const whole = Math.floor(n);
  if (whole < 1) return DEFAULT_MIN_REFERRALS_FOR_CLAIM;
  return Math.min(10_000, whole);
}

export function formatPrizeThresholdLine(min: number): string {
  const n = parseMinReferralsForClaim(min);
  return `Verified #1 with at least ${n} friends who tapped Get my link can claim the banner.`;
}

export function formatFaqPrizeAnswer(min = DEFAULT_MIN_REFERRALS_FOR_CLAIM): string {
  const n = parseMinReferralsForClaim(min);
  return `Open worldwide. This week's top racer (not the site owner) with ${n} friends who tapped Get my link can claim a 7-day homepage banner for their website. There is no cash prize.`;
}

export function hostnameFromUrl(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    return u.hostname.replace(/^www\./i, '');
  } catch {
    return null;
  }
}

export function safeHttpUrl(raw: string): string | null {
  const trimmed = String(raw || '').trim();
  if (!trimmed) return null;
  try {
    const u = new URL(trimmed);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    return u.toString();
  } catch {
    return null;
  }
}

export function emptyPrizeSlot(): PrizeSlot {
  return {
    kind: 'empty',
    siteName: EMPTY_SLOT_NAME,
    meta: EMPTY_SLOT_META,
    href: null,
  };
}

export function examplePrizeSlot(): PrizeSlot {
  return {
    kind: 'example',
    siteName: EXAMPLE_SLOT_NAME,
    meta: EXAMPLE_SLOT_META,
    href: EXAMPLE_SLOT_HREF,
    imageUrl: EXAMPLE_SLOT_IMAGE,
  };
}

export function formatVisitInventoryLine(visits: number): string {
  const n = Math.max(0, Math.floor(Number(visits) || 0));
  if (n <= 0) return '';
  return `Seen ${n.toLocaleString('en-US')} times this week on this page.`;
}

export function formatUnlockRaceLine(
  leaderReferrals: number,
  minForClaim = DEFAULT_MIN_REFERRALS_FOR_CLAIM,
  kind: PrizeSlotKind = 'example',
): string {
  if (kind === 'winner') return '';
  const have = Math.max(0, Math.floor(Number(leaderReferrals) || 0));
  const need = parseMinReferralsForClaim(minForClaim);
  if (have <= 0) return `Slot still empty. Verified #1 with ${need} friends can claim it.`;
  if (have < need) return `Board leader has ${have} of ${need} friends. Slot still empty.`;
  return `Board leader has ${have} friends. Slot still empty until they claim.`;
}

/** Promo / placeholder CMS rows are not a claimed #1 site. */
export function isClaimedPrizeBanner(banner: PrizeBannerInput | null | undefined): boolean {
  if (!banner || banner.enabled === false) return false;
  const href = safeHttpUrl(banner.redirectUrl || '');
  if (!href) return false;
  const host = (hostnameFromUrl(href) || '').toLowerCase();
  if (!host) return false;
  if (host === 'viralrefer.app' || host.endsWith('.viralrefer.app')) return false;
  if ((host === 'x.com' || host === 'twitter.com') && /viralrefer/i.test(href)) return false;
  const img = String(banner.imageUrl || '').toLowerCase();
  if (img.includes('winner-spotlight') || img.includes('featured-partner')) return false;
  const label = String(banner.label || '').trim().toLowerCase();
  if (label === 'winner spotlight' || label === 'featured partner') return false;
  return true;
}

export function resolvePrizeSlot(input: {
  banners?: readonly PrizeBannerInput[];
  selected?: PrizeBannerInput | null;
} = {}): PrizeSlot {
  const enabled = (input.banners || []).filter((b) => isClaimedPrizeBanner(b));
  const candidate =
    (input.selected && isClaimedPrizeBanner(input.selected) ? input.selected : null) ||
    enabled[0] ||
    null;
  if (!candidate) return emptyPrizeSlot();

  const href = safeHttpUrl(candidate.redirectUrl || '');
  const host = href ? hostnameFromUrl(href) : null;
  const siteName = String(candidate.label || host || '').trim();
  if (!siteName && !href) return emptyPrizeSlot();

  const display = siteName || host || 'Featured site';
  return {
    kind: 'winner',
    siteName: display,
    meta: `${host || display} · 7 days`,
    href,
    imageUrl: String(candidate.imageUrl || '').trim() || undefined,
  };
}

export function shouldShowWeeklySideWidgets(weeklyVerified: number): boolean {
  return Math.max(0, Math.floor(Number(weeklyVerified) || 0)) >= WEEKLY_SIDE_WIDGET_MIN;
}

export function sharePayloadHasBannerRace(text: string): boolean {
  const lower = String(text || '').toLowerCase();
  return lower.includes('homepage') && lower.includes('tap get my link');
}

function paintSlotName(id: string, slot: PrizeSlot): void {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = slot.siteName;
  if (el instanceof HTMLAnchorElement) {
    if (slot.href) {
      el.href = slot.href;
      el.target = '_blank';
      el.rel = 'noopener noreferrer';
      el.removeAttribute('aria-disabled');
    } else {
      el.removeAttribute('href');
      el.removeAttribute('target');
      el.removeAttribute('rel');
      el.setAttribute('aria-disabled', 'true');
    }
  }
}

function setText(id: string, text: string): void {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

/** Paint hero + prize mocks. Example = /tools/ preview. Winner = claimed site. */
export function paintPrizeSlot(slot: PrizeSlot): void {
  paintSlotName('hero-slot-site', slot);
  paintSlotName('prize-slot-site', slot);

  setText('hero-slot-meta', slot.meta);
  setText('prize-slot-meta', slot.meta);

  const hero = document.getElementById('hero-banner-mock');
  if (hero) hero.setAttribute('data-vr-prize-slot', slot.kind);

  const prize = document.getElementById('prize-banner-visual');
  if (prize) prize.setAttribute('data-vr-prize-slot', slot.kind);

  setText(
    'hero-ad-kicker-kind',
    slot.kind === 'example' ? 'Example ad' : slot.kind === 'empty' ? EMPTY_AD_KICKER_KIND : 'Live ad',
  );
  setText(
    'hero-ad-mark',
    slot.kind === 'example' ? 'Ex' : slot.kind === 'empty' ? EMPTY_AD_MARK : '#1',
  );
  const mark = document.getElementById('hero-ad-mark');
  if (mark) mark.classList.toggle('hero-ad-mark-empty', slot.kind === 'empty');

  const preview = document.getElementById('hero-slot-preview');
  if (preview) {
    const showPreview = slot.kind === 'example';
    preview.classList.toggle('hidden', !showPreview);
    preview.toggleAttribute('hidden', !showPreview);
  }

  const thumbs = [
    document.getElementById('hero-slot-thumb') as HTMLImageElement | null,
    document.getElementById('prize-slot-thumb') as HTMLImageElement | null,
  ];
  const showThumb = slot.kind === 'winner';
  for (const thumb of thumbs) {
    if (!thumb) continue;
    const src = showThumb ? slot.imageUrl : undefined;
    if (src) {
      thumb.src = src;
      thumb.alt = `${slot.siteName} homepage banner`;
      thumb.classList.remove('hidden');
    } else {
      thumb.src = EMPTY_SLOT_THUMB_SRC;
      thumb.alt = '';
      thumb.classList.add('hidden');
    }
  }

  const note = document.getElementById('hero-ad-note');
  if (note) {
    note.textContent =
      slot.kind === 'winner' ? slot.meta : slot.kind === 'example' ? EXAMPLE_AD_NOTE : EMPTY_AD_NOTE;
  }
  const visit = document.getElementById('hero-ad-visit') as HTMLAnchorElement | null;
  if (visit) {
    if (slot.href && slot.kind !== 'empty') {
      visit.href = slot.href;
      visit.classList.remove('hidden');
      visit.removeAttribute('hidden');
    } else {
      visit.removeAttribute('href');
      visit.classList.add('hidden');
      visit.setAttribute('hidden', '');
    }
  }
}

export function paintPrizePullProof(input: {
  visits7d?: number;
  leaderReferrals?: number;
  minForClaim?: number;
  kind?: PrizeSlotKind;
}): void {
  const inventory = document.getElementById('hero-ad-inventory');
  if (inventory) {
    const line = formatVisitInventoryLine(input.visits7d ?? 0);
    inventory.textContent = line;
    inventory.hidden = !line;
    inventory.classList.toggle('hidden', !line);
  }
  const race = document.getElementById('hero-ad-race');
  if (race) {
    // 8:44 slot footer is empty-note + live seen-count only.
    race.textContent = '';
    race.hidden = true;
    race.classList.add('hidden');
  }
}

export function getUtcWeekEndMs(nowMs = Date.now()): number {
  const now = new Date(nowMs);
  const day = now.getUTCDay();
  const add = day === 0 ? 1 : 8 - day;
  return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + add, 0, 0, 0, 0);
}

export function formatWeekRaceClock(nowMs = Date.now()): string {
  let remain = Math.max(0, getUtcWeekEndMs(nowMs) - nowMs);
  const days = Math.floor(remain / 86_400_000);
  remain -= days * 86_400_000;
  const hours = Math.floor(remain / 3_600_000);
  remain -= hours * 3_600_000;
  const mins = Math.floor(remain / 60_000);
  return `This week's race ends in ${days}d ${hours}h ${mins}m. ${WEEK_RACE_CLOCK_SUFFIX}`;
}

export function paintWeekRaceClock(nowMs = Date.now()): void {
  const el = document.getElementById('hero-week-clock');
  if (!el) return;
  el.textContent = formatWeekRaceClock(nowMs);
}

export function initWeekRaceClock(): void {
  paintWeekRaceClock();
  if (typeof window === 'undefined') return;
  const root = document.documentElement;
  if (root.dataset.vrWeekClock === '1') return;
  root.dataset.vrWeekClock = '1';
  window.setInterval(() => paintWeekRaceClock(), 30_000);
}

export function paintPrizeThreshold(min: number): void {
  const n = parseMinReferralsForClaim(min);
  const num = document.getElementById('min-referrals-value');
  if (num) {
    num.textContent = String(n);
    return;
  }
  const el = document.getElementById('prize-threshold');
  if (el) el.textContent = formatPrizeThresholdLine(n);
}
