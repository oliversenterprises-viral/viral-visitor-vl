/**
 * Admin live funnel sound alerts — Web Audio chimes when global visitors hit key steps.
 * Requires user gesture to unlock audio (admin unlock / sound toggle).
 */

import type { AdminLiveEvent, AdminLiveFeedFilters } from './admin-live-helpers';
import {
  adminLiveSoundProfileForEvent,
  shouldPlayAdminLiveSound,
  type AdminLiveSoundProfile,
} from './admin-live-sound-helpers';
import {
  ADMIN_LIVE_SOUND_HISTORY_KEY,
  ADMIN_LIVE_SOUND_HISTORY_PANEL_KEY,
  appendSoundHistoryEntry,
  buildSoundHistoryEntry,
  buildSoundHistoryHtml,
  parseSoundHistoryJson,
  type AdminLiveSoundHistoryEntry,
} from './admin-live-sound-history-helpers';

export const ADMIN_LIVE_SOUND_STORAGE_KEY = 'vr_admin_live_sound';

const SOUND_COOLDOWN_MS = 2500;

let audioCtx: AudioContext | null = null;
let lastSoundAt = 0;
let controlsWired = false;
let historyWired = false;
let historyEntries: AdminLiveSoundHistoryEntry[] = [];

function readSoundEnabled(): boolean {
  try {
    const raw = localStorage.getItem(ADMIN_LIVE_SOUND_STORAGE_KEY);
    if (raw === '0') return false;
    return true;
  } catch {
    return true;
  }
}

function writeSoundEnabled(on: boolean): void {
  try {
    localStorage.setItem(ADMIN_LIVE_SOUND_STORAGE_KEY, on ? '1' : '0');
  } catch {
    /* storage unavailable */
  }
}

export function isAdminLiveSoundEnabled(): boolean {
  return readSoundEnabled();
}

export function setAdminLiveSoundEnabled(on: boolean): void {
  writeSoundEnabled(on);
  syncAdminLiveSoundButton();
}

async function ensureAudioContext(): Promise<AudioContext | null> {
  if (typeof window === 'undefined') return null;
  const AC = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  if (!audioCtx) audioCtx = new AC();
  if (audioCtx.state === 'suspended') {
    try {
      await audioCtx.resume();
    } catch {
      return null;
    }
  }
  return audioCtx;
}

/** Call on admin unlock or sound toggle — satisfies browser autoplay policy. */
export async function unlockAdminLiveSound(): Promise<void> {
  await ensureAudioContext();
}

type Tone = { f: number; d: number; type?: OscillatorType; v?: number };

const PROFILES: Record<AdminLiveSoundProfile, Tone[]> = {
  funnel: [
    { f: 740, d: 120 },
    { f: 988, d: 160 },
    { f: 1175, d: 220, v: 0.55 },
  ],
  referral: [
    { f: 523, d: 140 },
    { f: 784, d: 200, v: 0.65 },
  ],
  share: [
    { f: 880, d: 100, type: 'triangle' },
    { f: 1100, d: 140, type: 'triangle', v: 0.5 },
  ],
  claim: [
    { f: 659, d: 180, v: 0.7 },
    { f: 880, d: 180, v: 0.7 },
    { f: 1047, d: 280, v: 0.6 },
  ],
};

function playTone(ctx: AudioContext, tone: Tone, startAt: number): number {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  const dur = tone.d / 1000;

  osc.type = tone.type || 'sine';
  osc.frequency.value = tone.f;

  const vol = tone.v ?? 0.62;
  gain.gain.setValueAtTime(vol, startAt);
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + dur + 0.04);

  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(startAt);
  osc.stop(startAt + dur + 0.05);

  return dur + 0.06;
}

/** Play a short chime for the given profile (best-effort, no throw). */
export async function playAdminLiveChime(profile: AdminLiveSoundProfile): Promise<void> {
  const ctx = await ensureAudioContext();
  if (!ctx) return;

  const seq = PROFILES[profile];
  let t = ctx.currentTime + 0.02;
  for (const tone of seq) {
    const gap = playTone(ctx, tone, t);
    t += gap;
  }
}

export function syncAdminLiveSoundButton(): void {
  const btn = document.getElementById('admin-live-sound-btn');
  if (!btn) return;
  const on = isAdminLiveSoundEnabled();
  btn.classList.toggle('admin-live-sound-btn--on', on);
  btn.classList.toggle('admin-live-sound-btn--off', !on);
  btn.setAttribute('aria-pressed', on ? 'true' : 'false');
  btn.title = on
    ? 'Sound alerts on — click to mute funnel chimes'
    : 'Sound alerts off — click to enable funnel chimes';
  const icon = btn.querySelector('i');
  if (icon) {
    icon.className = on ? 'fa-solid fa-volume-high' : 'fa-solid fa-volume-xmark';
  }
  const label = btn.querySelector('[data-sound-label]');
  if (label) label.textContent = on ? 'Sound on' : 'Sound off';
}

function loadSoundHistoryFromStorage(): AdminLiveSoundHistoryEntry[] {
  try {
    return parseSoundHistoryJson(localStorage.getItem(ADMIN_LIVE_SOUND_HISTORY_KEY));
  } catch {
    return [];
  }
}

function persistSoundHistory(): void {
  try {
    localStorage.setItem(ADMIN_LIVE_SOUND_HISTORY_KEY, JSON.stringify(historyEntries));
  } catch {
    /* storage unavailable */
  }
}

function recordSoundHistory(ev: AdminLiveEvent, profile: AdminLiveSoundProfile, playedAt: string): void {
  const entry = buildSoundHistoryEntry(ev, profile, playedAt);
  historyEntries = appendSoundHistoryEntry(historyEntries, entry);
  persistSoundHistory();
  renderAdminLiveSoundHistory();
}

export function getAdminLiveSoundHistory(): readonly AdminLiveSoundHistoryEntry[] {
  return historyEntries;
}

export function clearAdminLiveSoundHistory(): void {
  historyEntries = [];
  persistSoundHistory();
  renderAdminLiveSoundHistory();
}

export function renderAdminLiveSoundHistory(): void {
  const list = document.getElementById('admin-live-sound-history-list');
  const count = document.getElementById('admin-live-sound-history-count');
  if (count) {
    count.textContent = historyEntries.length ? `${historyEntries.length}` : '';
    count.classList.toggle('hidden', historyEntries.length === 0);
  }
  if (list) {
    list.innerHTML = buildSoundHistoryHtml(historyEntries);
  }
}

function isSoundHistoryPanelOpen(): boolean {
  try {
    return localStorage.getItem(ADMIN_LIVE_SOUND_HISTORY_PANEL_KEY) === '1';
  } catch {
    return false;
  }
}

function setSoundHistoryPanelOpen(open: boolean): void {
  const panel = document.getElementById('admin-live-sound-history');
  const toggle = document.getElementById('admin-live-sound-history-toggle');
  if (panel) panel.classList.toggle('hidden', !open);
  if (toggle) toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
  try {
    localStorage.setItem(ADMIN_LIVE_SOUND_HISTORY_PANEL_KEY, open ? '1' : '0');
  } catch {
    /* non-fatal */
  }
}

export function wireAdminLiveSoundHistory(): void {
  if (historyWired) return;
  const toggle = document.getElementById('admin-live-sound-history-toggle');
  if (!toggle) return;
  historyWired = true;
  toggle.dataset.vrWired = '1';

  historyEntries = loadSoundHistoryFromStorage();
  setSoundHistoryPanelOpen(isSoundHistoryPanelOpen());
  renderAdminLiveSoundHistory();

  toggle.addEventListener('click', () => {
    const panel = document.getElementById('admin-live-sound-history');
    const open = panel?.classList.contains('hidden') ?? true;
    setSoundHistoryPanelOpen(open);
  });

  document.getElementById('admin-live-sound-history-clear')?.addEventListener('click', () => {
    if (historyEntries.length && !window.confirm('Clear all sound alert history?')) return;
    clearAdminLiveSoundHistory();
  });
}

export function wireAdminLiveSoundControls(): void {
  if (controlsWired) return;
  const btn = document.getElementById('admin-live-sound-btn');
  if (!btn) return;
  controlsWired = true;
  btn.dataset.vrWired = '1';

  syncAdminLiveSoundButton();
  wireAdminLiveSoundHistory();

  btn.addEventListener('click', () => {
    const next = !isAdminLiveSoundEnabled();
    setAdminLiveSoundEnabled(next);
    if (next) {
      void unlockAdminLiveSound().then(() => playAdminLiveChime('funnel'));
    }
  });
}

/** Play alert for a realtime admin live event (respects cooldown + prefs). */
export function maybePlayAdminLiveAlert(
  ev: AdminLiveEvent,
  filters: AdminLiveFeedFilters,
  eventType: string,
  now = Date.now(),
): void {
  if (!isAdminLiveSoundEnabled()) return;
  if (!shouldPlayAdminLiveSound(ev, filters, eventType)) return;
  if (now - lastSoundAt < SOUND_COOLDOWN_MS) return;

  const profile = adminLiveSoundProfileForEvent(ev);
  if (!profile) return;

  lastSoundAt = now;
  const playedAt = new Date(now).toISOString();
  recordSoundHistory(ev, profile, playedAt);
  void playAdminLiveChime(profile);
}