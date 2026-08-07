# ViralRefer multi-platform banners & social pack

**Saved:** 2026-07-15 21:48 (local)
**Project:** `C:\Users\olive\Projects\viral-visitor-vl`
**Slash:** `/save open viralrefer-banners-social-pack`

## Resume (paste in a new session)
> Read `C:\Users\olive\.grok\saved-conversations\2026-07-15-viralrefer-banners-social-pack.md` and continue. Nova Team / ViralRefer marketing banners + PageRankCafe + X flag-safe posts. Do not break prod; static-only deploys when shipping assets.

## One-line goal
Ship powerful ViralRefer ad/social banners hosted on viralrefer.app for PageRankCafe, Facebook, Telegram, Reddit, X, and general web — without breaking production.

## What we did
- Designed and rendered brand-consistent banners (HTML/CSS → Playwright PNG; exact text, no AI garbled copy).
- Hosted assets under `https://www.viralrefer.app/assets/banners/` (static only).
- Safe deploy pattern: stage banner files only → `git stash --keep-index` other WIP → `vercel --prod` → smoke → stash pop.
- PageRankCafe: 851×315 banner; **must use `/embed` URL** (homepage blocks iframes via X-Frame-Options DENY).
- Multi IAB pack: 728×90, 468×60, 320×50, 320×100, 300×250, 160×600, 300×600, 250×250, 970×90, 970×250, 851×315.
- Universal social pack: 1200×628, 1280×720, 1080×1080, 1080×1920 + clickable HTML wrapper.
- X growth post (flag-safe: no bare domain; “Search Google: ViralRefer” + growth card graphic).
- Real stats snapshot (2026-07-15): ~535 uniques/7d sample, 44 GetReferralLink, 41 copies; board early (7 verified referrals).

## Decisions
- **Exact banner text** → code/HTML render, not pure image_gen.
- **Homepage ≠ iframe-safe.** Traffic exchanges → `/embed?...`. Social full-tab → homepage `/?utm_...`.
- **Owner cold ads** use homepage/embed + UTMs — **not** personal `/r/VIRAL-97UWEGZ` (peer shares only).
- **Product truth on creatives:** free, no signup, no cash prize; #1 = homepage feature.
- **X domain flagged** → never paste viralrefer.app in posts; Google search + QR/image until appeal clears.
- Static-only deploys; do **not** ship unrelated WIP (SEO/index/organic-seo edits stayed local).

## Key files & paths
### Hosted live
- `https://www.viralrefer.app/assets/banners/viralrefer-social-1200x628.png` — primary social
- `https://www.viralrefer.app/assets/banners/viralrefer-728x90.png` — leaderboard
- `https://www.viralrefer.app/assets/banners/viralrefer-851x315.png` (+ pagerankcafe alias)
- `https://www.viralrefer.app/assets/banners/viralrefer-clickable-banner.html`
- `https://www.viralrefer.app/assets/banners/SOCIAL-SHARE.txt`
- `https://www.viralrefer.app/assets/banners/URLS.txt`

### Repo
- `public/assets/banners/` — all PNG + guides
- `scripts/ad-banners/render-ad-banners.mjs` — IAB pack
- `scripts/ad-banners/render-social-universal.mjs` — social pack
- `scripts/ad-banners/render-growth-card.mjs` — X growth graphic
- `marketing/pagerankcafe/LISTING.txt`
- `marketing/x-launch/GROWTH-POST-2026-07-15.txt`
- `marketing/x-launch/DO-THIS-NOW.txt` — X domain appeal steps
- `scripts/deploy-prod.mjs` — full edge+smoke (avoid unless needed)
- Prefer `npx vercel --prod` for static-only

### Desktop packs
- `Desktop\ViralRefer-Banners\` — IAB sizes
- `Desktop\ViralRefer-Social-Banners\` — social sizes + SOCIAL-SHARE.txt
- `Desktop\viralrefer-growth-card-1200x675.png`
- `Desktop\viralrefer-851x315-pagerankcafe.png` (earlier)

### Git (local, may be ahead of origin)
- `b3c4089` host 851×315 PageRankCafe banner
- `9da7562` multi-size IAB pack
- `cedef9a` universal social banners
- main was **ahead of origin by 3** at save time (not necessarily pushed)

## Open / next
- [ ] Push banner commits to GitHub if remote should match prod (`git push` when ready)
- [ ] Finish X domain false-positive appeal (`marketing/x-launch/DO-THIS-NOW.txt`)
- [ ] Place PageRankCafe listing with **embed** URL + banner image
- [ ] Post FB/Telegram/Reddit using social pack + UTM destinations
- [ ] Optionally deploy growth-card to public/assets (file may still be untracked locally)
- [ ] Keep other WIP (organic-seo, robots, index.html, etc.) separate from banner deploys

## Do not forget
- PageRankCafe / iframe exchanges: **`/embed?utm_...`** only — homepage “breaks iframes” by design.
- PNG does not auto-redirect; always set destination URL when posting (or use clickable HTML).
- No cash-prize claims on creatives.
- Don’t ship dirty working tree to prod; stash non-banner WIP first.
- Smoke: `npm run test:smoke:prod` after deploys.

## Commands / URLs
```text
# Re-render packs
node scripts/ad-banners/render-ad-banners.mjs
node scripts/ad-banners/render-social-universal.mjs
node scripts/ad-banners/render-growth-card.mjs

# Safe static deploy (after staging only banner files + stash other WIP)
npx vercel --prod --yes
npm run test:smoke:prod

# Stats
node scripts/dba-stats-snapshot.mjs
```

### Destinations cheat sheet
| Use | URL |
|-----|-----|
| Social / full page | `https://www.viralrefer.app/?utm_source=PLATFORM&utm_medium=social&utm_campaign=social_banner` |
| Iframe exchanges | `https://www.viralrefer.app/embed?utm_source=pagerankcafe&utm_medium=banner&utm_campaign=SIZE` |
| Peer personal share | `https://www.viralrefer.app/r/VIRAL-97UWEGZ` |

### PageRankCafe paste
- Image: `https://www.viralrefer.app/assets/banners/viralrefer-851x315-pagerankcafe.png`
- Link: `https://www.viralrefer.app/embed?utm_source=pagerankcafe&utm_medium=banner&utm_campaign=851x315&utm_content=prcafe`
- Title: `Get a Free Referral Link in 30 Sec · Climb the Live Leaderboard`

### X post (flag-safe) — attach growth card
```
Last 7 days on ViralRefer 📈

535+ unique visitors (sampled)
44 free links claimed
41 link copies
US + Ireland leading the board traffic

Free worldwide referral leaderboard.
No signup. ~30 seconds. No cash prize.
#1 claims a homepage feature — board is still early.

Search Google: ViralRefer
(or scan the QR on our profile)

#buildinpublic #indiehacker #referral
```
