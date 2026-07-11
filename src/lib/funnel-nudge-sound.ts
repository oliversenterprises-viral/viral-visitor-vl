/**
 * Soft Web Audio chimes for copy/share funnel reminders.
 * Zero assets — procedural tones. Requires a prior user gesture to unlock
 * (Get my link / COPY satisfy autoplay policy).
 */

import { tryHapticPulse } from './haptic';

export type FunnelNudgeSoundKind = 'link-ready' | 'copy-nudge' | 'share-nudge' | 'banner';

const STORAGE_KEY = 'vr_funnel_nudge_sound';
const MIN_GAP_MS = 2_200;

let audioCtx: AudioContext | null = null;
let unlocked = false;
let lastPlayAt = 0;

export function isFunnelNudgeSoundEnabled(): boolean {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    // Default ON — only silence when explicitly disabled
    if (v === '0' || v === 'off' || v === 'false') return false;
    return true;
  } catch {
    return true;
  }
}

export function setFunnelNudgeSoundEnabled(on: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEY, on ? '1' : '0');
  } catch {
    /* storage unavailable */
  }
}

function prefersSilence(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    // Treat reduced-motion as a quiet preference for non-essential chimes
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return true;
  } catch {
    /* ignore */
  }
  return false;
}

async function ensureAudioContext(): Promise<AudioContext | null> {
  if (typeof window === 'undefined') return null;
  const AC =
    window.AudioContext ||
    (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  if (!audioCtx) audioCtx = new AC();
  if (audioCtx.state === 'suspended') {
    try {
      await audioCtx.resume();
    } catch {
      return audioCtx;
    }
  }
  if (audioCtx.state === 'running') unlocked = true;
  return audioCtx;
}

/** Call from Get link / COPY / share button handlers (user gesture). */
export async function unlockFunnelNudgeAudio(): Promise<void> {
  await ensureAudioContext();
}

function playTone(
  ctx: AudioContext,
  freq: number,
  durationMs: number,
  when: number,
  volume = 0.09,
  type: OscillatorType = 'sine',
): number {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  const filter = ctx.createBiquadFilter();
  osc.type = type;
  osc.frequency.value = freq;
  filter.type = 'lowpass';
  filter.frequency.value = Math.min(2400, freq * 2.4);
  const dur = durationMs / 1000;
  gain.gain.setValueAtTime(0.0001, when);
  gain.gain.exponentialRampToValueAtTime(volume, when + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, when + dur);
  osc.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);
  osc.start(when);
  osc.stop(when + dur + 0.03);
  return when + dur + 0.02;
}

/** Soft multi-tone sequences per nudge kind. */
export function tonesForNudge(
  kind: FunnelNudgeSoundKind,
): Array<{ f: number; d: number; v?: number }> {
  switch (kind) {
    case 'link-ready':
      // Gentle up-chime — success without alarm
      return [
        { f: 523, d: 90, v: 0.08 },
        { f: 659, d: 110, v: 0.09 },
        { f: 784, d: 140, v: 0.07 },
      ];
    case 'copy-nudge':
      // Two soft pips — “hey, still need to copy”
      return [
        { f: 740, d: 80, v: 0.07 },
        { f: 880, d: 100, v: 0.08 },
      ];
    case 'share-nudge':
      // Friendly invite tone
      return [
        { f: 659, d: 90, v: 0.08 },
        { f: 784, d: 90, v: 0.08 },
        { f: 988, d: 120, v: 0.07 },
      ];
    case 'banner':
      // Slightly fuller for the sticky banner
      return [
        { f: 587, d: 100, v: 0.08 },
        { f: 740, d: 100, v: 0.09 },
        { f: 880, d: 160, v: 0.07 },
      ];
    default:
      return [{ f: 700, d: 100, v: 0.07 }];
  }
}

function hapticFor(kind: FunnelNudgeSoundKind): void {
  if (kind === 'link-ready') tryHapticPulse([10, 30, 12]);
  else if (kind === 'banner') tryHapticPulse([14, 40, 14]);
  else tryHapticPulse(10);
}

/**
 * Play a funnel nudge sound if enabled, unlocked, and not throttled.
 * Never throws — silent no-op when audio is blocked.
 */
export async function playFunnelNudgeSound(kind: FunnelNudgeSoundKind): Promise<boolean> {
  if (!isFunnelNudgeSoundEnabled() || prefersSilence()) {
    hapticFor(kind);
    return false;
  }

  const now = Date.now();
  if (now - lastPlayAt < MIN_GAP_MS) {
    hapticFor(kind);
    return false;
  }

  try {
    const ctx = await ensureAudioContext();
    if (!ctx || ctx.state !== 'running') {
      hapticFor(kind);
      return false;
    }
    unlocked = true;
    let t = ctx.currentTime + 0.02;
    for (const tone of tonesForNudge(kind)) {
      t = playTone(ctx, tone.f, tone.d, t, tone.v ?? 0.08);
    }
    lastPlayAt = now;
    hapticFor(kind);
    return true;
  } catch {
    hapticFor(kind);
    return false;
  }
}

export function isFunnelNudgeAudioUnlocked(): boolean {
  return unlocked && !!audioCtx && audioCtx.state === 'running';
}

/** Test helper — reset module state between unit tests. */
export function resetFunnelNudgeSoundForTests(): void {
  lastPlayAt = 0;
  unlocked = false;
  // Do not close AudioContext — jsdom may not have it
}
