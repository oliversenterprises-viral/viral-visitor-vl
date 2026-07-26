# Reddit Pixel — retargeting (ViralRefer)

## What was implemented

Optional Reddit Ads Pixel for **retargeting audiences** + conversion signals.

| Guard | Behavior |
|--------|----------|
| `VITE_REDDIT_PIXEL_ID` empty | **No script loads** (prod-safe default) |
| Set to your pixel id | Loads `redditstatic.com/ads/pixel.js`, fires events |
| `/embed` traffic exchanges | Pixel **skipped** |
| Failures | Never break get-link / share funnel |

Code: `src/lib/reddit-pixel.ts` · wired from `main.ts` + `trackVisitorFunnel`.

## Events (best ladder)

| Site funnel | Reddit event | Use for |
|-------------|--------------|---------|
| Landing | `PageVisit` | Retarget anyone who hit viralrefer.app |
| Get referral link | `Lead` + Custom `GetReferralLink` | High-intent; exclude converters from cold ads |
| Copy link | Custom `CopyReferralLink` | Super-intent |
| Share | Custom `ShareReferral` | Hottest segment |
| Prize claim open/submit | Custom | Niche high-intent |

**Not used:** `Purchase` (product is free — would mislead optimization).

## Enable in production (does not auto-deploy)

1. Reddit Ads → **Events Manager** → create/copy **Pixel ID** (looks like `a2_...`).
2. Vercel → Project → Settings → Environment Variables → Production:
   ```
   VITE_REDDIT_PIXEL_ID=a2_xxxxxxxxxxxx
   ```
3. Redeploy production (`npm run deploy:prod` when you are ready).
4. Visit `https://www.viralrefer.app/` → Reddit Events Manager should show **PageVisit** (may take minutes).
5. Get a link on the site → should show **Lead**.

Historical id once used on this project (if Events Manager still shows it): check Ads account; do not invent a new one if the old pixel still has history.

## Audiences to create in Reddit Ads

1. **All visitors (7–30d)** — event `PageVisit`  
2. **Got link, didn’t share (7–14d)** — `Lead` / `GetReferralLink` **minus** `ShareReferral`  
3. **Sharers (exclude from cold prospecting)** — `ShareReferral`  
4. **US-only** — combine with US geo on the campaign (pixel is not a geo filter)

## CSP

Main site CSP allows:

- `script-src` → `https://www.redditstatic.com`
- `connect-src` → `redditstatic.com`, `alb.reddit.com`, `pixel-config.reddit.com`, `conversions-config.reddit.com`, `www.reddit.com`

**Embed** CSP stays free of Reddit (no pixel on traffic-exchange iframes).

## Verify locally

```bash
# with pixel off (default)
npm test -- tests/unit/reddit-pixel.test.ts

# with pixel id in .env.local
# VITE_REDDIT_PIXEL_ID=a2_test
# npm run dev → Network tab should request pixel.js
```

## Safety

- No deploy required for code review alone; **pixel only becomes live after env + redeploy**.
- Empty env = identical to pre-pixel product behavior (plus slightly broader CSP allowlist for Reddit domains).
