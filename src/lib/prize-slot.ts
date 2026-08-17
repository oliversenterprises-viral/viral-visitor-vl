/**
 * Helix Bet 2 — homepage banner slot as a visible, time-boxed prize.
 * Single source for threshold copy, empty-slot mock, locked share/OG, weekly gates.
 */

export const DEFAULT_MIN_REFERRALS_FOR_CLAIM = 10;
export const WEEKLY_SIDE_WIDGET_MIN = 10;

export const EMPTY_SLOT_NAME = 'Your site here';
export const EMPTY_SLOT_META = 'Your site here · 30 days';
export const EMPTY_BOARD_LINE = 'Board is open. #1 is winnable this week.';
export const DAILY_CROWN_NOT_BANNER = 'Not the homepage banner.';

export const LOCKED_SHARE_TEXT =
  "I'm racing for the ViralRefer homepage — #1 gets a banner for their site. Get a free link and try to beat me. {link}";

export const LOCKED_OG_DESCRIPTION =
  "I'm racing for the ViralRefer homepage — #1 gets a banner for their site. Get a free link and try to beat me.";

export const PRIZE_FOMO_LINE = 'Early ranks are open. #1 puts their website on this page.';

/** One trust sentence — say the prize once. Do not repeat “no cash” on the first screen. */
export const ONE_PRIZE_SENTENCE = 'Verified #1 gets a 30-day banner for their website.';

export const AD_SLOT_KICKER = 'Live ad · this homepage · 30 days';
export const EMPTY_AD_NOTE = 'This slot is empty. #1 puts their site here.';

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
  return `Open worldwide. Verified #1 with at least ${n} friends who tapped Get my link can claim a homepage banner for their website. There is no cash prize.`;
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

export function resolvePrizeSlot(input: {
  banners?: readonly PrizeBannerInput[];
  selected?: PrizeBannerInput | null;
} = {}): PrizeSlot {
  const enabled = (input.banners || []).filter((b) => b && b.enabled !== false);
  const candidate = input.selected || enabled[0] || null;
  if (!candidate) return examplePrizeSlot();

  const href = safeHttpUrl(candidate.redirectUrl || '');
  const host = href ? hostnameFromUrl(href) : null;
  const siteName = String(candidate.label || host || '').trim();
  if (!siteName && !href) return emptyPrizeSlot();

  const display = siteName || host || 'Featured site';
  return {
    kind: 'winner',
    siteName: display,
    meta: `${host || display} · 30 days`,
    href,
    imageUrl: String(candidate.imageUrl || '').trim() || undefined,
  };
}

export function shouldShowWeeklySideWidgets(weeklyVerified: number): boolean {
  return Math.max(0, Math.floor(Number(weeklyVerified) || 0)) >= WEEKLY_SIDE_WIDGET_MIN;
}

export function sharePayloadHasBannerRace(text: string): boolean {
  const lower = String(text || '').toLowerCase();
  return lower.includes('homepage') && (lower.includes('beat me') || lower.includes('banner'));
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

  setText('hero-ad-kicker-kind', slot.kind === 'example' ? 'Example ad' : 'Live ad');
  setText('hero-ad-mark', slot.kind === 'example' ? 'Ex' : '#1');

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
      thumb.removeAttribute('src');
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
    const line = formatUnlockRaceLine(
      input.leaderReferrals ?? 0,
      input.minForClaim,
      input.kind || 'example',
    );
    race.textContent = line;
    race.hidden = !line;
    race.classList.toggle('hidden', !line);
  }
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
