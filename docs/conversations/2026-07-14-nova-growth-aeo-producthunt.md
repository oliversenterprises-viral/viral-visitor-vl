# Conversation save — 2026-07-14  
## Nova Team · ViralRefer growth, AEO, Product Hunt

**Saved so you can always come back.**  
**Project:** `C:\Users\olive\Projects\viral-visitor-vl`  
**Also see:** `RESTART_HANDOFF.md` (project root) · `marketing/producthunt/`

---

## How to resume this chat later

In a **new** Grok session:

```
cd C:\Users\olive\Projects\viral-visitor-vl
```

Then say:

> Read `docs/conversations/2026-07-14-nova-growth-aeo-producthunt.md` and `RESTART_HANDOFF.md`. Continue where we left off.

Or shorter:

> Read RESTART_HANDOFF.md and continue ViralRefer.

---

## What we covered (topic index)

### A) Product funnel (shipped)
1. **Post–get-link send mode** — one primary “Send to a friend now,” hide extra chrome, sticky mobile send bar.  
   - Files: `src/lib/send-mode.ts`, share-first-ui, referral, CSS `data-vr-send-mode`
2. **Full workflow audit** — fix only broken paths; don’t break prod.  
   - Fixed: funnel coach Share, share reminders, native share fallback (were aiming at hidden platform grid).  
   - Confirmed healthy: record-referral, lock = first friend Get link, smoke tests.
3. **Deploy:** `npm run deploy:prod` + smoke gate (used successfully after send-mode + AEO).

### B) AEO — Answer Engine Optimization (shipped)
1. Explained AEO vs SEO (AI answers cite you vs blue links).  
2. Implemented best safe AEO plan:
   - Entity “What is ViralRefer?” block  
   - Visible `#faq` (8 Q&As)  
   - Expanded JSON-LD FAQPage / Organization / WebApplication  
   - `public/llms.txt`  
   - `robots.txt` allows GPTBot, ClaudeBot, PerplexityBot, Google-Extended, etc.  
   - Sitemap: `#faq`, `llms.txt`  
   - Verify: `node scripts/verify-aeo-live.mjs`  
3. FAQ/entity hidden during send-mode / referred micro (funnel first).

### C) Growth channels (advice, not all built)
| Topic | Conclusion |
|-------|------------|
| **DFY Traffic Pro** (Stan / Manda) | Not zero help forever, but **weak** for ViralRefer; vanity traffic; don’t rely on it |
| **AdFasten** | Telegram promo automation; may grow channel reach; not a quality builder; spam risk |
| **Bot: post to any groups** | **No** — ToS/ban |
| **Bot: find chats + auto-invite** | **No** — spam tooling |
| **Telegram @viralrefer at 0 subs** | Grow via **site → channel**, free posts, whitelist bots, optional official Telegram Ads |
| **Blog /guides** | **Yes helps** SEO/AEO long-term; early traffic from site + free promo; paid ads optional |
| **Product Hunt** | Good **launch spike**; not hard to submit; hard to “win the day”; **kit prepared** |

### D) Product Hunt (kit ready — you launch)
Folder: **`marketing/producthunt/`**

| File | Purpose |
|------|---------|
| `YOU-DO-THIS.txt` | Your only short checklist |
| `LISTING-COPY.txt` | Name, tagline, description, topics |
| `MAKER-FIRST-COMMENT.txt` | Launch-day first comment |
| `FAQ-REPLIES.txt` | Comment answers |
| `SCREENSHOT-CHECKLIST.txt` | Gallery shots |
| `LAUNCH-DAY-PLAYBOOK.txt` | Hour-by-hour |
| `UTM-LINKS.txt` | Trackable homepage URLs |
| `SOCIAL-AMPLIFY.txt` | X/Telegram after you have PH URL |
| `README.md` | Overview |

**Primary PH website URL:**  
`https://www.viralrefer.app/?utm_source=producthunt&utm_medium=launch&utm_campaign=ph_launch`  

**Do not** use owner `/r/CODE` as main PH link.

**You still do:** PH account, upload screenshots, submit, be online launch day.

### E) Blog discovery (explained, not built)
- SEO/AEO can find guides over weeks/months — no paid ads required.  
- Early traffic usually from **your site links** + free posts.  
- Paid ads optional rocket fuel.

---

## Product truths (never lose these)

1. ViralRefer = **free** worldwide referral leaderboard.  
2. Link in ~**30 seconds**, **no signup**.  
3. Climb when friend opens link and taps **Get my link**.  
4. Copy alone does **not** lock.  
5. #1 = **homepage banner feature**, **no cash prize**.  
6. Cold ads/PH → **homepage + UTM**, not personal referral code.  
7. Main growth engine = **share loop**, not DFY traffic packs.

---

## Suggested next missions (pick one)

1. **Launch Product Hunt** — follow `marketing/producthunt/YOU-DO-THIS.txt`  
2. **Build `/guides` blog** — 3–5 cornerstone AEO articles  
3. **Site Telegram CTA** — grow `@viralrefer` from app traffic  
4. **Measure funnel** after send-mode/AEO (get-link → share rate)

---

## Key live URLs

- App: https://www.viralrefer.app  
- FAQ: https://www.viralrefer.app/#faq  
- llms.txt: https://www.viralrefer.app/llms.txt  
- Telegram: https://t.me/viralrefer  

---

## Infrastructure (names only)

- Vercel: viralrefer-premium  
- Supabase: `wqbefjzpgsezzwdrvvua`  
- Deploy: `npm run deploy:prod`  

Secrets stay in Vercel/Supabase dashboards (never paste into chat logs).

---

*Saved 2026-07-14 by Nova Team handoff. This file is the durable “come back to this conversation” archive.*
