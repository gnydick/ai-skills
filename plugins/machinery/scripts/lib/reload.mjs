// The delta /machinery:reload prints (#65). Kept out of the CLI so the ORDER that matters —
// every print issued before the manifest is touched — can be tested by handing in a writer
// that dies mid-print, which no amount of shell redirection makes reliable on Windows.
//
// The manifest is session-scoped by living in the session's own scratchpad directory. It is
// keyed on the path the caller hands over rather than on a session id: a skill-invoked script
// receives no hook payload, so there is no session id to read (ticket #65, design constraint).
// Stated rather than hidden: the first reload of a session is always a full dump, which is
// correct — a fresh session has seen nothing.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export const MANIFEST_NAME = 'machinery-reload.json';

// The one snake_case name this script's own lines carry, so every line it prints matches the
// declared proof-line format and survives the output filter (rules/tool-output.md § Proof lines
// and denominators).
export const TOOL = 'machinery_reload';

export const hashOf = (text) => crypto.createHash('sha256').update(text, 'utf8').digest('hex');

// A manifest that cannot be read is DATA, not this program's invariant failing: a truncated or
// hand-edited file makes every rule file count as changed, and the run says so on its output
// (rules/design-invariants.md § External input, § Telling the user what you dropped).
export function readManifest(manifestPath) {
  if (!manifestPath) return { hashes: {}, note: 'no session scratchpad given — nothing is remembered between runs, so this is a full dump' };
  if (!fs.existsSync(manifestPath)) return { hashes: {}, note: null };
  try {
    const doc = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    const hashes = doc && typeof doc === 'object' && doc.hashes && typeof doc.hashes === 'object' ? doc.hashes : null;
    if (!hashes) throw new Error('no hashes object');
    return { hashes, note: null };
  } catch (e) {
    return { hashes: {}, note: `manifest unreadable (${manifestPath}: ${e.message}) — every file counted as changed` };
  }
}

// Prior hashes are MERGED, not replaced: a run without `--project` must not make the session
// forget project rules it has already been shown, or `--project` would re-dump every time it
// is alternated. A key the run did not see keeps whatever the session already knew about it.
function writeManifest(manifestPath, prior, seen) {
  fs.mkdirSync(path.dirname(manifestPath), { recursive: true });
  fs.writeFileSync(manifestPath, JSON.stringify({ version: 1, hashes: { ...prior, ...seen } }, null, 2), 'utf8');
}

function collect(dirs) {
  const files = [], missing = [];
  for (const [label, dir] of dirs) {
    if (!fs.existsSync(dir)) { missing.push([label, dir]); continue; }
    for (const name of fs.readdirSync(dir).filter((x) => x.endsWith('.md')).sort()) {
      const text = fs.readFileSync(path.join(dir, name), 'utf8');
      files.push({ key: `${label}/${name}`, text, hash: hashOf(text) });
    }
  }
  return { files, missing };
}

// Returns { files, changed }. `write` is called once per chunk; it throwing aborts the run
// BEFORE the manifest is touched, which is the whole point of the ordering below — an aborted
// run must never mark files as seen.
export function reloadDelta({ dirs, manifestPath = null, all = false, write }) {
  const prior = readManifest(manifestPath);
  const { files, missing } = collect(dirs);
  const changed = files.filter((f) => all || prior.hashes[f.key] !== f.hash);

  for (const [label, dir] of missing) write(`===== ${label} ===== (missing: ${dir})\n`);
  for (const f of changed) write(`===== ${f.key} =====\n${f.text}\n`);
  if (prior.note) write(`${TOOL}: ${prior.note}\n`);
  write(`${TOOL}: ${files.length} files, ${changed.length} changed\n`);

  // Only now — every chunk above went out without throwing.
  if (manifestPath) writeManifest(manifestPath, prior.hashes, Object.fromEntries(files.map((f) => [f.key, f.hash])));
  return { files: files.length, changed: changed.length };
}
