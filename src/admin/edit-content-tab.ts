import { supabase } from '../lib/supabase';
import { uploadBannerImage, BANNER_UPLOAD_ACCEPT } from '../lib/banner-upload';
import { formatError } from '../lib';
import { showToast } from '../ui';
import { renderBannerStats, wireBannerStatsQuick } from './banner-stats';
import { wireRedditCampaignStatsQuick } from './reddit-campaign-stats';
import { wireVisitorFunnelStatsQuick } from './visitor-funnel-stats';

/** Lightweight row shape used by the Edit Content admin tab */
interface ContentRow {
  id: string;
  value?: unknown;
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

async function saveSiteContentEntry(key: string, value: unknown): Promise<boolean> {
  const adminSecret = import.meta.env.VITE_ADMIN_ACTION_SECRET || '';
  try {
    const invokeOpts: {
      body: { action: string; payload: { key: string; value: unknown } };
      headers?: Record<string, string>;
    } = {
      body: { action: 'update_site_content', payload: { key, value } },
    };
    if (adminSecret) invokeOpts.headers = { 'x-admin-secret': adminSecret };
    const { data, error } = await supabase.functions.invoke('admin-action', invokeOpts);
    if (!error && data?.success) return true;
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

  // Thin reload function: fetch → build HTML → attach listeners
  async function loadAndRenderList() {
    try {
      const { data, error } = await supabase.from('site_content').select('*');
      if (error) throw error;

      const rows = (data || [])
        .map((row: { key?: string; id?: string; value?: unknown }) => ({
          id: String(row.key ?? row.id ?? ''),
          value: row.value,
        }))
        .filter((row) => row.id)
        .sort((a, b) => a.id.localeCompare(b.id));

      const html = buildContentListHTML(rows);
      content.innerHTML = html;

      attachContentListeners(content, loadAndRenderList, rows);
      await wireVisitorFunnelStatsQuick(content);
      await wireBannerStatsQuick(content);
      await wireRedditCampaignStatsQuick(content);

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
      content.innerHTML = `<div class="p-6 text-red-400">Error loading content: ${formatError(err)}. Please try refreshing the page.</div>`;
    }
  }

  await loadAndRenderList();

  // Wire the always-visible v2 banners button
  const openV2Btn = content.querySelector('#open-banners-v2-btn') as HTMLButtonElement | null;
  if (openV2Btn) {
    openV2Btn.onclick = () => {
      // Find or create the banners row by triggering add/edit for "banners"
      const existingBannersRow = Array.from(content.querySelectorAll('.edit-btn')).find((btn: any) => btn.dataset.id === 'banners') as HTMLButtonElement | null;
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
          const existingBanners = Array.from(content.querySelectorAll('.edit-btn')).find((btn: any) => btn.dataset.id === 'banners') as HTMLButtonElement | null;
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
function buildContentListHTML(rows: ContentRow[]): string {
  let html = `
    <div class="flex items-center justify-between mb-4">
      <div>
        <div class="text-2xl font-bold">Edit Site Content</div>
        <div class="text-sm text-zinc-400">Live CMS — changes are public immediately</div>
      </div>
      <div class="flex items-center gap-3">
        <span id="content-last-updated" class="text-[10px] text-zinc-500"></span>
        <input id="content-search" type="text" placeholder="Search keys..." 
               class="w-48 bg-zinc-900 border border-white/10 rounded-xl px-3 py-1.5 text-sm focus:border-violet-500" />
        <button id="add-content-btn" class="px-5 py-2.5 bg-violet-600 hover:bg-violet-500 rounded-2xl text-sm font-semibold flex items-center gap-2">
          <i class="fa-solid fa-plus"></i> Add New Key
        </button>
      </div>
    </div>
    <div id="visitor-stats-quick" class="mb-4 p-3 border border-violet-500/30 bg-zinc-900/50 rounded-2xl"></div>
    <div id="reddit-stats-quick" class="mb-4 p-3 border border-orange-500/30 bg-zinc-900/50 rounded-2xl"></div>
    <div id="banner-stats-quick" class="mb-4 p-3 border border-emerald-500/30 bg-zinc-900/50 rounded-2xl"></div>
    <div id="content-list" class="space-y-3">
  `;

  const hasBannersKey = rows.some(r => r.id === 'banners');

  if (rows.length === 0) {
    html += `<div class="py-8 text-center text-zinc-400 border border-white/10 rounded-2xl">No content entries yet.<br><span class="text-xs">Click "Add New Key" above to start managing your public site content.</span></div>`;
  } else {
    rows.forEach((row: ContentRow) => {
      const valStr = String(row.value ?? '');
      const valPreview = valStr.slice(0, 80);

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
              <button data-id="${row.id}" class="edit-btn px-5 py-2 text-sm bg-emerald-600 hover:bg-emerald-500 font-semibold rounded-2xl">Edit Banners (Rich Editor)</button>
              <button data-id="${row.id}" class="delete-btn px-4 py-2 text-sm bg-red-600/20 hover:bg-red-600/40 text-red-400 rounded-2xl">Delete</button>
            </div>
          </div>`;
      } else {
        html += `
          <div class="bg-zinc-900 border border-white/10 rounded-2xl p-4 flex flex-col md:flex-row md:items-center gap-4">
            <div class="flex-1 min-w-0">
              <div class="font-mono text-emerald-400 text-sm">${row.id}</div>
              <div class="text-sm mt-2 text-zinc-300 break-all">${valPreview}${valPreview.length > 79 ? '…' : ''}</div>
            </div>
            <div class="flex gap-2 flex-shrink-0">
              <button data-id="${row.id}" class="edit-btn px-4 py-1.5 text-sm bg-white/10 hover:bg-white/20 rounded-xl">Edit</button>
              <button data-id="${row.id}" class="delete-btn px-4 py-1.5 text-sm bg-red-600/20 hover:bg-red-600/40 text-red-400 rounded-xl">Delete</button>
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
  // Update last refreshed timestamp
  const contentTs = content.querySelector('#content-last-updated');
  if (contentTs) {
    const now = new Date();
    contentTs.textContent = `Updated ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
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

      try {
        const adminSecret = import.meta.env.VITE_ADMIN_ACTION_SECRET || '';
        const invokeOpts: {
          body: { action: string; payload: { key: string } };
          headers?: Record<string, string>;
        } = {
          body: { action: 'delete_site_content', payload: { key: id } },
        };
        if (adminSecret) invokeOpts.headers = { 'x-admin-secret': adminSecret };
        const { data, error } = await supabase.functions.invoke('admin-action', invokeOpts);
        if (error || !data?.success) {
          await supabase.from('site_content').delete().eq('key', id);
        }
      } catch (_) {
        try {
          await supabase.from('site_content').delete().eq('key', id);
        } catch {
          /* demo / RLS graceful fallback */
        }
      }
      await reloadList();
      showToast('Content deleted', 'info');
    });
  });
}

export { renderEditContentTab };

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

  let banners: any[] = [];
  try {
    const parsed = valInput.value ? JSON.parse(valInput.value) : [];
    if (Array.isArray(parsed)) {
      banners = parsed.map((b: any) => ({
        ...b,
        weight: (typeof b.weight === 'number' && b.weight > 0) ? b.weight : 1,
      }));
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

      card.innerHTML = `
        <div class="flex gap-3">
          <div class="w-14 h-14 flex-shrink-0 bg-zinc-900 rounded overflow-hidden border border-white/10 flex items-center justify-center">
            ${hasImg 
              ? `<img src="${b.imageUrl}" class="max-w-full max-h-full object-contain" onerror="this.parentElement.innerHTML='<div class=\\'text-[9px] text-red-400 text-center\\'>Bad image</div>'">` 
              : `<div class="text-[10px] text-zinc-500 text-center leading-[14px] p-1">No image</div>`}
          </div>

          <div class="flex-1 text-xs space-y-1.5">
            <div>
              <div class="text-zinc-400 text-[10px]">Image URL ${!hasImg ? '<span class="text-red-400">(required)</span>' : ''}</div>
              <div class="flex gap-1.5 items-center">
                <input data-idx="${i}" data-field="imageUrl" value="${b.imageUrl || ''}" class="flex-1 min-w-0 bg-zinc-900 border border-white/20 rounded px-2 py-1 text-xs" placeholder="https://...jpg or upload below">
                <input type="file" accept="${BANNER_UPLOAD_ACCEPT}" data-idx="${i}" data-field="file" class="hidden banner-file-input">
                <button type="button" data-idx="${i}" data-action="upload" class="text-[10px] px-2 py-1 bg-emerald-600/80 hover:bg-emerald-500 rounded-lg font-semibold whitespace-nowrap">Upload</button>
              </div>
              <div class="text-[9px] text-zinc-500 mt-0.5">JPG, PNG, GIF, WebP, SVG · max 2MB</div>
            </div>
            <div>
              <div class="text-zinc-400 text-[10px]">Redirect URL ${!hasRedirect ? '<span class="text-red-400">(required)</span>' : ''}</div>
              <input data-idx="${i}" data-field="redirectUrl" value="${b.redirectUrl || ''}" class="w-full bg-zinc-900 border border-white/20 rounded px-2 py-1 text-xs" placeholder="https://...">
            </div>
            <div>
              <div class="text-zinc-400 text-[10px]">Label</div>
              <input data-idx="${i}" data-field="label" value="${b.label || ''}" class="w-full bg-zinc-900 border border-white/20 rounded px-2 py-1 text-xs" placeholder="Optional label">
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
      card.querySelectorAll('input').forEach((inp: any) => {
        inp.addEventListener('input', () => {
          const idx = parseInt(inp.dataset.idx);
          const field = inp.dataset.field;

          if (field === 'enabled') {
            banners[idx][field] = inp.checked;
          } else if (field === 'weight') {
            const n = parseInt(inp.value, 10);
            banners[idx][field] = (isFinite(n) && n > 0) ? n : 1;
          } else {
            banners[idx][field] = inp.value.trim();
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
      card.querySelectorAll('button[data-action]').forEach((btn: any) => {
        btn.addEventListener('click', () => {
          const idx = parseInt(btn.dataset.idx);
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

    (window as any).__currentBannersForStats = banners;
    const statsEl = document.createElement('div');
    statsEl.id = 'banner-stats';
    statsEl.className = 'mt-3 pt-3 border-t border-white/10';
    container.appendChild(statsEl);
    renderBannerStats(statsEl).catch(() => {});
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
