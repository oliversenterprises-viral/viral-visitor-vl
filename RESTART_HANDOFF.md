# RESTART_HANDOFF — ViralRefer Premium (viral-visitor-vl)

**Generated:** 2026-06-21 via `/handoff` skill (efficient flush + compact)  
**Session:** `019ee0af-000b-71c0-a3d8-a15fdb45c03a` (cwd group: `C:\Users\olive`)  
**Model:** `grok-composer-2.5-fast` | Messages: 8772 chat / 419 turns | Last active: 2026-06-21

---

## Quick Resume

1. `cd C:\Users\olive\viral-visitor-vl`
2. Launch Grok here (or home `C:\Users\olive` — use `novacodeswarm-workdir` to lock repo).
3. Say: **"Read RESTART_HANDOFF.md at the project root. Continue ViralRefer maintenance without breaking campaign-critical paths."**
4. Swarm: `/novacodeswarm-workdir C:\Users\olive\viral-visitor-vl`

---

## Current Status (Production-Ready — 9.9/10)

| Check | Result |
|-------|--------|
| **Live site audit** | 12/12 (`npm run test:audit`) |
| **Admin flow audit** | 8/8 (`npm run test:admin-audit`) |
| **Unit tests** | 54/54 (`npm run test:unit`) |
| **Latest commit** | `5d20539` — visitor country from IP + admin geo panel |
| **Branch** | `main` (pushed to `origin/main`) |
| **Deployed domain** | https://www.viralrefer.app |

**Rating:** **9.9/10** production-ready. Campaign paths verified. Lint debt only (non-blocking).

---

## Current Goals & Active TODOs

- [x] Site-wide **Visitor Funnel** stats (violet panel, Admin → Edit)
- [x] **Unique visitors** + **country breakdown** (visitor_id + IP geo lookup)
- [x] Reddit Campaign Funnel (orange) — refresh + server fetch reliable
- [x] Banner Performance (green) — refresh delegation + prod schema logging
- [x] Fix `admin-action` 500s (`get_shares`, `get_banner_stats` schema alignment)
- [x] Fix Recent events showing oldest instead of newest (all three panels)
- [x] Stats panels server-first load (no stale local flash)
- [x] UTM source counts landings-only (less confusing)
- [ ] **Optional:** Commit or `.gitignore` untracked audit/recovery scripts
- [ ] **Optional:** Populate banner_events — needs public homepage banner views after schema fix
- [ ] **Optional:** Country data backfill — old events have NULL country; only new visits geo-tagged

---

## Admin Stats Panels (Admin → Edit) — How to Read

| Panel | Color | Audience | Data source | Key labels |
|-------|-------|----------|-------------|------------|
| **Site Visitor Funnel** | Violet | All traffic | `visitor_events` via `get_visitor_stats` | Events / Unique; By country (landings); By UTM source (landings only); Recent = 8 newest |
| **Reddit Campaign Funnel** | Orange | `utm_source=reddit` only | `reddit_events` via `get_reddit_stats` | Also sends Reddit pixel; By campaign (Reddit landings) |
| **Banner Performance** | Green | Prize card banners | `banner_events` via `get_banner_stats` | Imps/Clicks/CTR; server = cross-browser |

**Share Analytics** (Admin tab 1): `get_shares` — fixed prod schema (`referrer_code`).

**Refresh:** All panels use event delegation — ↻ shows "Refreshing…" + toast + Updated timestamp.

**Counts only change when new public-site traffic occurs** — Refresh re-fetches latest 500 server events.

---

## Critical Infrastructure & Config

| Resource | Value |
|----------|-------|
| **Canonical repo** | `C:\Users\olive\viral-visitor-vl` |
| **GitHub** | `oliversenterprises-viral/viral-visitor-vl` |
| **Vercel project** | `viralrefer-premium` — `prj_lEguzmle2JOlyRyzO0zHjG2HtpNv` |
| **Vercel team** | `team_hnd0XbdMIawij8c5v92NkJiQ` |
| **Supabase ref** | `wqbefjzpgsezzwdrvvua` |
| **Supabase URL** | `https://wqbefjzpgsezzwdrvvua.supabase.co` |
| **Reddit pixel** | `a2_jr6jdbg2r4` (`VITE_REDDIT_PIXEL_ID`) |
| **Turnstile** | `0x4AAAAAADbxoHgHBgOr7tC9` (`VITE_TURNSTILE_SITEKEY`) |

### Env vars (names only)

| Var | Where |
|-----|-------|
| `VITE_SUPABASE_URL` | Vercel Prod + Preview + CI |
| `VITE_SUPABASE_ANON_KEY` | Vercel Prod + Preview + CI |
| `VITE_ADMIN_PASSWORD` | Vercel Prod + Preview (owner login) |
| `VITE_ADMIN_ACTION_SECRET` | Vercel Prod + Preview (admin CMS + stats fetch) |
| `ADMIN_OWNER_PASSWORD` | Supabase Edge (`admin-action`) |
| `ADMIN_TEST_PASSWORD` | GitHub Actions only (CI E2E) |
| `VISITOR_IP_HASH_SALT` | Optional Supabase secret (IP hashing; has default) |

### DB tables for analytics (applied migrations)

| Migration | Table | Purpose |
|-----------|-------|---------|
| `0008_reddit_events.sql` | `reddit_events` | Reddit UTM funnel |
| `0009_visitor_events.sql` | `visitor_events` | Site-wide funnel |
| `0010_visitor_events_identity.sql` | +columns | `visitor_id`, `session_id`, `ip_hash`, `country_code` |

**Prod row counts (approx at handoff):** visitor_events ~81 · reddit_events ~30 · banner_events 0 · shares 1

**Prod `banner_events` schema:** `event_type`, `banner_label`, `redirect_url`, `source`, `additional` (NOT `type`/`label`/`key`).

**Prod `shares` schema:** `platform`, `referrer_code`, `created_at`.

---

## Campaign-Critical — Do Not Break

1. **Reddit pixel** (`a2_jr6jdbg2r4`) + UTM welcome banner — CSP in `vercel.json` allows `redditstatic.com`, `pixel-config.reddit.com`, `conversions-config.reddit.com`, `alb.reddit.com`
2. **Admin login** — no `?nocache=` kick-out; `verify_owner_password` via `admin-action`; gate in `src/public/modals.ts`
3. **Claim flow** — `handlers.ts`, `#winner-modal`, Turnstile
4. **CSP** — do not loosen without audit

**Console note:** `redditstatic.com/ads/pixel.js ERR_BLOCKED_BY_CLIENT` = ad blocker — not a bug.

---

## Key File Locations (analytics + admin)

| File | Purpose |
|------|---------|
| `src/lib/visitor-tracking.ts` | Site funnel track + `getVisitorEventsForStats` + unique/country stats |
| `src/lib/reddit-tracking.ts` | Reddit pixel + funnel + `getRedditEventsForStats` |
| `src/lib/stats-helpers.ts` | Shared `latestEvents`, `groupBy`, `eventName` |
| `src/content.ts` | Banner local + `getBannerEventsForStats` + `computeBannerStats` |
| `src/admin/visitor-funnel-stats.ts` | Violet panel UI + country names |
| `src/admin/reddit-campaign-stats.ts` | Orange panel UI |
| `src/admin/banner-stats.ts` | Green panel UI + refresh delegation |
| `src/admin/edit-content-tab.ts` | Wires all three panels on Edit tab load |
| `supabase/functions/record-visitor-event/index.ts` | Logs visitor events + IP geo (ipapi.co fallback) |
| `supabase/functions/record-reddit-event/index.ts` | Logs Reddit funnel events |
| `supabase/functions/record-banner-event/index.ts` | Logs banner events (prod schema) |
| `supabase/functions/admin-action/index.ts` | `get_visitor_stats`, `get_reddit_stats`, `get_banner_stats`, `get_shares` |
| `scripts/verify-stats-wiring.mjs` | Live stats API smoke test |
| `tests/site-audit.mjs` | 12-check live audit |
| `scripts/audit-admin-flow.mjs` | 8-check admin E2E |

---

## Recent Commits (this session wave — newest first)

```
5d20539 feat(analytics): resolve visitor country from IP + clearer admin geo panel
c035bd6 fix(admin): align all stats panels — server-first, correct UTM/recent events
89192da fix(admin): show newest visitor/reddit/banner events after server refresh
9125737 fix(admin): banner stats refresh + record events to production schema
0ebee1e fix(admin): align admin-action queries with production DB schema
6c02083 feat(analytics): unique visitors and country breakdown for site funnel
0770516 feat(admin): site-wide visitor funnel stats counter
77511a5 fix(admin): Reddit funnel refresh button + reliable server fetch
```

---

## Git Working Tree (at handoff)

**Modified (ignore):** `supabase/.temp/cli-latest`, `gotrue-version`, `storage-version`

**Untracked (local tooling):**
- `_premium_recovered/`
- `scripts/extract-live-env.mjs`, `full-audit.mjs`, `recover-*.mjs`, `verify-live.mjs`, `verify-stats-wiring.mjs`
- `tests/extract-*.mjs`, `reddit-*.mjs`, `referral-flow-audit.mjs`

**Tracked:** `RESTART_HANDOFF.md` updated this handoff.

---

## Background / Tasks Flushed in This Handoff

- **Schedulers:** None active (no scheduler API in this environment).
- **Background shells:** Stale terminal metadata for old `supabase db query` migration (pid 22340) — safe to ignore; migration `0010` already applied.
- **Subagents:** None running.

---

## Compaction Status

| Item | State |
|------|-------|
| **Session `019ee0af-...`** | No `compaction/` folder — context rolled into this handoff |
| **Older sessions** | `019ec9b4-...` has `compaction/INDEX.md`; archives under `019ec2de-.../compaction/archive/` |
| **This handoff** | Disk source of truth for resume |

**Pruned this handoff:** N/A (no segment files in current session).

---

## Major Decisions & State (most recent first)

1. **Country geo:** `record-visitor-event` uses header geo first, then `ipapi.co/{ip}/country_code/` fallback (browser→Supabase path lacks CF headers).
2. **Stats wiring:** `admin-action` uses `select('*')` + normalize for `banner_events`; `get_shares` uses `referrer_code`.
3. **Recent events bug:** Server returns DESC; panels must take first N after sort, not `slice(-N)`.
4. **UTM breakdown:** Counts **SiteLanding** only (visitor) and **RedditLanding** only (Reddit) — not all funnel steps.
5. **Unique visitors:** First-party `vr_visitor_id` in localStorage; not perfect humans (phone+laptop = 2).
6. **Server-first panels:** Removed local preload flash on Edit tab open.
7. **Reddit pixel** unchanged throughout analytics work — parallel tracking only.

---

## Open Issues / Gotchas

- **banner_events empty** until real public banner impressions/clicks post schema fix.
- **81 visitor events** had NULL `country_code` before IP lookup deploy — only **new** visits get country.
- **Ad blockers** block Reddit pixel + may block Supabase edge calls — stats undercount.
- **Admin panel** shows latest **500** events max.
- **`supabase db push`** fails on full history (existing tables) — use targeted `npx supabase db query --linked --file migrations/XXXX.sql --yes`.
- Workspace often `C:\Users\olive` not repo root — use `novacodeswarm-workdir`.

---

## User-Supplied Preserve Notes

None (user invoked: "Nova, do a flush and compact efficiently for me.")

---

## Compact Invocation (run after reading this file)

```
/compact preserve the full RESTART_HANDOFF.md at C:\Users\olive\viral-visitor-vl, deployment IDs (prj_lEguzmle2JOlyRyzO0zHjG2HtpNv, wqbefjzpgsezzwdrvvua), admin stats panel wiring (visitor/reddit/banner), latest commit 5d20539, campaign-critical paths (Reddit pixel, claim, admin login), and TODO state above.
```

---

## Previous Handoff History (condensed)

**2026-06-20 handoff** (`85ad1ed` era): CI green 10/10, E2E scoped, Text Colors secret auto-use, bundle chunks, `RESTART_HANDOFF.md` first written.

**Earlier (2026-05–06):** GitHub→Vercel migration, Nova waves, banner v2, rating progression, compaction segments archived under `.grok/sessions/.../compaction/archive/`.

**Superseded by this document** for all analytics/stats work completed 2026-06-20 through 2026-06-21.

---

*End of handoff. Disk artifact is authoritative. Resume from Quick Resume above.*