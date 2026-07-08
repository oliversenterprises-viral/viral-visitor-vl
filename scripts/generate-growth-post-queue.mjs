#!/usr/bin/env node
/**
 * Generate 7-day referral marketing post queue from live stats.
 *   node scripts/generate-growth-post-queue.mjs
 *   node scripts/generate-growth-post-queue.mjs --merge   # keep posted items, refresh pending
 */
import {
  QUEUE_FILE,
  buildWeekQueue,
  fetchGrowthStats,
  readQueue,
  writeQueue,
} from './growth-post-queue-helpers.mjs';

const merge = process.argv.includes('--merge');

console.log('=== Generate Growth Post Queue ===\n');

const stats = await fetchGrowthStats();
console.log(
  `Stats: ${stats.landings7d} landings · ${stats.getLink7d} get-link (${stats.getLinkRatePct}%) · #1 ${stats.leaderCount} referrals\n`,
);

const fresh = buildWeekQueue(stats);

if (merge) {
  const prev = readQueue();
  if (prev?.items?.length) {
    const statusById = new Map(
      prev.items
        .filter((i) => i.status === 'posted' || i.status === 'skipped' || i.status === 'approved')
        .map((i) => [i.id, i]),
    );
    let preserved = 0;
    fresh.items = fresh.items.map((item) => {
      const prevItem = statusById.get(item.id);
      if (!prevItem) return item;
      preserved += 1;
      return {
        ...item,
        status: prevItem.status,
        postedAt: prevItem.postedAt,
        approvedAt: prevItem.approvedAt,
        result: prevItem.result,
      };
    });
    console.log(`Merged: preserved status on ${preserved} items.\n`);
  }
}

writeQueue(fresh);

console.log(`✓ Wrote ${fresh.items.length} items → ${QUEUE_FILE}\n`);
for (const item of fresh.items) {
  console.log(`  [${item.status}] ${item.scheduledFor?.slice(0, 10)} ${item.platform.padEnd(8)} ${item.mode.padEnd(6)} ${item.id}`);
}
console.log('\nNext: node scripts/post-growth-queue.mjs --list');
console.log('      node scripts/post-growth-queue.mjs --approve <id>');
console.log('      node scripts/post-growth-queue.mjs --post-next telegram');
console.log('      node scripts/post-growth-queue.mjs --post-next x --assist');