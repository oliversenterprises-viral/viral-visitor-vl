# ViralRefer (Cloudflare sibling) — perfect funnel

This is the product. Secondary surfaces (duel, embed, kingmaker, TE later) never outrank this loop.

**Rule taught on every screen:** visits, refreshes, and copies do **not** count. Only a unique friend tapping **Get my link** credits you.

Owner alerts (HQ inbox + **Telegram** when secrets are set; optional webhook) fire on these conversion writes only — not pageviews.

## Happy path (exact names)

These names match the Owner HQ funnel chart.

| # | Step | What the human does | What the system does |
| --- | --- | --- | --- |
| 1 | **Land** | Opens `/` or a referral URL (`/r/VIRAL-XXXXXXX`, `/a/VIRAL-XXXXXXX`, `/?ref=`) | Shows one job. Attribution is stored in the session and written back onto `?ref=` so refresh cannot drop it. |
| 2 | **Paste site** | Types any website | Live validate + normalize + favicon/host preview. Invalid URLs never submit. |
| 3 | **Get my link** | Taps the only primary CTA (no email) | Instant kit. Network blips retry. Failure stays on the form with **Try again**. |
| 4 | **Share** | Copies or sends `/r/VIRAL-XXXXXXX` | OG card, QR, platform intents. Primary CTA is Copy (or device Share on mobile). |
| 5 | **Friend land** | Friend opens the referral URL | Crystal clear *who* sent them and *what* to do: paste **their** site, tap Get my link. Opening the page does not count. |
| 6 | **Credit** | Friend taps Get my link | One unique lock (`referrer + actor`). Double-tap / refresh → `alreadyCredited`. Self-tap → `selfJoin`. Both sides celebrate when possible. |
| 7 | **Climb** | Board updates | Just entered → Rising → Challenger → #1 banner. **You’re here** on the owner’s site. |
| 8 | **Next action** | Always visible | e.g. “Send to 1 friend to unlock Rising” / “Send to 1 more friend this week to unlock Challenger”. Near-miss HUD (“1 friend from Rising”) and share-kit celebrations decorate this step — they never replace the primary CTA. |

## Deep links

| URL | Restores |
| --- | --- |
| `/?ref=VIRAL-XXXXXXX` | Friend attribution + “You’re in the same contest” |
| `/a/VIRAL-XXXXXXX` | 302 → `/?ref=VIRAL-XXXXXXX` (keeps extra query tags) |
| `/r/VIRAL-XXXXXXX` | Friend landing (OG + Get YOUR link) |
| `/?kit=VIRAL-XXXXXXX` | Opens the share kit |
| `/?credited=1&helped=host` | Kit + “you credited them” |
| `/?unlock=rising` | Unlock celebration |
| Session `vr-ultra-kit-open-v1` | Reopens kit after refresh |

## Edge cases

| Case | Expected |
| --- | --- |
| Refresh mid-funnel | `?ref=` still present; kit reopens if it was open |
| Double Get my link (same friend) | No second credit. Copy: already counted |
| Sharer taps own link | No credit. Copy: your own tap does not count |
| Bad URL | Inline error, still one CTA (**Try again**) |
| KV / network blip | Join retries 3×; kit still returns if persist degrades |
| Empty board | Honest empty lanes — no fake sites |
| Demo (no Functions) | localStorage loop + Simulate unique friend |
| `/r/` prefill | Does **not** paste the referred site as “your” URL |

## Manual test checklist

Do this on a phone-width viewport and a second browser profile.

- [ ] **Land** `/` — one primary CTA: Get my link. Lead copy says visits don’t count.
- [ ] **Paste site** `example.com` — preview shows host + favicon. `not a url` does not submit.
- [ ] **Get my link** — kit opens immediately; next-action line visible; no email field.
- [ ] **Share** — Copy link works. WhatsApp / X / Telegram / Reddit open. QR renders.
- [ ] Refresh with kit open — kit returns. `?ref=` (if present) still on the URL.
- [ ] Open `/a/VIRAL-XXXXXXX` after you have a code — lands on `/?ref=` and the friend banner.
- [ ] **Friend land** `/r/VIRAL-XXXXXXX` in another profile — who + next action clear; URL field empty (their site).
- [ ] Friend pastes their site and taps Get my link — credit once; they get a kit; `credited=1`.
- [ ] Friend taps again — already credited, board count unchanged.
- [ ] Sharer board shows **You’re here** and the site moves Just entered → Rising on first unique credit.
- [ ] Next action updates (Rising → “1 more friend this week to unlock Challenger”).
- [ ] Simulate (demo only) climbs further without inventing public visitor counts.
- [ ] Owner HQ funnel steps read: Land → Paste site → Get my link → Share → Friend land → Credit.

## Compulsion layer (decorate, don’t confuse)

Casino-light feedback sits **under** the paste form and inside the kit. It must not invent visitors, trap dismissals, or autoplay sound.

| Layer | Honest source |
| --- | --- |
| Progress ring / near-miss | `nextActionFor` friend math |
| Live ticker / toasts | Real `board.activity` only |
| Ghost counts | Real `liveSites` / `livePlayers` |
| Rising hook | `expiresAt` on the owner’s chip |
| Share streak | Local last-share day (dies at next UTC midnight; “dies in 4h” when unpaid) |
| Confetti tiers | Verified credit count / unlock. Mute default. `prefers-reduced-motion` skips particles |

## Traffic exchange

TE / rotators are a **distribution path**, not a funnel step. Iframe compact units (`/te?src=te&camp=…&size=468x60`), not `/`. Send human clicks to `/splash?src=te&camp=…` (homepage-like conversion page). Compact impressions do not write KV. Full splash beacons `te_splash_view` / `te_splash_cta` only — never a referral credit. `src=te` Get-my-link does not count as Credit. See README “Traffic exchanges”.

## Notifications

Server-side only, after successful writes: new site, first share, friend land (batched), credit (1st–3rd instant), rung unlocks, spikes. Telegram is the default owner ping (`TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHAT_ID`). Missing secrets → HQ inbox only. See README Owner alerts.
