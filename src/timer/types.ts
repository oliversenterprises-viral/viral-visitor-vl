/**
 * Elite vClock Replica — Core Types
 * Strict, no any, background-proof timer domain.
 */

export type TimerStatus = 'IDLE' | 'RUNNING' | 'PAUSED' | 'FINISHED';

export type OnZeroAction = 'stop' | 'restart' | 'stopwatch';

export interface TimerState {
  status: TimerStatus;
  // Authoritative target wall time (for recovery + absolute datetime targets)
  targetWallMs: number | null;
  // For stopwatch / elapsed view
  baseElapsedMs: number;
  // User config (persisted + shareable)
  durationMs: number;           // last/ preset duration for restart
  label: string;                // Title (vclock "Title")
  finishMessage: string;        // "Show message"
  soundKey: string;             // e.g. 'classic' | 'guitar' | ... (maps to 21+ profiles)
  repeatSound: boolean;
  onZeroAction: OnZeroAction;
  // Display prefs
  showMs: boolean;
  // Runtime (not always persisted)
  remainingMs: number;
  elapsedMs: number;
}

export interface PersistedTimerState {
  version: 1;
  targetWallMs: number | null;
  durationMs: number;
  label: string;
  finishMessage: string;
  soundKey: string;
  repeatSound: boolean;
  onZeroAction: OnZeroAction;
  baseElapsedMs?: number;
  lastStatus?: TimerStatus;
  savedAt: number;
}

export type MainToWorker =
  | { type: 'INIT'; payload: { targetWallMs: number | null; durationMs: number; baseElapsedMs?: number; tickMs?: number } }
  | { type: 'START' }
  | { type: 'PAUSE' }
  | { type: 'RESUME' }
  | { type: 'RESET' }
  | { type: 'SYNC_REQUEST' }
  | { type: 'SET_DURATION'; totalMs: number };

export type WorkerToMain =
  | { type: 'TICK'; remainingMs: number; elapsedMs: number; monotonic: number }
  | { type: 'FINISHED' }
  | { type: 'ERROR'; message: string }
  | { type: 'PONG'; now: number; remainingMs: number };

export interface TimerPreset {
  label: string;
  ms: number;
  hint?: string;
}

export const PRESETS: TimerPreset[] = [
  { label: '1 min', ms: 60_000 },
  { label: '3 min', ms: 3 * 60_000 },
  { label: '5 min', ms: 5 * 60_000 },
  { label: '10 min', ms: 10 * 60_000 },
  { label: '15 min', ms: 15 * 60_000 },
  { label: '25 min', ms: 25 * 60_000, hint: 'Pomodoro' },
  { label: '30 min', ms: 30 * 60_000 },
  { label: '45 min', ms: 45 * 60_000 },
  { label: '60 min', ms: 60 * 60_000 },
];

export const SOUND_KEYS = [
  'classic', 'beep', 'bell', 'chimes', 'digital', 'flute', 'guitar', 'harp',
  'urgent', 'mellow', 'ascending', 'cuckoo', 'xylophone', 'wind', 'happy',
  'childhood', 'glow', 'musicbox', 'birds', 'bells', 'soft'
] as const;

export type SoundKey = typeof SOUND_KEYS[number];

export const DEFAULT_STATE: TimerState = {
  status: 'IDLE',
  targetWallMs: null,
  baseElapsedMs: 0,
  durationMs: 5 * 60_000,
  label: 'Focus Session',
  finishMessage: 'Time is up!',
  soundKey: 'classic',
  repeatSound: true,
  onZeroAction: 'stop',
  showMs: false,
  remainingMs: 5 * 60_000,
  elapsedMs: 0,
};
