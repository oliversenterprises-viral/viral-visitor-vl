import fs from 'fs';
const p = 'src/lib/i18n/messages.ts';
const lines = fs.readFileSync(p, 'utf8').split(/\n/);
const out = [];
let skip = false;
for (const line of lines) {
  if (/^\s*'deadline\./.test(line)) {
    skip = true;
    if (/',\s*$/.test(line) || /",\s*$/.test(line)) skip = false;
    continue;
  }
  if (skip) {
    if (/',\s*$/.test(line) || /",\s*$/.test(line)) skip = false;
    continue;
  }
  out.push(line);
}
fs.writeFileSync(p, out.join('\n'));
const text = out.join('\n');
console.log('deadline.badge count', (text.match(/deadline\.badge/g) || []).length);
console.log('en still has pre_rule', text.includes("'deadline.pre_rule'"));
