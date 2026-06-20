/**
 * Application Configuration & Defaults
 *
 * Single source of truth for non-sensitive, non-content constants used across
 * the public site and admin. Sensitive values (Supabase keys) live in Vite env.
 *
 * These are intentionally simple named exports so they can be tree-shaken or
 * overridden in tests without a full DI container.
 */

export const DEFAULT_REFERRAL_BASE_URL = 'https://viralrefer.app';

export const DEFAULT_ADMIN_PASSWORD = import.meta.env.VITE_ADMIN_PASSWORD || ''; // Hardened: no hardcoded fallback (audit security fix)

export const APP_NAME = 'ViralRefer';