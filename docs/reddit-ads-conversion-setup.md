# Reddit Ads — optimize for Get link + Share (not landings)

**Goal conversions (site):**
1. **Primary:** visitor taps **Get my referral link** → pixel `Lead` + custom `GetReferralLink`
2. **Secondary:** visitor **shares** → custom `ShareReferral`

**Do not optimize for:** `PageVisit` / site landings alone. That is what “actions that aren’t real” looks like.

Pixel ID (production): set `VITE_REDDIT_PIXEL_ID` (already in project env files). Redeploy after any pixel change.

---

## Campaign setup (do this in Ads Manager)

| Setting | Value |
|---------|--------|
| **Objective** | **Conversions** (not Traffic / Clicks) |
| **Conversion event** | **Lead** (maps to GetReferralLink on-site) |
| **Geo** | United States (if prize/eligibility is US-only) |
| **Age** | 18+ |
| **Automated targeting** | ON only after you have 15–30+ real Leads; until then use broad communities + keywords |
| **Final URL** | Must include UTMs (site boosts conversion for paid/Reddit) |

### Final URL (required)

```
https://www.viralrefer.app/?utm_source=reddit&utm_medium=paid&utm_campaign=wave2_jul2026&utm_content=ad_getlink
```

Owner-attribution variant:

```
https://www.viralrefer.app/r/VIRAL-97UWEGZ?utm_source=reddit&utm_medium=paid&utm_campaign=wave2_jul2026&utm_content=ad_getlink
```

### Ad copy rules (match the live site)

- **Promise:** free link, no signup, live leaderboard, share to climb  
- **Do not promise:** Cash App cash, “get paid,” guaranteed money (site is recognition / homepage feature positioning in wave2)  
- **CTA line:** “Get your free referral link — then share it”

Headline examples:
- `Free referral link. No signup.`
- `Get your link. Share. Climb.`
- `Live referral leaderboard — free`

---

## Why automated targeting “gives actions” but not shares

| Mode | What Reddit optimizes for | What you often see |
|------|---------------------------|--------------------|
| Traffic / soft events | Clicks / PageVisit | Landings, no Get link |
| Conversions + Lead | People likely to fire Lead | Get-link taps |
| Auto targeting ON + wrong event | Easiest “result” in auction | Fake-feeling actions |
| Auto OFF + tiny audience | Nothing eligible | $0 spend |

**Fix:** Conversion objective → **Lead** → enough budget/communities that the auction can spend → then auto expansion.

---

## Retargeting (after pixel has data)

1. **Got link, didn’t share (7–14d):** event Lead / GetReferralLink **exclude** ShareReferral  
2. **Sharers:** ShareReferral — exclude from cold prospecting  
3. **All visitors who never got link:** PageVisit exclude Lead  

---

## On-site (shipped)

- Paid/Reddit landings get `data-vr-paid-landing` boost: sticky Get-link bar, faster soft nudge (~6–8s), conversion hero copy  
- Funnel events: `GetReferralLink` → Reddit `Lead`; `ShareReferral` → custom ShareReferral  
- Verify: `node scripts/stats-last-24h.mjs` → watch `getLink` and `shareEvents` rise, not just `landings`

---

## Checklist before scaling spend

- [ ] Events Manager shows **Lead** when you tap Get my link on prod  
- [ ] Campaign objective = Conversions, event = Lead  
- [ ] Final URL has `utm_source=reddit&utm_medium=paid`  
- [ ] Creative matches “free link → share → board” (no cash claims)  
- [ ] After 48h: `getLink / landings` > 15% on paid traffic, else pause and fix creative/LP
