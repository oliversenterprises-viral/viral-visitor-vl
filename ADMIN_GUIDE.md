# ViralRefer — Admin Guide

For the site owner only.

## How you log in (current production)

Admin is **not** a client-side `VITE_ADMIN_PASSWORD` compare. That path is gone.

1. Open https://www.viralrefer.app/?owner=1 (or press **Ctrl+Shift+O** on the homepage).
2. Enter `ADMIN_OWNER_PASSWORD` (Supabase Edge secret).
3. The edge function mints an 8-hour HMAC session. The browser keeps it in `sessionStorage` and sends `x-admin-session`.

There is **no** `isAdmin = true` bypass in `admin-action`. Scripts/cron use `ADMIN_ACTION_SECRET` (`x-admin-secret`).

Treat `ADMIN_OWNER_PASSWORD` as a high-privilege secret. Never put it in a `VITE_` env var (that would bake it into the public JS bundle).

## Dashboard

Five numbers + one feed after the owner password. Last 7 days; owner IP, test codes, and webdriver excluded. Tiles come from SQL RPC get_owner_funnel_desk_counts (COUNT DISTINCT) when that function exists; if it is missing, the same 7-day DISTINCT counts are computed via service-role queries on visitor_events / shares / referrals / referrer_links (not last-1000). Landings, Get-link, Share (verified send, not copy), Locked, Get-link rate (Get-link / Landings only). One feed: Landed · Got a link · Shared · Locked. Extra owner tools stay behind a visible More (Friends, Prize, and Website words stay on the strip). The old tab bar is not CSS-hidden. No Died waiting / Promoters / Claims tiles on the first screen.

## Prize / homepage-feature claims

Public product is **recognition only** — homepage banner, no cash.

1. Prize Claims tab (or `prize_claims` in Supabase).
2. Confirm the code is still #1 on the live board and meets the minimum threshold.
3. Approve or reject in the dashboard (`update_claim_status`). Do not set `paid` unless you are running a private off-site arrangement.

## Deploy

See [DEPLOY.md](./DEPLOY.md). Prefer `npm run deploy:prod` when Edge Functions change.
