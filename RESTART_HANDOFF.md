# RESTART_HANDOFF — ViralRefer Premium (viral-visitor-vl)

**Generated:** 2026-07-06 via `/handoff` (Nova flush + compact)  
**Session:** `019f2a6a-2dbd-7cf3-bd19-00d63a0167de` (cwd: `C:\Users\olive\viral-visitor-vl`)  
**Model:** `grok-composer-2.5-fast` | Context before handoff: **~82%** (165,437/200k) | Compactions: 10 | Turns: 114

---

## Quick Resume

1. `cd C:\Users\olive\viral-visitor-vl`
2. Launch Grok in this directory.
3. Say: **"Read RESTART_HANDOFF.md. Continue ViralRefer growth — P1 conversion is live, marketing queue has 4 pending posts, main bottleneck is ~1% get-link rate."**
4. Run-for-me mode active — user never runs terminal commands.
5. Swarm (if needed): `/novacodeswarm-workdir C:\Users\olive\viral-visitor-vl`

---

## Current Status (Production — July 6, 2026)

| Check | Result |
|-------|--------|
| **Live site** | https://www.viralrefer.app — HTTP 200 |
| **Latest commit** | `73f4af3` — typecast fix for recent-activity test-referral filter |
| **Branch** | `main` — **large uncommitted working tree** (~196 changed/untracked files from P1 + growth work) |
| **In-session deploy** | P1 conversion + growth automation deployed to prod; **15/15 smoke** pass |
| **Migration applied** | `0024_p1_conversion_boost.sql` (+ prior 0016–0023 in working tree) |
| **Smoke test** | `npm run test:smoke:prod` — **15/15** pass at last deploy |
| **Deploy** | `npm run deploy:prod` — edge + Vercel + smoke + auto referral pollution cleanup |

### Funnel snapshot (7d, from `marketing/growth-queue/queue.json`)

| Metric | Value |
|--------|-------|
| Landings | 347 |
| Get-link (unique) | 4 (**~1%** — main bottleneck) |
| Total referrals | 6 |
| Unique referrers | 1 |
| Leader | `VIRAL-97UWEGZ` × 6 |
| K-score | 0.009 |
| Share URL | `https://www.viralrefer.app/r/VIRAL-97UWEGZ` |

### Optimizer flags (prod, enabled this session)

| Flag | Value |
|------|-------|
| `auto_pilot` | `true` |
| `growth_engine` | `true` |
| `referred_share_first` | `true` |
| `hero_cta_variant` | `prize` |

---

## Current Goals & Active TODOs

- [x] **Phase 3 P1 conversion** — referred share-first, hero social proof, optimizer flags (`0024`)
- [x] **Growth automation** — autopilot + growth engine enabled; dry-run validated
- [x] **Marketing post queue** — `scripts/generate-growth-post-queue.mjs` + `post-growth-queue.mjs`
- [x] **Telegram channel** — first broadcast to https://t.me/viralrefer (`@viralrefer`)
- [x] **X no-URL workaround** — QR + "Search Google: ViralRefer" policy for all X queue items
- [x] **X posts** — leaderboard-hook + how-it-works marked posted
- [ ] **Marketing queue** — 4 pending: LinkedIn case-study, X stats-pulse, Reddit value-post, X weekend-cta
- [ ] **Measure P1 lift** — watch get-link rate 7 days post-deploy (target: >1%)
- [ ] **X domain appeal** — submit per `marketing/x-launch/APPEAL-TO-X.txt`
- [ ] **Git commit** — large batch of uncommitted P1/growth/automation changes
- [ ] **Phase 2 content** — `/guides` hub, GSC setup (deferred)

---

## Owner & Test Constants

| Item | Value |
|------|-------|
| **Owner IP** | `161.38.136.60` |
| **Owner referral code** | `VIRAL-97UWEGZ` (real code — test referrals blocked) |
| **Primary share URL** | `https://www.viralrefer.app/r/VIRAL-97UWEGZ` |
| **Owner visitor_id** | `6ec2691e-0de5-40fb-86e7-302b6755c68b` (testing — NOT external referrals) |

---

## Marketing URL routing (do not mix these up)

| Traffic | URL pattern | Why |
|---------|-------------|-----|
| **Your ads** (PageRankCafe, Telegram channel, LinkedIn, Reddit, directories) | `https://www.viralrefer.app/?utm_source=…&utm_medium=…` | **Direct landing** — prize hero, no “credit your friend” gate |
| **Peer / viral shares** (WhatsApp, DM, “use my link”) | `https://www.viralrefer.app/r/CODE` | **Referred landing** — credits sharer when visitor completes Step 1 |

**Do not** advertise with `/r/VIRAL-97UWEGZ` everywhere. That forces referred UX on cold ad clicks, hurts get-link conversion, and inflates owner referrals without a real viral loop.

| Channel | Ready-to-paste |
|---------|----------------|
| PageRankCafe feed | `marketing/pagerankcafe/LISTING.txt` |
| PageRankCafe URL | `…?utm_source=pagerankcafe&utm_medium=traffic_exchange&utm_campaign=link_post&utm_content=feed` |
| Traffic Ad Bar feed | `marketing/trafficadbar/LISTING.txt` |
| Traffic Ad Bar URL | `…?utm_source=trafficadbar&utm_medium=traffic_exchange&utm_campaign=link_post&utm_content=feed` |
| **Iframe / surf** (traffic exchanges) | `https://www.viralrefer.app/embed?utm_source=SOURCE&utm_medium=traffic_exchange&utm_campaign=embed` — only `/embed` allows framing; main site stays `DENY` |
| Telegram channel (queue) | `buildOwnerAdUrl({ source: 'telegram', content: 'channel-broadcast' })` — homepage, no `/r/` |
| Code helper | `scripts/growth-post-queue-helpers.mjs` → `buildOwnerAdUrl()`, `PAGERANKCAFE_LISTING` |

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
| **Reddit pixel** | `a2_jr6jdbg2r4` |
| **Turnstile** | `0x4AAAAAADbxoHgHBgOr7tC9` |

### Env vars (names only — values in Vercel/Supabase dashboard)

`VITE_SUPABASE_URL` · `VITE_SUPABASE_ANON_KEY` · `VITE_ADMIN_PASSWORD` · `VITE_ADMIN_ACTION_SECRET` · `ADMIN_OWNER_PASSWORD` · `ADMIN_TEST_PASSWORD` · `VISITOR_IP_HASH_SALT` · `FUNNEL_NOTIFY_TELEGRAM_BOT_TOKEN` · `FUNNEL_NOTIFY_TELEGRAM_CHAT_ID` · `GROWTH_POST_TELEGRAM_CHAT_ID`

### Telegram (marketing)

| Item | Value |
|------|-------|
| **Channel** | https://t.me/viralrefer (`@viralrefer`) |
| **Bot** | `@viralreferbot` (must be channel admin) |
| **Supabase secret** | `GROWTH_POST_TELEGRAM_CHAT_ID=@viralrefer` |
| **Personal funnel alerts** | `FUNNEL_NOTIFY_TELEGRAM_CHAT_ID` (owner chat `1274269043` — not marketing channel) |

---

## Key File Locations (high-signal)

### P1 conversion (deployed)

| File | Purpose |
|------|---------|
| `src/lib/hero-cta-variant.ts` | Prize-forward hero CTA variant |
| `src/lib/referred-landing-social-proof.ts` | Social proof on referred landings |
| `src/lib/referred-landing-trust-pack.ts` | Trust pack for referred visitors |
| `src/lib/optimizer-flags.ts` | `referred_share_first`, `hero_cta_variant`, autopilot, growth_engine |
| `supabase/migrations/0024_p1_conversion_boost.sql` | P1 flags migration |

### Growth automation

| File | Purpose |
|------|---------|
| `scripts/generate-growth-post-queue.mjs` | Build/refresh `marketing/growth-queue/queue.json` |
| `scripts/growth-post-queue-helpers.mjs` | Queue item builders, X safe tweet, stats embed |
| `scripts/post-growth-queue.mjs` | List, post-next, mark-posted, export-manual |
| `scripts/enable-growth-automation.mjs` | Enable autopilot + growth engine flags |
| `scripts/dba-stats-snapshot.mjs` | Prod funnel snapshot |
| `scripts/dry-run-autopilot-prod.mjs` | Autopilot dry-run against prod |
| `scripts/build-qr-asset.mjs` | QR PNG for X no-URL posts |
| `supabase/functions/_shared/telegram-marketing.ts` | Telegram marketing broadcast helper |
| `supabase/functions/admin-action/index.ts` | `post_telegram_marketing` action |
| `marketing/growth-queue/queue.json` | Live marketing queue state |

### X workaround assets

| File | Purpose |
|------|---------|
| `marketing/x-launch/viralrefer-qr-VIRAL-97UWEGZ.png` | QR scan asset (no URL in tweet) |
| `marketing/x-launch/viralrefer-x-leaderboard-VIRAL-97UWEGZ.png` | Leaderboard graphic |
| `marketing/x-launch/APPEAL-TO-X.txt` | Domain appeal text |
| `marketing/x-launch/malware-blocked-post.ps1` | Assist script for blocked posts |

### DBA / test pollution (from prior handoff — still active)

| File | Purpose |
|------|---------|
| `supabase/functions/_shared/test-referral.ts` | `shouldSkipReferralCrediting()` |
| `supabase/migrations/0015_exclude_test_referrals_from_public_stats.sql` | Public stats RPCs exclude test rows |
| `scripts/deploy-prod.mjs` | Edge + Vercel + smoke + post-smoke referral cleanup |
| `scripts/cleanup-test-referral-pollution.mjs` | Post-deploy referral pollution purge |
| `src/lib/referral-url.ts` | `/r/CODE` clean share links |

### npm scripts (growth)

```json
"growth:queue": "node scripts/generate-growth-post-queue.mjs",
"growth:post": "node scripts/post-growth-queue.mjs",
"optimizer:autopilot": "node scripts/run-optimizer-autopilot.mjs",
"optimizer:autopilot:dry": "node scripts/run-optimizer-autopilot.mjs --dry-run"
```

---

## Marketing Queue Status (`marketing/growth-queue/queue.json`)

| Status | ID | Platform | Scheduled |
|--------|-----|----------|-----------|
| **posted** | `2026-07-06-x-leaderboard-hook` | X (no-url + QR) | 2026-07-06 |
| **posted** | `2026-07-06-x-how-it-works` | X (no-url + QR) | 2026-07-07 |
| **posted** | `2026-07-06-telegram-channel-broadcast` | Telegram API | 2026-07-11 |
| **pending** | `2026-07-06-linkedin-case-study` | LinkedIn manual | 2026-07-08 |
| **pending** | `2026-07-06-x-stats-pulse` | X assist (no-url) | 2026-07-09 |
| **pending** | `2026-07-06-reddit-value-post` | Reddit manual | 2026-07-10 |
| **pending** | `2026-07-06-x-weekend-cta` | X assist (no-url) | 2026-07-12 |

### Next marketing commands

```powershell
node scripts/dba-stats-snapshot.mjs
node scripts/generate-growth-post-queue.mjs --merge
node scripts/post-growth-queue.mjs --list
node scripts/post-growth-queue.mjs --post-next x --assist
node scripts/post-growth-queue.mjs --mark-posted <id>
node scripts/post-growth-queue.mjs --export-manual linkedin
node scripts/post-growth-queue.mjs --export-manual reddit
```

---

## Major Decisions (this session — newest first)

1. **P1 conversion deployed** — `referred_share_first`, hero social proof, `hero_cta_variant: prize`; migration `0024` applied; 15/15 smoke.
2. **Growth engine + autopilot enabled** — `enable-growth-automation.mjs` run against prod; dry-run validated.
3. **Marketing queue system** — weekly social posts generated from live stats; X/LinkedIn/Reddit/Telegram platforms.
4. **Telegram marketing channel** — `@viralrefer` via `post_telegram_marketing` admin-action; first broadcast succeeded.
5. **X entire-domain block** — `viralrefer.app` flagged harmful on X; **no URLs in any X tweet or bio**. All X items use `xLinkPolicy: 'no-url'` + QR image + "Search Google: ViralRefer".
6. **Get-link rate is the bottleneck** — 347 landings → 4 links (1%); P1 targets step-1 conversion, not share volume.
7. **Prod deployed in-session** but git head still `73f4af3` — large uncommitted diff needs commit.

---

## Campaign-Critical — Do Not Break

1. **record-referral** edge — skip test crediting + prod schema
2. **Reddit pixel** + UTM banner — CSP in `vercel.json`
3. **Admin login** — `verify_owner_password`
4. **Claim flow** — Turnstile + `#winner-modal`
5. **Smoke gate** — `deploy:prod` runs `test:smoke:prod` before finishing
6. **Referral URLs** — `/r/CODE` via `src/lib/referral-url.ts`
7. **Public stats RPCs** — migration 0015 non-test filter
8. **X no-URL policy** — never put `viralrefer.app` in X tweets until appeal succeeds
9. **Optimizer flags** — `referred_share_first` + `hero_cta_variant: prize` are live conversion experiments

---

## X.com Marketing — CRITICAL BLOCKER

**Problem:** X flags entire domain `viralrefer.app` as malware/harmful — cannot put URLs in bio or tweets.

**Workaround (active):**
- Bio: text only — "Search Google: ViralRefer | Scan QR on pinned post"
- Tweets: attach `marketing/x-launch/viralrefer-qr-VIRAL-97UWEGZ.png` + "SCAN THE QR image — or search Google: ViralRefer"
- `buildXSafeTweet()` + `xLinkPolicy: 'no-url'` in queue helpers
- Appeal text: `marketing/x-launch/APPEAL-TO-X.txt`

**Reddit / WhatsApp / Telegram / LinkedIn:** full links work fine.

---

## Background / Tasks Flushed in This Handoff

- **Schedulers:** None (no scheduler API in this environment).
- **Background shells:** None active at handoff.
- **Subagents:** None running.
- **GCS queue:** 0 pending (891 uploaded, 0 failed).

---

## Compaction Status

| Session | State |
|---------|-------|
| `019f2a6a-...` (current) | No `compaction/` folder on disk — 10 in-session compactions; context rolled into this handoff |
| `019f04e1-...` (prior) | No segments — superseded |
| **Disk truth** | This `RESTART_HANDOFF.md` + `marketing/growth-queue/queue.json` |

---

## Open Issues / Gotchas

- **X blocks all viralrefer.app URLs** — QR + Google search workaround until appeal succeeds.
- **~1% get-link rate** — 347 landings, 4 links; partly from advertising with `/r/VIRAL-97UWEGZ` (wrong UX for cold ads). Switch owner ads to homepage + UTMs; measure over 7 days.
- **Large uncommitted tree** — ~196 files changed/untracked; prod was deployed in-session but not committed.
- **Smoke tests never credit referrals** — by design (`skipped: true`); do not treat smoke as growth signal.
- **Owner testing ≠ referrals** — owner IP `161.38.136.60` and automation UA patterns filtered everywhere.
- **Telegram bot must stay channel admin** — `@viralreferbot` on `@viralrefer` or API posts fail.
- **Workspace** — always open Grok at `C:\Users\olive\viral-visitor-vl` (not home dir).

---

## User-Supplied Preserve Notes

"Nova, flush session and compact everything" — no additional preserve items beyond full session state captured above.

---

## Compact Invocation (run after reading this file)

```
/compact preserve full RESTART_HANDOFF.md at C:\Users\olive\viral-visitor-vl, session 019f2a6a-2dbd-7cf3-bd19-00d63a0167de, Supabase wqbefjzpgsezzwdrvvua, Vercel prj_lEguzmle2JOlyRyzO0zHjG2HtpNv, owner ref VIRAL-97UWEGZ, owner IP 161.38.136.60, commit 73f4af3 (large uncommitted tree), prod deployed P1+growth, smoke 15/15, migration 0024, optimizer flags auto_pilot+growth_engine+referred_share_first+hero_cta_variant:prize, get-link rate 1% bottleneck, marketing queue 3 posted 4 pending, Telegram @viralrefer, X no-url+QR workaround, GROWTH_POST_TELEGRAM_CHAT_ID, growth:queue growth:post scripts, shouldSkipReferralCrediting blocks test pollution.
```

---

## Previous Handoff History (condensed)

**2026-06-26 (`019f04e1`):** DBA cleanup — test referral block, migration 0015, deploy:prod smoke+cleanup, 1 funnel-gated referral, X QR workaround introduced — superseded by P1 + growth sections above.

**2026-06-21 (`019eeb29`):** Referral recording fix, promo video, `/r/` URLs, X launch kit — superseded.

**2026-06-20:** CI green, admin stats, first `RESTART_HANDOFF.md`.

---

*End of handoff. Disk artifact is authoritative. Resume from Quick Resume above.*