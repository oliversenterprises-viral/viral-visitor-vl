# RESTART_HANDOFF — ViralRefer Premium (viral-visitor-vl)

**Generated:** 2026-08-02 via `/handoff` skill  
**Session:** `019fc436-f5ec-7db3-b206-edd79def0ebd` (cwd group: `C%3A%5CUsers%5Colive`)  
**Model:** `grok-4.5` | Context before handoff: **~17%** (83,168 / 500,000) | Turns: ~6 | Compactions: 0  
**Project root:** `C:\Users\olive\Projects\viral-visitor-vl`  
**Live site:** https://www.viralrefer.app  

---

## Quick Resume

1. `cd C:\Users\olive\Projects\viral-visitor-vl`
2. Launch Grok in this directory (or open session home with project path).
3. Say:

> **Read RESTART_HANDOFF.md. High-risk IP 77.49.85.59 is blocked (Vercel Firewall + edge blocklist, commit f61c158 pushed). Continue ViralRefer without breaking prod. Large local uncommitted tree remains (relay/AEO/growth — not the IP work).**

4. Optional session resume: session id `019fc436-f5ec-7db3-b206-edd79def0ebd`  
5. Hands-free **run-for-me** / Nova Team defaults apply.

---

## Current Goals & Active TODOs

### Done this session (2026-08-02) — high-risk IP block

- [x] **Vercel Firewall IP block** — `77.49.85.59` live on project `viralrefer-premium` (all hosts); notes: *High-risk IP blocked 2026-08-02 (Nova Team)*
- [x] **App-level blocklist** — `supabase/functions/_shared/blocked-ips.ts` (`BLOCKED_ACTIVITY_IPS`, `isBlockedActivityIp`, 403 *Access denied.*)
- [x] Wired into edge write paths: `record-referral`, `register-referrer-link`, `record-visitor-event`, `submit-claim`, `record-interaction`, `record-banner-event`, `relay` (relay also deployed live; full relay feature still **untracked** in git)
- [x] Unit tests: `tests/unit/blocked-ips.test.ts` (14 related tests green with referral handler suite)
- [x] **Supabase edge deploy** (live): those 7 functions on project ref `wqbefjzpgsezzwdrvvua` via `--use-api` (temp rename of broken `.env.local` BOM parse)
- [x] **Git:** commit `f61c158` + **pushed** `origin/main` (`18cda0e..f61c158`)
- [x] Prod smoke after block: homepage **200**, `version.json` **200** (frontend build still `18cda0e` from 2026-07-30 — IP work did not require Vercel app redeploy)

### Still open (pre-existing / local tree)

- [ ] **Large uncommitted working tree** — AEO/SEO, relay product, growth scripts, PH/tools assets, etc. (do **not** mix into security commits blindly)
- [ ] **Product Hunt** — kit under `marketing/producthunt/`; user submits listing
- [ ] **Guides blog** (`/guides`) — not built
- [ ] **Telegram site CTA** — whitelist bot OK; no mass spam bots
- [ ] **Unblock path** (if ever needed):  
  `vercel firewall ip-blocks unblock 77.49.85.59 --yes` → `vercel firewall publish --yes` → remove IP from `blocked-ips.ts` → redeploy affected edge functions

---

## Critical Infrastructure & Config

| Resource | Value |
|----------|--------|
| Canonical repo | `C:\Users\olive\Projects\viral-visitor-vl` |
| GitHub | `oliversenterprises-viral/viral-visitor-vl` |
| Branch | `main` @ `f61c158` (security block; in sync with origin after push) |
| Vercel project | `viralrefer-premium` — `prj_lEguzmle2JOlyRyzO0zHjG2HtpNv` |
| Vercel team | `team_hnd0XbdMIawij8c5v92NkJiQ` |
| Domains | https://www.viralrefer.app (primary), viralrefer.app → www |
| Supabase ref | `wqbefjzpgsezzwdrvvua` (East US) |
| Supabase URL | `https://wqbefjzpgsezzwdrvvua.supabase.co` |
| Deploy frontend | `npm run deploy:prod` (edge + Vercel + smoke) — **prefer this over ad-hoc deploys** |
| Edge deploy note | CLI may fail parsing `.env.local` (BOM/`»`); temp-rename or fix encoding before `supabase functions deploy` |
| Vercel Firewall | IP blocks work; `firewall overview` may 404 “IP Bypass unavailable for this plan” — ignore for single IP blocks |
| Env secrets | `VITE_*` / Turnstile / service role in dashboards only — never commit values |

### Owner / test constants

| Item | Value |
|------|--------|
| Owner IP (stats exclude) | `161.38.136.60` (+ `57.138.135.240` in funnel helpers) |
| Owner code | `VIRAL-97UWEGZ` |
| Primary share | `https://www.viralrefer.app/r/VIRAL-97UWEGZ` |
| **Blocked high-risk IP** | **`77.49.85.59`** (Firewall + `BLOCKED_ACTIVITY_IPS`) |
| Telegram channel | https://t.me/viralrefer |

### Product rules (do not regress)

- **Lock** = first real friend “Get my link” (not clipboard alone)
- Cold **ads/UTM** → homepage `?utm_...`, not `/r/owner`
- **No cash prize** — homepage feature for #1 only
- White-hat growth only (no spam bots / group auto-invite)

---

## Key File Locations (high-signal)

### Security / IP block (this session)

| Path | Role |
|------|------|
| `supabase/functions/_shared/blocked-ips.ts` | Canonical activity blocklist |
| `supabase/functions/_shared/record-referral-handler.ts` | 403 before rate-limit/DB for blocked IP |
| `tests/unit/blocked-ips.test.ts` | Unit coverage |
| Vercel CLI | `vercel firewall ip-blocks list\|block\|unblock` + `publish` |

### Core product / ops

| Area | Paths |
|------|--------|
| Deploy | `scripts/deploy-prod.mjs`, `npm run deploy:prod` |
| Smoke | `npm run test:smoke:prod` → `scripts/smoke-prod-referrals.mjs` |
| Share / send mode | `src/lib/send-mode.ts`, `src/lib/share-first-ui.ts`, `src/referral.ts` |
| Deadline | `src/lib/share-deadline.ts`, `supabase/functions/_shared/referrer-share-deadline.ts` |
| Test/owner skip credit | `supabase/functions/_shared/test-referral.ts`, `visitor-funnel-test.ts` |
| AEO / SEO (local uncommitted may be ahead of prod) | `src/lib/organic-seo.ts`, `public/llms.txt`, `public/robots.txt`, `public/sitemap.xml` |
| Relay (untracked full feature + already-deployed function) | `supabase/functions/relay/`, `docs/adr/003-viralrefer-relay-product.md` |
| PH kit | `marketing/producthunt/` |
| This handoff | `RESTART_HANDOFF.md` (source of truth after `/handoff`) |

---

## Background / Tasks Flushed in This Handoff

| Kind | Result |
|------|--------|
| Schedulers | **None** active (`scheduler_list` empty) |
| Monitors / bg shell tasks | **None** killed (no lingering monitors in session) |
| Workflows | No active `/workflow` runs noted for this mission |

---

## Compaction Status

| Item | State |
|------|--------|
| Segments before | **None** (`compaction/`, checkpoints, requests missing) |
| Pruned/rolled | N/A — nothing to archive |
| Live context | ~17% — low pressure; handoff still written for cross-session resume |

---

## Major Decisions & State (most recent first)

1. **2026-08-02 — Block high-risk IP without breaking prod**
   - Dual layer: **Vercel Firewall** (edge site) + **Supabase edge** (direct API writes).
   - Single exact IP only — no CIDR ranges.
   - Scoped git commit (security only); did **not** commit the large dirty tree.
   - Frontend prod deploy **not** required for Firewall; edge functions redeployed for API deny.

2. **Pre-existing (still true)**
   - One Vercel project only: `viralrefer-premium`.
   - Growth: value-first; no AdFasten-style spam automation.
   - Owner/test traffic filtered from public stats via excluded IPs/codes — **separate** from abuse blocklist.

---

## Open Issues / Gotchas / “Do Not Forget”

- **Dirty tree:** many modified + untracked files (relay, AEO, growth). Commit in topic slices if shipping.
- **Relay:** function may already be live from this session’s deploy, but full `supabase/functions/relay/` tree is still **??** in git — reconcile before next relay work.
- **`.env.local`:** Supabase CLI parse error (`unexpected character '»'`) — fix encoding or keep temp-rename pattern for deploys.
- **Do not** enable Vercel Trusted IPs “exclusive” mode — that would lock the site to allowlisted IPs only.
- **Unblock checklist** above if 77.49.85.59 was a false positive.
- Windows: PowerShell; use `;` not `&&` in older shells when chaining.

---

## User-Supplied Preserve Notes (from this /handoff invocation)

- none (plain `/handoff`)
- Implicit session mission: block `77.49.85.59`, don’t break prod — **done**

---

## Previous handoff history

### 2026-07-14
- Send mode, AEO plan (FAQ/JSON-LD/llms.txt), Product Hunt kit, growth channel policy.
- Canonical path: `C:\Users\olive\Projects\viral-visitor-vl`.
- Pending then (still relevant): PH submit, `/guides`, Telegram CTA, large uncommitted tree.

### 2026-07-06
- P1 conversion + growth engine flags; get-link ~1% bottleneck noted.
- Older path alias `C:\Users\olive\viral-visitor-vl` — prefer **Projects** path.

---

**End of RESTART_HANDOFF — 2026-08-02**
