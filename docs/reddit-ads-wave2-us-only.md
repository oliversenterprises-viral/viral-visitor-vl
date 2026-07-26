# Reddit ads — wave2 US-only (honest prize rules)

**Campaign:** `wave2_jul2026`  
**Geo:** United States only  
**Age:** 18+  
**Positioning (must match site):** free · no signup · live leaderboard · **no cash prizes** · **recognition only** · top verified can claim a **homepage feature**  
**Do not claim:** Cash App cash, guaranteed money, “get paid to refer,” earnings promises  

**Conversions that matter:** Get my link (`Lead`) → Share (`ShareReferral`).  
**Full Ads Manager setup:** see [`reddit-ads-conversion-setup.md`](./reddit-ads-conversion-setup.md)  
**Objective must be Conversions → Lead**, not Traffic / PageVisit.

**Base (recommended for ads):** homepage  
**Owner-attribution variant:** replace host path with `/r/VIRAL-97UWEGZ` if you want clicks credited to your owner code.

---

## Creative A — `ad_nosignup`  
**Angle:** frictionless product (30-second free link)

### Reddit Ads fields
| Field | Copy |
|--------|------|
| **Headline** (≤ ~40 chars ideal) | Free referral link. No signup. |
| **Primary text** | Built a free viral referral leaderboard — no account, no app install. US residents 18+ can grab a unique link in about 30 seconds, share it, and climb a live board. Recognition only (homepage feature for verified top spot) — **not a cash prize**. |
| **Display/URL text** | viralrefer.app |
| **CTA button** | Learn More / Sign Up (use whatever Reddit allows; site itself is no-signup) |

### Final URL (paste into ad destination)
```
https://www.viralrefer.app/?utm_source=reddit&utm_medium=paid&utm_campaign=wave2_jul2026&utm_content=ad_nosignup
```

### Owner-ref variant
```
https://www.viralrefer.app/r/VIRAL-97UWEGZ?utm_source=reddit&utm_medium=paid&utm_campaign=wave2_jul2026&utm_content=ad_nosignup
```

### Short comment / post body (if promoting organically)
```
Free referral leaderboard — no signup. US 18+. Grab a link in ~30s and climb the board.
Recognition / homepage feature only — no cash prizes.
https://www.viralrefer.app/?utm_source=reddit&utm_medium=social&utm_campaign=wave2_jul2026&utm_content=ad_nosignup
```

---

## Creative B — `ad_leaderboard`  
**Angle:** competition + live rank

### Reddit Ads fields
| Field | Copy |
|--------|------|
| **Headline** | Climb a live referral leaderboard |
| **Primary text** | See who is actually driving referrals in real time. Get a free unique link (no signup), share it, and watch the board update. Open to US residents 18+. Prizes are **recognition only** — verified leaders can earn a **homepage feature**, not cash. |
| **Display/URL text** | viralrefer.app |
| **CTA button** | Learn More |

### Final URL
```
https://www.viralrefer.app/?utm_source=reddit&utm_medium=paid&utm_campaign=wave2_jul2026&utm_content=ad_leaderboard
```

### Owner-ref variant
```
https://www.viralrefer.app/r/VIRAL-97UWEGZ?utm_source=reddit&utm_medium=paid&utm_campaign=wave2_jul2026&utm_content=ad_leaderboard
```

### Short comment / post body
```
Live referral leaderboard — free unique links, no signup.
US 18+. Recognition / homepage feature only (no cash).
https://www.viralrefer.app/?utm_source=reddit&utm_medium=social&utm_campaign=wave2_jul2026&utm_content=ad_leaderboard
```

---

## Creative C — `ad_us_contest`  
**Angle:** eligibility + honesty (filters junk geo/intent)

### Reddit Ads fields
| Field | Copy |
|--------|------|
| **Headline** | US 18+ free referral contest |
| **Primary text** | Free to enter. No signup. Get your ViralRefer link, share it, climb the leaderboard. **US residents 18+ only.** This is **not a cash giveaway** — winners get recognition (including a verified homepage feature). Built for people who like fair, transparent referral contests. |
| **Display/URL text** | viralrefer.app |
| **CTA button** | Learn More |

### Final URL
```
https://www.viralrefer.app/?utm_source=reddit&utm_medium=paid&utm_campaign=wave2_jul2026&utm_content=ad_us_contest
```

### Owner-ref variant
```
https://www.viralrefer.app/r/VIRAL-97UWEGZ?utm_source=reddit&utm_medium=paid&utm_campaign=wave2_jul2026&utm_content=ad_us_contest
```

### Short comment / post body
```
US 18+ · free · no signup · live referral leaderboard.
Recognition only (homepage feature) — no cash prizes.
https://www.viralrefer.app/?utm_source=reddit&utm_medium=social&utm_campaign=wave2_jul2026&utm_content=ad_us_contest
```

---

## Quick-copy URL block (homepage, paid)

```
A nosignup:
https://www.viralrefer.app/?utm_source=reddit&utm_medium=paid&utm_campaign=wave2_jul2026&utm_content=ad_nosignup

B leaderboard:
https://www.viralrefer.app/?utm_source=reddit&utm_medium=paid&utm_campaign=wave2_jul2026&utm_content=ad_leaderboard

C us_contest:
https://www.viralrefer.app/?utm_source=reddit&utm_medium=paid&utm_campaign=wave2_jul2026&utm_content=ad_us_contest
```

---

## Reddit Ads setup checklist (US-only)

1. **Locations:** United States only (exclude all other countries).  
2. **Age:** 18+ if the UI allows.  
3. **Interests (start narrow):** contests, giveaways, entrepreneurship, side hustles, digital marketing, Cash App *culture* only if copy stays non-cash — prefer “referral / contest / leaderboard” over “make money online.”  
4. **Placements:** feed first; avoid low-intent inventory if CTR is high but get-link is ~0%.  
5. **Destination:** one of the three URLs above (full UTM required).  
6. **Budget test:** equal spend across A/B/C for 3–5 days, **kill losers on get-link rate**, not just clicks.  
7. **Policy:** never put “win cash,” “Cash App prize money,” or earnings guarantees in headline/body/image text. Site says **no cash prizes / recognition only**.

---

## How to judge winners (site metrics)

After 3–5 days, compare by `utm_content`:

| Metric | Goal before scaling |
|--------|---------------------|
| SiteLanding with full UTM | Tracking works (medium=paid, campaign=wave2_jul2026) |
| GetReferralLink / unique visitors | Aim **≥10%** on US paid |
| CopyReferralLink / ShareReferral | Secondary |
| Verified referrals | Real success signal |

Query idea: filter `visitor_events` where `utm_source=reddit` and `utm_medium=paid` and `utm_campaign=wave2_jul2026` and group by `utm_content`.

---

## Compliance one-liner (put in ad if space)

> US residents 18+. Free. No signup. No cash prizes — recognition / homepage feature only. See site for rules.

---

*Generated for Oliver · local doc only · no production deploy.*
