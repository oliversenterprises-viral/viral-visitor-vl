/**
 * Viral loops toggles + thresholds — read from site_content.viral_loops_config.
 */

export interface ViralLoopsConfig {
  challenge_enabled: boolean;
  receipt_enabled: boolean;
  anxiety_enabled: boolean;
  sprint_enabled: boolean;
  community_enabled: boolean;
  community_goal_weekly: number;
}

export const DEFAULT_VIRAL_LOOPS_CONFIG: ViralLoopsConfig = {
  challenge_enabled: true,
  receipt_enabled: true,
  anxiety_enabled: true,
  sprint_enabled: true,
  community_enabled: true,
  community_goal_weekly: 100,
};

let cached: ViralLoopsConfig = { ...DEFAULT_VIRAL_LOOPS_CONFIG };

function parseBool(value: unknown, fallback: boolean): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const v = value.trim().toLowerCase();
    if (v === 'true' || v === '1' || v === 'yes') return true;
    if (v === 'false' || v === '0' || v === 'no') return false;
  }
  if (typeof value === 'number') return value !== 0;
  return fallback;
}

function parseGoal(value: unknown, fallback: number): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n) || n < 1) return fallback;
  return Math.min(Math.round(n), 10_000);
}

function parseConfigRaw(raw: unknown): Record<string, unknown> | null {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      return null;
    }
  }
  return null;
}

/** Hydrate from site_content row (call after fetchSiteContent). */
export function initViralLoopsConfigFromContent(content: Record<string, unknown>): void {
  const obj = parseConfigRaw(content.viral_loops_config);
  if (!obj) {
    cached = { ...DEFAULT_VIRAL_LOOPS_CONFIG };
    return;
  }
  cached = {
    challenge_enabled: parseBool(obj.challenge_enabled, DEFAULT_VIRAL_LOOPS_CONFIG.challenge_enabled),
    receipt_enabled: parseBool(obj.receipt_enabled, DEFAULT_VIRAL_LOOPS_CONFIG.receipt_enabled),
    anxiety_enabled: parseBool(obj.anxiety_enabled, DEFAULT_VIRAL_LOOPS_CONFIG.anxiety_enabled),
    sprint_enabled: parseBool(obj.sprint_enabled, DEFAULT_VIRAL_LOOPS_CONFIG.sprint_enabled),
    community_enabled: parseBool(obj.community_enabled, DEFAULT_VIRAL_LOOPS_CONFIG.community_enabled),
    community_goal_weekly: parseGoal(
      obj.community_goal_weekly,
      DEFAULT_VIRAL_LOOPS_CONFIG.community_goal_weekly,
    ),
  };
}

export function getViralLoopsConfig(): ViralLoopsConfig {
  return cached;
}