/**
 * Owner → racer Talk. Public message after Get my link. No email required.
 * Same CMS keys as Website → Talk (owner_broadcast_*). Missing keys = no panel.
 */

export const RACER_TALK_DEFAULT_TITLE = 'Message from ViralRefer';

export const RACER_TALK_CONTENT_KEYS = [
  'owner_broadcast_enabled',
  'owner_broadcast_title',
  'owner_broadcast_body',
  'owner_broadcast_id',
  'owner_broadcast_media_url',
  'owner_broadcast_sponsor_label',
  'owner_broadcast_sponsor_url',
  'owner_broadcast_sponsor_image',
  'owner_broadcast_sponsor_cta',
] as const;

export type RacerTalkContentKey = (typeof RACER_TALK_CONTENT_KEYS)[number];

export interface RacerTalkSponsor {
  label: string;
  url: string;
  imageUrl: string | null;
  cta: string;
}

export interface RacerTalkMessage {
  enabled: boolean;
  title: string;
  body: string;
  id: string;
  mediaUrl: string | null;
  sponsor: RacerTalkSponsor | null;
  emailRequired: false;
}

export function racerTalkTruthyFlag(raw: unknown): boolean {
  const s = String(raw ?? '')
    .trim()
    .toLowerCase();
  return s === '1' || s === 'true' || s === 'yes' || s === 'on';
}

export function racerTalkSafeHttpUrl(raw: string): boolean {
  const s = String(raw || '').trim();
  if (!s || s.length > 2000) return false;
  try {
    const u = new URL(s);
    return u.protocol === 'https:' || u.protocol === 'http:';
  } catch {
    return false;
  }
}

export function racerTalkText(value: unknown): string {
  if (value == null || value === '') return '';
  if (typeof value === 'object') return JSON.stringify(value);
  let text = String(value).trim();
  if (!text) return '';
  if (text.length >= 2 && text.startsWith('"') && text.endsWith('"')) {
    try {
      const parsed = JSON.parse(text);
      if (typeof parsed === 'string') text = parsed.trim();
    } catch {
      text = text.slice(1, -1).trim();
    }
  }
  return text;
}

export function mapSiteContentRowsToTalk(
  rows: Array<{ key?: string | null; id?: string | null; value?: unknown }> | null | undefined,
): Record<string, unknown> {
  const content: Record<string, unknown> = {};
  for (const row of rows || []) {
    const logicalKey = String(row.key || row.id || '').trim();
    if (!logicalKey) continue;
    content[logicalKey] = row.value;
  }
  return content;
}

function parseSponsor(content: Record<string, unknown>): RacerTalkSponsor | null {
  const urlRaw = racerTalkText(content['owner_broadcast_sponsor_url']);
  if (!urlRaw || !racerTalkSafeHttpUrl(urlRaw)) return null;
  const imageRaw = racerTalkText(content['owner_broadcast_sponsor_image']);
  return {
    label: (racerTalkText(content['owner_broadcast_sponsor_label']) || 'Sponsored').slice(0, 80),
    url: urlRaw.slice(0, 2000),
    imageUrl: imageRaw && racerTalkSafeHttpUrl(imageRaw) ? imageRaw.slice(0, 2000) : null,
    cta: (racerTalkText(content['owner_broadcast_sponsor_cta']) || 'Visit sponsor').slice(0, 40),
  };
}

export function racerTalkMessageId(title: string, body: string, explicitId?: string): string {
  const explicit = String(explicitId || '').trim();
  if (explicit) return explicit.slice(0, 80);
  const base = `${title}\n${body}`.trim();
  let h = 0;
  for (let i = 0; i < base.length; i++) h = (Math.imul(31, h) + base.charCodeAt(i)) | 0;
  return `rt_${(h >>> 0).toString(16)}`;
}

/** Pure parse — unit-tested. Disabled / empty = null. */
export function parseRacerTalkMessage(
  content: Record<string, unknown> | null | undefined,
): RacerTalkMessage | null {
  if (!content || typeof content !== 'object') return null;
  if (!racerTalkTruthyFlag(content['owner_broadcast_enabled'])) return null;

  const title = racerTalkText(content['owner_broadcast_title']) || RACER_TALK_DEFAULT_TITLE;
  const body = racerTalkText(content['owner_broadcast_body']);
  const sponsor = parseSponsor(content);
  const mediaRaw = racerTalkText(content['owner_broadcast_media_url']);
  const mediaUrl = mediaRaw && racerTalkSafeHttpUrl(mediaRaw) ? mediaRaw.slice(0, 2000) : null;
  if (!body && !sponsor && !mediaUrl) return null;

  const explicitId = racerTalkText(content['owner_broadcast_id']);
  return {
    enabled: true,
    title: title.slice(0, 120),
    body: body.slice(0, 2000),
    id: racerTalkMessageId(title, body || sponsor?.url || mediaUrl || 'media', explicitId),
    mediaUrl,
    sponsor,
    emailRequired: false,
  };
}

export function racerTalkContentFromPublic(msg: RacerTalkMessage): Record<string, unknown> {
  return {
    owner_broadcast_enabled: '1',
    owner_broadcast_title: msg.title,
    owner_broadcast_body: msg.body,
    owner_broadcast_id: msg.id,
    owner_broadcast_media_url: msg.mediaUrl || '',
    owner_broadcast_sponsor_label: msg.sponsor?.label || '',
    owner_broadcast_sponsor_url: msg.sponsor?.url || '',
    owner_broadcast_sponsor_image: msg.sponsor?.imageUrl || '',
    owner_broadcast_sponsor_cta: msg.sponsor?.cta || '',
  };
}
