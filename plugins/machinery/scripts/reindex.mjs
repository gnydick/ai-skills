#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { generateIndex, readIndex } from './lib/index.mjs';
const argv = process.argv.slice(2);
const opt = (k) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : null; };
const rules = opt('--rules'), out = opt('--out'), check = argv.includes('--check');
if (!rules || !out) { process.stderr.write('usage: reindex --rules <dir> --out <file> [--check]\n'); process.exit(2); }
const fresh = generateIndex(rules);
if (check) {
  const cur = readIndex(out);
  if (cur === fresh) process.exit(0);
  process.stdout.write(`register_check: index is stale — ${out} differs from a fresh regeneration; run /machinery:reindex\n`);
  process.exit(1);
}
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, fresh, 'utf8');
