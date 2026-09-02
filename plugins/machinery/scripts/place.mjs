#!/usr/bin/env node
// The only writer of rule bullets in scripts (spec I34). Writes only under an existing-or-created ## heading (spec I33).
import fs from 'node:fs';
import path from 'node:path';
const argv = process.argv.slice(2);
const opt = (k) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : null; };
const file = opt('--file'), section = opt('--section'), text = opt('--text');
if (!file || !section || !text) { process.stderr.write('usage: place --file <rules/x.md> --section "<Heading>" --text "<rule>"\n'); process.exit(2); }
const abs = path.resolve(file);
if (!/[\\/]rules[\\/][^\\/]+\.md$/.test(abs)) { process.stderr.write(`refusing to write outside a rules directory: ${abs}\n`); process.exit(1); }
let lines = fs.existsSync(abs) ? fs.readFileSync(abs, 'utf8').replace(/\s+$/, '').split(/\r?\n/) : [`# ${path.basename(abs, '.md')}`];
const at = lines.findIndex((l) => l.trim() === `## ${section}`);
const bullet = `- ${text.trim()}`;
if (at < 0) lines.push('', `## ${section}`, '', bullet);
else {
  let end = at + 1;
  while (end < lines.length && !/^## /.test(lines[end])) end++;
  while (end > at + 1 && !lines[end - 1].trim()) end--;
  lines.splice(end, 0, bullet);
}
fs.writeFileSync(abs, lines.join('\n') + '\n', 'utf8');
process.stdout.write(`${path.basename(abs)} § ${section}: + ${bullet}\n`);
