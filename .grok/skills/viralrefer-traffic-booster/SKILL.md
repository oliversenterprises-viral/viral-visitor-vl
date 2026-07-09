---
name: viralrefer-traffic-booster
description: >
  Drive qualified, sustainable, white-hat traffic to viralrefer.app through value creation,
  discoverability, and built-in viral mechanics (no-signup referral links, live leaderboard,
  homepage feature for #1, open worldwide). Use for boost traffic, automate growth, promote viralrefer.app,
  referral marketing automation, SEO, social strategy, content batches, or /viralrefer-traffic-booster.
  Never spam, bots, black-hat SEO, fake engagement, or purchased backlinks.
metadata:
  short-description: "White-hat traffic & growth for viralrefer.app"
  author: "ViralRefer"
when-to-use: >
  User asks to boost traffic, automate growth, promote viralrefer.app, referral marketing
  automation, increase leaderboard participation, SEO planning, social strategy, analytics,
  or content/assets that drive visitors to get their free referral link.
argument-hint: "[phase: audit | content | onsite | distribution | paid | analytics | compliance]"
user-invocable: true
---

# ViralRefer Traffic Booster

## Core Mandate

Drive qualified, sustainable traffic to **https://www.viralrefer.app** through **white-hat methods only**. Focus on value creation, discoverability, and leveraging the platform's built-in viral mechanics (easy no-signup link sharing, live worldwide leaderboard, homepage feature for #1 — no cash prizes).

**Never** recommend or assist with spam, bot traffic, black-hat SEO, fake engagement, purchased backlinks, cloaking, or any tactic that risks platform bans, legal issues, or long-term brand damage. All strategies must comply with US eligibility rules and platform terms.

**Operate in run-for-me mode:** execute all commands, research, and builds yourself. Never ask the user to open a terminal.

---

## Activation Triggers

This skill activates automatically for:

- Requests to "boost traffic", "automate growth", "promote viralrefer.app", "referral marketing automation", or "increase leaderboard participation"
- Content creation, SEO planning, social strategy, or analytics tasks tied to the app
- Building supporting tools or assets that drive visitors to get their free referral link

---

## Foundational Principles

1. **Value First** — Every asset must genuinely help users understand or succeed with viral referrals. The platform wins when participants have a great experience sharing and competing.
2. **Sustainable Automation** — AI excels at batch content generation, research synthesis, optimization suggestions, and reporting. Human judgment remains essential for outreach, posting, relationship building, and final approvals.
3. **Leverage Built-in Virality** — Prioritize improvements and promotions that make the core loop (get link → share → climb leaderboard → win feature/prize) more visible and frictionless.
4. **Measurement-Driven** — Every action ties to trackable outcomes (UTM parameters, Plausible events if configured, referral link creation counts, leaderboard activity).
5. **Risk-Aware** — Avoid any paid ads or promotions until ad accounts are fully compliant and tested. Past Meta issues require extra caution.

---

## Complete Traffic Growth Playbook

### Phase 1: Audit & Intelligence (Run First)

Gather baseline data: Ask user for current analytics exports, top traffic sources, conversion rates from visitor → link created → first share, bounce rates, device mix.

**Technical SEO audit checklist:**

- Title tag, meta description, H1–H6 structure, alt text, internal linking to key pages
- Page speed (Core Web Vitals via PageSpeed Insights), mobile responsiveness, HTTPS, XML sitemap, robots.txt
- Schema markup opportunities (Event for campaign, FAQ, HowTo, Organization)
- Open Graph / Twitter Card tags for rich link previews

**Competitive intelligence:** Identify top-ranking pages and content formats for target queries like "earn money referring friends", "viral referral leaderboard", "no signup referral link".

**Keyword mapping:** Group by intent (informational, commercial, transactional). Prioritize long-tail opportunities with clear path to conversion (e.g., "how to win referral contest 2026").

Document everything in a simple living tracker (suggest single-file HTML dashboard if needed).

**Repo shortcuts (viral-visitor-vl):**

- `node scripts/dba-stats-snapshot.mjs` — production stats snapshot
- `node scripts/dry-run-autopilot-prod.mjs` — funnel health dry-run
- `src/lib/organic-seo.ts`, `public/robots.txt`, `public/sitemap.xml`
- Admin → Viral Optimizer tab (K-score, referred vs direct)

See `references/seo-audit-checklist.md` for full checklist.

---

### Phase 2: Content & Asset Engine (High-Volume Automation)

**Primary Content Pillars:**

- **Educational guides** — Step-by-step referral maximization, psychology of viral sharing, 2026 trends in referral marketing
- **Platform proof** — Leaderboard spotlights (anonymized or with consent), winner stories, "how I got featured" breakdowns
- **Actionable tools** — Interactive single-file apps (referral message generator, share tracker, ROI calculator for time spent sharing)
- **FAQ & Trust** — Clear rules explainer, eligibility checker, prize claim process

**Generation Workflow:**

- Produce batches of 7–30 days of content in one go: blog post outlines + full drafts, X threads (3–8 tweets), LinkedIn carousels, Reddit value posts, email nurture sequences
- Every piece must include: primary keyword naturally, compelling hook, social proof elements, direct CTA to **"Get your free ViralRefer link in 30 seconds"** with UTM tracking
- Optimize for shareability: ready-to-copy share templates, leaderboard screenshots, prize highlights, "tag a friend who needs this"
- **Tone:** Exciting, transparent, empowering, fun — never hype or misleading

**Single-File Asset Factory:** When a supporting tool or micro-landing page is needed, generate complete, production-ready HTML5 + Tailwind + JS + optional Alpine.js/Canvas masterpieces. Hostable instantly on Vercel or as standalone. These assets themselves become traffic magnets and linkable resources.

**Repurposing Engine:** Turn one long-form guide into 5–10 social posts, 3 short video scripts, 1 email, 1 infographic description, FAQ additions.

See `references/content-quality-rubric.md` before publishing any batch.

---

### Phase 3: On-Site Optimization & Expansion

- **Hero section:** Crystal-clear value prop + prominent "Get my referral link" CTA above the fold. Test variations (prize emphasis vs speed vs leaderboard)
- **Trust & proof:** Live or recent leaderboard teaser, "Join X people who already claimed their link today", rules summary, testimonials if available
- **Navigation & UX:** Easy access to How it Works, Leaderboard, Rules. One-click share buttons with pre-filled messages
- **New page opportunities:** `/guides` (hub), `/blog` (or tag-based), `/tools` (collection of single-file utilities), `/winners`
- **Technical wins:** Structured data, improve LCP/FID/CLS, breadcrumb schema, fast global CDN (Vercel already in use)
- **Internal linking:** Every new piece points back to main conversion pages with contextual anchors

**Repo guardrails:** Never break referral recording, leaderboard, admin, or funnel tracking. Deploy only via `npm run deploy:prod` (15/15 smoke gate). Windows: use `;` not `&&`.

---

### Phase 4: Distribution & Amplification Channels

**X / Twitter (@viralrefer):** Consistent cadence. Daily posts + weekly deep threads. Topics: leaderboard updates, sharing tips, prize announcements, UGC reposts (with credit), engagement questions. Strong visuals, polls, quote tweets.

**Reddit & niche communities:** Value-first posts only (e.g., "I built a no-signup referral leaderboard — here's what I learned about viral mechanics"). Never spam. Follow each subreddit's rules strictly. Generate comment reply templates that add value.

**LinkedIn & professional networks:** Position as modern referral marketing case study. Carousels on "The future of viral campaigns is no-friction links + real prizes".

**Other:** Facebook groups, Discord servers, side-hustle newsletters (manual submission or templates). Embeddable widgets or badges driving traffic.

**Backlink strategy:** Build genuinely link-worthy assets first (single-file tools, comprehensive guides, original leaderboard data if shareable). Personalized outreach for relevant blogs, roundups, directories. Relevance over volume.

**Email & owned channels:** If capture exists or is easy to add, welcome + tip sequences encouraging more sharing.

**Graphics scripts:** `node scripts/render-x-leaderboard-graphic.mjs`, `node scripts/render-fb-leaderboard-graphic.mjs`

---

### Phase 5: Paid & Amplification Experiments (Conditional & Cautious)

Only activate if user **confirms** healthy, compliant ad accounts.

- Interest targeting (entrepreneurship, referral marketing, growth hacking, indie builders)
- Creative mirroring organic value (30-second link demo, leaderboard excitement)
- Ad copy variations, landing page variants, UTM structures for clean attribution
- Strict budget tests with clear success metrics before scaling. Monitor policy flags daily
- Alternative: boost organic posts on X or Meta only after proven engagement

**Default: do not recommend paid until user explicitly opts in.**

---

### Phase 6: Analytics, Iteration & Reporting Automation

**Core KPIs:**

- Traffic quality (time on site, pages per session, return rate)
- Conversion funnel (visitor → link generated → shares made → leaderboard movement)
- Viral coefficient and referral source breakdown
- Content ROI (which pieces drive most qualified traffic)

**Weekly cadence:** Auto-generate performance summary + top 3 opportunities + recommended experiments.

**A/B testing framework:** Document hypothesis, variant, traffic split, results, learnings. Prioritize high-impact tests (CTA copy, social proof placement, prize messaging).

**Dashboard:** Build or enhance single-file analytics visualizer (CSV exports or manual entry for now).

**Long-term:** Compound learning — maintain a "what worked" knowledge base informing future batches.

**UTM helper:** `node .grok/skills/viralrefer-traffic-booster/scripts/utm-builder.mjs`

---

### Phase 7: Risk, Compliance & Brand Safety

- Every promotion must clearly state: **US residents 18+**, no purchase necessary, full rules link, skill-based contest disclaimers
- Content review: accurate claims, no guarantees of earnings, transparent leaderboard mechanics
- Platform compliance: respect robots.txt, rate limits, community guidelines everywhere
- Crisis protocol: pause amplification, investigate, respond transparently

See `references/compliance-checklist.md` before any public campaign.

---

## Integration with NovaCodeSwarm & Development Workflow

When traffic goals require new code, tools, landing page variants, dashboards, or enhancements to viralrefer.app itself:

1. Immediately load and activate **NovaCodeSwarm** (`~/.grok/skills/novacodeswarm/SKILL.md` or `/novacodeswarm`)
2. Commander Nova enforces: **complete code only — no placeholders, no TODOs, Level 10/10 production polish**
3. Typical request pattern: *"Using NovaCodeSwarm, build a single-file [tool name] that helps [specific growth goal] with [features list]. Make it a masterpiece with neon/retro/cyberpunk aesthetics if fitting, full persistence via File System Access API or localStorage, smooth animations, sound where appropriate, and direct CTAs back to viralrefer.app."*
4. Deploy via GitHub → Vercel. Use preview URLs for rapid testing

**Examples of growth-supporting builds:** Interactive referral earnings estimator, content calendar planner with auto-UTM, leaderboard embed generator, share message A/B tester, local analytics dashboard.

---

## Scripts, References & Assets

| Path | Purpose |
|------|---------|
| `scripts/utm-builder.mjs` | UTM parameter builder for campaigns |
| `references/seo-audit-checklist.md` | Full SEO audit |
| `references/content-quality-rubric.md` | Content quality rubric |
| `references/compliance-checklist.md` | US eligibility & platform compliance |
| `references/commands.md` | Repo deploy & stats commands |

Always read the latest version of this SKILL.md and relevant references before executing complex campaigns.

---

## Final Directive

The most powerful traffic automation is creating an experience so compelling that users **want** to share their referral links and compete on the leaderboard. Use this skill to 10x the quantity and quality of supporting content and tools while keeping strategy thoughtful, compliant, and aligned with long-term brand health.

**Track everything. Iterate relentlessly. Protect the platform's integrity above short-term vanity metrics.**

Success is measured in **engaged participants who genuinely benefit** — not just raw visits.

---

## Activation

On entry print:

```
🚀 ViralRefer Traffic Booster active — white-hat growth for viralrefer.app.
```

Then run **Phase 1: Audit & Intelligence** unless the user named a specific phase focus.