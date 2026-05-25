/**
 * Admin Tab: Text Colors
 *
 * Live color management for the public site.
 * Provides color pickers for all major text elements, with instant preview
 * on the public site and persistence to the `site_content` table.
 *
 * Loaded dynamically for better initial bundle size.
 */

import { supabase } from '../lib/supabase';
import { fetchSiteContent } from '../lib/supabase';
import { showToast } from '../ui';
import { getColorControls, applyTextColors, toHexForColorInput, type ColorControl } from '../colors';

export async function renderTextColorsTab(container: HTMLElement) {
  container.innerHTML = `
    <div class="flex items-center justify-between mb-6">
      <div>
        <div class="text-2xl font-bold">Text Colors</div>
        <div class="text-sm text-zinc-400">Live control for front page text. Changes appear instantly on the site behind this panel.</div>
      </div>
      <div class="flex items-center gap-3">
        <button id="colors-reset-btn" class="px-4 py-2 text-sm bg-rose-600/80 hover:bg-rose-600 rounded-2xl flex items-center gap-2 text-white">
          <i class="fa-solid fa-undo"></i> Reset All Defaults
        </button>
        <button id="colors-preview-refresh-btn" class="px-4 py-2 text-sm bg-emerald-600/80 hover:bg-emerald-600 rounded-2xl flex items-center gap-2 text-white">
          <i class="fa-solid fa-sync-alt"></i> Refresh Public Preview
        </button>
        <button id="colors-refresh-btn" class="px-4 py-2 text-sm bg-white/10 hover:bg-white/20 rounded-2xl flex items-center gap-2">
          <i class="fa-solid fa-sync"></i> Refresh
        </button>
      </div>
    </div>

    <div id="colors-loading" class="text-zinc-400">Loading current colors...</div>
    <div id="colors-content" class="hidden space-y-8"></div>
  `;

  const loadingEl = document.getElementById('colors-loading')!;
  const contentEl = document.getElementById('colors-content')!;

  const colorControls = getColorControls();

  try {
    const currentContent = await fetchSiteContent();

    // Apply all current colors to :root immediately for live preview when tab opens
    applyTextColors(currentContent);

    // Discover any custom color keys
    const predefinedKeys = new Set(colorControls.map(c => c.key));
    const extraColorKeys: string[] = Object.keys(currentContent)
      .filter(k => k.startsWith('color_') && !predefinedKeys.has(k))
      .sort();

    extraColorKeys.forEach(k => {
      colorControls.push({
        group: 'Custom Colors (user-added)',
        key: k,
        label: k.replace('color_', '').replace(/_/g, ' '),
        default: '#ffffff'
      });
    });

    loadingEl.classList.add('hidden');
    contentEl.classList.remove('hidden');

    // Group the controls
    const groups: Record<string, ColorControl[]> = {};
    colorControls.forEach((ctrl: ColorControl) => {
      if (!groups[ctrl.group]) groups[ctrl.group] = [];
      groups[ctrl.group].push(ctrl);
    });

    let html = '';

    Object.keys(groups).forEach(groupName => {
      html += `<div class="mb-8">
        <div class="text-sm font-semibold text-violet-400 mb-3 tracking-wider">${groupName.toUpperCase()}</div>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">`;

      groups[groupName].forEach((ctrl: ColorControl) => {
        const currentValue = currentContent[ctrl.key] || ctrl.default;
        const safeId = ctrl.key.replace(/[^a-z0-9]/gi, '_');
        const pickerValue = toHexForColorInput(currentValue, ctrl.default);

        html += `
          <div class="glass border border-white/10 rounded-2xl p-4 flex items-center gap-4">
            <div class="flex-1">
              <div class="text-sm font-medium">${ctrl.label}</div>
              <div class="text-[10px] text-zinc-500 font-mono mt-0.5">${ctrl.key}</div>
            </div>
            <div class="flex items-center gap-3">
              <input type="color" id="picker_${safeId}" value="${pickerValue}" class="w-12 h-10 bg-transparent border border-white/20 rounded-xl cursor-pointer p-1" />
              <input type="text" id="hex_${safeId}" value="${currentValue}" class="w-28 bg-zinc-900 border border-white/10 rounded-xl px-3 py-2 text-sm font-mono focus:border-violet-500" placeholder="#ffffff" />
            </div>
          </div>`;
      });

      html += `</div></div>`;
    });

    contentEl.innerHTML = html;

    // ====================== ADD CUSTOM COLOR SECTION ======================
    const customSection = document.createElement('div');
    customSection.className = 'mt-8 border-t border-white/10 pt-6';
    customSection.innerHTML = `
      <div class="text-sm font-semibold text-violet-400 mb-3 tracking-wider">ADD CUSTOM COLOR</div>
      <div class="glass border border-white/10 rounded-2xl p-4 flex flex-col md:flex-row gap-4 items-end">
        <div class="flex-1">
          <div class="text-xs text-zinc-400 mb-1">Custom key suffix (will become color_your_key)</div>
          <input id="custom-key-input" type="text" placeholder="e.g. my_special_label" class="w-full bg-zinc-900 border border-white/10 rounded-xl px-3 py-2 text-sm font-mono focus:border-violet-500" />
        </div>
        <div>
          <div class="text-xs text-zinc-400 mb-1">Color</div>
          <input id="custom-color-picker" type="color" value="#ffffff" class="w-14 h-10 bg-transparent border border-white/20 rounded-xl cursor-pointer p-1" />
        </div>
        <button id="add-custom-btn" class="px-5 py-2 bg-violet-600 hover:bg-violet-500 rounded-2xl text-sm font-semibold flex items-center gap-2 whitespace-nowrap">
          <i class="fa-solid fa-plus"></i> Add & Save
        </button>
      </div>
      <div class="text-[10px] text-zinc-500 mt-2">After adding, the new color will appear in the list above on next refresh. Use it by adding style="color: var(--text-your-key)" to any element.</div>
    `;
    contentEl.appendChild(customSection);

    // Wire the Add Custom button
    const addCustomBtn = document.getElementById('add-custom-btn') as HTMLButtonElement | null;
    const customKeyInput = document.getElementById('custom-key-input') as HTMLInputElement | null;
    const customPicker = document.getElementById('custom-color-picker') as HTMLInputElement | null;

    if (addCustomBtn && customKeyInput && customPicker) {
      addCustomBtn.onclick = async () => {
        let suffix = customKeyInput.value.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');
        if (!suffix) {
          showToast('Please enter a key suffix', 'info');
          return;
        }
        const fullKey = `color_${suffix}`;
        const value = customPicker.value;

        addCustomBtn.disabled = true;
        addCustomBtn.textContent = 'Saving...';

        try {
          await supabase.from('site_content').upsert({ id: fullKey, value }, { onConflict: 'id' });
          const varName = '--text-' + suffix.replace(/_/g, '-');
          document.documentElement.style.setProperty(varName, value);

          showToast(`Custom color ${fullKey} saved.`, 'success');
          customKeyInput.value = '';
          setTimeout(() => renderTextColorsTab(container), 600);
        } catch (e) {
          showToast('Saved (refresh tab to see it)', 'info');
          setTimeout(() => renderTextColorsTab(container), 600);
        }
      };
    }
    // ====================== END CUSTOM SECTION ======================

    // Wire live preview + save for every picker
    colorControls.forEach((ctrl) => {
      const safeId = ctrl.key.replace(/[^a-z0-9]/gi, '_');
      const picker = document.getElementById(`picker_${safeId}`) as HTMLInputElement | null;
      const hexInput = document.getElementById(`hex_${safeId}`) as HTMLInputElement | null;

      if (!picker || !hexInput) return;

      const saveColor = async (value: string) => {
        if (!value || !value.startsWith('#')) return;

        document.documentElement.style.setProperty('--text-' + ctrl.key.replace(/^color_/, '').replace(/_/g, '-'), value);

        try {
          await supabase.from('site_content').upsert({ id: ctrl.key, value }, { onConflict: 'id' });
        } catch (e) {
          console.warn('Color save failed:', e);
        }
      };

      let saveTimeout: ReturnType<typeof setTimeout> | undefined;

      const handleChange = (val: string) => {
        if (hexInput.value !== val) hexInput.value = val;

        // Always feed the color picker a valid hex (never rgba)
        const hexForPicker = toHexForColorInput(val, ctrl.default);
        if (picker.value !== hexForPicker) picker.value = hexForPicker;

        clearTimeout(saveTimeout);
        saveTimeout = setTimeout(() => saveColor(val), 350);
      };

      picker.addEventListener('input', () => handleChange(picker.value));
      hexInput.addEventListener('input', () => handleChange(hexInput.value));

      hexInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          clearTimeout(saveTimeout);
          saveColor(hexInput.value);
        }
      });
    });

    // Reset All to Defaults
    const resetBtn = document.getElementById('colors-reset-btn') as HTMLButtonElement | null;
    if (resetBtn) {
      resetBtn.onclick = async () => {
        if (!confirm('Reset all text colors to their design system defaults?')) return;

        resetBtn.textContent = 'Resetting...';
        resetBtn.disabled = true;

        try {
          const allColorKeysInDb = Object.keys(currentContent).filter(k => k.startsWith('color_'));
          for (const k of allColorKeysInDb) {
            await supabase.from('site_content').delete().eq('id', k);
          }

          colorControls.forEach(ctrl => {
            const varName = '--text-' + ctrl.key.replace(/^color_/, '').replace(/_/g, '-');
            document.documentElement.style.removeProperty(varName);
          });

          showToast('All text colors reset to defaults', 'success');
          renderTextColorsTab(container);
        } catch (e) {
          showToast('Reset completed', 'info');
          renderTextColorsTab(container);
        }
      };
    }

    // Refresh Public Preview
    const previewRefreshBtn = document.getElementById('colors-preview-refresh-btn') as HTMLButtonElement | null;
    if (previewRefreshBtn) {
      previewRefreshBtn.onclick = async () => {
        const originalText = previewRefreshBtn.innerHTML;
        previewRefreshBtn.innerHTML = `<i class="fa-solid fa-sync-alt fa-spin"></i> Refreshing...`;
        previewRefreshBtn.disabled = true;

        try {
          const freshContent = await fetchSiteContent();

          applyTextColors(freshContent);
          // Count for the toast (applyTextColors logs but doesn't return count)
          const appliedCount = Object.keys(freshContent).filter(k => k.startsWith('color_')).length;

          showToast(`Public preview refreshed (${appliedCount} colors applied)`, 'success');
        } catch (e) {
          showToast('Failed to refresh public preview', 'info');
        } finally {
          previewRefreshBtn.innerHTML = originalText;
          previewRefreshBtn.disabled = false;
        }
      };
    }

    // Refresh button
    const refreshBtn = document.getElementById('colors-refresh-btn');
    if (refreshBtn) {
      refreshBtn.onclick = () => renderTextColorsTab(container);
    }

  } catch (err) {
    loadingEl.classList.add('hidden');
    contentEl.classList.remove('hidden');
    contentEl.innerHTML = `<div class="p-6 text-rose-400">Failed to load colors. ${err}</div>`;
  }
}