# TE promo copy (ViralRefer Site Drops)

No paid TE integration required. Destination must include `src=te` so credits stay honest.

## Recommended destinations

| Use | URL |
| --- | --- |
| Full conversion splash | `/splash?src=te&camp=YOURCAMP` |
| Human breakout (same splash) | `/go?src=te&camp=YOURCAMP` |
| Rotator / iframe | `/te?src=te&camp=YOURCAMP&size=468x60` |
| Compact iframe | `/embed/te?src=te&camp=YOURCAMP` |
| Homepage (after click) | `/join?src=te&camp=YOURCAMP` or `/?src=te` |
| Race link | `/splash?src=te&ref=VIRAL-XXXXXXX&camp=YOURCAMP` or `/a/VIRAL-XXXXXXX?src=te` |

## Ad titles

- Paste a site. Make it climb.
- Get my link — visits do not count
- Help this site go viral (no email)
- Just entered → Rising → #1 banner
- Unique friends only. No fake counts.

## Short blurbs

- Instant personal share link. Friends tap Get my link. The site climbs a live board. Free. No email. No cash prize.
- Opening this page does not count. Tap Get my link.
- Traffic-exchange hits never unlock the #1 banner. Real unique friends do.

## Iframe snippet (ready to paste)

The CTA is a real `<a target="_top">`. It works if cookies and JS are blocked. Tags stay on the URL.

```html
<iframe src="https://YOUR-ORIGIN/te?src=te&camp=rotator&size=468x60" width="468" height="60" style="border:0;overflow:hidden;max-width:100%" loading="lazy" title="ViralRefer Site Drops"></iframe>
```

| Size | src | width × height |
| --- | --- | --- |
| Full splash | `/splash?src=te&camp=YOURCAMP` | Viewport (not for iframes) |
| Leader | `/te?src=te&camp=leader&size=728x90` | 728 × 90 |
| Rotator | `/te?src=te&camp=rotator&size=468x60` | 468 × 60 |
| Box | `/embed/te?src=te&camp=box&size=300x250` | 300 × 250 |

Do **not** iframe `/` or `/admin`. Do **not** iframe `/r/VIRAL-…` (join needs a first-party page). Race traffic: `/te?src=te&ref=VIRAL-XXXXXXX`.

## Framing policy

| Path | Framed by third parties? |
| --- | --- |
| `/splash`, `/te`, `/go`, `/embed/te`, `/e/*`, `/promo/te/*` | Yes (`frame-ancestors *`) |
| `/` homepage | Same-origin only |
| `/admin` | Never (`DENY`) |
