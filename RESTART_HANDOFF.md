# RESTART_HANDOFF — ViralRefer Site Drops (848-fix)

**Generated:** 2026-09-03  
**Worktree:** `C:\Users\olive\Projects\viral-visitor-vl-848-fix`  
**HEAD:** `848540d` (detached, Site Drops handoff — keep live)  
**Dirty tree:** ~77 uncommitted files (do not merge onto dirty `viral-visitor-vl` main; do not zip 2387436)

---

## Quick Resume

1. `cd C:\Users\olive\Projects\viral-visitor-vl-848-fix`
2. Say: **Read RESTART_HANDOFF.md. Continue viralrefer.app Site Drops ladder. Do not mint on Oliver’s Chrome. Do not open Desk.**
3. Deploy: `npm run deploy:cloudflare` (loads allowlisted `VITE_*` from 848-fix then sibling env; refuses if URL/anon/Turnstile missing).
4. Host is **Cloudflare Workers + static assets**, not Vercel.

---

## Live now

| Item | Value |
|------|--------|
| Site | https://www.viralrefer.app |
| Worker | `viralrefer` |
| Account | `9a0b71745403339d82a8d72cfcd3b1f0` |
| Zone | `8ad67fe9f4a796c89fb84f5b2af65a51` |
| NS | `emma.ns.cloudflare.com` / `kaiser.ns.cloudflare.com` |
| Latest Worker version | `7f1f094e-a995-404b-bc67-26914361d5af` |
| Latest CSS | `index-BK0ULm0A.css` |
| Supabase | `wqbefjzpgsezzwdrvvua` |

Client build needs `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_TURNSTILE_SITEKEY`. Never `VITE_ADMIN_ACTION_SECRET` / owner password in the repo or in replies.

---

## Product lock (do not drift)

- No cash prize. Prize is 7-day homepage banner for this week’s #1 (not owner) with 3 friends.
- Turnstile on paste and first friend credit. Compact widget, not invisible.
- `LOCKED_SITE_DROPS_CTA` = **Get my referral link** (desktop / FAQ / i18n `hero.cta`).
- Phone hero shows **Get my link** via a second span (`hero.cta_short`). `setButtonLabel` updates the first span only.
- Friend land CTA = **Get my link** (`SAME_RACE_CTA`).
- Site Drop / Just entered / Rising / Challenger stay English.
- Do not delete `public/google163d31ba24216edd.html`.
- Do not wipe `vr_show_owner` / `vr_my_ref_code`.
- Do not mint a live Get my link on Oliver’s Default Chrome. Do not tap live Send on his profile.
- Do not touch HQ/Desk while he is in it.
- Chrome DevTools: not port 9222; never `browser.close()` on CDP.

---

## Loop (live, phone 390×844)

1. Organic: V mark → **Win the homepage.** → Just entered / Rising / Challenger → **Get my link** (~141px). How/Board hidden until expand.
2. Friend `/r/CODE`: **Same race as CODE.** → rungs → **Get my link**. Subtitle off. Title one line. Friend Turnstile after footer, height 0 until iframe.
3. After Get my link: same Send button reads **Getting your link…** then **Send it now**.
4. After Send: paste field + **Paste site**. Copy hidden. Share-abandon overlay suppressed. Turnstile host is **under** the button (height 0 until iframe).
5. After paste: rungs → **Send it now**. Drop/status/chips/Copy/toast off.

Paste auto-saves on paste+input when URL normalizes (`vrFromPaste`). Enter submits. Focus paste when share sheet closes (`sharePromise.finally` + visibilitychange).

---

## Do not

- Deploy dirty `C:\Users\olive\Projects\viral-visitor-vl` main.
- Treat Vercel as the host (Hobby 100/day cap; cutover done).
- Hide friend-land rungs (locked visible).
- Strip desktop prize slot (phone hides it; desktop still shows).
- Commit secrets. Do not print Desk password or `ADMIN_ACTION_SECRET`.
- Block deploys on `get-link-reveal` EnvironmentTeardown flake.

---

## Next if you keep cutting

1. Real-loop watch in an **isolated** tab only (Turnstile on paste is the remaining wall).
2. Park/commit this 848-fix tree when Oliver asks — not onto dirty main.
3. Do not resume tiny first-screen padding deploys.

---

## Commands

```
cd C:\Users\olive\Projects\viral-visitor-vl-848-fix
npx vitest run tests/unit/first-screen-rules.test.ts tests/unit/share-abandon-rescue.test.ts --pool=threads
npm run deploy:cloudflare
```

Vitest from this worktree with `--pool=threads`.

---

## Background flushed (2026-09-03)

- Schedulers: none.
- Isolated verify tabs closed; Oliver’s www tab (`?v=nav1`) and Cloudflare dash left open.

---

## Previous handoff

**2026-07-06** (cwd `C:\Users\olive\viral-visitor-vl`): P1 conversion + growth queue. Superseded for **host + Site Drops ladder**. Do not use that cwd for deploys.

---

*Disk artifact is the resume source. Say: read RESTART_HANDOFF.md and continue Site Drops.*
