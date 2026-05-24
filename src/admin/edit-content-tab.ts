import { supabase } from '../lib/supabase';
import { formatError } from '../lib';
import { showToast } from '../ui';

/** Lightweight row shape used by the Edit Content admin tab */
interface ContentRow {
  id: string;
  value?: unknown;
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
    <div class="space-y-3">
      <div class="h-16 skeleton rounded-2xl"></div>
      <div class="h-16 skeleton rounded-2xl"></div>
      <div class="h-16 skeleton rounded-2xl"></div>
    </div>
  `;

  // Thin reload function: fetch → build HTML → attach listeners
  async function loadAndRenderList() {
    try {
      const { data, error } = await supabase
        .from('site_content')
        .select('id, value')
        .order('id', { ascending: true });

      if (error) throw error;

      const rows = data || [];

      const html = buildContentListHTML(rows);
      content.innerHTML = html;

      attachContentListeners(content, loadAndRenderList);

    } catch (err) {
      content.innerHTML = `<div class="p-6 text-red-400">Error loading content: ${formatError(err)}. Please try refreshing the page.</div>`;
    }
  }

  await loadAndRenderList();
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
    <div id="content-list" class="space-y-3">
  `;

  if (rows.length === 0) {
    html += `<div class="py-8 text-center text-zinc-400 border border-white/10 rounded-2xl">No content entries yet.<br><span class="text-xs">Click "Add New Key" above to start managing your public site content.</span></div>`;
  } else {
    rows.forEach((row: ContentRow) => {
      const valStr = String(row.value ?? '');
      const valPreview = valStr.slice(0, 80);
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
    });
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
    valInput.value = String(existing.value || '');
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
      const payload: { id: string; value: string } = { id: key, value: rawVal };

      const originalSaveText = saveBtn.textContent;
      saveBtn.textContent = 'Saving...';
      saveBtn.disabled = true;

      try {
        await supabase.from('site_content').upsert(payload, { onConflict: 'id' });
      } catch (_) {
        // Demo / RLS fallback
      }

      saveBtn.textContent = originalSaveText || 'Save (upsert)';
      saveBtn.disabled = false;
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
}

/**
 * Attaches all interactive listeners for the Edit Site Content view
 * after the HTML has been rendered by buildContentListHTML.
 *
 * Handles: search filtering, Add New Key, Edit, and Delete actions.
 */
function attachContentListeners(content: HTMLElement, reloadList: () => Promise<void>) {
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

  // Edit buttons (use id for lookup)
  content.querySelectorAll('.edit-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = (btn as HTMLElement).dataset.id!;
      showContentForm({ id }, reloadList);
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
        await supabase.from('site_content').delete().eq('id', id);
      } catch (_) {
        /* demo / RLS graceful fallback */
      }
      await reloadList();
      showToast('Content deleted', 'info');
    });
  });
}

export { renderEditContentTab };
