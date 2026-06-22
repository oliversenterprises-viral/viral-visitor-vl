/**
 * Mechanical verification manifest for premium audit goal.
 * Usage: SCRATCH=... node scripts/verification-manifest.mjs
 */
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

const SCRATCH = process.env.SCRATCH || '.';
const root = resolve(import.meta.dirname, '..');

const SCOPE_PREFIXES = [
  'src/',
  'tests/',
  'supabase/functions/',
  'index.html',
  'vite.config.ts',
  'vercel.json',
  'package.json',
  'vitest.config.ts',
  'playwright.config.ts',
  '.gitignore',
  'scripts/verification-manifest.mjs',
];

function inScope(file) {
  return SCOPE_PREFIXES.some((p) => file === p || file.startsWith(p));
}

function countExpectedTests(src) {
  const eachCases = [...src.matchAll(/it\.each\s*\(\s*\[([\s\S]*?)\]\s*\)/g)].reduce(
    (sum, m) => sum + (m[1].match(/\[[^\]]+\]/g) || []).length,
    0,
  );
  const plainIt = (src.match(/\bit\s*\(/g) || []).length;
  return plainIt + eachCases;
}

function countItBlocks(filePath) {
  const src = readFileSync(filePath, 'utf8');
  return { it: countExpectedTests(src), each: (src.match(/\bit\.each\s*\(/g) || []).length };
}

function walkUnitTests(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walkUnitTests(p));
    else if (name.endsWith('.test.ts')) out.push(p);
  }
  return out;
}

let changedFiles = [];
try {
  changedFiles = execSync('git diff origin/main --name-only', { cwd: root, encoding: 'utf8' })
    .trim()
    .split(/\r?\n/)
    .filter(Boolean);
} catch {
  changedFiles = execSync('git diff HEAD~5 --name-only', { cwd: root, encoding: 'utf8' })
    .trim()
    .split(/\r?\n/)
    .filter(Boolean);
}

const scopedChanged = changedFiles.filter(inScope);

let unitLog = '';
try {
  unitLog = execSync('npm run test:unit', { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
} catch (err) {
  unitLog = (err.stdout || '') + (err.stderr || '');
}

const unitTestCounts = {};
for (const line of unitLog.split(/\r?\n/)) {
  const m = line.match(/tests\/unit\/([^\s]+)\s+\((\d+) tests\)/);
  if (m) unitTestCounts[m[1]] = Number(m[2]);
}

const sourceCounts = {};
for (const file of walkUnitTests(join(root, 'tests/unit'))) {
  const rel = file.replace(root + '\\', '').replace(root + '/', '').replace(/\\/g, '/');
  const relShort = rel.replace('tests/unit/', '');
  sourceCounts[relShort] = countItBlocks(file);
}

const manifest = {
  generatedAt: new Date().toISOString(),
  gitHead: execSync('git rev-parse HEAD', { cwd: root, encoding: 'utf8' }).trim(),
  scopedChangedFiles: scopedChanged,
  scopedChangedCount: scopedChanged.length,
  unitTestsTotal: Number((unitLog.match(/Tests\s+(\d+) passed/) || [])[1] || 0),
  unitTestFileCountsFromRun: unitTestCounts,
  unitTestFileCountsFromSource: sourceCounts,
  countMismatches: Object.keys({ ...unitTestCounts, ...sourceCounts })
    .filter((f) => unitTestCounts[f] !== undefined && sourceCounts[f]?.it !== unitTestCounts[f])
    .map((f) => ({ file: f, run: unitTestCounts[f], sourceItBlocks: sourceCounts[f]?.it })),
};

const outPath = join(SCRATCH, 'verification-manifest.json');
writeFileSync(outPath, JSON.stringify(manifest, null, 2));
console.log(JSON.stringify(manifest, null, 2));