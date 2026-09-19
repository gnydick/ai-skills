// Story: #132 § 11. The migration plan file: written by `migrate --plan`, filled by the AI,
// confirmed by the owner, read by `migrate --apply`. A file-writer exemption in
// test/gate-purity.test.mjs (it serialises to a FILE, never to the hook channel).
import fs from 'node:fs';

export function writePlan(file, plan) { fs.writeFileSync(file, JSON.stringify(plan, null, 2) + '\n', 'utf8'); }
export function readPlan(file) { return JSON.parse(fs.readFileSync(file, 'utf8')); }
