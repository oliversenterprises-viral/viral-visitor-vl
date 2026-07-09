/**
 * Application Configuration & Defaults
 *
 * Single source of truth for non-sensitive, non-content constants used across
 * the public site and admin. Sensitive values (Supabase keys) live in Vite env.
 *
 * These are intentionally simple named exports so they can be tree-shaken or
 * overridden in tests without a full DI container.
 */

/** Canonical public origin (www). Apex redirects here in production. */
export const DEFAULT_REFERRAL_BASE_URL = 'https://www.viralrefer.app';

export const APP_NAME = 'ViralRefer';