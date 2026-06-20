# ViralRefer Premium — Clean Project Structure & HTML Porting Plan

**Date:** 2026-05-15  
**Owner:** Atlas (System Architect)

## Final Directory Layout (src/)

```
src/
├── assets/                 # (existing) hero.png, logos — keep as-is or migrate to public/
├── lib/
│   ├── types.ts            # ALL domain interfaces (Profile, Referral, Share, PrizeClaim, SiteContent, LeaderboardEntry + helpers)
│   ├── supabase.ts         # createClient + typed helpers (getProfile, getLeaderboard, claimPrize, etc.)
│   └── constants.ts        # PRIZE_CATALOG, TIERS, REFERRAL_POINTS_MAP, etc.
├── utils/
│   ├── format.ts           # currency, date, pluralize, truncate, generateReferralLink
│   ├── validation.ts       # email, referralCode, claimForm validators
│   ├── confetti.ts         # wrapper around canvas-confetti with premium presets
│   └── storage.ts          # localStorage helpers (draft claims, last share timestamp)
├── ui/
│   ├── components/         # Reusable presentational pieces (vanilla or tiny class wrappers)
│   │   ├── Button.ts
│   │   ├── Modal.ts
│   │   ├── Card.ts
│   │   ├── LeaderboardTable.ts
│   │   ├── ShareButton.ts
│   │   ├── PrizeCard.ts
│   │   └── Toast.ts
│   └── icons.ts            # inline SVG helpers or re-exports from public/icons.svg
├── features/
│   ├── referral/
│   │   ├── ReferralDashboard.ts   # main logged-in state + code display
│   │   ├── SharePanel.ts
│   │   └── useReferral.ts         # (or plain functions + state object)
│   ├── prizes/
│   │   ├── PrizeCatalog.ts
│   │   ├── ClaimModal.ts
│   │   └── claimPrize.ts
│   ├── leaderboard/
│   │   ├── Leaderboard.ts         # Chart.js integration + realtime subscription
│   │   └── leaderboardService.ts
│   └── auth/
│       ├── auth.ts                # signInWithMagicLink / signOut + profile listener
│       └── AuthModal.ts
├── main.ts                 # Bootstrap: mount App, init Supabase, global listeners
└── style.css               # Tailwind + glassmorphism + premium custom styles (this is THE source of truth)
```

**No `components/` at root** — everything lives under `ui/` (presentational) or `features/` (behavior + state).

**No heavy framework.** We stay in lightweight TypeScript + DOM. State is managed via small classes or signals if we add a tiny lib later.

## How the Rich Original HTML Will Be Ported

The original ViralRefer Premium prototype contains beautiful, highly polished marketing + interactive sections:

- Hero with animated gradient + trust badges
- How it works (3-4 step cards)
- Live Leaderboard (with Chart.js)
- Prizes showcase + claim flow
- Referral code generator + multi-share buttons (Twitter, LinkedIn, copy, email)
- User dashboard (points, tier progress, history)
- FAQ, footer, modals

### Recommended Porting Strategy (Speed + Fidelity)

1. **Phase 0 (Today — 1 hour)**
   - Replace `index.html` `<title>` and basic meta.
   - Move the **entire original `<body>` markup** (or the rich sections) into `index.html` inside `<div id="app">` as static HTML with Tailwind utility classes already applied.
   - Or (preferred for long-term): Put the master template string in `src/App.ts` (or `src/main.ts` initially) and `document.querySelector('#app').innerHTML = appTemplate`.

2. **Phase 1 (Rapid Interactivity)**
   - Identify interactive "islands":
     - Leaderboard → extract to `features/leaderboard/Leaderboard.ts`
     - Share buttons → `features/referral/SharePanel.ts`
     - Prize claim buttons/modals → `features/prizes/`
   - Keep the static marketing copy **exactly** as in original HTML (no design drift).
   - Wire up using `querySelector` + event listeners inside the feature modules. Mount by calling `initLeaderboard()` etc. after DOM ready.

3. **Phase 2 (Refactoring)**
   - Progressively pull repeated card patterns into `ui/components/PremiumCard.ts`, `ui/components/GlassPanel.ts`.
   - Extract repeated Tailwind class groups into `@apply` directives inside `style.css`.
   - Introduce a tiny router (hash or history) only if dashboard vs landing split becomes necessary.

4. **Benefits of this approach**
   - Zero design regression risk — the original pixel-perfect HTML is preserved verbatim at first.
   - Fastest possible path to a working premium experience (days not weeks).
   - TypeScript types (`src/lib/types.ts`) are introduced immediately so all new code is safe.
   - Easy to hand off sections to other developers (clear feature boundaries).

**Rule of thumb:** "If it's mostly static beautiful copy + layout → keep in the main HTML template. If it has state, API calls, realtime, or user input → extract to `features/` + `ui/`."

## Additional Conventions (Production Grade)

- **Imports:** Always use `@/` alias (`@/lib/types`, `@/features/leaderboard/Leaderboard`).
- **Styling:** All custom design tokens + glassmorphism live in `src/style.css`. No inline styles except for dynamic values (e.g. confetti colors).
- **Data access:** Only through `src/lib/supabase.ts` helpers. Never call `supabase.from()` directly from features.
- **Testing:** Playwright (already in devDeps) for E2E on critical flows (claim prize, leaderboard update).
- **Environment:** `.env.local` (gitignored) for `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` / `VITE_ADMIN_PASSWORD` / `VITE_TURNSTILE_SITEKEY`. Never commit real keys — `.env.example` has placeholders ONLY. Code in `src/lib/supabase.ts` (and admin/modals) does hard-fail if required VITE_* missing. See README.md Security section.
- **Build output:** `dist/` is purely static (run `npm run build` + verify `grep -r` finds NO secrets/URLs/JWTs/passwords from .env.example or old baked values). Deploy to any static host. Edge Functions deployed separately via Supabase CLI.

## Next Immediate Actions After Structure

1. Create `src/lib/supabase.ts`
2. Implement `src/utils/confetti.ts` and `format.ts`
3. Port original `<style>` + add Tailwind + glassmorphism (current task)
4. Update `src/main.ts` + `index.html` with initial App template
5. Begin extracting one feature (e.g. leaderboard) as proof of pattern

This structure scales cleanly from prototype to full production while honoring the original rich design.
