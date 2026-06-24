# ViralRefer — Production Ready

The viral referral platform. Refer friends, climb the real-time leaderboard, and win prizes for top referrers.

**Status**: Production deployment on Vercel with Supabase Edge Functions, RLS security, realtime leaderboard, and multi-tab admin dashboard.

**Live Site**: https://www.viralrefer.app (Vercel project: `viralrefer-premium`, repo folder: `viral-visitor-vl`)

## Quick Start (5 minutes)

```bash
git clone <your-repo>
cd viral-visitor-vl
npm install
# Set environment variables (see below)
npm run dev
```

Open http://localhost:5173 to see the full experience:
- Live realtime leaderboard from Supabase `referrals` table
- Referral link generation + QR codes + 7-platform sharing
- Profile/referral attribution via `?ref=`
- Admin dashboard (client-side password gate using `VITE_ADMIN_PASSWORD`)
- Turnstile-protected prize claim flow

## Supabase Setup (One-time)

1. Go to your Supabase project.
2. SQL Editor → run the full content of all migrations in `supabase/migrations/` (in order).
3. This creates the tables (`profiles`, `referrals`, `shares`, `prize_claims`, `site_content`), applies strict RLS, indexes, and security triggers.
4. Deploy the Edge Functions:

```bash
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase functions deploy record-referral
supabase functions deploy submit-claim
supabase functions deploy admin-action
```

5. Add secrets in Supabase Dashboard → Edge Functions → Secrets:
   - `TURNSTILE_SECRET_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`

## Environment Variables

### Vercel (Production / Preview)

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_TURNSTILE_SITEKEY`
- `VITE_ADMIN_PASSWORD` (client-side admin access password — treat as sensitive)

### Supabase Edge Function Secrets (Deno)

- `TURNSTILE_SECRET_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

The app uses the values from the current Supabase project for immediate testing when properly configured.

## Architecture Highlights

- **Frontend**: Vite 8 + TypeScript (strict) + Tailwind CSS v4 via `@tailwindcss/vite`
- **Backend**: Supabase (Postgres + Realtime + RLS + Edge Functions on Deno)
- **Security**: All high-value writes go through Edge Functions using `service_role`. RLS blocks anon writes. Admin dashboard currently uses a client-side `VITE_ADMIN_PASSWORD` gate (temporary — not real Supabase Auth).
- **Deployment**: Vercel (static Vite build + `vercel.json` for headers and SPA routing) + Supabase Edge Functions.

See `docs/adr/001-architecture.md` and `ARCHITECTURE.md` for deeper details.

## Key Production Features

- Real-time leaderboard + activity feed (Supabase `postgres_changes`)
- 7-platform sharing with analytics logging (`shares` table)
- QR codes (mobile-optimized)
- Profile / referral attribution system
- Secure prize claim flow (Turnstile + `submit-claim` Edge Function)
- Full admin dashboard (5 tabs) with live content editing, color theming, claim management, and share analytics
- Mobile-first premium glassmorphism UI

## Scripts

```bash
npm run dev          # Local development
npm run build        # Production build (dist/)
npm run preview      # Preview production build
npm run test         # Vitest unit tests
npm run test:e2e     # Playwright E2E tests
npm run lint
npm run format
```

Edge Functions:
```bash
npm run edge:deploy  # deploys all functions
```

## Deployment

**Primary platform**: Vercel.

See the complete runbook in `DEPLOY.md` for exact steps, environment variable configuration, Edge Function deployment, and the current post-deploy security checklist.

Security headers and SPA fallback are provided by the committed `vercel.json`.

## Security & Compliance Notes

- **Never** commit real service role keys, Turnstile secrets, or production `VITE_ADMIN_PASSWORD`.
- After RLS migrations, the anon key cannot insert fake referrals or claims.
- Prize claims must go through the `submit-claim` Edge Function (server-side validation + Turnstile).
- Cloudflare Turnstile is active on the claim path.
- Admin access is currently a client-side password gate (`VITE_ADMIN_PASSWORD`). This is temporary and not backed by Supabase Auth sessions. The `admin-action` Edge Function supports this flow via a temporary bypass.
- Legal / prize disclaimers are linked from the footer (see `docs/rules.md`).

## Documentation

- `DEPLOY.md` — Full Vercel + Supabase deployment runbook
- `ADMIN_GUIDE.md` — How to use the admin dashboard (claims, content, colors)
- `TESTING_CHECKLIST.md` — Manual verification steps for all flows
- `ARCHITECTURE.md` — Current module structure and design decisions
- `docs/adr/001-architecture.md` and `002-...` — Architecture decision records
- `docs/project-structure.md` — Historical structure notes
- `docs/rules.md` — Official rules and disclaimers

---

Built for scale. Secured for real campaigns.