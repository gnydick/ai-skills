#!/usr/bin/env node
// Regenerates a generated index. Two kinds since #81 — the rules index (RULES_INDEX.md) and the
// spec index (SPEC_INDEX.md) — chosen by --kind and never inferred from the output file's name,
// because inferring it would make a typo in --out silently pick the other generator.
import fs from 'node:fs';
import path from 'node:path';
import { generateIndex, generateSpecIndex, readIndex } from './lib/index.mjs';
const argv = process.argv.slice(2);
const opt = (k) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : null; };
const rules = opt('--rules'), out = opt('--out'), check = argv.includes('--check');
const kind = opt('--kind') ?? 'rules';
if (!rules || !out || !['rules', 'specs'].includes(kind)) { process.stderr.write('usage: reindex [--kind rules|specs] --rules <dir> --out <file> [--check]\n'); process.exit(2); }
const fresh = kind === 'specs' ? generateSpecIndex(rules) : generateIndex(rules);
if (check) {
  const cur = readIndex(out);
  if (cur === fresh) process.exit(0);
  process.stdout.write(`${kind === 'specs' ? 'spec_check' : 'register_check'}: index is stale — ${out} differs from a fresh regeneration; run /machinery:reindex\n`);
  process.exit(1);
}
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, fresh, 'utf8');
