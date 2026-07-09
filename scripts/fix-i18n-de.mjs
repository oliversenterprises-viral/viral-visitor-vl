import { readFileSync, writeFileSync } from 'fs';

const p = 'src/lib/i18n/messages.ts';
let s = readFileSync(p, 'utf8');
const coachDe = 'Tippe auf Meinen Empfehlungslink holen, um zu starten.';

// Replace any funnel.coach value that mentions Empfehlungslink
s = s.replace(
  /'funnel\.coach':\s*'[^']*Empfehlungslink[^']*'/g,
  `'funnel.coach': '${coachDe}'`,
);
s = s.replace(
  /de\['funnel\.coach'\]\s*=\s*'[^']*';/g,
  `de['funnel.coach'] = '${coachDe}';`,
);

// Drop redundant reassignment lines if duplicate
const lines = s.split('\n').filter((line, i, arr) => {
  if (line.includes("de['funnel.coach']") && arr.slice(0, i).some((l) => l.includes("de['funnel.coach']"))) {
    return false;
  }
  return true;
});
s = lines.join('\n');

// Ensure MESSAGES de uses spread without bad override
s = s.replace(
  /de:\s*\{\s*\.\.\.de,\s*'funnel\.coach':\s*'[^']*'\s*\}/,
  'de',
);

writeFileSync(p, s);
console.log('fixed');
const m = [...s.matchAll(/'funnel\.coach':\s*'([^']+)'/g)].map((x) => x[1]);
console.log(m.filter((x) => /Empfehlung|tippe|Tippe/i.test(x)));
