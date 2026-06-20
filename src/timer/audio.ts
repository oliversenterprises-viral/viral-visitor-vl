/**
 * Elite Timer — Web Audio Synth (zero assets, reliable, offline)
 * Procedural retro chimes for ~21 vclock-style sounds.
 * Must be unlocked via user gesture (Start/Test).
 */

let audioCtx: AudioContext | null = null;
let unlocked = false;

export async function ensureAudioContext(): Promise<AudioContext | null> {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const AC = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!AC) return null;
    audioCtx = new AC();
  }
  const ctx = audioCtx!;
  if (ctx.state === 'suspended') {
    try {
      await ctx.resume();
      unlocked = true;
    } catch {
      // Will require another gesture
    }
  } else if (ctx.state === 'running') {
    unlocked = true;
  }
  return audioCtx;
}

export function isAudioUnlocked(): boolean {
  return unlocked && !!audioCtx && audioCtx.state === 'running';
}

/** Gentle unlock helper — call on any primary gesture button */
export async function unlockAudioOnGesture(): Promise<void> {
  await ensureAudioContext();
}

function playTone(ctx: AudioContext, freq: number, durationMs: number, type: OscillatorType = 'sine', volume = 0.6, ramp = 0.008) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  const filter = ctx.createBiquadFilter();

  osc.type = type;
  osc.frequency.value = freq;

  filter.type = 'lowpass';
  filter.frequency.value = Math.min(2200, freq * 2.2);

  const now = ctx.currentTime;
  gain.gain.value = volume;
  gain.gain.setValueAtTime(volume, now);
  gain.gain.linearRampToValueAtTime(0.0001, now + durationMs / 1000 + ramp);

  osc.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);

  osc.start(now);
  osc.stop(now + durationMs / 1000 + ramp + 0.02);
}

/** Map soundKey -> sequence of {f, d, t?, v?} */
function getSequence(key: string): Array<{ f: number; d: number; t?: OscillatorType; v?: number }> {
  const k = (key || 'classic').toLowerCase();
  // 21+ profiles synthesized for vintage feel
  switch (k) {
    case 'classic':
    case 'beep':
      return [{ f: 880, d: 180 }, { f: 660, d: 220 }];
    case 'bell':
      return [{ f: 523, d: 420, t: 'sine', v: 0.75 }, { f: 659, d: 380, t: 'sine', v: 0.6 }, { f: 784, d: 520, t: 'sine', v: 0.5 }];
    case 'chimes':
    case 'wind':
      return [{ f: 1240, d: 140 }, { f: 880, d: 180 }, { f: 1560, d: 260 }];
    case 'digital':
      return [{ f: 1200, d: 90, t: 'square' }, { f: 800, d: 110, t: 'square' }, { f: 1400, d: 70, t: 'square' }];
    case 'flute':
      return [{ f: 740, d: 280 }, { f: 880, d: 240 }, { f: 660, d: 320 }];
    case 'guitar':
      return [{ f: 196, d: 180, t: 'sawtooth', v: 0.55 }, { f: 294, d: 220 }, { f: 392, d: 260 }];
    case 'harp':
      return [{ f: 523, d: 320 }, { f: 659, d: 280 }, { f: 784, d: 380 }];
    case 'urgent':
      return [{ f: 980, d: 80 }, { f: 1240, d: 70 }, { f: 980, d: 80 }, { f: 1240, d: 90 }];
    case 'mellow':
    case 'soft':
      return [{ f: 440, d: 420 }, { f: 523, d: 360 }];
    case 'ascending':
      return [{ f: 440, d: 140 }, { f: 554, d: 140 }, { f: 659, d: 160 }, { f: 784, d: 280 }];
    case 'cuckoo':
      return [{ f: 1046, d: 260 }, { f: 784, d: 340 }, { f: 1046, d: 220 }];
    case 'xylophone':
      return [{ f: 1320, d: 110 }, { f: 990, d: 130 }, { f: 1480, d: 90 }, { f: 780, d: 150 }];
    case 'happy':
      return [{ f: 659, d: 160 }, { f: 784, d: 140 }, { f: 880, d: 180 }, { f: 988, d: 220 }];
    case 'childhood':
    case 'musicbox':
      return [{ f: 784, d: 200 }, { f: 659, d: 180 }, { f: 523, d: 240 }, { f: 659, d: 160 }];
    case 'glow':
      return [{ f: 392, d: 380 }, { f: 523, d: 320 }, { f: 659, d: 420 }];
    case 'birds':
      return [{ f: 1760, d: 70 }, { f: 1480, d: 90 }, { f: 1976, d: 60 }, { f: 1320, d: 110 }];
    case 'bells':
      return [{ f: 622, d: 480 }, { f: 932, d: 360 }, { f: 1244, d: 520 }];
    default:
      return [{ f: 880, d: 160 }, { f: 660, d: 220 }, { f: 440, d: 180 }];
  }
}

let alarmInterval: number | null = null;

export async function playFinishSequence(soundKey: string, repeat: boolean, onComplete?: () => void) {
  const ctx = await ensureAudioContext();
  if (!ctx) {
    // Fallback: visual only (caller handles toast)
    if (onComplete) setTimeout(onComplete, 120);
    return;
  }

  const seq = getSequence(soundKey);
  const playOnce = () => {
    let t = 0;
    seq.forEach((tone) => {
      setTimeout(() => {
        if (ctx.state === 'running') {
          playTone(ctx, tone.f, tone.d, tone.t || 'sine', tone.v ?? 0.65);
        }
      }, t);
      t += tone.d + 28;
    });
    // Total sequence duration + tail
    return t + 180;
  };

  playOnce();

  if (repeat) {
    if (alarmInterval) clearInterval(alarmInterval);
    alarmInterval = window.setInterval(() => {
      /* keep repeating gently when hidden; user will see notif or return */
      playOnce();
    }, 1850);
  }

  // Auto stop after reasonable time if repeat (user must dismiss via UI)
  if (repeat && onComplete) {
    setTimeout(() => {
      stopAlarm();
      onComplete();
    }, 1000 * 60 * 4); // 4min safety
  } else if (onComplete) {
    setTimeout(onComplete, playOnce() + 80);
  }
}

export function stopAlarm() {
  if (alarmInterval) {
    clearInterval(alarmInterval);
    alarmInterval = null;
  }
}

export function playTestBeep(soundKey: string) {
  // Fire-and-forget test (non-repeating)
  playFinishSequence(soundKey, false).catch(() => { /* best effort */ });
}
