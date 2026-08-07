# Technical SEO Audit Checklist — viralrefer.app

## On-page

- [ ] Title tag unique, ≤60 chars, includes primary keyword + brand
- [ ] Meta description compelling, ≤155 chars, includes CTA
- [ ] Single H1 aligned with intent; logical H2–H6 hierarchy
- [ ] Image alt text on all meaningful images
- [ ] Internal links to: homepage CTA, How it Works, Leaderboard, Rules
- [ ] Canonical URL set correctly

## Technical

- [ ] HTTPS everywhere; no mixed content
- [ ] `public/robots.txt` allows key paths
- [ ] `public/sitemap.xml` includes live URLs
- [ ] Mobile-responsive (viewport, touch targets)
- [ ] Core Web Vitals: LCP, INP/FID, CLS (PageSpeed Insights)
- [ ] No render-blocking critical path regressions

## Structured data

- [ ] WebSite + Organization schema
- [ ] FAQPage (homepage FAQ)
- [ ] HowTo or Event schema if campaign-specific page exists
- [ ] BreadcrumbList on nested pages

## Social / previews

- [ ] Open Graph: title, description, image, url
- [ ] Twitter Card tags
- [ ] OG image renders correctly on X, iMessage, Discord

## Competitive & keywords

- [ ] Map top 10 target queries by intent (info / commercial / transactional)
- [ ] Note top 3 competitor page formats ranking for each
- [ ] Prioritize long-tail with clear conversion path (e.g. "no signup referral link 2026")

## Repo files to check

- `src/lib/organic-seo.ts`
- `index.html` JSON-LD mirror
- `public/robots.txt`, `public/sitemap.xml`
- `vercel.json` redirects/headers