# ViralRefer Ultra (Cloudflare)

A **new** Cloudflare-native ViralRefer: paste any website, get an instant personal share link, and climb a live board when **unique friends tap Get my link**.

This folder is a standalone Pages + Functions + KV app. It does **not** replace the live Vercel Site Drops product at [www.viralrefer.app](https://www.viralrefer.app). Do not point `www.viralrefer.app` or the production Vercel project at this build.

## What ships

1. Paste any site URL (no email).
2. Instant share kit: OG landing at `/r/VR-XXXXXX`, copy link, WhatsApp / X / Telegram / Reddit, QR.
3. Friend opens the link and taps **Get my link** → unique credit (visits and self-taps do not count).
4. Site climbs **Just entered → Rising → Challenger → #1 banner**.
5. Each rung is a shareable moment. Weekly race + duel. Streaks / 24h heat from real locks. Kingmaker when someone you referred hits #1.
6. Free embed snippet: “Help us go viral”.
7. Demo mode when KV or Functions are missing (clearly labeled; no fake user counts, testimonials, or MRR).

### Honest rules

| Action | Counts? |
| --- | --- |
| Open / refresh a share link | No |
| Copy or view the QR | No |
| Same browser tapping its own link | No |
| Same friend tapping twice | No |
| Unique friend taps Get my link | Yes |

Rungs (UTC week, unique locks only):

- **Just entered** — site pasted, 15 minutes
- **Rising** — 1 unique friend, 1 hour after last lock
- **Challenger** — weekly rank #2 / #3 with 2+ locks
- **#1 banner** — weekly lead with 3+ locks (recognition only, no cash)

## Run locally

```bash
cd cf-ultra
npm install
npm run build          # required gate — tsc + Vite
npm test               # engine / anti-cheat tests
```

### UI-only demo (no Wrangler)

```bash
npm run dev:ui
```

Opens Vite on http://localhost:5174. If `/api/health` is missing, the client uses **localStorage demo mode**. You can paste a URL, open the share kit, and **Simulate a unique friend**.

### Pages Functions + local KV

Needs the Wrangler CLI (installed as a devDependency):

```bash
npm run dev
```

This runs `wrangler pages dev --kv BOARD -- npm run dev:vite`. Functions are live, `BOARD` is an in-memory/local KV preview, and the UI talks to `/api/*`.

```bash
npm run preview
```

Builds `dist/` then serves it with `wrangler pages dev dist --kv BOARD` (default port **8788**).

If Wrangler cannot bind KV, Functions still start in **isolate memory demo mode**. The health payload says so. Data resets when the isolate recycles.

## Bind KV and deploy (approval gate)

**Do not deploy to production or attach a custom domain without explicit user approval.** This is a parallel demo, not a cutover.

1. Install / login Wrangler: `npx wrangler login` (on your machine; this agent will not publish for you).
2. Create a **separate** Cloudflare Pages project (name suggestion: `viralrefer-ultra`).
   - Framework: none / Vite
   - **Root directory: `cf-ultra`**
   - Build command: `npm run build`
   - Output directory: `dist`
   - Node: 20+
3. Create KV:

   ```bash
   npx wrangler kv namespace create BOARD
   npx wrangler kv namespace create BOARD --preview
   ```

4. Paste the IDs into `wrangler.toml` under `[[kv_namespaces]]` **or** bind `BOARD` in the dashboard: Pages → project → Settings → Bindings → KV namespace.
5. Deploy **only after approval**:

   ```bash
   npm run deploy
   # wrangler pages deploy dist
   ```

   Or connect the Git repo to that Pages project (root `cf-ultra`). Do **not** use the existing `viralrefer-premium` Vercel project.

6. Production custom domain / `www.viralrefer.app` is **out of scope** until you say to cut over.

### TODO when bindings are missing

- [ ] `wrangler kv namespace create BOARD` (+ preview)
- [ ] Bind `BOARD` on the Pages project
- [ ] Uncomment `[[kv_namespaces]]` IDs in `wrangler.toml`
- [ ] Approve a non-production Pages deploy
- [ ] Never put secrets in the Vite client bundle (`VITE_*` is public)

No Supabase, no Vercel, no service-role keys are required for this v1 demo.

## Current look (previews)

PNGs from the local Pages preview (`wrangler pages dev dist --kv BOARD` on :8788):

| Shot | Path |
| --- | --- |
| Homepage / board | `previews/01-homepage-board.png` |
| Mobile board | `previews/01b-homepage-board-mobile.png` |
| Paste URL + Get my link | `previews/02-paste-url-get-link.png` |
| Share kit | `previews/03-share-kit.png` |
| Friend referral land | `previews/04-friend-referral-land.png` |
| TE iframe splash | `previews/05-te-iframe-splash.png` |
| Embed widget | `previews/05b-embed-widget.png` |
| Admin HQ | `previews/06-admin-dashboard.png` (re-shoot after HQ rebuild) |

Stub routes: `/admin` (partial HQ desk), `/te` (publisher iframe splash).

## Project layout

```
cf-ultra/
  functions/           # Pages Functions
    api/               # health, join, board, activity, challenge, og, embed, simulate
    r/[code].ts        # OG + Get my link landing
    e/[host].ts        # embed widget
    embed.js.ts
    _lib/              # engine, store, memory rate limits, edge cache, OG HTML
  ARCHITECTURE.md      # 1k–10k+/day Cloudflare scale story
  src/                 # Vite UI
  wrangler.toml
```

State lives in `ultra:state` (durable) plus `ultra:board` (public snapshot). Simulate (`POST /api/simulate`) is **disabled** when KV is bound so production cannot mint fake locks.

Rate limits live in isolate memory — they never write KV.

## Scale (1k–10k+ visitors/day)

Designed so a busy day does not take the app down. Full write-up: [`ARCHITECTURE.md`](./ARCHITECTURE.md).

**Assumed bindings / plan**

- Cloudflare Pages project (root `cf-ultra`)
- Workers **Paid** (or Pages billed with paid Workers)
- One KV namespace bound as `BOARD`
- No Durable Object, no D1, no Supabase required

**Free KV is not this scale.** Free is ~1k writes/day. Each real Get-my-link writes two keys (`ultra:state`, `ultra:board`). A few hundred joins exhaust Free. Paid includes ~1M writes/day and ~10M reads/day.

**How it stays up**

| Rule | Implementation |
| --- | --- |
| Edge-first | Vite static assets on the Pages CDN (`/assets/*` immutable). Functions only for join + snapshots. |
| Reads ≫ writes | Board / activity / challenge / embeds / `/r/*` never `KV.put`. |
| Snapshot, don’t recompute | `GET /api/board` hits Cache API (~3s) → isolate (~2.5s) → `ultra:board`. |
| No write-per-pageview | Opening a share link or polling the board does not count and does not write. |
| Anti-abuse | 8 joins/IP/min, 5/actor/min, 120/10s/isolate. **429** on floods — no KV rate keys. |
| Fail soft | Degrade poll interval (8s → 16–30s) and serve stale snapshots before dropping paste → share → credit. If KV put fails, the kit still returns (`degraded: true`). |

`GET /api/health` includes a `scale` object with this same story.

## Owner HQ (admin)

First-class analytics console at **`/admin/`**. Not a leftover stub.

**Auth (live)**

- Pages Function checks `ADMIN_OWNER_PASSWORD` or `ADMIN_ACTION_SECRET` and sets an **HttpOnly HMAC cookie**. There is no owner password in the Vite bundle. Do not invent a `VITE_ADMIN_*` var.
- Optional: put Cloudflare Access in front of `/admin` — `Cf-Access-Authenticated-User-Email` is treated as signed-in.
- Copy `.dev.vars.example` → `.dev.vars` for local Wrangler (gitignored).
- **Local-only fallback:** if no secret is set **and** the request has no `CF-Ray` (typical `wrangler pages dev`), the Function accepts `ultra-local-only`. This is **disabled on the real Cloudflare edge**.

**Live vs demo/mock**

| Surface | Source |
| --- | --- |
| Uniques / sessions / funnel / platforms / geo / device / UTM | Live rollups from `/api/track` + join/credit (sampled pageviews) |
| Top sharers / climbing sites / board rungs | Live `ultra:state` + board snapshot |
| Live visitors + event feed | Isolate last-seen + flushed `stats:feed` |
| Geo country | `CF-IPCountry` (shows `XX` on local preview) |
| Fake testimonials / MRR / inflated counts | **Never** |

**Ops (live):** ban/mute codes or sites, edit public hero/lead (`/api/content`), CSV export, reset demo data, KV health line.

See `ARCHITECTURE.md` for rollup keys and write budget.

## Stack

Cloudflare Pages + Pages Functions + KV. Healthy clients poll the board every **8s** (hidden tabs stop). No Durable Object in v1. Static build via Vite.
