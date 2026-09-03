/**
 * Website → Talk (racer-talk). Owner message after Get my link. No email.
 * Public panel: src/lib/racer-talk.ts. CMS keys stay owner_broadcast_*.
 */

import { BANNER_UPLOAD_ACCEPT } from '../lib/banner-upload';
import { RACER_TALK_DEFAULT_TITLE } from '../../supabase/functions/_shared/racer-talk';

export const RACER_TALK_PANEL_ID = 'owner-broadcast-panel';

export interface RacerTalkPanelFields {
  enabled: boolean;
  title: string;
  body: string;
  id: string;
  mediaUrl: string;
  sponsorLabel: string;
  sponsorUrl: string;
  sponsorImage: string;
  sponsorCta: string;
}

/** HQ Website Talk chrome — keep id="owner-broadcast-panel" and data-hq-talk="1". */
export function buildRacerTalkPanelHTML(fields: RacerTalkPanelFields): string {
  const {
    enabled,
    title,
    body,
    id,
    mediaUrl,
    sponsorLabel,
    sponsorUrl,
    sponsorImage,
    sponsorCta,
  } = fields;

  return `
    <div id="owner-broadcast-panel" data-hq-talk="1" data-racer-talk-tab="1" class="mb-4 p-5 rounded-2xl border-2 border-violet-500/50 bg-violet-950/30">
      <div class="flex flex-wrap items-start justify-between gap-3 mb-3">
        <div>
          <div class="text-lg font-bold text-violet-200 flex items-center gap-2">
            <i class="fa-solid fa-bullhorn"></i> Talk
            <span class="text-sm font-semibold text-violet-200/80">Message all joiners</span>
          </div>
          <p class="text-xs text-zinc-400 mt-1 max-w-xl">
            Message box after Get my link. No email. <strong class="text-violet-200">Only you can remove it</strong> (Turn OFF). Links: paste full <code class="text-violet-300">https://…</code> URLs or use <code class="text-violet-300">[label](https://…)</code>. Optional sponsor ad below.
          </p>
          ${
            enabled
              ? ''
              : '<p data-hq-talk-idle="1" class="text-xs text-zinc-500 mt-2">Talk is off. This tab still loaded. Prize is under More. Not an empty CMS.</p>'
          }
        </div>
        <span class="text-[10px] font-bold uppercase tracking-wide px-2 py-1 rounded-full border ${
          enabled
            ? 'border-emerald-400/50 text-emerald-300 bg-emerald-500/10'
            : 'border-zinc-500/40 text-zinc-400 bg-zinc-800/50'
        }" data-hq-talk-state="${enabled ? 'live' : 'off'}">${enabled ? 'LIVE on site' : 'Off'}</span>
      </div>
      <div class="grid gap-3 md:grid-cols-2">
        <label class="block text-xs text-zinc-400">
          Title
          <input id="owner-bc-title" type="text" maxlength="120" value="${title}"
            class="mt-1 w-full bg-zinc-900 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:border-violet-500"
            placeholder="e.g. ${RACER_TALK_DEFAULT_TITLE}" />
        </label>
        <label class="block text-xs text-zinc-400">
          Message id (optional)
          <input id="owner-bc-id" type="text" maxlength="80" value="${id}"
            class="mt-1 w-full bg-zinc-900 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:border-violet-500"
            placeholder="e.g. rules-2026-08-11" />
        </label>
      </div>
      <label class="block text-xs text-zinc-400 mt-3">
        Message body (links auto-clickable)
        <textarea id="owner-bc-body" rows="4" maxlength="2000"
          class="mt-1 w-full bg-zinc-900 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:border-violet-500"
          placeholder="Text + https://example.com or [Get Safelist Traffic](https://example.com)">${body}</textarea>
      </label>

      <div class="mt-4 pt-4 border-t border-violet-400/25">
        <div class="text-sm font-semibold text-violet-200 mb-2 flex items-center gap-2">
          <i class="fa-solid fa-image"></i> Message image (optional)
        </div>
        <p class="text-[11px] text-zinc-500 mb-3">Upload JPG/PNG/GIF/WebP/SVG (max 2MB) or paste a https:// image URL. Shows under the title after Get my link.</p>
        <div class="flex flex-wrap items-center gap-2 mb-2">
          <input type="file" id="owner-bc-media-file" accept="${BANNER_UPLOAD_ACCEPT}" class="hidden" />
          <button type="button" id="owner-bc-media-upload" class="px-4 py-2 rounded-xl bg-violet-700/80 hover:bg-violet-600 text-sm font-semibold">
            <i class="fa-solid fa-upload mr-1.5"></i>Upload image
          </button>
          <button type="button" id="owner-bc-media-clear" class="px-3 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 border border-white/10 text-xs font-semibold">
            Clear
          </button>
          <span id="owner-bc-media-status" class="text-[11px] text-zinc-500"></span>
        </div>
        <label class="block text-xs text-zinc-400">
          Image URL
          <input id="owner-bc-media-url" type="url" maxlength="2000" value="${mediaUrl}"
            class="mt-1 w-full bg-zinc-900 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:border-violet-500"
            placeholder="https://…/image.png or upload above" />
        </label>
        <div id="owner-bc-media-preview" class="mt-2 ${mediaUrl ? '' : 'hidden'}">
          <img src="${mediaUrl || ''}" alt="Broadcast media preview" class="max-h-28 rounded-lg border border-white/10 bg-black/30 object-contain" />
        </div>
      </div>

      <div class="mt-4 pt-4 border-t border-violet-400/25">
        <div class="text-sm font-semibold text-amber-200/95 mb-2 flex items-center gap-2">
          <i class="fa-solid fa-rectangle-ad"></i> Sponsor ad (optional)
        </div>
        <p class="text-[11px] text-zinc-500 mb-3">Requires a valid https:// click URL. Image optional (upload or URL). Shown as a sponsored card under your message.</p>
        <div class="grid gap-3 md:grid-cols-2">
          <label class="block text-xs text-zinc-400">
            Sponsor name
            <input id="owner-bc-sp-label" type="text" maxlength="80" value="${sponsorLabel}"
              class="mt-1 w-full bg-zinc-900 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:border-violet-500"
              placeholder="e.g. Get Safelist Traffic" />
          </label>
          <label class="block text-xs text-zinc-400">
            Button label
            <input id="owner-bc-sp-cta" type="text" maxlength="40" value="${sponsorCta}"
              class="mt-1 w-full bg-zinc-900 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:border-violet-500"
              placeholder="Visit sponsor" />
          </label>
          <label class="block text-xs text-zinc-400 md:col-span-2">
            Sponsor click URL (required for ad)
            <input id="owner-bc-sp-url" type="url" maxlength="2000" value="${sponsorUrl}"
              class="mt-1 w-full bg-zinc-900 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:border-violet-500"
              placeholder="https://getsafelisttraffic.online/" />
          </label>
          <div class="md:col-span-2 space-y-2">
            <div class="flex flex-wrap items-center gap-2">
              <input type="file" id="owner-bc-sp-file" accept="${BANNER_UPLOAD_ACCEPT}" class="hidden" />
              <button type="button" id="owner-bc-sp-upload" class="px-4 py-2 rounded-xl bg-amber-700/70 hover:bg-amber-600 text-sm font-semibold">
                <i class="fa-solid fa-upload mr-1.5"></i>Upload sponsor image
              </button>
              <button type="button" id="owner-bc-sp-clear" class="px-3 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 border border-white/10 text-xs font-semibold">
                Clear image
              </button>
              <span id="owner-bc-sp-status" class="text-[11px] text-zinc-500"></span>
            </div>
            <label class="block text-xs text-zinc-400">
              Sponsor image URL (optional)
              <input id="owner-bc-sp-image" type="url" maxlength="2000" value="${sponsorImage}"
                class="mt-1 w-full bg-zinc-900 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:border-violet-500"
                placeholder="https://…/banner.png or upload above" />
            </label>
            <div id="owner-bc-sp-preview" class="mt-1 ${sponsorImage ? '' : 'hidden'}">
              <img src="${sponsorImage || ''}" alt="Sponsor preview" class="max-h-24 rounded-lg border border-white/10 bg-black/30 object-contain" />
            </div>
          </div>
        </div>
      </div>

      <div class="flex flex-wrap items-center gap-2 mt-4">
        <button type="button" id="owner-bc-publish" class="px-5 py-2.5 bg-violet-600 hover:bg-violet-500 rounded-2xl text-sm font-semibold">
          Publish message (turn ON)
        </button>
        <button type="button" id="owner-bc-turn-off" class="px-5 py-2.5 bg-zinc-700 hover:bg-zinc-600 rounded-2xl text-sm font-semibold">
          Turn OFF banner (owner only)
        </button>
      </div>
    </div>
  `;
}
