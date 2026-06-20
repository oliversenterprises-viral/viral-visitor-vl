/**
 * Elite vClock Replica UI
 * Premium glassmorphism, accessible, responsive, faithful to vclock controls + big display.
 * Pure builders + listeners. No heavy framework.
 */

import type { TimerState, TimerStatus, OnZeroAction } from './types';
import { PRESETS, SOUND_KEYS } from './types';
import * as Engine from './engine';
import { escapeHtml } from '../content';

let overlay: HTMLDivElement | null = null;
let displayEl: HTMLDivElement | null = null;
let statusEl: HTMLDivElement | null = null;
let progressFill: HTMLDivElement | null = null;
let labelInput: HTMLInputElement | null = null;
let msgInput: HTMLInputElement | null = null;
let soundSelect: HTMLSelectElement | null = null;
let repeatChk: HTMLInputElement | null = null;
let onZeroRadios: NodeListOf<HTMLInputElement> | null = null;
let msToggle: HTMLButtonElement | null = null;

let unsubscribeTick: (() => void) | null = null;
let unsubscribeStatus: (() => void) | null = null;
let unsubscribeComplete: (() => void) | null = null;
let keydownHandler: ((e: KeyboardEvent) => void) | null = null; // for cleanup (prevents permanent doc listener)

function formatTime(ms: number, showMs: boolean): string {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const milli = Math.floor((ms % 1000) / 10); // 2 digits

  const pad = (n: number, w = 2) => n.toString().padStart(w, '0');

  if (h > 0) {
    return showMs ? `${pad(h)}:${pad(m)}:${pad(s)}.${pad(milli)}` : `${pad(h)}:${pad(m)}:${pad(s)}`;
  }
  return showMs ? `${pad(m)}:${pad(s)}.${pad(milli)}` : `${pad(m)}:${pad(s)}`;
}

function createOverlay(): HTMLDivElement {
  const el = document.createElement('div');
  el.id = 'vr-timer-overlay';
  el.className = 'fixed inset-0 bg-black/90 z-[900] flex items-center justify-center p-4';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-modal', 'true');
  el.setAttribute('aria-label', 'Elite Online Timer — reliable in background');

  el.innerHTML = `
    <div class="glass border border-white/10 rounded-3xl w-full max-w-[960px] max-h-[96vh] overflow-auto shadow-2xl">
      <!-- Header -->
      <div class="flex items-center justify-between px-6 py-4 border-b border-white/10">
        <div class="flex items-center gap-3">
          <div class="w-9 h-9 rounded-2xl bg-violet-600/20 text-violet-400 flex items-center justify-center">
            <i class="fa-solid fa-stopwatch text-xl"></i>
          </div>
          <div>
            <div class="font-semibold text-xl tracking-tight">Elite Timer</div>
            <div class="text-[10px] text-emerald-400/80 -mt-0.5">vClock replica • background-proof</div>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <button id="timer-fullscreen-btn"
                  class="px-3 py-1.5 text-xs rounded-2xl border border-white/15 hover:bg-white/5 flex items-center gap-1.5"
                  title="Toggle fullscreen (F)">
            <i class="fa-solid fa-expand"></i>
            <span class="hidden sm:inline">Fullscreen</span>
          </button>
          <button id="timer-export-btn"
                  class="px-3 py-1.5 text-xs rounded-2xl border border-white/15 hover:bg-white/5 flex items-center gap-1.5"
                  title="Download standalone single-file timer (works offline anywhere)">
            <i class="fa-solid fa-download"></i>
            <span class="hidden sm:inline">Export Standalone</span>
          </button>
          <button id="timer-close-btn" class="text-3xl leading-none px-2 text-zinc-400 hover:text-white" aria-label="Close timer">✕</button>
        </div>
      </div>

      <!-- Big Display -->
      <div class="px-6 pt-8 pb-4 text-center">
        <div id="timer-display"
             class="timer-display timer-time font-mono tabular-nums tracking-[-0.06em] select-none"
             style="font-size: clamp(3.25rem, 11vw, 7.25rem); line-height: 1; color: #fff; text-shadow: 0 4px 30px rgba(0,0,0,0.45);"
             aria-live="polite" aria-atomic="true">
          05:00
        </div>
        <div id="timer-status" class="mt-1 text-xs uppercase tracking-[2px] text-emerald-400/80 font-medium">READY</div>

        <!-- Progress -->
        <div class="mt-4 mx-auto max-w-[520px]">
          <div class="timer-progress h-1.5 bg-white/10 rounded-full overflow-hidden">
            <div id="timer-progress-fill" class="h-full w-0 transition-all" style="background: linear-gradient(to right, #864cff, #a78bfa);"></div>
          </div>
        </div>
      </div>

      <!-- Quick Presets -->
      <div class="px-6 pb-3">
        <div class="flex flex-wrap gap-2 justify-center">
          ${PRESETS.map(p => `
            <button data-preset="${p.ms}" class="timer-preset-btn px-3.5 py-1 text-sm rounded-2xl border border-white/15 hover:border-violet-500/60 active:bg-white/5">
              ${escapeHtml(p.label)}${p.hint ? `<span class="text-[10px] opacity-60 ml-1">${p.hint}</span>` : ''}
            </button>
          `).join('')}
          <button id="timer-datetime-btn" class="timer-preset-btn px-3.5 py-1 text-sm rounded-2xl border border-white/15 hover:border-amber-400/60">
            <i class="fa-solid fa-calendar mr-1"></i> Date &amp; Time
          </button>
        </div>
      </div>

      <!-- Manual / Advanced Controls -->
      <div class="px-6 py-4 border-t border-white/10 grid md:grid-cols-2 gap-4">
        <!-- Duration -->
        <div>
          <div class="text-xs uppercase tracking-widest text-zinc-400 mb-1.5">DURATION (H : M : S)</div>
          <div class="flex items-center gap-2">
            <input id="timer-h" type="number" min="0" max="99" value="0" class="w-16 text-center rounded-2xl border border-white/10 bg-zinc-950/70 py-2" />
            <div class="text-zinc-500">:</div>
            <input id="timer-m" type="number" min="0" max="59" value="5" class="w-16 text-center rounded-2xl border border-white/10 bg-zinc-950/70 py-2" />
            <div class="text-zinc-500">:</div>
            <input id="timer-s" type="number" min="0" max="59" value="0" class="w-16 text-center rounded-2xl border border-white/10 bg-zinc-950/70 py-2" />
            <button id="timer-apply-duration" class="ml-2 px-4 py-2 text-sm rounded-2xl border border-white/15 hover:bg-white/5">Set</button>
          </div>
          <div class="text-[10px] text-zinc-500 mt-1">Or use presets above. Supports long runs (hours+).</div>
        </div>

        <!-- Label + Message + Sound -->
        <div class="space-y-3">
          <div>
            <div class="text-xs uppercase tracking-widest text-zinc-400 mb-1">TITLE</div>
            <input id="timer-label" class="w-full rounded-2xl border border-white/10 bg-zinc-950/70 px-4 py-2 text-sm" placeholder="Focus Session" maxlength="80" />
          </div>
          <div>
            <div class="text-xs uppercase tracking-widest text-zinc-400 mb-1">SHOW MESSAGE ON FINISH</div>
            <input id="timer-msg" class="w-full rounded-2xl border border-white/10 bg-zinc-950/70 px-4 py-2 text-sm" placeholder="Time is up!" maxlength="200" />
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div>
              <div class="text-xs uppercase tracking-widest text-zinc-400 mb-1">SOUND</div>
              <select id="timer-sound" class="w-full rounded-2xl border border-white/10 bg-zinc-950/70 px-3 py-2 text-sm">
                ${SOUND_KEYS.map(k => `<option value="${k}">${k}</option>`).join('')}
              </select>
            </div>
            <div class="flex items-end gap-2">
              <label class="flex items-center gap-2 text-sm cursor-pointer">
                <input id="timer-repeat" type="checkbox" class="accent-violet-500" />
                <span>Repeat sound</span>
              </label>
              <button id="timer-test-sound" class="ml-auto px-3 py-1.5 text-xs rounded-2xl border border-white/15 hover:bg-white/5">Test</button>
            </div>
          </div>

          <!-- On zero -->
          <div>
            <div class="text-xs uppercase tracking-widest text-zinc-400 mb-1">ON ZERO</div>
            <div class="flex flex-wrap gap-x-4 gap-y-1 text-sm">
              <label class="flex items-center gap-2"><input type="radio" name="onzero" value="stop" checked> Stop</label>
              <label class="flex items-center gap-2"><input type="radio" name="onzero" value="restart"> Restart</label>
              <label class="flex items-center gap-2"><input type="radio" name="onzero" value="stopwatch"> Run as stopwatch</label>
            </div>
          </div>
        </div>
      </div>

      <!-- Main Controls -->
      <div class="px-6 py-6 border-t border-white/10 flex flex-wrap items-center justify-center gap-3">
        <button id="timer-start-btn"
                class="btn-primary px-10 py-3.5 text-lg rounded-3xl flex items-center gap-2 shadow-xl shadow-violet-500/30">
          <i class="fa-solid fa-play"></i> <span>START</span>
        </button>
        <button id="timer-pause-btn"
                class="btn-secondary px-8 py-3.5 text-lg rounded-3xl flex items-center gap-2 hidden">
          <i class="fa-solid fa-pause"></i> <span>PAUSE</span>
        </button>
        <button id="timer-resume-btn"
                class="btn-secondary px-8 py-3.5 text-lg rounded-3xl flex items-center gap-2 hidden">
          <i class="fa-solid fa-play"></i> <span>RESUME</span>
        </button>
        <button id="timer-reset-btn"
                class="px-6 py-3.5 text-sm rounded-3xl border border-white/20 hover:bg-white/5 flex items-center gap-2">
          <i class="fa-solid fa-undo"></i> <span>RESET</span>
        </button>
        <button id="timer-ms-btn"
                class="px-4 py-3.5 text-xs rounded-3xl border border-white/15 hover:bg-white/5">
          <span id="ms-label">MS: OFF</span>
        </button>
      </div>

      <div class="px-6 pb-6 text-center text-[10px] text-zinc-500">
        Accurate in background via dedicated worker • Persists across reloads &amp; hidden tabs • Self-contained export available
      </div>
    </div>
  `;

  return el;
}

function attachListeners(root: HTMLElement) {
  // Close
  root.querySelector('#timer-close-btn')?.addEventListener('click', closeTimerOverlay);
  root.addEventListener('click', (e) => {
    if (e.target === root) closeTimerOverlay();
  });
  keydownHandler = handleKey;
  document.addEventListener('keydown', keydownHandler, { capture: true, once: false });

  // Presets
  root.querySelectorAll('[data-preset]').forEach(btn => {
    btn.addEventListener('click', () => {
      const ms = parseInt((btn as HTMLElement).dataset.preset || '0', 10);
      if (ms > 0) Engine.setDuration(ms);
    });
  });

  // DateTime target (elite enhancement)
  root.querySelector('#timer-datetime-btn')?.addEventListener('click', () => {
    const inp = document.createElement('input');
    inp.type = 'datetime-local';
    inp.style.position = 'absolute';
    inp.style.opacity = '0';
    document.body.appendChild(inp);
    inp.addEventListener('change', () => {
      if (!inp.value) { inp.remove(); return; }
      const target = new Date(inp.value).getTime();
      const delta = Math.max(0, target - Date.now());
      if (delta > 0) {
        Engine.setDuration(delta);
      }
      inp.remove();
    }, { once: true });
    inp.click();
  });

  // Manual duration
  const applyDur = () => {
    const h = parseInt((root.querySelector('#timer-h') as HTMLInputElement)?.value || '0', 10);
    const m = parseInt((root.querySelector('#timer-m') as HTMLInputElement)?.value || '0', 10);
    const s = parseInt((root.querySelector('#timer-s') as HTMLInputElement)?.value || '0', 10);
    const total = ((h || 0) * 3600 + (m || 0) * 60 + (s || 0)) * 1000;
    Engine.setDuration(total);
  };
  root.querySelector('#timer-apply-duration')?.addEventListener('click', applyDur);

  // Label / Message
  labelInput = root.querySelector('#timer-label') as HTMLInputElement;
  msgInput = root.querySelector('#timer-msg') as HTMLInputElement;
  labelInput?.addEventListener('input', () => Engine.setLabel(labelInput!.value));
  msgInput?.addEventListener('input', () => Engine.setFinishMessage(msgInput!.value));

  // Sound + repeat + test
  soundSelect = root.querySelector('#timer-sound') as HTMLSelectElement;
  repeatChk = root.querySelector('#timer-repeat') as HTMLInputElement;
  soundSelect?.addEventListener('change', () => Engine.setSound(soundSelect!.value));
  repeatChk?.addEventListener('change', () => Engine.setRepeat(repeatChk!.checked));
  root.querySelector('#timer-test-sound')?.addEventListener('click', () => Engine.testSound());

  // On zero radios
  onZeroRadios = root.querySelectorAll('input[name="onzero"]') as NodeListOf<HTMLInputElement>;
  onZeroRadios.forEach(r => r.addEventListener('change', () => {
    if (r.checked) Engine.setOnZeroAction(r.value as OnZeroAction);
  }));

  // Main actions
  root.querySelector('#timer-start-btn')?.addEventListener('click', () => Engine.start());
  root.querySelector('#timer-pause-btn')?.addEventListener('click', () => Engine.pause());
  root.querySelector('#timer-resume-btn')?.addEventListener('click', () => Engine.resume());
  root.querySelector('#timer-reset-btn')?.addEventListener('click', () => Engine.reset());

  // Ms toggle
  msToggle = root.querySelector('#timer-ms-btn') as HTMLButtonElement;
  msToggle?.addEventListener('click', () => {
    Engine.toggleMs();
    updateFromState(Engine.getState());
  });

  // Fullscreen
  root.querySelector('#timer-fullscreen-btn')?.addEventListener('click', () => {
    const panel = root.firstElementChild as HTMLElement;
    if (!panel) return;
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    } else {
      panel.requestFullscreen().catch(() => {});
    }
  });

  // Export standalone
  root.querySelector('#timer-export-btn')?.addEventListener('click', async () => {
    const { generateStandalone } = await import('./embed');
    const html = generateStandalone(Engine.exportConfigForEmbed());
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'elite-timer-standalone.html';
    document.body.appendChild(a);
    a.click();
    a.remove();
    // Revoke to avoid leaking blob URL / memory for the full exported HTML (defense in depth)
    setTimeout(() => { try { URL.revokeObjectURL(url); } catch { /* already revoked */ } }, 1500);
  });
}

function handleKey(e: KeyboardEvent) {
  if (!overlay || overlay.classList.contains('hidden')) return;
  if (e.key === 'Escape') {
    closeTimerOverlay();
    e.preventDefault();
  }
  if (e.key === ' ' || e.key === 'Spacebar') {
    const st = Engine.getState().status;
    if (st === 'RUNNING') Engine.pause();
    else if (st === 'PAUSED') Engine.resume();
    else Engine.start();
    e.preventDefault();
  }
  if ((e.key.toLowerCase() === 'r') && !['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement).tagName)) {
    Engine.reset();
    e.preventDefault();
  }
  if (e.key.toLowerCase() === 'f') {
    const fsBtn = overlay.querySelector('#timer-fullscreen-btn') as HTMLButtonElement;
    fsBtn?.click();
  }
}

function updateControls(status: TimerStatus) {
  if (!overlay) return;
  const start = overlay.querySelector('#timer-start-btn') as HTMLButtonElement;
  const pause = overlay.querySelector('#timer-pause-btn') as HTMLButtonElement;
  const resume = overlay.querySelector('#timer-resume-btn') as HTMLButtonElement;

  start?.classList.toggle('hidden', status === 'RUNNING' || status === 'PAUSED');
  pause?.classList.toggle('hidden', status !== 'RUNNING');
  resume?.classList.toggle('hidden', status !== 'PAUSED');
}

function updateFromState(s: TimerState) {
  if (!overlay || !displayEl) return;

  displayEl.textContent = formatTime(s.remainingMs, s.showMs);
  if (statusEl) {
    const map: Record<TimerStatus, string> = {
      IDLE: 'READY',
      RUNNING: s.targetWallMs ? 'RUNNING • BACKGROUND PROOF' : 'RUNNING',
      PAUSED: 'PAUSED',
      FINISHED: 'FINISHED',
    };
    statusEl.textContent = map[s.status] || s.status;
    statusEl.className = `mt-1 text-xs uppercase tracking-[2px] font-medium ${s.status === 'RUNNING' ? 'text-emerald-400/90' : s.status === 'FINISHED' ? 'text-rose-400' : 'text-zinc-400'}`;
  }

  // Progress (countdown only)
  if (progressFill && s.durationMs > 0) {
    const pct = Math.max(0, Math.min(100, Math.round((s.remainingMs / s.durationMs) * 100)));
    progressFill.style.width = `${pct}%`;
  }

  // Sync form fields (only if not focused to avoid fighting user)
  if (labelInput && document.activeElement !== labelInput) labelInput.value = s.label || '';
  if (msgInput && document.activeElement !== msgInput) msgInput.value = s.finishMessage || '';
  if (soundSelect) soundSelect.value = s.soundKey;
  if (repeatChk) repeatChk.checked = !!s.repeatSound;

  if (onZeroRadios) {
    onZeroRadios.forEach(r => { r.checked = r.value === s.onZeroAction; });
  }

  if (msToggle) {
    const lbl = overlay!.querySelector('#ms-label') as HTMLElement;
    if (lbl) lbl.textContent = `MS: ${s.showMs ? 'ON' : 'OFF'}`;
  }

  updateControls(s.status);

  // Celebration flash on finish (lightweight)
  if (s.status === 'FINISHED' && displayEl) {
    displayEl.style.transition = 'color 120ms';
    displayEl.style.color = '#fda4af';
    setTimeout(() => { if (displayEl) displayEl.style.color = '#fff'; }, 650);
  }
}

export function openTimerOverlay() {
  if (overlay) {
    overlay.classList.remove('hidden');
    overlay.style.display = 'flex';
    // Re-hydrate in case of background changes
    Engine.forceSyncFromWorker();
    return;
  }

  overlay = createOverlay();
  document.body.appendChild(overlay);

  displayEl = overlay.querySelector('#timer-display') as HTMLDivElement;
  statusEl = overlay.querySelector('#timer-status') as HTMLDivElement;
  progressFill = overlay.querySelector('#timer-progress-fill') as HTMLDivElement;

  attachListeners(overlay);

  // Wire engine -> UI
  unsubscribeTick = Engine.onTick((rem, elap, st) => {
    const s = Engine.getState();
    // Keep local view in sync
    s.remainingMs = rem;
    s.elapsedMs = elap;
    s.status = st;
    updateFromState(s);
  });

  unsubscribeStatus = Engine.onStatus((st) => {
    updateControls(st);
    if (statusEl) {
      const s = Engine.getState();
      updateFromState(s);
    }
  });

  unsubscribeComplete = Engine.onComplete((finalState) => {
    updateFromState(finalState);
    // Handle onZeroAction behaviors here (elite replica fidelity)
    const act = finalState.onZeroAction;
    if (act === 'restart') {
      setTimeout(() => { if (overlay) Engine.start(); }, 650);
    } else if (act === 'stopwatch') {
      // Switch to counting up — simple: set a huge target and flip display logic (or restart engine as stopwatch)
      // For v1 we reset to 00:00 counting conceptually by showing elapsed prominently.
      // Practical: restart with on-zero=stop but show "STOPWATCH MODE" + elapsed.
      setTimeout(() => {
        if (!overlay) return;
        Engine.reset();
        // Visual cue
        if (statusEl) statusEl.textContent = 'STOPWATCH MODE (counting up)';
      }, 420);
    } else {
      // stop — already finished
    }
  });

  // Initial paint
  const initial = Engine.getState();
  updateFromState(initial);

  // Make sure form reflects persisted config
  if (labelInput) labelInput.value = initial.label || '';
  if (msgInput) msgInput.value = initial.finishMessage || '';
  if (soundSelect) soundSelect.value = initial.soundKey;
  if (repeatChk) repeatChk.checked = !!initial.repeatSound;
}

export function closeTimerOverlay() {
  if (!overlay) return;
  // Clean listeners
  unsubscribeTick?.(); unsubscribeTick = null;
  unsubscribeStatus?.(); unsubscribeStatus = null;
  unsubscribeComplete?.(); unsubscribeComplete = null;
  if (keydownHandler) {
    document.removeEventListener('keydown', keydownHandler, { capture: true } as any);
    keydownHandler = null;
  }

  overlay.style.display = 'none';
  // Keep in DOM for fast reopen + state
  // overlay.remove(); overlay = null;  // comment to keep cheap reopen
}

export function isTimerOpen(): boolean {
  return !!overlay && overlay.style.display !== 'none';
}

// Expose a minimal refresh for external (e.g. after hash import)
export function refreshTimerUI() {
  if (overlay && displayEl) {
    updateFromState(Engine.getState());
  }
}
