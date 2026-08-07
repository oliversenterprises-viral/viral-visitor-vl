# ADR 003 — ViralRefer Relay (Traffic Exchange Product)

**Status:** Implemented & shipped (2026-07-29) — live at `/relay`  
**Owner:** Nova Swarm / Oliver  
**Goal:** Extremely effective reciprocal traffic engine that also feeds **viralrefer.app** with attributed referrals.

---

## Decision summary

| Call | Choice |
|------|--------|
| **Product name** | **ViralRefer Relay** |
| **Ship as** | First-class surface on **viralrefer.app** (not a disconnected brand) |
| **Route** | `https://www.viralrefer.app/relay` (primary); short alias `/traffic` → same page |
| **Core loop** | **Credit-backed Hot Seat** (queue + live spotlight) |
| **ViralRefer feed** | Always-on banner + empty-queue house + dual-funnel CTAs with `?ref=` / `/r/CODE` |
| **MVP stack** | Same as ViralRefer Premium: Vite + TS + Supabase + Edge Functions + Vercel |
| **Quality bar** | White-hat only; real view gates; no fake traffic claims |

---

## Why this shape (not pure Hot Seat alone)

User mental model: *“I submit → next person must see me.”*  
Power requirement: *fair, sticky, hard to game, grows ViralRefer.*

**Pure single Hot Seat** is easy to understand but unfair (one person, then gone).  
**Pure credits** is powerful but needs more UI and invites farming.  
**Winner:** **Hot Seat presentation + credit-backed queue underneath.**

```
Visitor lands → sees LIVE site (Hot Seat)
            → must complete a valid view (timer + confirm + anti-bot)
            → earns 1 credit
            → spends 1 credit to enter queue (net-zero fair exchange)
            → when they reach front: they become LIVE for N visitor-views
            → always see ViralRefer house promo (attributed)
```

Net-zero credits = classic traffic exchange fairness.  
Hot Seat UI = matches what Oliver described.  
Queue = power + scale.

---

## ViralRefer referral feed (non-negotiable)

Every Relay session must create **attributed paths** into the main app.

### Layer A — Always-on house brand

- Persistent banner / strip: **Built for growth · ViralRefer**
- Link always includes tracking, e.g.:
  - `https://www.viralrefer.app/?ref=RELAY&utm_source=relay&utm_medium=banner&utm_campaign=house`
  - Prefer a dedicated house code `RELAY` (or Oliver’s primary code) so leaderboard attribution is real
- Label clearly as house promo (trust)

### Layer B — Empty / thin queue seed

- If no user is LIVE → Hot Seat = ViralRefer (same attributed URL)
- Never leave the seat empty

### Layer C — Dual conversion after Relay action

After successful view + queue entry, secondary CTA:

1. **“Also get a free ViralRefer referral link”** → main funnel (`get link` / `#get-link`)
2. Pre-fill share copy that includes **both**:
   - Their Relay status / queue position link (if public share URL exists)
   - Their ViralRefer `/r/CODE` or `?ref=` link once generated

### Layer D — Share templates that recruit both products

Default share text (example):

> I’m in ViralRefer Relay — free traffic exchange. View my site when you join:  
> https://www.viralrefer.app/relay  
> Want prizes + a referral leaderboard too?  
> https://www.viralrefer.app/?ref=THEIR_CODE&utm_source=relay&utm_medium=share

### Layer E — Optional house boost (phase 2)

- Every Nth Hot Seat rotation (e.g. 10th) can be house ViralRefer for 1 view  
- Labeled; never silent  
- Configurable in admin

**Success metrics for “feeds ViralRefer”:**

- Relay visits → main site clicks (banner + CTA)
- Relay → `?ref=` / `/r/` landings attributed
- Relay → “get link” completions
- Relay → first share on main app

---

## Core rules (effectiveness + integrity)

1. **View gate before queue entry** — no skip; minimum dwell (e.g. 15s) with tab focus preference.
2. **1 credit in / 1 credit out** at MVP (fair). Later: premium multipliers only if explicit product.
3. **Hot Seat duration** — deliver fixed **view budget** (e.g. next 5–10 valid views), not infinite time.
4. **Rate limits** — per IP / fingerprint / URL cooldown; Turnstile on submit.
5. **URL validation** — http(s) only; blocklist malware/phishing/scam patterns; optional block adult if brand stays prize/family-safe.
6. **No iframe requirement for target sites** — open target in new tab/window; many sites block iframes.
7. **White-hat only** — no bots, purchased hits, or fake counters. Copy must say traffic is reciprocal / exchange-based, not guaranteed sales.
8. **Protect main ViralRefer** — Relay mutations via Edge Functions + RLS; never open write on sensitive tables.

---

## MVP scope (ship-first)

### In

- Public page `/relay` (mobile-first, premium glass UI matching ViralRefer)
- LIVE Hot Seat card + open + 15s timer + confirm
- Submit URL → enqueue after valid view
- Credits wallet (session + persisted when linked to referral code)
- Always-on ViralRefer banner (attributed)
- Empty-queue house seat
- Live activity feed (last N enqueues / seats)
- Edge Functions: `relay-view`, `relay-enqueue`
- Tables: `relay_links`, `relay_views`, `relay_sessions` (names flexible)
- Admin: **Relay tab** (kill switch, house URL, min dwell, views-per-seat, queue ops, force-complete, reject link)
- Analytics events / UTMs into growth stack

### Out of MVP (phase 2+)

- Paid credit packs
- Niche categories (crypto-only, etc.)
- Complex reputation scoring
- Browser extension auto-surf
- Full “every 10th is house” (config ready, default off until stable)

---

## Data sketch

```
relay_sessions
  id, fingerprint_hash, ip_hash, referral_code_nullable, credits, created_at, last_seen_at

relay_links
  id, url, domain, submitter_session_id, status (queued|live|completed|rejected),
  queue_position, views_remaining, views_delivered, created_at, live_at, completed_at

relay_views
  id, session_id, target_link_id, dwell_ms, focused bool, turnstile_ok, created_at
```

House ViralRefer is not a user row spam — config-driven LIVE when queue empty.

---

## UX skeleton

```
[ ViralRefer banner — always on, labeled, ?ref=RELAY + UTMs ]

🔥 LIVE NOW — getting Relay traffic
  {current user URL or ViralRefer house}
  [ Open site ]  timer 0:15  [ I visited — continue ]

Want your site LIVE next?
  Paste URL → complete a view → join the queue
  Credits: 1  |  Position when queued: #N

After enqueue:
  ✓ You’re in line
  [ Get your free ViralRefer referral link ]  ← main app feed
  [ Copy share blurb ]

Live feed · How it works · Rules (reciprocal, not paid ads)
```

---

## Why ship **on** viralrefer.app (not a separate domain)

1. Shared trust + SEO juice  
2. Same cookie/session patterns and referral attribution  
3. One deploy pipeline (`viral-visitor-vl` → Vercel)  
4. Banner and CTAs feel native, not cross-site spam  
5. Growth skill / admin / brand already exist  

Separate domain only if SEO experiment later; product stays under ViralRefer brand.

---

## Risks & mitigations

| Risk | Mitigation |
|------|------------|
| Bot farms | Turnstile, dwell+focus, rate limits, anomaly admin |
| Low-quality junk URLs | Validation, blocklist, report button (phase 2) |
| Users hate house promo | Label clearly; keep user Hot Seat majority of time |
| Cannibalizes main app time | Dual CTA pushes get-link; Relay is top-of-funnel |
| Legal / ToS claims | “Reciprocal exchange,” no income guarantees |
| Empty early days | House seed + seed from Oliver’s share campaigns |

---

## Implementation phases

1. **Decide** — this ADR (done)  
2. **Schema + Edge Functions** — view proof + enqueue  
3. **Public `/relay` UI** — Hot Seat + banner + dual CTA  
4. **Wire house `?ref=` / UTM** — prove clicks into main funnel  
5. **Admin controls + kill switch**  
6. **Ship + measure** — Relay → main conversions  
7. **Phase 2 power** — house boost N, reputation, categories  

---

## Success definition (powerful & effective)

- Visitors understand the loop in **&lt; 10 seconds**  
- Every new submitter **must** generate at least one valid view for the LIVE site  
- ViralRefer receives **continuous attributed traffic** from banner + empty seat + post-enqueue CTA  
- Abuse stays controllable without manual babysitting  
- Product copy stays white-hat and brand-safe for the prize campaign  

---

## Explicit non-goals

- Guaranteeing sales, SEO rankings, or “real buyers”  
- Black-hat traffic, botnets, forced popunders  
- Replacing the main referral leaderboard product  

---

## Next action after acceptance

Implement inside `viral-visitor-vl` starting with Supabase migration + `/relay` route + house banner using existing ViralRefer brand assets.
