# ViralRefer Site Drops (Cloudflare sibling) — scale on the edge

Target: **1,000–10,000+ daily visitors** without melting the core loop (paste URL → share kit → unique friend Get-my-link → board climb).

This is a Pages + Functions + KV app. It is **not** the live Vercel Site Drops product.

## Assumed plan

| Piece | Assumption |
| --- | --- |
| Compute | Cloudflare **Workers Paid** (or Pages project billed with paid Workers) |
| KV | One namespace `BOARD` |
| Paid KV included | ~10M reads/day, ~1M writes/day |
| Free KV | ~100k reads / **1k writes** per day — **not enough** once joins pick up |
| Durable Objects | Not required at this scale |
| D1 | Not required for v1 |

**Do not run a real campaign on the Free KV write cap.** Bind `BOARD` on Paid, then approve a non-production Pages deploy.

## What must stay cheap

Pageviews, share-link opens, board polls, embeds, and OG crawlers are **read-only**. They must not `KV.put`.

| Event | KV write? | Why |
| --- | --- | --- |
| Homepage / asset hit | No | Static on Pages CDN (`/assets/*` immutable) |
| `GET /api/board` poll | No | `ultra:board` snapshot + 3s edge/isolate cache |
| Open `/r/VIRAL-XXXX` | No | Cached HTML ~20s. Visits do not count. |
| Open `/te` / `/go` / `/embed/te` | No | Cached splash. TE impressions never `KV.put`. |
| Embed `/e/:host` | No | Snapshot + 30s cache |
| `POST /api/join` (Get my link) | Yes (2 keys) | `ultra:state` + `ultra:board` |
| Unique friend credit | Yes | Same join path + stats flush |
| `POST /api/track` pageview | Buffered / sampled 1-in-5 | Isolate buffer → hourly/daily rollup |
| Track join/share/credit | Flush now | Funnel stays accurate |
| Owner alert (inbox) | Debounced (~20s) + isolate | High-signal conversions only; demo inbox works with no Telegram secrets |
| Owner Telegram sendMessage | No KV | Primary owner ping; token never in client; same 12 / 5 min outbound cap |
| Owner webhook POST | No KV | Optional fallback; Discord/Slack/generic HTTPS |
| Rate-limit check | **No** | In-isolate sliding window only |

Two writes per successful join is intentional: one durable game state, one small public snapshot so thousands of polls never recompute or reread the blob.

## Read path (hot)

```
GET /api/board
  → Cache API (≈3s, per colo)
  → isolate memory (≈2.5s)
  → KV ultra:board snapshot
  → last resort: load ultra:state + compute (still no write)
```

If KV is unhappy: serve the last isolate snapshot and set `x-ultra-degraded: 1`. Empty board only if we have never seen one.

Client poll: **8s** while healthy (hidden tabs do not poll). On 429 or degraded: **16–30s**. Last painted board stays on screen.

## Write path (rare)

Joins and credits are the only mutations. Rate limits (no KV):

- 8 joins / IP / minute
- 5 joins / actor cookie / minute
- 120 joins / 10s / isolate (sheds a bot flood on one colo)

A spike gets **429 + Retry-After**. The board keeps serving. We would rather drop abusive joins than drop the homepage.

If `KV.put` fails, join still returns the share kit (`persisted: false`, `degraded: true`) so the loop works in that isolate until KV recovers.

`POST /api/simulate` stays **off** when KV is bound.

## Capacity sketch (Paid)

Conservative campaign day: 8k unique visitors, 12% get a link, 25% of those earn one unique credit.

| | Estimate |
| --- | --- |
| Joins + credits | ~1,200 mutations → ~2,400 KV writes |
| Paid write headroom | 1,000,000 / day included |
| Board polls without cache | would be tens–hundreds of thousands of full-state reads |
| With 3s snapshot + CDN | KV reads collapse to cache misses (low thousands) |
| Function CPU | Tiny JSON + cookie. No per-visitor HTML render on `/` |

Free-tier write math fails around the first ~500 joins/day (2 writes each + no room for retries). That is why Paid is the assumed plan.

## Fail-soft order

1. Stretch client poll / mark board stale
2. Serve cached snapshot (even a minute old)
3. Skip celebrations / heat polish
4. **Never** drop paste → Get my link → unique credit when KV still accepts a put
5. If KV put fails: return the kit anyway, flag degraded

## Owner HQ (admin)

Gated by **HMAC session cookie** signed with `ADMIN_OWNER_PASSWORD` or `ADMIN_ACTION_SECRET` (Pages/Wrangler secrets — **never** `VITE_`). Cloudflare Access (`Cf-Access-Authenticated-User-Email`) also passes. Local wrangler without CF-Ray and without a secret accepts `ultra-local-only` so you can demo HQ; that fallback is **off on the real edge**.

Dashboard reads `stats:day:*` + `stats:all` + live isolate + board. Cached by not recomputing from raw pageviews. Ops: ban/mute codes or sites, edit hero/lead, CSV export, reset demo. Owner alerts: inbox + webhook prefs (`ultra:alert-inbox`, `ultra:alert-prefs`).

Analytics keys: `stats:hour:*` (8-day TTL), `stats:day:*` (120-day TTL), `stats:all`, `stats:feed`, `stats:rungs`, `ultra:ops`, `ultra:alert-prefs`, `ultra:alert-inbox`, `ultra:alert-first-share`.

## What we did not add (on purpose)

- Durable Objects / websocket fan-out — polling a 3s snapshot is enough at 10k/day
- D1 — one KV blob + rollups is simpler until state is huge
- Write-per-pageview rows — pageviews are sampled and buffered
- Per-request Turnstile on every poll — keep challenge on the join POST later if abuse appears

## Layout

```
functions/_lib/engine.ts      pure loop (no CF imports)
functions/_lib/limit.ts       memory rate limits (no KV)
functions/_lib/edge-cache.ts  Cache API get/put/bust
functions/_lib/store.ts       state + board snapshot, isolate TTL
functions/_lib/admin-auth.ts  HMAC / CF Access (no client secret)
functions/_lib/analytics.ts   isolate buffer + KV rollups
functions/_lib/alerts.ts      owner notify (inbox, batch, Telegram, webhook)
functions/api/admin/*         HQ APIs
functions/api/board.ts        public cached snapshot
functions/api/join.ts         hot write path
src/admin.ts                  Owner HQ UI
```
