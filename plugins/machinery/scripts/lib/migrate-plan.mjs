// Story: #132 § 11. The migration plan file: written by `migrate --plan`, filled by the AI,
// confirmed by the owner, read by `migrate --apply`. A file-writer exemption in
// test/gate-purity.test.mjs (it serialises to a FILE, never to the hook channel).
import fs from 'node:fs';

export function writePlan(file, plan) { fs.writeFileSync(file, JSON.stringify(plan, null, 2) + '\n', 'utf8'); }

// The owner hand-edits this file, so every way it can come back wrong is named rather than thrown
// as a parser message with no context. The SHAPE is checked in planProblems, with the rest.
export function readPlan(file) {
  let text;
  try { text = fs.readFileSync(file, 'utf8'); } catch (e) { throw new Error(`plan ${file}: cannot be read — ${e.message}`); }
  try { return JSON.parse(text); } catch (e) { throw new Error(`plan ${file}: not valid JSON — ${e.message}`); }
}
