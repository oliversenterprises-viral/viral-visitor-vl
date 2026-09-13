# ViralRefer Site Drops (Cloudflare sibling)

An enhanced Cloudflare-native sibling of [www.viralrefer.app](https://www.viralrefer.app) Site Drops: same **VIRAL-** referral codes, `/r/…` + `/a/…` + `?ref=`, and Get my link credits — plus a stronger share kit, HQ, Telegram, and TE iframes.

This folder is a standalone Pages + Functions + KV app. It does **not** replace the live Vercel Site Drops product. Do not point `www.viralrefer.app` or the production Vercel project at this build. No cutover.

The **product core** is the eight-step loop in [`FUNNEL.md`](./FUNNEL.md). If anything conflicts, funnel perfection wins over duel/embed polish.

## Traffic exchanges (TE / rotators)

Owners can buy or run hit-exchange traffic **to this sibling** (and to a race link) without paid TE integrations and without bots climbing #1.

**Destinations (put these in the rotator)**

| URL | Role |
| --- | --- |
| `/te?src=te&camp=YOURCAMP` | Fast splash, iframe-safe, **no write per impression** |
| `/go?src=te&camp=YOURCAMP` | Same splash |
| `/embed/te?src=te&camp=YOURCAMP` | Compact 300×250 iframe |
| `/join?src=te&camp=YOURCAMP` | 302 into the real funnel |
| `/a/VIRAL-XXXXXXX?src=te` | Race attribution + TE tag |
| `/?src=te&camp=YOURCAMP` | Homepage after a real click |

Splash CTA uses `target="_top"` so a third-party iframe can break out. Cookies/storage are optional — tags live on the query string.

**Integrity (default)**

- Opening `/te` never credits anyone.
- A Get-my-link tagged `src=te` / `traffic_exchange` still issues a **share kit**, but **does not** write a verified credit toward Rising / Challenger / #1.
- HQ can flip “Allow TE-attributed credits” (off by default). Leave it off.

**HQ:** TE visits, TE→Get my link conversion, credits-per-TE-visit (should stay ~0), campaign list, copy-TE-link.

**Promo kit:** `/promo/te/` — live iframe previews, titles, blurbs, SVG banners, copy-paste `<iframe>`. Share kit and HQ copy both the rotator URL and the iframe snippet.

**Framing policy (path-scoped)**

| Path | Third-party iframe |
| --- | --- |
| `/te`, `/go`, `/embed/te`, `/e/*`, `/promo/te/*` | Allowed (`frame-ancestors *`, no `X-Frame-Options`) |
| `/` homepage | `SAMEORIGIN` — do not put this in a rotator |
| `/admin`, `/admin/*` | `DENY` / `frame-ancestors 'none'` |
| `/r/VIRAL-…` | Not a TE surface — use `/te?ref=VIRAL-…` so breakout keeps tags |

Inside a TE iframe: compact strip on 60–90px heights, 48px CTA, no login wall, no sticky header. The button is `<a href="/?src=te&camp=…&ref=…" target="_top">Open</a>`. If storage is blocked, the query string still carries the campaign. JS is optional.

## What ships

1. Tap **Get my referral link** and paste a site (no email). Codes look like live: `VIRAL-XXXXXXX`.
2. Instant share kit: OG landing at `/r/VIRAL-XXXXXXX` (also `/a/VIRAL-XXXXXXX` + `?ref=`), copy link, WhatsApp / X / Telegram / Reddit, QR.
3. Friend opens the link and taps **Get my link** → unique credit (visits and self-taps do not count).
4. Site climbs **Just entered → Rising Site Drop → week text line → Challenger strip → #1 banner (7 days)**.
5. Each rung is a shareable moment. Weekly race + duel. Streaks / 24h heat from real locks. Kingmaker when someone you referred hits #1.
6. Free embed snippet: “Help us go viral”.
7. Real BOARD KV persistence for VIRAL- codes and credits. If KV or Functions are missing locally, the board stays in isolate/local memory — that fallback is never the public product identity.

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

## Languages (public Site Drops UI)

Public Site Drops UI is translated for **26 locales**. Existing Phase 1 set plus a global pack:

`en`, `es`, `fr`, `pt`, `de`, `hi`, `ar`, `zh`, `ja`, `ko`, `ru`, `id`, `tr`, `it`, `nl`, `pl`, `vi`, `th`, `uk`, `bn`, `ur`, `ms`, `fil`, `sw`, `sv`, `ro`.

- Browser language is detected on first visit (`navigator.languages`). Common tags map in (`zh-CN` → `zh`, `pt-BR` → `pt`, `tl` → `fil`, …).
- The nav language picker is a compact searchable dropdown (26 languages without blowing up mobile nav). A footer “Page language” note shows the current choice. Stored in `localStorage` as `vr_locale`.
- `ar` and `ur` set `dir="rtl"` on `<html>`.
- TE splash / embed widgets reuse that same key so a later homepage visit stays in the chosen language.
- Owner HQ (`/admin/`) stays English.

See `src/lib/i18n/` (`data-i18n` attributes + `t()`).

**Crawler strategy (not path-prefix i18n):** English copy is in the initial HTML. `?lang=` is the addressable locale (example `/?lang=es`). Pages Functions rewrite homepage `data-i18n` text, `lang`/`dir`, canonical, and JSON-LD for that query so Google and answer engines do not need JavaScript. The sitemap lists `/?lang=` variants plus `hreflang` (including `x-default`). Client picker still stores `vr_locale` and writes `?lang=` when the visitor changes language. Owner HQ stays English and `noindex`.

## SEO / AEO (Google + answer engines)

White-hat only. No cloaking, no doorway stacks, no fake ratings, MRR, testimonials, or invented user counts. Recognition-only / no cash prize language is the product.

| Asset | Where | What it does |
| --- | --- | --- |
| `robots.txt` | Function + `public/robots.txt` | Allow public pages; disallow `/admin`, `/api/` (except `/api/og`); point at sitemap |
| `sitemap.xml` | Function + `public/sitemap.xml` | `/`, `/te`, `/go`, `/promo/te/`, `/?lang=` variants, lastmod, hreflang |
| `llms.txt` / `llms-full.txt` | Function + `public/` | Product brief + Site Drops rules for LLM crawlers |
| Homepage `<head>` | `index.html` (SSR-decorated by `functions/index.ts`) | Unique title/description, canonical, OG/Twitter, theme-color, robots index/follow, JSON-LD |
| JSON-LD | Organization + SoftwareApplication/WebApplication + FAQPage + HowTo | Honest `Offer` price `0`. No `aggregateRating` |
| `/te` `/go` | Full unique HTML when top-level; compact `noindex` splash when `size=` or iframe | Rank for TE/share queries without thin doorway pages |
| `/r/` `/a/` | OG cards | `noindex, follow` — personal links, not ranking targets |
| `/og.svg` | Static + Function | Homepage share image |

Hero, how-it-works, FAQ, and ladder rules are in the first HTML response (not an empty JS shell). Vite CSS is extracted at build time; Font Awesome is preloaded and applied asynchronously so the H1 can paint without waiting on the icon kit.

### Request indexing after deploy

1. Confirm `https://viralrefer-ultra.pages.dev/robots.txt` and `/sitemap.xml` return 200.
2. In [Google Search Console](https://search.google.com/search-console) add the Pages host (and later the custom domain). Use the same property type you will keep.
3. Submit `https://viralrefer-ultra.pages.dev/sitemap.xml`.
4. URL Inspection → `/`, `/te`, `/go`, `/promo/te/` → **Request indexing**.
5. Optional: Bing Webmaster Tools sitemap submit. Answer engines that honor `llms.txt` will pick up `/llms.txt` and `/llms-full.txt` on their next crawl.
6. After a custom domain is attached, the Functions rewrite canonical/OG/sitemap origins to that host — re-submit the new sitemap.

Do **not** request indexing for `/admin`, `/api/*`, or individual `/r/VIRAL-…` links.

## Run locally

```bash
cd cf-ultra
npm install
npm run build          # required gate — tsc + Vite
npm test               # engine / anti-cheat tests
```

### UI-only local (no Wrangler)

```bash
npm run dev:ui
```

Opens Vite on http://localhost:5174. If `/api/health` is missing, the client keeps a **local board** in localStorage so you can paste a URL and open the share kit. That is a local fallback, not the product.

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

If Wrangler cannot bind KV, Functions keep the board in **isolate memory** until recycle. The health payload says `BOARD KV not bound` — never “demo app.”

## Bind KV and deploy (approval gate)

**Do not deploy to production or attach a custom domain without explicit user approval.** This is an enhanced ViralRefer sibling, not a cutover of www.viralrefer.app.

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

No Supabase, no Vercel, no service-role keys are required for this Cloudflare sibling.

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
| Admin HQ | `previews/06-admin-dashboard.png` |
| Admin HQ mobile | `previews/06b-admin-mobile.png` |

Live HQ: `/admin/`. TE splash: `/te`, `/go`, `/embed/te`. Promo kit: `/promo/te/`.

## Project layout

```
cf-ultra/
  functions/           # Pages Functions
    api/               # health, join, board, activity, challenge, og, embed, simulate
    r/[code].ts        # OG + Get my link landing
    e/[host].ts        # embed widget
    embed.js.ts
    robots.txt.ts sitemap.xml.ts llms.txt.ts llms-full.txt.ts og.svg.ts
    _lib/              # engine, store, SEO, memory rate limits, edge cache, OG HTML
  src/lib/organic-seo.ts
  FUNNEL.md            # Perfect loop + manual checklist (source of truth)
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

**Live vs local fallback**

| Surface | Source |
| --- | --- |
| Uniques / sessions / funnel / platforms / geo / device / UTM | Live rollups from `/api/track` + join/credit (sampled pageviews) |
| Top sharers / climbing sites / board rungs | Live `ultra:state` + board snapshot |
| Live visitors + event feed | Isolate last-seen + flushed `stats:feed` |
| Geo country | `CF-IPCountry` (shows `XX` on local preview) |
| Fake testimonials / MRR / inflated counts | **Never** |

**Ops (live):** ban/mute codes or sites, edit public hero/lead (`/api/content`), CSV export, **excluded IPs** (durable KV — never increment stats), **reset stats** (analytics / activity / funnel rollups only; board stays), wipe live referral board, KV health line.

**Excluded IPs + owner browsing**

- HQ can add/remove IPs stored at `ultra:exclude-ips` on BOARD KV.
- Before any stats write (`POST /api/track`, join/credit/share rollups, activity feed), Functions check `CF-Connecting-IP`, else the first `X-Forwarded-For` hop.
- An authenticated Owner HQ session (`vr_ultra_hq` HMAC cookie, or Cloudflare Access) also skips stats so logged-in admin browsing does not inflate counters.
- Get my link and other product actions still work; only analytics increment is skipped.
- Optional: **Add + purge matching feed** drops HQ feed rows that already stored that IP.
- **Reset stats** lists and deletes every `stats:*` key (works with BOARD KV bound). It does not wipe `ultra:state` / the live board.
- **Clear inbox** empties `ultra:alert-inbox` (authenticated). Alert prefs stay.

**Owner alerts (live):** defaults are **credit + rung climbs only** (`race_started`, `first_share`, `friend_land`, `spike`, `digest` off). `/api/track` never enqueues alerts. Excluded IPs and Owner HQ sessions never enqueue. Each inbox row shows **why** it fired. **Clear inbox** empties `ultra:alert-inbox`. Telegram still pings when `TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHAT_ID` are set. Digest is never auto-enabled.

See `ARCHITECTURE.md` for rollup keys and write budget.

### Owner alert secrets (Pages dashboard or `.dev.vars`)

Never prefix these with `VITE_` — that ships in the client bundle. **Do not paste the bot token into the repo, chat, or a PR.**

| Secret | Required? | Purpose |
| --- | --- | --- |
| `TELEGRAM_BOT_TOKEN` | Required to send | Bot API token from [@BotFather](https://t.me/BotFather). Server-side secret only. **Do not commit it.** |
| `TELEGRAM_CHAT_ID` | Defaulted | **This deploy’s owner chat id is `1274269043`** (`wrangler.toml` `[vars]` + code default). Override with a Pages secret only if the owner chat changes. |
| `NOTIFY_WEBHOOK_URL` | Optional fallback | Discord / Slack incoming webhook or any HTTPS URL. **Wins over** the URL saved in HQ. |
| `RESEND_API_KEY` | Optional | Send email via [Resend](https://resend.com) for immediate high-signal events only. |
| `NOTIFY_EMAIL_TO` | With Resend | Inbox that receives owner mail. |
| `NOTIFY_EMAIL_FROM` | Optional | Defaults to `ViralRefer Site Drops <alerts@viralrefer.app>` (must be a verified Resend from). |

#### Telegram (BotFather)

1. In Telegram, message [@BotFather](https://t.me/BotFather) → `/newbot` → copy the token. Keep it off git.
2. Message your new bot once (`/start`) so it can DM you.
3. Confirm your chat id. For this ViralRefer Site Drops owner deploy it is **`1274269043`**. To discover another id, call `getUpdates` **from your machine** (not the repo):  
   `curl https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/getUpdates`  
   and read `message.chat.id`.
4. Set the **bot token** as a Pages / wrangler secret (never `[vars]`, never `VITE_`). Chat id is already `1274269043` for this deploy.

```bash
cd cf-ultra
npx wrangler pages secret put TELEGRAM_BOT_TOKEN --project-name viralrefer-ultra
# optional override only:
# npx wrangler pages secret put TELEGRAM_CHAT_ID --project-name viralrefer-ultra
# when prompted, enter: 1274269043
```

Local Wrangler: copy `.dev.vars.example` → `.dev.vars` and fill `TELEGRAM_BOT_TOKEN` only. `TELEGRAM_CHAT_ID=1274269043` is already the default. `.dev.vars` is gitignored.

HQ → **Notify me** shows `configured · chat …043` once the token is set, or `token missing` (masked — never the token). Toggle Telegram on/off, keep the event checkboxes, then **Test ping** — it targets chat `1274269043` when the token is configured. If the token is missing, the ping still lands in the Alerts inbox (demo path).

Optional: paste a webhook URL in HQ (authenticated `POST /api/admin/action` `save_alerts`). The Function stores it in KV (`ultra:alert-prefs`) and **never echoes the full URL** back. A dashboard secret still overrides that value.

**Quiet hours:** optional. Inbox still records; outbound Telegram / webhook / email is skipped until quiet hours end.

**Write budget:** inbox persists to KV at most every ~20s (or on high-signal events). Outbound Telegram + webhooks share a cap of 12 POSTs / 5 minutes per isolate. Friend-land and spike alerts always batch so thousands of daily events do not spam the chat.

## Stack

Cloudflare Pages + Pages Functions + KV. Healthy clients poll the board every **8s** (hidden tabs stop). No Durable Object in v1. Static build via Vite.
