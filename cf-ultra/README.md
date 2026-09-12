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

## Project layout

```
cf-ultra/
  functions/           # Pages Functions
    api/               # health, join, board, activity, challenge, og, embed, simulate
    r/[code].ts        # OG + Get my link landing
    e/[host].ts        # embed widget
    embed.js.ts
    _lib/              # engine (pure), KV/memory store, OG HTML
  src/                 # Vite UI
  wrangler.toml
```

State lives in one KV key (`ultra:state`) plus optional rate-limit keys. Simulate (`POST /api/simulate`) is **disabled** when KV is bound so production cannot mint fake locks.

## Stack

Cloudflare Pages + Pages Functions + KV. Polling every 4s for live-enough heat (no Durable Object in v1). Static build via Vite.
