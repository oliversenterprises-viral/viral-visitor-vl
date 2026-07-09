# ViralRefer — Official Rules & Disclaimers

**Last Updated:** 2026-07-09  
**Product:** Free live referral leaderboard. No cash prizes.

## NO PURCHASE NECESSARY

**THIS IS A FREE, SKILL-BASED REFERRAL LEADERBOARD. NO PURCHASE, PAYMENT, OR DONATION OF ANY KIND IS NECESSARY TO ENTER OR PARTICIPATE.**  
**VOID WHERE PROHIBITED BY LAW OR REGULATION.**  
**THERE ARE NO CASH PRIZES.**

- **Eligibility:** Open only to natural persons who are legal residents of the 50 United States and the District of Columbia, and who are at least eighteen (18) years of age at the time of entry. Employees, officers, directors, agents, and representatives of ViralRefer, its affiliates, and their immediate family members and household members are not eligible.
- **Entry Method:** Entry occurs by generating a unique personal referral link and successfully referring new users who complete valid actions tracked server-side. Each unique, verified referral awards progress toward leaderboard ranking. Automated, robotic, or fraudulent entries are invalid.
- **#1 Determination:** Top referrers (highest verified referral counts, minimum threshold as shown on site / configurable in `site_content`) may claim a **homepage banner feature** for their website after verification. Rankings computed from the `referrals` table via secure server-side queries. Ties broken by earliest timestamp. Client-side claims are never trusted.
- **Homepage feature (not cash):** The only recognition offered is a homepage banner / feature slot subject to eligibility verification and final admin approval. Features are non-transferable. There is no cash prize, Cash App payout, or monetary award.
- **Claim Process:** Eligible #1 referrers claim via the in-app secure submit-claim flow (authenticated Supabase session + Turnstile). Claims go through the `submit-claim` Edge Function with server-side top-1 rank validation, then admin review.
- **Verification & Disqualification:** Sponsor may verify eligibility and referral authenticity at any time. Circumventing rules (self-referrals, shared devices/IPs, bots, VPN abuse, multiple accounts, etc.) results in disqualification. All Sponsor decisions are final.
- **General Conditions:** Sponsor may cancel, suspend, or modify the leaderboard if fraud or technical failures impair integrity. By participating, entrants agree to these rules and the Privacy Policy.

**Privacy:** Personal data is processed per Supabase RLS policies and never sold. See Privacy Policy for details.

**Sponsor:** ViralRefer (contact via site support).

**Live rules:** Editable short version in Supabase `site_content` key `rules_text`. Full text key: `rules_full`.

**Related:** [README.md](../README.md) · [ADMIN_GUIDE.md](../ADMIN_GUIDE.md)
