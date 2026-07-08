/**
 * Share engine — platform URLs, optimized messages, native share detection.
 * Pure functions (testable); side effects live in public/handlers.ts.
 */

import { appendChallengeParam, formatChallengeSharePrefix } from './challenge-mode';
import { getStoredLandingRef } from './referral-url';
import { formatShareGapNudge } from './share-gap';
import { getViralLoopsConfig } from './viral-loops-config';

export type SharePlatform =
  | 'x'
  | 'whatsapp'
  | 'linkedin'
  | 'facebook'
  | 'telegram'
  | 'sms'
  | 'email'
  | 'reddit'
  | 'bluesky'
  | 'threads'
  | 'pinterest'
  | 'discord'
  | 'tiktok'
  | 'snapchat'
  | 'copy'
  | 'native'
  | 'boost'
  | 'other';

/** Platforms shown in the live message preview tab strip. */
export const SHARE_PREVIEW_PLATFORMS: SharePlatform[] = [
  'whatsapp',
  'tiktok',
  'x',
  'reddit',
  'sms',
  'bluesky',
];

/** Platforms with no web intent — copy optimized message to clipboard instead. */
export const CLIPBOARD_SHARE_PLATFORMS: ReadonlySet<SharePlatform> = new Set([
  'discord',
  'tiktok',
  'snapchat',
]);

const DEFAULT_TEMPLATE =
  'Free to join — grab your link in ~30 sec. #1 wins homepage feature + $10 Cash App. {link}';

const PLATFORM_MESSAGE_OVERRIDES: Partial<Record<SharePlatform, string>> = {
  whatsapp:
    '🏆 ViralRefer — climb the live leaderboard!\nFree to join in ~30 sec. #1 wins homepage feature + $10 Cash App.\n\n{link}',
  boost:
    '🚀 Join me on ViralRefer — live leaderboard, free in ~30 sec!\n#1 wins homepage + $10 Cash App.\n\n{link}',
  reddit: 'ViralRefer — live referral leaderboard. Free to join. #1 wins homepage feature + $10 Cash App',
  bluesky:
    'Join the ViralRefer leaderboard — free, ~30 sec setup. #1 wins homepage + $10 Cash App 🏆\n\n{link}',
  sms: 'Join me on ViralRefer — free leaderboard contest. #1 wins homepage + $10. {link}',
  email:
    'Hey! I joined ViralRefer — a live referral leaderboard where #1 wins homepage feature + $10 Cash App.\n\nGrab your free link in ~30 sec:\n{link}',
  linkedin:
    'Join the ViralRefer live referral leaderboard — free to start, real-time rankings. {link}',
  telegram: 'ViralRefer leaderboard — free to join, #1 wins homepage + $10 Cash App. {link}',
  threads: 'Climbing the ViralRefer leaderboard — free to join in ~30 sec 🏆\n\n{link}',
  pinterest: 'ViralRefer — live referral leaderboard. #1 wins homepage feature + $10 Cash App',
  discord:
    '**ViralRefer** — live referral leaderboard\nFree to join in ~30 sec. #1 wins homepage + $10 Cash App\n\n{link}',
  x: 'Live referral leaderboard on ViralRefer — free to join. #1 wins homepage + $10 Cash App 🏆\n\n{link}',
  tiktok:
    'POV: climbing the ViralRefer leaderboard 🏆 Free to join in ~30 sec — link in bio vibes\n\n{link}\n\n#referral #giveaway #viral #fyp #leaderboard',
  snapchat:
    'Join me on ViralRefer — live referral leaderboard 🏆 Free link in ~30 sec\n\n{link}\n\nAdd to your story or send to friends!',
};

/** Append UTM params so you can see which platform drove each visit. */
export function buildTrackedShareLink(link: string, platform: SharePlatform): string {
  const challengeLink = appendChallengeParam(link);
  try {
    const url = new URL(challengeLink);
    url.searchParams.set('utm_source', platform);
    url.searchParams.set('utm_medium', 'referral_share');
    url.searchParams.set('utm_campaign', 'viralrefer');
    return url.toString();
  } catch {
    return challengeLink;
  }
}

function applySharePlaceholders(
  raw: string,
  link: string,
  options: {
    referralCount?: number;
    leaderboardRank?: number | null;
    gapToNextRank?: number | null;
  } = {},
): string {
  let out = raw.replace(/\{link\}/g, link);
  const count = options.referralCount ?? 0;
  const rank = options.leaderboardRank ?? null;
  const gap = options.gapToNextRank ?? null;
  out = out.replace(/\{referrals\}/g, String(count));
  out = out.replace(/\{rank\}/g, rank ? String(rank) : '');
  out = out.replace(/\{gap\}/g, gap != null ? String(gap) : '');

  const prefixParts: string[] = [];
  if (rank && rank >= 1) {
    prefixParts.push(
      rank === 1 ? "I'm #1 on the leaderboard" : `I'm #${rank} on the leaderboard`,
    );
  }
  const gapLine = formatShareGapNudge(rank, gap).replace(/ — $/, '').trim();
  if (gapLine) prefixParts.push(gapLine);
  else if (count > 0 && (!rank || rank < 1)) {
    prefixParts.push(`I'm at ${count} referral${count === 1 ? '' : 's'}`);
  }

  if (prefixParts.length) {
    const combined = `${prefixParts.join(' — ')} — `;
    const alreadyPrefixed = prefixParts.some((p) => out.includes(p));
    if (!alreadyPrefixed && !out.startsWith(combined)) out = combined + out;
  }

  if (getViralLoopsConfig().challenge_enabled) {
    const duelPrefix = formatChallengeSharePrefix(getStoredLandingRef());
    if (duelPrefix && !out.includes(duelPrefix.trim())) {
      out = duelPrefix + out;
    }
  }

  return out;
}

/** Admin template or platform-optimized default with {link} substituted. */
export function buildShareMessage(
  link: string,
  options: {
    template?: string;
    platform?: SharePlatform;
    referralCount?: number;
    leaderboardRank?: number | null;
    gapToNextRank?: number | null;
    trackUtm?: boolean;
    abTemplate?: string;
  } = {},
): string {
  const platform = options.platform ?? 'other';
  const linkTrimmed = (options.trackUtm ? buildTrackedShareLink(link, platform) : link).trim();
  const adminTemplate = options.template?.trim();
  const abTemplate = options.abTemplate?.trim();

  let raw =
    adminTemplate ||
    abTemplate ||
    PLATFORM_MESSAGE_OVERRIDES[platform] ||
    DEFAULT_TEMPLATE;
  if (adminTemplate && PLATFORM_MESSAGE_OVERRIDES[platform] && !adminTemplate.includes('{link}')) {
    raw = PLATFORM_MESSAGE_OVERRIDES[platform]!;
  }

  return applySharePlaceholders(raw, linkTrimmed, {
    referralCount: options.referralCount,
    leaderboardRank: options.leaderboardRank,
    gapToNextRank: options.gapToNextRank,
  });
}

/** Markdown formatted share blurb for Reddit, GitHub, Notion, etc. */
export function buildMarkdownShareMessage(
  link: string,
  options: {
    platform?: SharePlatform;
    referralCount?: number;
    leaderboardRank?: number | null;
  } = {},
): string {
  const platform = options.platform ?? 'whatsapp';
  const tracked = buildTrackedShareLink(link, platform);
  const code = extractReferralCodeFromLink(tracked) || 'VIRAL';
  const plain = buildShareMessage(link, {
    platform,
    referralCount: options.referralCount,
    leaderboardRank: options.leaderboardRank,
    trackUtm: true,
  });
  const linked = plain.replace(tracked, `[${tracked}](${tracked})`);
  return `### Join ViralRefer — ${code}\n\n${linked}`;
}

/** Reddit submit title — short, no URL (link passed separately). */
export function buildRedditShareTitle(link: string, template?: string): string {
  const msg = buildShareMessage(link, { template, platform: 'reddit' });
  const firstLine = msg.split('\n')[0]?.trim() || 'ViralRefer — live referral leaderboard';
  return firstLine.slice(0, 280);
}

/** Build intent URL for a platform; null when platform has no web intent (e.g. native). */
export function buildPlatformShareUrl(
  platform: SharePlatform,
  link: string,
  text: string,
): string | null {
  const encodedLink = encodeURIComponent(link);
  const encodedText = encodeURIComponent(text);

  switch (platform) {
    case 'x':
      return `https://x.com/intent/tweet?text=${encodedText}`;
    case 'whatsapp':
      return `https://wa.me/?text=${encodedText}`;
    case 'linkedin':
      return `https://www.linkedin.com/sharing/share-offsite/?url=${encodedLink}`;
    case 'facebook':
      return `https://www.facebook.com/sharer/sharer.php?u=${encodedLink}`;
    case 'telegram':
      return `https://t.me/share/url?url=${encodedLink}&text=${encodedText}`;
    case 'sms':
      return `sms:?body=${encodedText}`;
    case 'email':
      return `mailto:?subject=${encodeURIComponent('Join me on ViralRefer')}&body=${encodedText}`;
    case 'reddit': {
      const title = encodeURIComponent(buildRedditShareTitle(link));
      return `https://www.reddit.com/submit?url=${encodedLink}&title=${title}`;
    }
    case 'bluesky':
      return `https://bsky.app/intent/compose?text=${encodedText}`;
    case 'threads':
      return `https://www.threads.net/intent/post?text=${encodedText}`;
    case 'pinterest': {
      const desc = encodeURIComponent(text.split('\n')[0] || 'ViralRefer referral leaderboard');
      return `https://pinterest.com/pin/create/button/?url=${encodedLink}&description=${desc}`;
    }
    case 'discord':
      return null;
    default:
      return null;
  }
}

/** Extract VIRAL-XXXX from a referral URL. */
export function extractReferralCodeFromLink(link: string): string | null {
  const match = link.match(/\/r\/([^/?#]+)/i);
  return match?.[1]?.toUpperCase() ?? null;
}

/** HTML embed snippet for blogs and newsletters. */
export function buildEmbedCode(link: string): string {
  const safeLink = link.trim();
  const code = extractReferralCodeFromLink(safeLink) || 'VIRAL';
  return `<a href="${safeLink}" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:12px 24px;background:linear-gradient(135deg,#7c3aed,#c026d3);color:#fff;font-family:system-ui,sans-serif;font-weight:600;text-decoration:none;border-radius:12px;">Join ViralRefer — ${code}</a>`;
}

/** Whether share should copy message instead of opening a URL. */
export function shouldCopyShareMessage(platform: SharePlatform): boolean {
  return CLIPBOARD_SHARE_PLATFORMS.has(platform);
}

/** True when the browser exposes the Web Share API (mobile + some desktop). */
export function isNativeShareSupported(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.share === 'function';
}

/** QR image URL for a referral link (external API — same as inline QR). */
export function buildQrImageUrl(link: string, size = 320): string {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(link)}`;
}