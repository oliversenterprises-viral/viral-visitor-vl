# ViralRefer — Admin Guide

For authorized administrators only. This guide reflects the current production implementation.

**Current Admin Access Mechanism (Temporary)**

Admin access is currently gated by a **client-side password** using the `VITE_ADMIN_PASSWORD` environment variable (fallback default in development: `TestAdmin2026!`).

- Users click the Admin button in the UI.
- A password modal appears.
- The entered password is compared directly in the browser against the value of `VITE_ADMIN_PASSWORD`.
- On success, the admin dashboard modal opens.

**Important**: This is a temporary client-side gate and is **not** real Supabase Auth. The `admin-action` Edge Function currently contains a temporary bypass (`isAdmin = true`) to support this flow. A future migration to proper Supabase Auth (JWT sessions + server-side role verification) is planned. Until then, protect the `VITE_ADMIN_PASSWORD` value as a high-privilege secret.

## Logging In as Admin

1. On the live site, click the **Admin** button (or equivalent trigger).
2. Enter the production value configured for `VITE_ADMIN_PASSWORD` in the Vercel environment variables.
3. On success, the Admin Dashboard opens with five tabs:
   - REFERRALS
   - SHARE ANALYTICS
   - EDIT CONTENT
   - PRIZE CLAIMS
   - TEXT COLORS

Regular users without the correct password cannot open the dashboard.

## Managing Prize Claims & Approving Winners

1. In Supabase Dashboard → Table Editor → `prize_claims` table.
2. Filter by `status = 'pending'`.
3. Review each claim:
   - Cross-check the user's `referral_count`.
   - Verify rank context using the public leaderboard or direct queries.
4. To approve:
   - Use the in-app Admin Dashboard **PRIZE CLAIMS** tab (preferred for auditability) or directly update the row.
   - Set `status` to `'approved'` or `'paid'`.
   - Add `review_note` with details (e.g., verification date, payout method, rank).
   - `reviewed_at` is set automatically by the `admin-action` Edge Function when using the dashboard.
5. Approved/paid claims become visible to the public via RLS for social proof.
6. Reject suspicious claims by setting `status = 'rejected'` and documenting the reason in `review_note`.

**All high-value actions should prefer the in-app admin dashboard** (which routes through the `admin-action` Edge Function) over direct table edits when possible.

## Editing Live Site Content (Hero, Prizes, Rules, Referral Base URL, etc.)

The `site_content` table powers dynamic text without requiring a redeploy.

1. Open Admin Dashboard → **EDIT CONTENT** tab (recommended), or use Supabase Table Editor directly.
2. Valid keys include (but are not limited to):
   - `hero_title`, `hero_badge`, `prize_pool`, `rules_text`
   - `min_referrals_for_claim`
   - `referral_base_url` (custom base for generated referral links)
3. Changes are live immediately for public visitors (public `SELECT` policy).
4. Always add a clear `description` or note when editing via the dashboard for auditability.

**Best Practice**: When using the admin UI, changes are persisted through the `admin-action` Edge Function.

## Text Colors (Live Preview)

Admin Dashboard → **TEXT COLORS** tab:

- Modify any design token color (Prize Title, Referral Link Text, buttons, etc.).
- Changes apply live to the public page behind the modal.
- "Reset All Defaults" restores the design system values.
- Custom colors can be added for future-proofing.

## Rotating Keys & Secrets (Security Maintenance)

### Vercel Environment Variables (Client)
- Rotate `VITE_ADMIN_PASSWORD` in Vercel when the current value is at risk.
- Rotate `VITE_SUPABASE_ANON_KEY` or `VITE_TURNSTILE_SITEKEY` when necessary and redeploy.

### Supabase Secrets (Edge Functions)
- Rotate `TURNSTILE_SECRET_KEY` and `SUPABASE_SERVICE_ROLE_KEY` in the Supabase Dashboard under Edge Functions → Secrets.
- Redeploy affected Edge Functions after rotation.

### General Hygiene
- Regularly review Supabase Auth → Users for anomalies.
- Monitor Edge Function logs.
- Never share the service_role key.
- Review `prize_claims` and `shares` tables for abuse patterns.

## Additional Admin Tips

- **Live Leaderboard & Activity**: View on the public site or query the `referrals` and `shares` tables.
- **Site Content Keys**: See the seed data in `supabase/migrations/0001_init_rls.sql` for the current set of keys.
- **Audit Trail**: Use `updated_at`, `reviewed_at`, and `review_note` fields. All mutations through Edge Functions are logged in Supabase.
- **Emergency Controls**: Raise `min_referrals_for_claim` in `site_content` or temporarily adjust UI to pause new claims.

**You are responsible for following the Official Rules** (linked from the site footer and documented in `docs/rules.md`) when approving real cash prizes. Always document approvals thoroughly.

For technical issues, refer to `DEPLOY.md`, `README.md`, and the architecture documents.

---

*Admin access is a privilege. Use the dashboard and Supabase responsibly. All privileged actions are auditable.*