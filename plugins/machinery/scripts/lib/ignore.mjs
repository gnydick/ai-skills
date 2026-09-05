// One writer of a .gitignore entry, shared by the two sites that need the observation record
// ignored: install.mjs (Task 9, where this logic was born) and observations.mjs, which is the site
// that actually CREATES the file and so the site that owes the entry (final review I6: the record
// appeared in every project the moment the plugin updated, and only an install ever ignored it).
// Moved rather than copied — a second spelling of the CRLF rule below would drift.
import fs from 'node:fs';
import path from 'node:path';

// The one spelling of the path, as it appears in .gitignore. Ruling 2026-09-05 (specs:
// tool-assimilation, "The ledger"): per-machine measurement, never tracked.
export const OBSERVATIONS_IGNORE = '.claude/machinery/observations.json';

// Appends `line` to <root>/.gitignore unless it is already there. Returns true when it wrote.
// Split on either line ending and trim, so a CRLF .gitignore does not gain a second copy per run.
// The project's own .gitignore is the authority, not `git check-ignore`: a global exclude on this
// machine would satisfy check-ignore and leave every other clone tracking the file.
export function ensureIgnored(root, line) {
  const gitignore = path.join(root, '.gitignore');
  const existing = fs.existsSync(gitignore) ? fs.readFileSync(gitignore, 'utf8') : '';
  if (existing.split(/\r?\n/).map((l) => l.trim()).includes(line)) return false;
  fs.writeFileSync(gitignore, existing + (existing && !/\r?\n$/.test(existing) ? '\n' : '') + line + '\n');
  return true;
}
