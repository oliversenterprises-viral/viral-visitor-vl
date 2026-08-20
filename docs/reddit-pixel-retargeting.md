# Reddit Pixel — retargeting (ViralRefer)

## What was implemented

Reddit Ads Pixel for **PageVisit** (paid Traffic campaign) + later conversion signals.

| Guard | Behavior |
|--------|----------|
| Default (no env) | Official snippet in `index.html` + `src/lib/reddit-pixel.ts` fire `init` + `PageVisit` on public pages |
| Pixel ID | `a2_ir6sjdbsj2n4` (ViralRefer Ad Account `ir6sjdbsj2n4`) |
| `VITE_REDDIT_PIXEL_ENABLED=0` | JS conversion path off; HTML PageVisit snippet still ships |
| `/embed` traffic exchanges | Pixel **skipped** (HTML + JS) |
| Failures | Never break get-link / share funnel |

Code: official snippet in `index.html` · `src/lib/reddit-pixel.ts` · wired from `main.ts` + `trackVisitorFunnel`.

## Events (best ladder)

| Site funnel | Reddit event | Use for |
|-------------|--------------|---------|
| Landing | `PageVisit` | Retarget anyone who hit viralrefer.app |
| Get referral link | `Lead` + Custom `GetReferralLink` | High-intent; exclude converters from cold ads |
| Copy link | Custom `CopyReferralLink` | Super-intent |
| Share | Custom `ShareReferral` | Hottest segment |
| Prize claim open/submit | Custom | Niche high-intent |

**Not used:** `Purchase` (product is free — would mislead optimization).

## Production

Pixel ID `a2_ir6sjdbsj2n4` is shipped in homepage HTML. Public CSP allows `redditstatic.com` + Reddit pixel connect hosts. Embed CSP stays free of Reddit.

1. Merge + Vercel deploy.
2. Visit `https://www.viralrefer.app/` → Events Manager should show **PageVisit** (may take minutes).
3. Get a link on the site → should show **Lead**.

Historical id (do not ship): `a2_jr6jdbg2r4`.

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

- Pixel ships with the site; no extra Vercel env is required.
- Set `VITE_REDDIT_PIXEL_ENABLED=0` only if you need to mute JS conversion events.
