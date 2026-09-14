#!/usr/bin/env node
// The only writer of rule bullets in scripts (spec I34). Writes only under an existing-or-created ## heading (spec I33),
// or at the end of a file whose only heading is a title equal to the section (core.md, recalibration 1).
import fs from 'node:fs';
import path from 'node:path';
const argv = process.argv.slice(2);
const opt = (k) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : null; };
const file = opt('--file'), section = opt('--section'), text = opt('--text');
if (!file || !section || !text) { process.stderr.write('usage: place --file <file.md> --section "<Heading>" --text "<rule>"\n'); process.exit(2); }
const abs = path.resolve(file);
// The three homes a rule can have (recalibration decisions 1, 2): a project rule file, a bucket
// skill's source, or the always-on core. A bare rules/ directory is no longer one of them.
const ALLOWED = [/[\\/]\.claude[\\/]rules[\\/][^\\/]+\.md$/, /[\\/]claude-code[\\/]machinery[\\/][a-z0-9-]+[\\/]SKILL\.md$/, /[\\/]plugins[\\/]machinery[\\/]core\.md$/];
if (!ALLOWED.some((re) => re.test(abs))) {
  process.stderr.write(`refusing to write ${abs}: a rule goes in .claude/rules/<file>.md, claude-code/machinery/<kind>/SKILL.md or plugins/machinery/core.md\n`);
  process.exit(1);
}
let lines = fs.existsSync(abs) ? fs.readFileSync(abs, 'utf8').replace(/\s+$/, '').split(/\r?\n/) : [`# ${path.basename(abs, '.md')}`];
const at = lines.findIndex((l) => l.trim() === `## ${section}`);
const bullet = `- ${text.trim()}`;
const titleOnly = !lines.some((l) => /^## /.test(l)) && lines.some((l) => l.trim() === `# ${section}`);
if (at < 0 && titleOnly) lines.push(bullet);
else if (at < 0) lines.push('', `## ${section}`, '', bullet);
else {
  let end = at + 1;
  while (end < lines.length && !/^## /.test(lines[end])) end++;
  while (end > at + 1 && !lines[end - 1].trim()) end--;
  lines.splice(end, 0, bullet);
}
fs.writeFileSync(abs, lines.join('\n') + '\n', 'utf8');
process.stdout.write(`${path.basename(abs)} § ${section}: + ${bullet}\n`);
