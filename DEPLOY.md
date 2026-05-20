# ViralRefer Premium — Deployment Runbook

## Recommended: Cloudflare Pages (Free + Global Edge)

1. Push the `viralrefer-premium` folder to GitHub.
2. In Cloudflare Dashboard → Pages → Create new project → Connect GitHub repo.
3. Build settings:
   - Framework preset: None (or Vite)
   - Build command: `npm run build`
   - Build output directory: `dist`
4. Environment variables (Production + Preview):
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `VITE_TURNSTILE_SITEKEY`
5. Add custom domain (viralrefer.app or your domain) and enable SSL.
6. Add the security headers via Cloudflare Transform Rules or `_headers` file in `public/` (example already in `vercel.json` — convert to Cloudflare format).

## Alternative: Vercel

- Import Git repo
- Framework: Vite
- Build command: `npm run build`
- Output: `dist`
- Add the `vercel.json` (already in root) for security headers + SPA fallback.

## Edge Functions (Supabase)

```bash
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase functions deploy record-referral --no-verify-jwt   # or with JWT once Auth is migrated
supabase functions deploy submit-claim
```

Set secrets in the Supabase Dashboard (Edge Functions → Secrets):
- TURNSTILE_SECRET_KEY
- SUPABASE_SERVICE_ROLE_KEY

## Post-Deploy Checklist (Security Gate)

- [ ] RLS migration applied (`0001_init_rls.sql`)
- [ ] Edge Functions deployed and secrets set
- [ ] Anon key cannot insert referrals or claims from browser console (test it)
- [ ] Admin uses real Supabase Auth (not client-side hash)
- [ ] Turnstile widgets live on profile + claim forms
- [ ] Security headers active (CSP, HSTS, X-Frame-Options)
- [ ] Lighthouse ≥ 95 Performance / 100 Accessibility
- [ ] Realtime works across multiple tabs
- [ ] E2E tests pass in CI

## Rollback

- Revert the Git commit that introduced the migration if needed.
- Supabase has point-in-time recovery.

## Monitoring

- Supabase Dashboard → Logs (Database + Edge Functions)
- Cloudflare / Vercel analytics
- Optional: Add Sentry for frontend errors

Production ready. Ship with confidence.
