# ViralRefer — Deployment Runbook

**Production platform:** Vercel project `viralrefer-premium` (this repo).

**Canonical live URL:** https://www.viralrefer.app  
Apex `https://viralrefer.app` redirects to www.

**Do not** create a second Vercel project for this repo.

## What actually ships

Two paths exist. Only path B deploys Edge Functions and runs smoke tests.

| Path | Trigger | Ships | Gates |
|------|---------|-------|--------|
| A — Git push to `main` | Vercel Git integration | Frontend only | Vercel `tsc && vite build` — **CI does not block this** |
| B — operator | `npm run deploy:prod` | 9 Edge Functions + Vercel prod + smoke | Static preflight, lint, live referral smoke |

**Prefer path B** after Edge or SQL changes. Path A is frontend-only and can drift from Deno.

### Edge Functions (path B)

`record-referral`, `admin-action`, `record-share`, `record-visitor-event`, `record-banner-event`, `record-interaction`, `submit-claim`, `optimizer-cron`, `register-referrer-link`

### Do not re-run these SQL files on production

- `scripts/apply-prod-rpcs.sql`
- `scripts/apply-prod-hardening.sql`

They redefine `get_leaderboard` **without** test/owner filters and would put smoke rows back on the public board. Live RPCs live in `supabase/migrations/` (especially 0015 / 0039).

Migrations `0046`–`0049` were applied 2026-08-12 after Edge `deploy:prod`. Do not re-run them. `0049` revokes leftover anon/authenticated write grants (including TRUNCATE) on visitor_events, banner_events, referrals, shares, prize_claims, and referrer_links.

## Environment

### Vercel (client — `VITE_*` is public in the JS bundle)

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_TURNSTILE_SITEKEY`

**Never** put the owner password or admin secret in a `VITE_` variable. Do not create a `VITE_ADMIN_PASSWORD` Edge or Vercel secret (removed 2026-08-12).

### Supabase Edge secrets (server only)

- `ADMIN_OWNER_PASSWORD` — owner gate (verified on the edge)
- `ADMIN_ACTION_SECRET` — HMAC sessions + scripts
- `TURNSTILE_SECRET_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `OPTIMIZER_CRON_SECRET` / Vercel `CRON_SECRET`
- Optional: `CLAIM_OWNERSHIP_SECRET` (falls back to `ADMIN_ACTION_SECRET`)
- Optional: `ALLOW_TURNSTILE_DEV_BYPASS=true` on **local/staging only**

## Admin access

Owner password is checked by `admin-action` → `verify_owner_password`. The browser stores an 8-hour HMAC session (`x-admin-session`). The public ADMIN button is hidden; open `/?owner=1` or press Ctrl+Shift+O.

## Post-deploy (path B)

- [ ] `https://www.viralrefer.app/version.json` matches the commit
- [ ] `/privacy/` `/terms/` `/rules/` return 200 (not the homepage)
- [ ] Get-link + referral smoke passed
- [ ] Owner gate still works via `/?owner=1`

## Rollback

- Frontend: Vercel Instant Rollback (does **not** roll back Edge or SQL)
- Edge: redeploy the previous function SHA via `deploy:prod` from that commit
- SQL: Supabase point-in-time recovery

## CI

`.github/workflows/ci.yml`: lint is a **separate** job so unit tests still run if lint is red. Fix lint before pushing `main`. Last green CI should be required before you treat a push as ship-ready. Vercel will still auto-promote `main` until a GitHub required-check is enabled (do that in the dashboard; do not lock yourself out of admin overrides).
