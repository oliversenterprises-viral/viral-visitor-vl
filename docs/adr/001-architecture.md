# ADR-001: Frontend and Backend Architecture — Vite + TypeScript + Supabase Edge Functions

**Status:** Accepted  
**Date:** 2026-05-15  
**Deciders:** Atlas (System Architect), Engineering Team

## Context

ViralRefer Premium is a high-converting referral marketing platform featuring:
- Rich, animated hero and prize showcases
- Real-time leaderboard (Chart.js powered)
- Referral link generation and multi-platform sharing
- Instant prize claims with form validation
- User profiles, tiers, points system
- Supabase-backed authentication and data persistence

The original implementation was a rich static HTML + vanilla JS prototype. We need to productionize it into a maintainable, type-safe, fast-loading application while leveraging Supabase for backend (already in package.json).

## Decision

Adopt the following stack:
- **Build & Dev:** Vite 8 + TypeScript 6 (strict)
- **Styling:** Tailwind CSS v4 via official `@tailwindcss/vite` plugin
- **Backend/API:** Supabase (Postgres + Row Level Security + Auth + Realtime + Edge Functions running on Deno)
- **Frontend Runtime:** Vanilla TypeScript SPA (no React/Next) with modular feature folders
- **Deployment:** Static hosting (Netlify / Vercel / Cloudflare Pages) for the Vite bundle + Supabase Edge Functions for any custom server logic (prize approval workflows, referral validation, email triggers)

Key files:
- `src/lib/types.ts` — canonical domain models
- `src/lib/supabase.ts` — typed client
- `src/features/*` and `src/ui/*` — domain logic and presentational components
- Edge Functions live in `supabase/functions/` (standard Supabase layout)

## Alternatives Considered

### 1. Monolithic Architecture (Single Express/Fastify server + EJS/Handlebars templates + Supabase only as DB)
**Pros:**
- Simpler mental model for small team
- One deploy target
- Easy server-side rendering of initial HTML

**Cons / Tradeoffs:**
- Slow local development iteration (full server restarts)
- Poor DX for rich client-side interactions (leaderboards, modals, confetti, live updates) — would require duplicating logic client/server
- Scaling: harder horizontal scaling for real-time features; no edge locality
- No strong type safety across frontend/backend without extra effort (tRPC or similar adds complexity)
- Bundle size and asset optimization worse than Vite
- Deployment: requires always-on server (higher cost, cold-start free but maintenance)

**Rejected** because it contradicts the "premium fast" requirement and the rich original HTML prototype that already assumes heavy client interactivity.

### 2. Next.js (App Router) + Supabase + Vercel
**Pros:**
- Excellent React ecosystem and component model
- Built-in SSR/SSG, API routes (can replace some Edge Functions)
- Great DX with Server Components + streaming
- Vercel + Supabase integration is polished

**Cons / Tradeoffs:**
- Heavier production bundle (React + Next runtime) — impacts LCP and INP for a primarily marketing + dashboard hybrid experience
- Opinionated routing and data fetching patterns that don't perfectly match our "mostly static rich landing + authenticated SPA dashboard" use case
- Vendor lock-in: best performance and DX tied to Vercel (functions pricing, edge cache behavior)
- Slower cold-start dev server compared to Vite
- Overkill for features that can be handled elegantly with Supabase Realtime + Edge Functions + lightweight TS modules
- Migration cost from the existing rich HTML prototype would be higher (JSX conversion vs keeping semantic HTML + Tailwind classes)

**Rejected** in favor of maximum performance, minimal JS payload, and independence from any single hosting provider. Vite + Supabase Edge gives us near-equivalent developer experience for this specific domain while producing a smaller, faster final artifact that can be deployed anywhere static assets are served.

## Rationale & Benefits of Chosen Approach

- **Vite + TS:** Sub-second HMR, best-in-class production builds (esbuild + Rollup), first-class TypeScript support, tiny dev overhead. The `@tailwindcss/vite` plugin compiles Tailwind at lightning speed in v4.
- **Path alias `@/`:** Clean imports (`import { Profile } from '@/lib/types'`).
- **Supabase Edge Functions:** Globally distributed (Deno), <50ms cold starts in most regions, direct authenticated access to Postgres with RLS, built-in JWT + anon key handling. Perfect for:
  - Secure referral code validation and double-claim prevention
  - Prize claim processing + admin approval webhook
  - Scheduled leaderboard snapshots or email digests
- **No heavy framework:** Keeps total JS < 80-120 kB gzipped even with Chart.js + confetti. Ideal for high-conversion landing pages where every ms of TTI matters.
- **Porting strategy (see project-structure.md):** Retain most of the beautiful original markup inside `index.html` or a single `App.ts` template string initially. Incrementally extract interactive islands into `features/` and `ui/` components. This gives fastest time-to-production while preserving pixel-perfect design fidelity.
- **Future-proof:** Easy to add a thin React island later (via Vite) if dashboard grows complex; easy to add more Edge Functions.

## Consequences

**Positive:**
- Blazing fast dev and prod performance
- Excellent type safety across the entire referral domain (Profile, Referral, PrizeClaim, etc.)
- Low operational cost (static + Supabase free tier generous)
- Full control and portability

**Negative / Mitigations:**
- No built-in SSR for SEO of marketing pages → Mitigation: Use static pre-rendering or Cloudflare Workers if needed; current design is heavily client-JS interactive anyway.
- More manual wiring for state vs React → Mitigation: Use lightweight signals or simple class-based state + Supabase realtime subscriptions; keep scope small.
- Edge Functions have different local dev story → Mitigation: Use Supabase CLI `supabase start` + `functions serve`.

## References
- Approved Architecture Plan (Section 2)
- Supabase Edge Functions docs
- Vite + Tailwind v4 best practices
- Original ViralRefer premium HTML prototype (rich glassmorphism UI)

Next steps: Implement types, structure, Tailwind styles, then begin porting markup + wiring Supabase client.
