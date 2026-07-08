#!/usr/bin/env node
/**
 * Read-only production DBA inventory (policies, grants, table list).
 *   npm run dba:inventory
 *   node scripts/dba-inventory.mjs --json
 */
import { assessInventorySecurity, fetchDbaInventory } from './dba-inventory-core.mjs';

const jsonOut = process.argv.includes('--json');
const inventory = fetchDbaInventory();
const issues = assessInventorySecurity(inventory);

if (jsonOut) {
  console.log(JSON.stringify({ inventory, securityIssues: issues }, null, 2));
} else {
  console.log(JSON.stringify(inventory, null, 2));
  if (issues.length) {
    console.error('\nSecurity issues:');
    for (const issue of issues) console.error(`  - ${issue}`);
    process.exit(1);
  }
}