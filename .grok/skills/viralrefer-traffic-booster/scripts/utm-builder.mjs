#!/usr/bin/env node
/**
 * Build tracked URLs for ViralRefer campaigns.
 * Usage: node .grok/skills/viralrefer-traffic-booster/scripts/utm-builder.mjs [source] [medium] [campaign]
 */
const base = 'https://www.viralrefer.app/';
const source = process.argv[2] || 'x';
const medium = process.argv[3] || 'social';
const campaign = process.argv[4] || 'traffic-booster-2026';
const content = process.argv[5] || '';

const params = new URLSearchParams({
  utm_source: source,
  utm_medium: medium,
  utm_campaign: campaign,
});
if (content) params.set('utm_content', content);

const url = `${base}?${params.toString()}`;
console.log(url);
console.log('\nCopy for posts:');
console.log(`Get your free ViralRefer link in 30 seconds → ${url}`);