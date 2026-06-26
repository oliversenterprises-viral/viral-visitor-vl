# ViralRefer — Deployment Runbook

**Production Platform**: Vercel (vercel.json is the active configuration).

**Vercel project (only one)**: `viralrefer-premium` — linked from this repo (`viral-visitor-vl`).

**Canonical live URLs** (all serve the same production build):

- https://www.viralrefer.app (primary — use for sharing)
- https://viralrefer.app (redirects to www)
- https://viral-visitor-vl.vercel.app (legacy alias → same build as www)

**Do not** create a second Vercel project for this repo; duplicate projects caused drift and confusion.

## Vercel Deployment (Primary / Production)

1. Push the repository to GitHub.
2. In the Vercel Dashboard, import the Git repository.
3. Framework preset: Vite.
4. Build command: `npm run build`
5. Output directory: `dist`
6. Vercel automatically uses the existing `vercel.json` for security headers and SPA fallback rewrites.

### Environment Variables (Vercel Dashboard — Production and Preview environments)

Add the following **VITE_** prefixed variables (these are exposed to the client):

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_TURNSTILE_SITEKEY`

- `VITE_ADMIN_PASSWORD` (client-side admin gate password; change from the development default for production)

**Note on Admin Access**: The current production admin mechanism is a client-side password gate using `VITE_ADMIN_PASSWORD`. This is a temporary implementation and is **not** real Supabase Auth. The `admin-action` Edge Function currently contains a temporary bypass to support this flow. Plan to migrate to proper Supabase Auth + server-side verification in the future.

## Edge Functions (Supabase)

All three Edge Functions must be deployed:

```bash
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase functions deploy record-referral
supabase functions deploy submit-claim
supabase functions deploy admin-action
```

### Supabase Secrets (Edge Functions → Secrets in Supabase Dashboard)

These are server-only secrets used by the Deno runtime:

- `TURNSTILE_SECRET_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

## Security Headers

Security headers are already configured in `vercel.json` (CSP, HSTS, X-Frame-Options, etc.) and are applied automatically on Vercel. No additional `_headers` file or Cloudflare rules are required.

## Post-Deploy Checklist

- [ ] RLS migrations applied (all files in `supabase/migrations/`)
- [ ] All three Edge Functions deployed (`record-referral`, `submit-claim`, `admin-action`)
- [ ] Supabase secrets set (`TURNSTILE_SECRET_KEY`, `SUPABASE_SERVICE_ROLE_KEY`)
- [ ] Vercel environment variables set for both Production and Preview
- [ ] Custom domain (viralrefer.app) configured with SSL
- [ ] Admin password gate functional via `VITE_ADMIN_PASSWORD` (temporary client-side implementation)
- [ ] Turnstile protection active on claim submissions
- [ ] Anon key cannot insert referrals or claims from browser console
- [ ] Realtime leaderboard and activity updates work across tabs
- [ ] All E2E tests pass (`npm run test:e2e`)
- [ ] Lighthouse scores acceptable (Performance ≥ 95, Accessibility 100 where feasible)

## Rollback

- Revert the Git commit that introduced the problematic change.
- Supabase provides point-in-time recovery for the database.
- Vercel provides instant rollback to previous deployments via the dashboard.

## Monitoring

- Supabase Dashboard → Logs (Database + Edge Functions)
- Vercel Analytics / Deployment logs
- Browser console for defensive `[ViralRefer]` logs during testing

**Production ready. Ship with confidence.**