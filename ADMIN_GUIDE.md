# ViralRefer — Admin Guide

For the site owner only.

## How you log in (current production)

Admin is **not** a client-side `VITE_ADMIN_PASSWORD` compare. That path is gone.

1. Open https://www.viralrefer.app/?owner=1 (or press **Ctrl+Shift+O** on the homepage).
2. Enter `ADMIN_OWNER_PASSWORD` (Supabase Edge secret).
3. The edge function mints an 8-hour HMAC session. The browser keeps it in `sessionStorage` and sends `x-admin-session`.

There is **no** `isAdmin = true` bypass in `admin-action`. Scripts/cron use `ADMIN_ACTION_SECRET` (`x-admin-secret`).

Treat `ADMIN_OWNER_PASSWORD` as a high-privilege secret. Never put it in a `VITE_` env var (that would bake it into the public JS bundle).

## Dashboard tabs

Referrals, Share Analytics, Edit Content, Prize Claims, Text Colors, Viral Optimizer, plus the live activity hub.

## Prize / homepage-feature claims

Public product is **recognition only** — homepage banner, no cash.

1. Prize Claims tab (or `prize_claims` in Supabase).
2. Confirm the code is still #1 on the live board and meets the minimum threshold.
3. Approve or reject in the dashboard (`update_claim_status`). Do not set `paid` unless you are running a private off-site arrangement.

## Deploy

See [DEPLOY.md](./DEPLOY.md). Prefer `npm run deploy:prod` when Edge Functions change.
