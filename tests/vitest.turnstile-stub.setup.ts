/** Empty Supabase env so turnstile-call-sites uses real stub client (no vi.mock). */
import.meta.env.VITE_SUPABASE_URL = '';
import.meta.env.VITE_SUPABASE_ANON_KEY = '';
import.meta.env.VITE_TURNSTILE_SITEKEY = 'dummy-turnstile-sitekey-for-tests';