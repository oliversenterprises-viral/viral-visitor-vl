import { supabase } from '../lib/supabase';
import { uploadBannerImage, BANNER_UPLOAD_ACCEPT } from '../lib/banner-upload';
import { formatError } from '../lib';
import {
  mapSiteContentAdminRows,
  resolveWebsiteTabLoad,
  websiteTabUnknownActionBanner,
  type WebsiteTabLoad,
} from '../lib/site-content-admin';
import { showToast } from '../ui';

/** Lightweight row shape used by the Edit Content admin tab */
interface ContentRow {
  id: string;
  value?: unknown;
}

interface Banner {
  imageUrl: string;
  redirectUrl: string;
  label?: string;
  enabled?: boolean;
  weight?: number;
}

/** Escape text for safe insertion into admin innerHTML templates. */
function escapeHtml(text: string): string {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Serialize site_content values for the edit textarea (handles JSONB objects/arrays). */
function formatValueForInput(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'object') return JSON.stringify(value, null, 2);
  return String(value);
}

/** On-brand banners hosted on viralrefer.app — swap into the winner/prize card slot from admin. */
const BANNER_PRESETS = [
  {
    id: 'winner-spotlight',
    label: 'Winner Spotlight',
    imageUrl: 'https://www.viralrefer.app/assets/banners/winner-spotlight.svg',
    redirectUrl: 'https://www.viralrefer.app/#prize',
    hint: 'Default #1 winner slot',
  },
  {
    id: 'featured-partner',
    label: 'Featured Partner',
    imageUrl: 'https://www.viralrefer.app/assets/banners/featured-partner.svg',
    redirectUrl: 'https://www.viralrefer.app/',
    hint: 'Partner spotlight — change redirect URL to their site',
  },
] as const;

async function loadWebsiteTabState(): Promise<WebsiteTabLoad> {
  let adminResult: { success: boolean; data?: unknown; error?: string } | undefined;
  try {
    const { invokeAdminAction } = await import('../lib/admin-action-client');
    adminResult = await invokeAdminAction<unknown>('get_site_content');
  } catch (err) {
    adminResult = {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
  try {
    const { data, error } = await supabase.from('site_content').select('*');
    return resolveWebsiteTabLoad({
      adminResult,
      publicRows: data || [],
      publicError: error?.message,
    });
  } catch (err) {
    return resolveWebsiteTabLoad({
      adminResult,
      publicError: err instanceof Error ? err.message : String(err),
    });
  }
}

async function saveSiteContentEntry(key: string, value: unknown): Promise<boolean> {
  try {
    const { invokeAdminAction } = await import('../lib/admin-action-client');
    const result = await invokeAdminAction('update_site_content', { key, value });
    if (result.success) return true;
  } catch {
    // fall through to direct upsert
  }
  try {
    const { error } = await supabase.from('site_content').upsert({ key, value }, { onConflict: 'key' });
    return !error;
  } catch {
    return false;
  }
}

/**
 * Admin Tab: Edit Site Content (Live CMS)
 *
 * Full-featured editor for the `site_content` key-value store.
 * Allows admins to add, edit, delete, and search all dynamic content
 * that powers the public homepage.
 */
async function renderEditContentTab(content: HTMLElement) {
  content.dataset.vrEditContentRoot = '1';
  content.innerHTML = `
    <div class="flex items-center justify-between mb-4">
      <div>
        <div class="h-7 w-48 skeleton mb-1"></div>
        <div class="h-4 w-36 skeleton"></div>
      </div>
      <div class="h-10 w-32 skeleton rounded-2xl"></div>
    </div>

    <!-- Permanent prominent entry point for Multi-Banner v2 (always visible, hard to miss) -->
    <div class="mb-4 p-4 bg-emerald-900/30 border-2 border-emerald-500 rounded-2xl">
      <div class="flex items-center justify-between gap-4">
        <div>
          <div class="font-bold text-emerald-400 text-lg">Multi-Banner Rotation (v2) for Right Prize Card</div>
          <div class="text-sm text-zinc-300 mt-1">This is the modern way to manage rotating banners on the right prize card (with weights, thumbnails, drag & drop).</div>
        </div>
        <button id="open-banners-v2-btn" class="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-sm font-semibold rounded-2xl whitespace-nowrap flex-shrink-0">Open Rich Editor</button>
      </div>
    </div>

    <div class="space-y-3">
      <div class="h-16 skeleton rounded-2xl"></div>
      <div class="h-16 skeleton rounded-2xl"></div>
      <div class="h-16 skeleton rounded-2xl"></div>
    </div>
  `;

  // Guard concurrent full reloads (live poll used to stack loadAndRenderList and race stats panels)
  let loadGeneration = 0;
  let loadInFlight = false;

  // Thin reload function: fetch → build HTML → attach listeners
  async function loadAndRenderList() {
    if (loadInFlight) return;
    loadInFlight = true;
    const gen = ++loadGeneration;
    try {
      const loaded = await loadWebsiteTabState();
      if (gen !== loadGeneration) return;

      const html = buildContentListHTML(loaded.rows, loaded);
      content.innerHTML = html;
      attachContentListeners(content, loadAndRenderList, loaded.rows);
      if (gen !== loadGeneration) return;

  // Wire up the prominent "Create Multi-Banner Rotation (v2)" button if it exists
  const createBannersBtn = content.querySelector('#create-banners-key-btn') as HTMLButtonElement | null;
  if (createBannersBtn) {
    createBannersBtn.onclick = () => {
      const starterBanners = [
        {
          imageUrl: "https://example.com/banner1.jpg",
          redirectUrl: "https://example.com",
          label: "Example Banner 1",
          enabled: true,
          weight: 1
        },
        {
          imageUrl: "https://example.com/banner2.jpg",
          redirectUrl: "https://example.com/offer",
          label: "Example Banner 2 (higher weight)",
          enabled: true,
          weight: 3
        }
      ];
      // Create the row by triggering the add flow with prefilled data
      const addBtn = content.querySelector('#add-content-btn') as HTMLButtonElement | null;
      if (addBtn) addBtn.click();

      // After the form opens, prefill it
      setTimeout(() => {
        const keyInput = document.getElementById('content-key') as HTMLInputElement | null;
        const valInput = document.getElementById('content-value') as HTMLTextAreaElement | null;
        if (keyInput) {
          keyInput.value = 'banners';
          keyInput.dispatchEvent(new Event('input', { bubbles: true }));
        }
        if (valInput) {
          valInput.value = JSON.stringify(starterBanners, null, 2);
        }
      }, 50);
    };
  }

    } catch (err) {
      const loaded = resolveWebsiteTabLoad({
        adminResult: {
          success: false,
          error: err instanceof Error ? err.message : formatError(err),
        },
      });
      content.innerHTML = buildContentListHTML([], loaded);
      attachContentListeners(content, loadAndRenderList, []);
    } finally {
      loadInFlight = false;
    }
  }

  await loadAndRenderList();

  // Wire the always-visible v2 banners button
  const openV2Btn = content.querySelector('#open-banners-v2-btn') as HTMLButtonElement | null;
  if (openV2Btn) {
    openV2Btn.onclick = () => {
      // Find or create the banners row by triggering add/edit for "banners"
      const existingBannersRow = Array.from(content.querySelectorAll('.edit-btn')).find(
        (el): el is HTMLButtonElement => el instanceof HTMLButtonElement && el.dataset.id === 'banners',
      );
      if (existingBannersRow) {
        existingBannersRow.click();
      } else {
        // If no row yet, open add form and prefill "banners"
        const addBtn = content.querySelector('#add-content-btn') as HTMLButtonElement | null;
        if (addBtn) addBtn.click();
        setTimeout(() => {
          const keyInput = document.getElementById('content-key') as HTMLInputElement | null;
          if (keyInput) {
            keyInput.value = 'banners';
            keyInput.dispatchEvent(new Event('input', { bubbles: true }));
          }
        }, 60);
      }
    };
  }

  // Aggressive fix for visibility: Inject v2 management directly into the existing v1 "Homepage Banner (Prize Card)" card
  // This targets the green card the user sees every time, so v2 becomes impossible to miss.
  setTimeout(() => {
    const v1Card = Array.from(content.querySelectorAll('div')).find((el: HTMLElement) => 
      el.textContent?.includes('Homepage Banner (Prize Card) v1') || 
      el.textContent?.includes('This is what appears in the right prize card')
    ) as HTMLElement | null;

    if (v1Card && !v1Card.querySelector('[data-v2-injected="true"]')) {
      const v2Section = document.createElement('div');
      v2Section.setAttribute('data-v2-injected', 'true');
      v2Section.className = 'mt-4 pt-4 border-t border-emerald-500/30';
      v2Section.innerHTML = `
        <div class="text-emerald-400 font-semibold text-sm mb-1">Multi-Banner Rotation (v2) — New</div>
        <div class="text-xs text-zinc-400 mb-2">Switch to the modern system for multiple rotating banners with weights on the right prize card.</div>
        <button id="inject-v2-editor-btn" class="px-4 py-1.5 text-xs bg-emerald-600 hover:bg-emerald-500 rounded-xl font-semibold">Open Multi-Banner Rich Editor</button>
      `;
      v1Card.appendChild(v2Section);

      const injectBtn = v2Section.querySelector('#inject-v2-editor-btn') as HTMLButtonElement | null;
      if (injectBtn) {
        injectBtn.onclick = () => {
          const existingBanners = Array.from(content.querySelectorAll('.edit-btn')).find(
            (el): el is HTMLButtonElement => el instanceof HTMLButtonElement && el.dataset.id === 'banners',
          );
          if (existingBanners) {
            existingBanners.click();
          } else {
            const addBtn = content.querySelector('#add-content-btn') as HTMLButtonElement | null;
            if (addBtn) addBtn.click();
            setTimeout(() => {
              const key = document.getElementById('content-key') as HTMLInputElement | null;
              if (key) {
                key.value = 'banners';
                key.dispatchEvent(new Event('input', { bubbles: true }));
              }
            }, 50);
          }
        };
      }
    }
  }, 300);
}

/**
 * Builds the HTML for the content list view (header, search, add button, rows, and hidden form area).
 * Pure function — no side effects.
 */
function contentKeyValue(rows: ContentRow[], key: string): string {
  const row = rows.find((r) => r.id === key);
  return formatValueForInput(row?.value);
}

function isBroadcastEnabledValue(raw: string): boolean {
  const s = String(raw || '')
    .trim()
    .toLowerCase();
  return s === '1' || s === 'true' || s === 'yes' || s === 'on';
}

function buildContentListHTML(rows: ContentRow[], load?: WebsiteTabLoad): string {
  const bcEnabled = isBroadcastEnabledValue(contentKeyValue(rows, 'owner_broadcast_enabled'));
  const bcTitle = escapeHtml(contentKeyValue(rows, 'owner_broadcast_title'));
  const bcBody = escapeHtml(contentKeyValue(rows, 'owner_broadcast_body'));
  const bcId = escapeHtml(contentKeyValue(rows, 'owner_broadcast_id'));
  const bcSpLabel = escapeHtml(contentKeyValue(rows, 'owner_broadcast_sponsor_label'));
  const bcSpUrl = escapeHtml(contentKeyValue(rows, 'owner_broadcast_sponsor_url'));
  const bcSpImage = escapeHtml(contentKeyValue(rows, 'owner_broadcast_sponsor_image'));
  const bcSpCta = escapeHtml(contentKeyValue(rows, 'owner_broadcast_sponsor_cta'));
  const bcMedia = escapeHtml(contentKeyValue(rows, 'owner_broadcast_media_url'));

  let html = `
    <div class="flex items-center justify-between mb-4">
      <div>
        <div class="text-2xl font-bold">Edit Site Content</div>
        <div class="text-sm text-zinc-400">Change the words on the public site. Saves go live right away.</div>
      </div>
      <div class="flex items-center gap-3">
        <span id="content-live-indicator" class="hidden text-[10px] text-emerald-400/80"><i class="fa-solid fa-circle text-[6px] mr-1"></i>live</span>
        <span id="content-last-updated" class="text-[10px] text-zinc-500"></span>
        <input id="content-search" type="text" placeholder="Search keys..." 
               class="w-48 bg-zinc-900 border border-white/10 rounded-xl px-3 py-1.5 text-sm focus:border-violet-500" />
        <button id="add-content-btn" class="px-5 py-2.5 bg-violet-600 hover:bg-violet-500 rounded-2xl text-sm font-semibold flex items-center gap-2">
          <i class="fa-solid fa-plus"></i> Add New Key
        </button>
      </div>
    </div>
    ${websiteTabUnknownActionBanner(load || { rows: [], via: 'get_site_content', actionMissing: false })
      ? `<div data-hq-website-action-missing="1" class="mb-4 p-4 rounded-2xl border border-amber-400/40 bg-amber-950/40 text-amber-100 text-sm">
        <div class="font-semibold">Website is not an empty CMS</div>
        <p class="mt-1 text-amber-100/85">${escapeHtml(websiteTabUnknownActionBanner(load!) || '')}</p>
        <button type="button" data-hq-website-retry="1" class="mt-3 px-4 py-2 text-sm bg-white/10 rounded-2xl">Retry</button>
      </div>`
      : ''}

    <!-- Owner Talk: message everyone who visits (no email — product is no-signup) -->
    <div id="owner-broadcast-panel" data-hq-talk="1" class="mb-4 p-5 rounded-2xl border-2 border-violet-500/50 bg-violet-950/30">
      <div class="flex flex-wrap items-start justify-between gap-3 mb-3">
        <div>
          <div class="text-lg font-bold text-violet-200 flex items-center gap-2">
            <i class="fa-solid fa-bullhorn"></i> Message all joiners
          </div>
          <p class="text-xs text-zinc-400 mt-1 max-w-xl">
            Banner for everyone on the site. <strong class="text-violet-200">Only you can remove it</strong> (Turn OFF). Links: paste full <code class="text-violet-300">https://…</code> URLs or use <code class="text-violet-300">[label](https://…)</code>. Optional sponsor ad below.
          </p>
        </div>
        <span class="text-[10px] font-bold uppercase tracking-wide px-2 py-1 rounded-full border ${
          bcEnabled
            ? 'border-emerald-400/50 text-emerald-300 bg-emerald-500/10'
            : 'border-zinc-500/40 text-zinc-400 bg-zinc-800/50'
        }">${bcEnabled ? 'LIVE on site' : 'Off'}</span>
      </div>
      <div class="grid gap-3 md:grid-cols-2">
        <label class="block text-xs text-zinc-400">
          Title
          <input id="owner-bc-title" type="text" maxlength="120" value="${bcTitle}"
            class="mt-1 w-full bg-zinc-900 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:border-violet-500"
            placeholder="e.g. Rule reminder: 48h to lock" />
        </label>
        <label class="block text-xs text-zinc-400">
          Message id (optional)
          <input id="owner-bc-id" type="text" maxlength="80" value="${bcId}"
            class="mt-1 w-full bg-zinc-900 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:border-violet-500"
            placeholder="e.g. rules-2026-08-11" />
        </label>
      </div>
      <label class="block text-xs text-zinc-400 mt-3">
        Message body (links auto-clickable)
        <textarea id="owner-bc-body" rows="4" maxlength="2000"
          class="mt-1 w-full bg-zinc-900 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:border-violet-500"
          placeholder="Text + https://example.com or [Get Safelist Traffic](https://example.com)">${bcBody}</textarea>
      </label>

      <div class="mt-4 pt-4 border-t border-violet-400/25">
        <div class="text-sm font-semibold text-violet-200 mb-2 flex items-center gap-2">
          <i class="fa-solid fa-image"></i> Message image (optional)
        </div>
        <p class="text-[11px] text-zinc-500 mb-3">Upload JPG/PNG/GIF/WebP/SVG (max 2MB) or paste a https:// image URL. Shows under the title for everyone.</p>
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
          <input id="owner-bc-media-url" type="url" maxlength="2000" value="${bcMedia}"
            class="mt-1 w-full bg-zinc-900 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:border-violet-500"
            placeholder="https://…/image.png or upload above" />
        </label>
        <div id="owner-bc-media-preview" class="mt-2 ${bcMedia ? '' : 'hidden'}">
          <img src="${bcMedia || ''}" alt="Broadcast media preview" class="max-h-28 rounded-lg border border-white/10 bg-black/30 object-contain" />
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
            <input id="owner-bc-sp-label" type="text" maxlength="80" value="${bcSpLabel}"
              class="mt-1 w-full bg-zinc-900 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:border-violet-500"
              placeholder="e.g. Get Safelist Traffic" />
          </label>
          <label class="block text-xs text-zinc-400">
            Button label
            <input id="owner-bc-sp-cta" type="text" maxlength="40" value="${bcSpCta}"
              class="mt-1 w-full bg-zinc-900 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:border-violet-500"
              placeholder="Visit sponsor" />
          </label>
          <label class="block text-xs text-zinc-400 md:col-span-2">
            Sponsor click URL (required for ad)
            <input id="owner-bc-sp-url" type="url" maxlength="2000" value="${bcSpUrl}"
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
              <input id="owner-bc-sp-image" type="url" maxlength="2000" value="${bcSpImage}"
                class="mt-1 w-full bg-zinc-900 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:border-violet-500"
                placeholder="https://…/banner.png or upload above" />
            </label>
            <div id="owner-bc-sp-preview" class="mt-1 ${bcSpImage ? '' : 'hidden'}">
              <img src="${bcSpImage || ''}" alt="Sponsor preview" class="max-h-24 rounded-lg border border-white/10 bg-black/30 object-contain" />
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

    <div id="content-list" class="space-y-3">
  `;

  const hasBannersKey = rows.some(r => r.id === 'banners');

  if (rows.length === 0) {
    if (load?.actionMissing) {
      html += `<div data-hq-website-not-empty="1" class="py-8 text-center text-amber-100/90 border border-amber-400/30 rounded-2xl">Keys did not load. This is not an empty CMS. Talk (message all joiners) stays on this tab. Prize is under More.</div>`;
    } else {
      html += `<div class="py-8 text-center text-zinc-400 border border-white/10 rounded-2xl">No content entries yet.<br><span class="text-xs">Click "Add New Key" above to start managing your public site content.</span></div>`;
    }
  } else {
    rows.forEach((row: ContentRow) => {
      const valStr = String(row.value ?? '');
      const valPreview = escapeHtml(valStr.slice(0, 80));
      const safeId = escapeHtml(row.id);

      if (row.id === 'banners') {
        // Special prominent card for Multi-Banner Rotation v2
        html += `
          <div class="bg-emerald-900/30 border-2 border-emerald-500 rounded-2xl p-5 flex flex-col md:flex-row md:items-center gap-4">
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2">
                <span class="font-semibold text-emerald-400">Right Prize Card - Multi Banner Rotation (v2)</span>
                <span class="text-[10px] px-2 py-0.5 bg-emerald-600 text-white rounded">RECOMMENDED</span>
              </div>
              <div class="text-sm text-zinc-300 mt-1">Manage multiple rotating banners with weights, thumbnails, drag & drop. This controls what appears in the right prize card on the public site.</div>
              <div class="text-xs text-emerald-400/70 mt-1">Current value: ${valPreview}...</div>
            </div>
            <div class="flex gap-2 flex-shrink-0">
              <button data-id="${safeId}" class="edit-btn px-5 py-2 text-sm bg-emerald-600 hover:bg-emerald-500 font-semibold rounded-2xl">Edit Banners (Rich Editor)</button>
              <button data-id="${safeId}" class="delete-btn px-4 py-2 text-sm bg-red-600/20 hover:bg-red-600/40 text-red-400 rounded-2xl">Delete</button>
            </div>
          </div>`;
      } else {
        html += `
          <div class="bg-zinc-900 border border-white/10 rounded-2xl p-4 flex flex-col md:flex-row md:items-center gap-4">
            <div class="flex-1 min-w-0">
              <div class="font-mono text-emerald-400 text-sm">${safeId}</div>
              <div class="text-sm mt-2 text-zinc-300 break-all">${valPreview}${valStr.length > 79 ? '…' : ''}</div>
            </div>
            <div class="flex gap-2 flex-shrink-0">
              <button data-id="${safeId}" class="edit-btn px-4 py-1.5 text-sm bg-white/10 hover:bg-white/20 rounded-xl">Edit</button>
              <button data-id="${safeId}" class="delete-btn px-4 py-1.5 text-sm bg-red-600/20 hover:bg-red-600/40 text-red-400 rounded-xl">Delete</button>
            </div>
          </div>`;
      }
    });
  }

  // Prominent call-to-action for Multi-Banner Rotation v2 if the key doesn't exist yet
  if (!hasBannersKey) {
    html += `
      <div class="bg-emerald-900/20 border border-emerald-500/40 rounded-2xl p-5 mb-3">
        <div class="flex items-start justify-between gap-4">
          <div>
            <div class="font-semibold text-emerald-400">Multi-Banner Rotation (v2) — Recommended</div>
            <div class="text-sm text-zinc-300 mt-1">Control multiple rotating banners on the right prize card with weights, thumbnails, and easy management.</div>
            <div class="text-xs text-emerald-400/80 mt-2">This powers the dynamic banners on the public homepage right card.</div>
          </div>
          <button id="create-banners-key-btn" class="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-sm font-semibold rounded-2xl whitespace-nowrap">Create & Edit</button>
        </div>
      </div>
    `;
  }

  html += `</div>`;

  // Form area (Add New Key + Save / Cancel)
  html += `
    <div id="content-form-area" class="mt-6 hidden border border-white/10 bg-zinc-950 rounded-2xl p-6">
      <div class="font-semibold mb-3" id="form-title">Add New Content Entry</div>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label class="block text-xs text-zinc-400 mb-1">ID / Key (unique text)</label>
          <input id="content-key" class="w-full bg-zinc-900 border border-white/20 rounded-xl px-4 py-3 text-sm font-mono" placeholder="hero_title">
        </div>
        <div>
          <label class="block text-xs text-zinc-400 mb-1">Note (optional, not saved)</label>
          <input id="content-desc" class="w-full bg-zinc-900 border border-white/20 rounded-xl px-4 py-3 text-sm" placeholder="Admin note (UI only)">
        </div>
      </div>
      <div class="mt-3">
        <label class="block text-xs text-zinc-400 mb-1">Value (plain text)</label>
        <textarea id="content-value" rows="4" class="w-full bg-zinc-900 border border-white/20 rounded-xl px-4 py-3 text-sm font-mono" placeholder="Enter the content value here"></textarea>
      </div>
      <div class="flex gap-3 mt-4">
        <button id="save-content-btn" class="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 rounded-2xl font-semibold">Save (upsert)</button>
        <button id="cancel-content-btn" class="flex-1 py-3 bg-white/10 hover:bg-white/20 rounded-2xl font-semibold">Cancel</button>
      </div>
    </div>
  `;

  return html;
}

/**
 * Shows the add/edit form for a content entry.
 * Accepts a reload function so it can refresh the list after save/cancel without tight coupling.
 */
function showContentForm(
  existing: ContentRow | undefined,
  reloadList: () => Promise<void>
) {
  const formArea = document.getElementById('content-form-area')!;
  const keyInput = document.getElementById('content-key') as HTMLInputElement;
  const descInput = document.getElementById('content-desc') as HTMLInputElement;
  const valInput = document.getElementById('content-value') as HTMLTextAreaElement;
  const titleEl = document.getElementById('form-title')!;
  const saveBtn = document.getElementById('save-content-btn') as HTMLButtonElement | null;

  formArea.classList.remove('hidden');

  if (existing) {
    titleEl.textContent = `Editing: ${existing.id}`;
    keyInput.value = existing.id || '';
    keyInput.disabled = true;
    descInput.value = '';
    valInput.value = formatValueForInput(existing.value);
  } else {
    titleEl.textContent = 'Add New Content Entry';
    keyInput.value = '';
    keyInput.disabled = false;
    descInput.value = '';
    valInput.value = '';
  }

  // Save handler
  if (saveBtn) {
    saveBtn.onclick = async () => {
      const key = keyInput.value.trim();
      if (!key) {
        alert('ID / Key is required');
        return;
      }

      const rawVal = valInput.value.trim();
      let parsedValue: unknown = rawVal;
      try {
        parsedValue = JSON.parse(rawVal);
      } catch {
        // keep as string
      }

      const originalSaveText = saveBtn.textContent;
      saveBtn.textContent = 'Saving...';
      saveBtn.disabled = true;

      const saved = await saveSiteContentEntry(key, parsedValue);

      saveBtn.textContent = originalSaveText || 'Save (upsert)';
      saveBtn.disabled = false;
      if (!saved) {
        showToast('Save failed — check admin secret or try again', 'info');
        return;
      }
      await reloadList();
      const reloadPublic = (window as { loadSiteContent?: () => Promise<void> }).loadSiteContent;
      if (typeof reloadPublic === 'function') {
        await reloadPublic().catch(() => {});
      }
      showToast('Content saved successfully', 'success');
    };
  }

  const cancelBtn = document.getElementById('cancel-content-btn');
  if (cancelBtn) {
    cancelBtn.onclick = () => {
      reloadList();
    };
  }

  // Phase 2 Banner v2: Use rich array editor instead of raw JSON when the key is "banners"
  const activateBannersEditorIfNeeded = () => {
    if (keyInput.value === 'banners') {
      // More reliable guard: check if our injected editor container already exists
      const alreadyActive = formArea.querySelector('[data-banners-editor-active="true"]');
      if (!alreadyActive) {
        setupBannersArrayEditor(valInput, formArea);
      }
    }
  };

  activateBannersEditorIfNeeded();

  // Also watch for the user typing "banners" as a new key (so the rich editor appears immediately)
  keyInput.addEventListener('input', activateBannersEditorIfNeeded);
}

/**
 * Attaches all interactive listeners for the Edit Site Content view
 * after the HTML has been rendered by buildContentListHTML.
 *
 * Handles: search filtering, Add New Key, Edit, and Delete actions.
 */
function attachContentListeners(content: HTMLElement, reloadList: () => Promise<void>, rows: ContentRow[]) {
  content.querySelectorAll<HTMLButtonElement>('[data-hq-website-retry]').forEach((btn) => {
    btn.onclick = () => {
      void reloadList();
    };
  });

  // Update last refreshed timestamp
  const contentTs = content.querySelector('#content-last-updated');
  if (contentTs) {
    const now = new Date();
    contentTs.textContent = `Updated ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  }

  // Owner broadcast panel (message all site visitors via site_content)
  const publishBc = content.querySelector('#owner-bc-publish') as HTMLButtonElement | null;
  const offBc = content.querySelector('#owner-bc-turn-off') as HTMLButtonElement | null;
  function wireBroadcastImageUpload(opts: {
    fileInputId: string;
    uploadBtnId: string;
    clearBtnId: string;
    urlInputId: string;
    previewId: string;
    statusId: string;
  }): void {
    const fileInput = content.querySelector(`#${opts.fileInputId}`) as HTMLInputElement | null;
    const uploadBtn = content.querySelector(`#${opts.uploadBtnId}`) as HTMLButtonElement | null;
    const clearBtn = content.querySelector(`#${opts.clearBtnId}`) as HTMLButtonElement | null;
    const urlInput = content.querySelector(`#${opts.urlInputId}`) as HTMLInputElement | null;
    const preview = content.querySelector(`#${opts.previewId}`) as HTMLElement | null;
    const status = content.querySelector(`#${opts.statusId}`) as HTMLElement | null;
    const previewImg = preview?.querySelector('img') as HTMLImageElement | null;

    const syncPreview = (url: string) => {
      if (!preview || !previewImg) return;
      if (url) {
        previewImg.src = url;
        preview.classList.remove('hidden');
      } else {
        previewImg.removeAttribute('src');
        preview.classList.add('hidden');
      }
    };

    if (uploadBtn && fileInput) {
      uploadBtn.onclick = () => fileInput.click();
      fileInput.onchange = async () => {
        const file = fileInput.files?.[0];
        fileInput.value = '';
        if (!file) return;
        if (status) status.textContent = 'Uploading…';
        uploadBtn.disabled = true;
        try {
          const url = await uploadBannerImage(file);
          if (urlInput) urlInput.value = url;
          syncPreview(url);
          if (status) status.textContent = 'Uploaded — publish to go live';
          showToast('Image uploaded', 'success');
        } catch (err) {
          if (status) status.textContent = '';
          showToast(formatError(err) || 'Upload failed', 'info');
        } finally {
          uploadBtn.disabled = false;
        }
      };
    }
    if (clearBtn) {
      clearBtn.onclick = () => {
        if (urlInput) urlInput.value = '';
        syncPreview('');
        if (status) status.textContent = 'Cleared';
      };
    }
    if (urlInput) {
      urlInput.addEventListener('input', () => syncPreview(urlInput.value.trim()));
    }
  }

  wireBroadcastImageUpload({
    fileInputId: 'owner-bc-media-file',
    uploadBtnId: 'owner-bc-media-upload',
    clearBtnId: 'owner-bc-media-clear',
    urlInputId: 'owner-bc-media-url',
    previewId: 'owner-bc-media-preview',
    statusId: 'owner-bc-media-status',
  });
  wireBroadcastImageUpload({
    fileInputId: 'owner-bc-sp-file',
    uploadBtnId: 'owner-bc-sp-upload',
    clearBtnId: 'owner-bc-sp-clear',
    urlInputId: 'owner-bc-sp-image',
    previewId: 'owner-bc-sp-preview',
    statusId: 'owner-bc-sp-status',
  });

  if (publishBc) {
    publishBc.onclick = async () => {
      const title = (content.querySelector('#owner-bc-title') as HTMLInputElement | null)?.value?.trim() || '';
      const body = (content.querySelector('#owner-bc-body') as HTMLTextAreaElement | null)?.value?.trim() || '';
      const id = (content.querySelector('#owner-bc-id') as HTMLInputElement | null)?.value?.trim() || '';
      const mediaUrl = (content.querySelector('#owner-bc-media-url') as HTMLInputElement | null)?.value?.trim() || '';
      const spLabel = (content.querySelector('#owner-bc-sp-label') as HTMLInputElement | null)?.value?.trim() || '';
      const spUrl = (content.querySelector('#owner-bc-sp-url') as HTMLInputElement | null)?.value?.trim() || '';
      const spImage = (content.querySelector('#owner-bc-sp-image') as HTMLInputElement | null)?.value?.trim() || '';
      const spCta = (content.querySelector('#owner-bc-sp-cta') as HTMLInputElement | null)?.value?.trim() || '';
      if (!body && !spUrl && !mediaUrl) {
        showToast('Add a message body, image, and/or a sponsor click URL', 'info');
        return;
      }
      if (mediaUrl) {
        try {
          const u = new URL(mediaUrl);
          if (u.protocol !== 'https:' && u.protocol !== 'http:') {
            showToast('Message image URL must start with https://', 'info');
            return;
          }
        } catch {
          showToast('Message image URL is not valid', 'info');
          return;
        }
      }
      if (spUrl) {
        try {
          const u = new URL(spUrl);
          if (u.protocol !== 'https:' && u.protocol !== 'http:') {
            showToast('Sponsor URL must start with https://', 'info');
            return;
          }
        } catch {
          showToast('Sponsor URL is not a valid link', 'info');
          return;
        }
      }
      if (spImage) {
        try {
          const u = new URL(spImage);
          if (u.protocol !== 'https:' && u.protocol !== 'http:') {
            showToast('Sponsor image URL must start with https://', 'info');
            return;
          }
        } catch {
          showToast('Sponsor image URL is not valid', 'info');
          return;
        }
      }
      publishBc.disabled = true;
      publishBc.textContent = 'Publishing…';
      const ok =
        (await saveSiteContentEntry('owner_broadcast_enabled', '1')) &&
        (await saveSiteContentEntry('owner_broadcast_title', title || 'Message from ViralRefer')) &&
        (await saveSiteContentEntry('owner_broadcast_body', body.slice(0, 2000))) &&
        (await saveSiteContentEntry(
          'owner_broadcast_id',
          id || `bc-${new Date().toISOString().slice(0, 10)}`,
        )) &&
        (await saveSiteContentEntry('owner_broadcast_media_url', mediaUrl.slice(0, 2000))) &&
        (await saveSiteContentEntry('owner_broadcast_sponsor_label', spLabel.slice(0, 80))) &&
        (await saveSiteContentEntry('owner_broadcast_sponsor_url', spUrl.slice(0, 2000))) &&
        (await saveSiteContentEntry('owner_broadcast_sponsor_image', spImage.slice(0, 2000))) &&
        (await saveSiteContentEntry('owner_broadcast_sponsor_cta', spCta.slice(0, 40)));
      publishBc.disabled = false;
      publishBc.textContent = 'Publish message (turn ON)';
      if (ok) {
        showToast('Broadcast live — visitors will see it on next load', 'success');
        await reloadList();
      } else {
        showToast('Publish failed — check admin access', 'info');
      }
    };
  }
  if (offBc) {
    offBc.onclick = async () => {
      offBc.disabled = true;
      const ok = await saveSiteContentEntry('owner_broadcast_enabled', '0');
      offBc.disabled = false;
      if (ok) {
        showToast('Broadcast turned off', 'info');
        await reloadList();
      } else {
        showToast('Could not turn off — check admin access', 'info');
      }
    };
  }

  // Attach Add New Key button
  const addBtn = content.querySelector('#add-content-btn') as HTMLButtonElement | null;
  if (addBtn) {
    addBtn.onclick = () => showContentForm(undefined, reloadList);
  }

  // Simple client-side search for content keys
  const searchInput = content.querySelector('#content-search') as HTMLInputElement | null;
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      const q = searchInput.value.toLowerCase().trim();
      content.querySelectorAll('#content-list > div').forEach((card) => {
        const text = (card as HTMLElement).textContent?.toLowerCase() || '';
        (card as HTMLElement).style.display = text.includes(q) ? '' : 'none';
      });
    });
  }

  // Edit buttons — pass full row so the form loads the current value (not just the key)
  content.querySelectorAll('.edit-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = (btn as HTMLElement).dataset.id!;
      const row = rows.find((r) => r.id === id);
      showContentForm(row ?? { id }, reloadList);
    });
  });

  // Delete with confirmation + loading state on button (uses id)
  content.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = (btn as HTMLElement).dataset.id!;
      if (!confirm(`Delete content entry "${id}"? This cannot be undone.`)) return;

      (btn as HTMLElement).textContent = 'Deleting...';
      (btn as HTMLElement as HTMLButtonElement).disabled = true;

      let deleted = false;
      try {
        const { invokeAdminAction } = await import('../lib/admin-action-client');
        const result = await invokeAdminAction('delete_site_content', { key: id });
        if (result.success) {
          deleted = true;
        } else {
          const { error: delErr } = await supabase.from('site_content').delete().eq('key', id);
          if (!delErr) deleted = true;
        }
      } catch {
        try {
          const { error: delErr } = await supabase.from('site_content').delete().eq('key', id);
          if (!delErr) deleted = true;
        } catch {
          /* demo / RLS graceful fallback */
        }
      }
      if (deleted) {
        await reloadList();
        showToast('Content deleted', 'info');
      } else {
        showToast('Delete failed — check admin access', 'info');
        (btn as HTMLElement).textContent = 'Delete';
        (btn as HTMLElement as HTMLButtonElement).disabled = false;
      }
    });
  });
}

export { renderEditContentTab, buildContentListHTML };

/**
 * Phase 2: Improved user-friendly editor for the "banners" key.
 * Features:
 * - Card-based list with live thumbnail previews
 * - Better validation (red borders + messages for missing required fields)
 * - Add / Delete / Reorder (up/down + basic drag-drop support)
 * - Live sync back to the JSON textarea (so existing save logic works)
 */
function setupBannersArrayEditor(valInput: HTMLTextAreaElement, formArea: HTMLElement) {
  valInput.style.display = 'none';

  const container = document.createElement('div');
  container.className = 'mt-2 p-3 border border-white/10 bg-zinc-900 rounded-2xl';
  container.setAttribute('data-banners-editor-active', 'true');

  let banners: Banner[] = [];
  try {
    const parsed = valInput.value ? JSON.parse(valInput.value) : [];
    if (Array.isArray(parsed)) {
      banners = parsed.map((raw) => {
        const b = raw && typeof raw === 'object' ? (raw as Banner) : ({} as Banner);
        return {
          ...b,
          imageUrl: String(b.imageUrl || ''),
          redirectUrl: String(b.redirectUrl || ''),
          weight: typeof b.weight === 'number' && b.weight > 0 ? b.weight : 1,
        };
      });
    }
  } catch (_) {
    banners = [];
  }

  // If the current value was not a valid array (e.g. old single URL or empty), offer easy starter
  let isValidArray = false;
  try {
    const probe = valInput.value.trim() ? JSON.parse(valInput.value) : null;
    isValidArray = Array.isArray(probe);
  } catch {
    isValidArray = false;
  }
  if (!isValidArray || banners.length === 0) {
    const initDiv = document.createElement('div');
    initDiv.className = 'mb-3 p-3 bg-yellow-900/20 border border-yellow-500/40 rounded-xl text-sm';
    initDiv.innerHTML = `
      <div class="text-yellow-400 font-medium">This key had old/non-array data.</div>
      <div class="text-xs text-zinc-400 mt-1">Click below to start fresh with 2 example banners (you can edit/delete them).</div>
      <button id="init-banners-starter" class="mt-2 px-4 py-1.5 text-xs bg-yellow-600 hover:bg-yellow-500 rounded-xl font-semibold">Initialize with Starter Banners + Weights</button>
    `;
    container.appendChild(initDiv);

    // Will attach listener after render
  }

  function applyPreset(preset: (typeof BANNER_PRESETS)[number], mode: 'add' | 'replace-first') {
    const entry = {
      imageUrl: preset.imageUrl,
      redirectUrl: preset.redirectUrl,
      label: preset.label,
      enabled: true,
      weight: 1,
    };
    if (mode === 'replace-first' && banners.length > 0) {
      banners[0] = { ...banners[0], ...entry };
    } else {
      banners.push(entry);
    }
    sync();
    render();
    showToast(`${preset.label} banner added — click Save when ready`, 'info');
  }

  function render() {
    const presetButtons = BANNER_PRESETS.map(
      (p) =>
        `<button type="button" data-preset="${p.id}" data-mode="add" class="preset-add-btn text-[10px] px-2.5 py-1.5 bg-emerald-600/80 hover:bg-emerald-500 rounded-lg font-semibold whitespace-nowrap" title="${p.hint}">+ ${p.label}</button>
         <button type="button" data-preset="${p.id}" data-mode="replace-first" class="preset-replace-btn text-[10px] px-2.5 py-1.5 bg-violet-600/80 hover:bg-violet-500 rounded-lg font-semibold whitespace-nowrap" title="Replace first banner slot">Use as Winner Slot</button>`
    ).join('');

    container.innerHTML = `
      <div class="mb-3 p-3 rounded-xl border border-emerald-500/30 bg-emerald-950/20">
        <div class="text-xs font-semibold text-emerald-400 mb-1">ViralRefer banner templates</div>
        <div class="text-[10px] text-zinc-400 mb-2">One-click branded banners for the prize card winner spot. Edit redirect URL after applying.</div>
        <div class="flex flex-wrap gap-2">${presetButtons}</div>
      </div>
      <div class="flex justify-between items-center mb-2">
        <div class="text-sm font-semibold text-emerald-400">Banners (v2)</div>
        <button id="add-banner" class="text-xs px-3 py-1 bg-violet-600 hover:bg-violet-500 rounded-xl flex items-center gap-1">
          <i class="fa-solid fa-plus text-[10px]"></i> Add Banner
        </button>
      </div>
      <div id="banner-list" class="space-y-3"></div>
    `;

    container.querySelectorAll('[data-preset]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = (btn as HTMLElement).dataset.preset!;
        const mode = ((btn as HTMLElement).dataset.mode || 'add') as 'add' | 'replace-first';
        const preset = BANNER_PRESETS.find((p) => p.id === id);
        if (preset) applyPreset(preset, mode);
      });
    });

    const list = container.querySelector('#banner-list') as HTMLElement;
    const addBtn = container.querySelector('#add-banner') as HTMLButtonElement;

    banners.forEach((b, i) => {
      const hasImg = b.imageUrl && b.imageUrl.trim();
      const hasRedirect = b.redirectUrl && b.redirectUrl.trim();

      const card = document.createElement('div');
      card.className = `bg-zinc-950 border rounded-xl p-3 ${(!hasImg || !hasRedirect) ? 'border-red-500/60' : 'border-white/10'}`;
      card.draggable = true;

      const safeImageUrl = escapeHtml(b.imageUrl || '');
      const safeRedirectUrl = escapeHtml(b.redirectUrl || '');
      const safeLabel = escapeHtml(b.label || '');

      card.innerHTML = `
        <div class="flex gap-3">
          <div class="w-14 h-14 flex-shrink-0 bg-zinc-900 rounded overflow-hidden border border-white/10 flex items-center justify-center">
            ${hasImg 
              ? `<img src="${safeImageUrl}" class="max-w-full max-h-full object-contain" onerror="this.parentElement.innerHTML='<div class=\\'text-[9px] text-red-400 text-center\\'>Bad image</div>'">` 
              : `<div class="text-[10px] text-zinc-500 text-center leading-[14px] p-1">No image</div>`}
          </div>

          <div class="flex-1 text-xs space-y-1.5">
            <div>
              <div class="text-zinc-400 text-[10px]">Image URL ${!hasImg ? '<span class="text-red-400">(required)</span>' : ''}</div>
              <div class="flex gap-1.5 items-center">
                <input data-idx="${i}" data-field="imageUrl" value="${safeImageUrl}" class="flex-1 min-w-0 bg-zinc-900 border border-white/20 rounded px-2 py-1 text-xs" placeholder="https://...jpg or upload below">
                <input type="file" accept="${BANNER_UPLOAD_ACCEPT}" data-idx="${i}" data-field="file" class="hidden banner-file-input">
                <button type="button" data-idx="${i}" data-action="upload" class="text-[10px] px-2 py-1 bg-emerald-600/80 hover:bg-emerald-500 rounded-lg font-semibold whitespace-nowrap">Upload</button>
              </div>
              <div class="text-[9px] text-zinc-500 mt-0.5">JPG, PNG, GIF, WebP, SVG · max 2MB</div>
            </div>
            <div>
              <div class="text-zinc-400 text-[10px]">Redirect URL ${!hasRedirect ? '<span class="text-red-400">(required)</span>' : ''}</div>
              <input data-idx="${i}" data-field="redirectUrl" value="${safeRedirectUrl}" class="w-full bg-zinc-900 border border-white/20 rounded px-2 py-1 text-xs" placeholder="https://...">
            </div>
            <div>
              <div class="text-zinc-400 text-[10px]">Label</div>
              <input data-idx="${i}" data-field="label" value="${safeLabel}" class="w-full bg-zinc-900 border border-white/20 rounded px-2 py-1 text-xs" placeholder="Optional label">
            </div>

            <div>
              <div class="text-zinc-400 text-[10px]">Weight (higher = rotates more often)</div>
              <input type="number" min="1" max="100" data-idx="${i}" data-field="weight" value="${b.weight || 1}" class="w-20 bg-zinc-900 border border-white/20 rounded px-2 py-1 text-xs">
            </div>

            <div class="flex items-center justify-between pt-1">
              <label class="flex items-center gap-1.5 cursor-pointer">
                <input type="checkbox" data-idx="${i}" data-field="enabled" ${b.enabled !== false ? 'checked' : ''} class="accent-violet-500 scale-90">
                <span class="text-[10px]">Enabled</span>
              </label>

              <div class="flex gap-1">
                <button data-idx="${i}" data-action="up" class="text-[10px] px-1.5 py-px bg-white/10 hover:bg-white/20 rounded">↑</button>
                <button data-idx="${i}" data-action="down" class="text-[10px] px-1.5 py-px bg-white/10 hover:bg-white/20 rounded">↓</button>
                <button data-idx="${i}" data-action="del" class="text-[10px] px-1.5 py-px bg-red-500/20 hover:bg-red-500/40 text-red-400 rounded">Del</button>
              </div>
            </div>
          </div>
        </div>
      `;

      // Live updates + live thumbnail refresh
      card.querySelectorAll('input').forEach((el) => {
        const inp = el as HTMLInputElement;
        inp.addEventListener('input', () => {
          const idx = parseInt(inp.dataset.idx || '', 10);
          const field = inp.dataset.field;
          if (!Number.isFinite(idx) || !banners[idx]) return;

          if (field === 'enabled') {
            banners[idx].enabled = inp.checked;
          } else if (field === 'weight') {
            const n = parseInt(inp.value, 10);
            banners[idx].weight = Number.isFinite(n) && n > 0 ? n : 1;
          } else if (field === 'imageUrl') {
            banners[idx].imageUrl = inp.value.trim();
          } else if (field === 'redirectUrl') {
            banners[idx].redirectUrl = inp.value.trim();
          } else if (field === 'label') {
            banners[idx].label = inp.value.trim();
          }

          sync();
          // Refresh thumbnail in this card only
          if (field === 'imageUrl') {
            const thumbWrap = card.querySelector('.w-14');
            if (thumbWrap) {
              const has = banners[idx].imageUrl && banners[idx].imageUrl.trim();
              thumbWrap.innerHTML = has 
                ? `<img src="${banners[idx].imageUrl}" class="max-w-full max-h-full object-contain" onerror="this.parentElement.innerHTML='<div class=\\'text-[9px] text-red-400 text-center\\'>Bad image</div>'">`
                : `<div class="text-[10px] text-zinc-500 text-center leading-[14px] p-1">No image</div>`;
            }
          }
        });
      });

      const refreshBannerThumbnail = (idx: number) => {
        const thumbWrap = card.querySelector('.w-14');
        if (!thumbWrap) return;
        const has = banners[idx].imageUrl && banners[idx].imageUrl.trim();
        thumbWrap.innerHTML = has
          ? `<img src="${banners[idx].imageUrl}" class="max-w-full max-h-full object-contain" onerror="this.parentElement.innerHTML='<div class=\\'text-[9px] text-red-400 text-center\\'>Bad image</div>'">`
          : `<div class="text-[10px] text-zinc-500 text-center leading-[14px] p-1">No image</div>`;
        const hasImgNow = !!banners[idx].imageUrl && banners[idx].imageUrl.trim().length > 0;
        const hasRedirectNow = !!banners[idx].redirectUrl && banners[idx].redirectUrl.trim().length > 0;
        card.className = `bg-zinc-950 border rounded-xl p-3 ${(!hasImgNow || !hasRedirectNow) ? 'border-red-500/60' : 'border-white/10'}`;
      };

      const fileInput = card.querySelector('input[data-field="file"]') as HTMLInputElement | null;
      const uploadBtn = card.querySelector('button[data-action="upload"]') as HTMLButtonElement | null;
      if (fileInput && uploadBtn) {
        uploadBtn.addEventListener('click', () => fileInput.click());
        fileInput.addEventListener('change', async () => {
          const file = fileInput.files?.[0];
          fileInput.value = '';
          if (!file) return;

          const idx = parseInt(fileInput.dataset.idx || '0', 10);
          const originalLabel = uploadBtn.textContent;
          uploadBtn.disabled = true;
          uploadBtn.textContent = 'Uploading…';
          try {
            const url = await uploadBannerImage(file);
            banners[idx].imageUrl = url;
            sync();
            const urlInput = card.querySelector('input[data-field="imageUrl"]') as HTMLInputElement | null;
            if (urlInput) urlInput.value = url;
            refreshBannerThumbnail(idx);
            showToast('Banner image uploaded', 'success');
          } catch (err: unknown) {
            showToast(formatError(err) || 'Banner upload failed', 'info');
          } finally {
            uploadBtn.disabled = false;
            uploadBtn.textContent = originalLabel || 'Upload';
          }
        });
      }

      // Buttons
      card.querySelectorAll('button[data-action]').forEach((el) => {
        const btn = el as HTMLButtonElement;
        btn.addEventListener('click', () => {
          const idx = parseInt(btn.dataset.idx || '', 10);
          const act = btn.dataset.action;
          if (act === 'upload') return;
          if (act === 'del') {
            banners.splice(idx, 1);
            render();
          } else if (act === 'up' && idx > 0) {
            [banners[idx-1], banners[idx]] = [banners[idx], banners[idx-1]];
            render();
          } else if (act === 'down' && idx < banners.length-1) {
            [banners[idx], banners[idx+1]] = [banners[idx+1], banners[idx]];
            render();
          }
        });
      });

      // Drag & drop reordering
      card.addEventListener('dragstart', e => {
        e.dataTransfer!.setData('text/plain', i.toString());
        card.style.opacity = '0.6';
      });
      card.addEventListener('dragend', () => card.style.opacity = '1');
      card.addEventListener('dragover', e => e.preventDefault());
      card.addEventListener('drop', e => {
        e.preventDefault();
        const from = parseInt(e.dataTransfer!.getData('text/plain'));
        if (from === i) return;
        const [m] = banners.splice(from, 1);
        banners.splice(i, 0, m);
        render();
      });

      list.appendChild(card);
    });

    // Add button
    if (addBtn) {
      addBtn.onclick = () => {
        banners.push({ imageUrl: '', redirectUrl: '', label: '', enabled: true, weight: 1 });
        render();
      };
    }

  }

  function sync() {
    valInput.value = JSON.stringify(banners, null, 2);
  }

  // Initial render
  render();

  // Insert into the form
  const valGroup = formArea.querySelector('#content-value')?.parentElement || formArea;
  valGroup.appendChild(container);

  // Keep textarea in sync on first load
  sync();

  // Wire up the "Initialize with Starter" button if it was added for bad data
  const initBtn = container.querySelector('#init-banners-starter') as HTMLButtonElement | null;
  if (initBtn) {
    initBtn.onclick = () => {
      banners = [
        { imageUrl: 'https://via.placeholder.com/600x300/7c3aed/ffffff?text=Banner+1', redirectUrl: 'https://example.com', label: 'First Banner', enabled: true, weight: 1 },
        { imageUrl: 'https://via.placeholder.com/600x300/9333ea/ffffff?text=Banner+2', redirectUrl: 'https://example.com/offer', label: 'Higher Weight Banner', enabled: true, weight: 3 }
      ];
      sync();
      render();
      // Remove the warning box
      const warning = container.querySelector('.bg-yellow-900\\/20');
      if (warning) warning.remove();
    };
  }
}
