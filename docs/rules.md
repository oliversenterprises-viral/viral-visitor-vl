# ViralRefer Premium — Official Rules & Prize Disclaimers

**Placeholder Section** — This will be linked from the site footer at `/rules` (or via modal in the SPA). Copy content below into a public-facing page, Supabase `site_content` key (`rules_full`), or dedicated route when implementing routing.

**Last Updated:** 2026-05-15  
**Contest Period:** Ongoing (subject to change; see site for current prize pool)

## NO PURCHASE NECESSARY / IMPORTANT LEGAL NOTICE (US SWEEPSTAKES & SKILL CONTEST COMPLIANCE)

**THIS IS A SKILL-BASED REFERRAL CONTEST / PROMOTION. NO PURCHASE, PAYMENT, OR DONATION OF ANY KIND IS NECESSARY TO ENTER, PARTICIPATE, OR WIN.**  
**VOID WHERE PROHIBITED BY LAW OR REGULATION.**

- **Eligibility:** Open only to natural persons who are legal residents of the 50 United States and the District of Columbia, and who are at least eighteen (18) years of age at the time of entry. Employees, officers, directors, agents, and representatives of ViralRefer Premium, its parent companies, affiliates, subsidiaries, advertising and promotion agencies, and their immediate family members and household members are not eligible.
- **Entry Method:** Entry occurs exclusively by generating a unique personal referral link (via authenticated Supabase profile) and successfully referring new users who complete valid actions tracked server-side. Each unique, verified referral (distinct IP, device fingerprint, and user agent, enforced by Edge Functions + Turnstile CAPTCHA + database triggers) awards points toward leaderboard ranking. Multiple referrals permitted. No limit on entries for an individual referrer, provided all activity complies with rules. Automated, robotic, or fraudulent entries are invalid.
- **Winner Determination:** Top referrers (highest verified referral counts, minimum threshold e.g. 50 unique referrals as configurable in `site_content`) win displayed cash prizes or rewards. Rankings computed from immutable `referrals` table via secure queries. Ties broken by earliest timestamp. All verification (no self-referrals, duplicate prevention via unique indexes + triggers) performed exclusively server-side in audited Supabase Edge Functions using service_role privileges. Client-side claims are never trusted. RLS policies ensure public can only view approved/paid winners for social proof.
- **Prizes:** Cash awards (e.g., $10–$500+ or as displayed on homepage prize pool and catalog) or equivalent value items. Prizes are non-transferable, non-substitutable (except at Sponsor's sole discretion). Approximate retail values listed. Winners responsible for all applicable federal, state, and local taxes. U.S. winners receiving prizes valued at $600+ will receive IRS Form 1099-MISC (or current equivalent) and must provide valid tax information (SSN/EIN) to claim. Failure to provide required documentation within 30 days may result in forfeiture.
- **Claim Process:** Eligible winners must claim via the in-app secure submit-claim flow (authenticated Supabase session + Turnstile verification). Claims are processed through the `submit-claim` Edge Function which performs server-side top-1 rank validation before recording a `prize_claims` row (status: pending). Manual admin review and approval required for payout (see ADMIN_GUIDE.md). Unclaimed prizes or those failing verification may be forfeited or re-awarded at Sponsor's discretion.
- **Verification & Disqualification:** Sponsor reserves the right to verify eligibility, referral authenticity, and compliance at any time. Any attempt to circumvent rules (self-referrals, shared devices/IPs, bots, VPN abuse, multiple accounts, etc.) will result in immediate disqualification, forfeiture of prizes, and potential legal action. The secure architecture (Row Level Security on every table + all mutations gated behind Edge Functions) + SECURITY DEFINER triggers + Cloudflare Turnstile provides defense-in-depth enforcement. All decisions of the Sponsor are final and binding.
- **General Conditions:** Sponsor reserves the right to cancel, suspend, or modify the contest if fraud, technical failures, or any other factor beyond Sponsor's reasonable control impairs the integrity of the promotion. By participating, entrants agree to these Official Rules, the Privacy Policy, and Sponsor's decisions. Entrants release and hold harmless Sponsor, Supabase, and related parties from any liability, injury, loss, or damage arising from participation or prize acceptance/use. This promotion is subject to all applicable federal, state, and local laws and regulations.

**Privacy:** Personal data (email, referrer_code, IP for abuse prevention only) is processed per Supabase RLS policies and never sold. See Privacy Policy for details on data retention and rights.

**Governing Law:** These rules shall be governed by the laws of the State of [State], United States, without regard to conflict of law principles.

**Sponsor:** ViralRefer Premium (contact via support form or admin@viralrefer.example).

**Full Contact for Questions:** admin@viralrefer.example or use the in-app support flow.

**Where to View Live Rules:** The editable short version lives in the Supabase `site_content` table under key `rules_text` (publicly readable via RLS `site_content_select_public` policy). Admins update it through secure channels only.

**Related Documentation:**
- [README.md](../README.md) — Quick Start & Architecture
- [ADMIN_GUIDE.md](../ADMIN_GUIDE.md) — How admins approve claims and manage content
- [docs/adr/001-architecture.md](adr/001-architecture.md) — Secure architecture details (RLS, Edge Functions, Sentinel audit)
- [docs/project-structure.md](project-structure.md)

*This placeholder ensures legal compliance language is ready for production launch. Replace with attorney-reviewed version before any real-money prize distribution. Horizon-style research on U.S. sweepstakes best practices (FTC 16 CFR Part 255, state laws, no-purchase-necessary disclosures, tax implications) incorporated.*

---

**End of Official Rules Placeholder**