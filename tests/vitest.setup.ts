// Vitest setup: dummy VITE_* so unit tests can import modules that load supabase.ts
import.meta.env.VITE_SUPABASE_URL = 'http://127.0.0.1:54321';
import.meta.env.VITE_SUPABASE_ANON_KEY = 'sbp_dummy_anon_key_for_vitest_unit_tests_only';
import.meta.env.VITE_TURNSTILE_SITEKEY = 'dummy-turnstile-sitekey-for-tests';