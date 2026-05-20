# ViralRefer Premium — Admin Guide

For authorized administrators only. Follow these steps to manage the live platform using Supabase Auth and the secure architecture.

## Logging In as Admin (Supabase Auth)

1. Use the in-app **Auth / Profile modal** (or "Sign in" button).
2. Enter your admin email (pre-approved, e.g. admin@yourdomain.com) and request a **Magic Link** (recommended — passwordless, secure).
3. Or use email + password if configured in Supabase Auth settings.
4. Click the link in your email → you are signed in with a valid Supabase JWT session.
5. Once logged in, click **Admin Dashboard** (or call `openAdminPanel()`). The production version verifies your session server-side via Edge Functions before showing sensitive tabs.

**Note:** Regular users cannot access admin features. Access is gated by Supabase Auth + future role checks (e.g., special claim in JWT or allowlisted email in an `admin_users` table / app_metadata).

## Managing Prize Claims & Approving Winners

1. In Supabase Dashboard (supabase.com → your project → **Table Editor**):
   - Open the `prize_claims` table.
   - Filter by `status = 'pending'`.
2. Review each claim:
   - Cross-check the user's `referral_count` (query `profiles` or use the public leaderboard).
   - Verify rank using server-side logic (the `submit-claim` Edge Function already did top-1 check; you confirm manually).
3. To approve:
   - Change `status` to `'approved'` (or `'paid'` after sending funds).
   - Add `notes` (e.g., "Verified top referrer #3 on 2026-05-15. Paid via Cash App.").
   - Set `processed_at` to current timestamp.
4. Approved/paid claims automatically become visible to the public (via RLS policy `prize_claims_select_public_approved`) for social proof on the leaderboard/winners section.
5. Reject suspicious claims by setting `status = 'rejected'` + reason in notes.

**Important (Secure Architecture):** You cannot (and should not) approve directly from the public app without proper Edge Function calls. For high-value payouts, always use the Supabase Table Editor or a future dedicated admin Edge Function (`admin-approve-claim`) that logs every action.

## Editing Live Site Content (Hero, Prizes, Rules)

The `site_content` table powers dynamic text without redeploying the site.

1. In Supabase Dashboard → **Table Editor** → `site_content`.
2. Edit existing rows or add new:
   - `key`: e.g. `hero_title`, `prize_pool`, `rules_text`, `min_referrals_for_claim`
   - `value`: JSON or string (current code expects simple values; see `fetchSiteContent()`)
   - `description`: Internal note for other admins
3. Changes are live instantly (public `SELECT` policy allows anyone to read; only service_role or admins with dashboard access can write).
4. Examples:
   - Update prize amounts
   - Change rules short text (full legal in `docs/rules.md`)
   - Modify hero copy for campaigns

**Best Practice:** Always add a description like "Updated by AdminName on [date] for Summer Campaign".

## Rotating Keys & Secrets (Security Maintenance)

- **Supabase Keys** (rarely needed):
  - Dashboard → Project Settings → API → Regenerate anon key or service_role if you suspect compromise.
  - Immediately update:
    - `.env` / hosting env vars for `VITE_SUPABASE_ANON_KEY`
    - Redeploy Edge Functions (they use service_role via secrets)
    - Run `supabase secrets set SUPABASE_SERVICE_ROLE_KEY=new-key...`
  - Rotate the JWT secret only in extreme cases (affects all sessions).

- **Cloudflare Turnstile (CAPTCHA)**:
  - Rotate `TURNSTILE_SECRET_KEY` in Cloudflare dashboard.
  - Update via `supabase secrets set TURNSTILE_SECRET_KEY=newsecret`
  - Update `VITE_TURNSTILE_SITEKEY` in `.env` and redeploy frontend if changed.

- **General Hygiene:**
  - Regularly review Supabase Auth → Users for suspicious signups.
  - Monitor Edge Function logs in Supabase Dashboard → Functions.
  - Never share service_role key. It bypasses all RLS.

## Additional Admin Tips

- **View Live Leaderboard & Activity:** Use the public site or query `referrals` table (RLS lets you see only your own + referred; as project owner you have full dashboard access).
- **Site Content Keys Reference:** See seed in `0001_init_rls.sql` (`hero_title`, `prize_pool`, `rules_text`, etc.).
- **Audit Trail:** All changes to `prize_claims` and `site_content` have `updated_at` + `updated_by` (when wired). Check `referrals` and `shares` tables for abuse patterns.
- **Emergency:** To pause claims, set a high `min_referrals_for_claim` value in site_content or temporarily disable the claim button in code.

**You are responsible for following the Official Rules in `docs/rules.md` when approving real cash prizes.** Always document your approvals.

For technical issues, refer the engineering team to `README.md` and the architecture ADR.

---

*Admin access is a privilege. Use the Supabase dashboard responsibly. All actions are auditable via Postgres logs.*

This guide assumes basic familiarity with the Supabase Dashboard (Table Editor + SQL Editor). No coding required for daily admin tasks.