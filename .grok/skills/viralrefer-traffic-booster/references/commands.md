# Repo commands — viral-visitor-vl

```powershell
# Stats & health (read-only)
node scripts/dba-stats-snapshot.mjs
node scripts/dry-run-autopilot-prod.mjs

# Referral marketing automation (post queue)
node scripts/generate-growth-post-queue.mjs
node scripts/post-growth-queue.mjs --list
node scripts/post-growth-queue.mjs --approve <id>
node scripts/post-growth-queue.mjs --post-next telegram
node scripts/post-growth-queue.mjs --post-next x --assist
node scripts/post-growth-queue.mjs --export-manual reddit

# Optimizer autopilot
node scripts/run-optimizer-autopilot.mjs --dry-run
node scripts/run-optimizer-autopilot.mjs

# UTM campaign URLs
node .grok/skills/viralrefer-traffic-booster/scripts/utm-builder.mjs x social week1-thread

# Social graphics
node scripts/render-x-leaderboard-graphic.mjs
node scripts/render-fb-leaderboard-graphic.mjs

# GSC (browser automation)
node scripts/setup-google-search-console.mjs

# Production deploy (15/15 smoke gate)
npm run deploy:prod
```