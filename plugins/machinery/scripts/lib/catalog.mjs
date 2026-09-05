// The universal tool catalog: which off-the-shelf tool an invocation is, the pattern matching the
// line that is that tool's answer, and the finite list of documented quiet flags to suggest.
// Story: specs/2026-09-04-tool-assimilation-design.md ("Declared outcome patterns, per off-the-shelf
// tool" and "The ledger"). Loading and matching only — deciding what to keep is filter.mjs's job.
//
// The universal half is human-reviewed data and may use regex; the project half is machine-derived
// and the design restricts it to prefix/literal. Nothing here enforces that split — the project
// record's own writer does — so this file reads both the same way.
import fs from 'node:fs';
import path from 'node:path';
import { pluginRoot } from './config.mjs';

const isObject = (v) => !!v && typeof v === 'object' && !Array.isArray(v);

// A file that is missing, unparsable, or not a JSON object at the top is external input, not a
// broken invariant: it reads as an empty table.
function readTable(file) {
  try { const v = JSON.parse(fs.readFileSync(file, 'utf8')); return isObject(v) ? v : {}; } catch { return {}; }
}

// Why an entry cannot be used, or null. `match` is the one field every reader dereferences —
// matchTool() destructures it — so it is checked HERE, once, at the source (final review I2): a
// project entry with no `match` used to throw out of the hook, which swallowed it, and every command
// in that project silently lost assimilation. `outcome` is deliberately not checked here: the
// runner compiles it at its own site and warns there, because a bad answer pattern still leaves a
// matchable tool, whereas a bad `match` leaves nothing.
function entryProblem(entry) {
  if (!isObject(entry)) return 'the entry is not a JSON object';
  const m = entry.match;
  if (!isObject(m)) return '"match" is missing or not an object';
  if (m.type !== 'prefix' && m.type !== 'regex') return `"match.type" is '${String(m.type)}', expected "prefix" or "regex"`;
  if (typeof m.value !== 'string' || m.value === '') return '"match.value" is missing or not a non-empty string';
  if (m.type === 'regex') { try { new RegExp(m.value); } catch (e) { return `"match.value" is not a valid regex: ${e.message}`; } }
  return null;
}

// The universal table, with the project's own entries laid over it. A project wins on an id
// collision by design: the local record is the one that has actually watched the tool run here.
// A malformed entry is dropped and the rest kept — one bad line in a hand-edited overlay must not
// switch the whole catalog off — and the drops come back AS PART OF THE RESULT, never as a side
// channel a caller can lose (rules/design-invariants.md § What a diagnostic and a measurement may
// claim). A malformed project override leaves the universal entry it failed to replace in place.
export function loadCatalogReport(root) {
  const sources = [
    ['universal', path.join(pluginRoot(), 'data', 'tool-catalog.json')],
    ['project', path.join(root, '.claude', 'machinery', 'tool-catalog.json')],
  ];
  const catalog = {}, dropped = [];
  for (const [source, file] of sources) {
    for (const [id, entry] of Object.entries(readTable(file))) {
      const problem = entryProblem(entry);
      if (problem) dropped.push({ id, source, file, problem }); else catalog[id] = entry;
    }
  }
  return { catalog, dropped };
}

// The command-line face of loadCatalogReport(): says on stderr what it dropped, one line per entry
// naming the id, the file and the reason, and hands back the usable table. Both CLI callers — the
// hook and the runner — want exactly this; a library caller that wants the drops as data takes the
// report instead.
export function loadCatalog(root) {
  const { catalog, dropped } = loadCatalogReport(root);
  for (const d of dropped) process.stderr.write(`tool catalog: skipping '${d.id}' (${d.source} catalog, ${d.file}): ${d.problem}\n`);
  return catalog;
}

// The tool id this command invokes, or null. First entry wins, so catalog order is significant.
export function matchTool(command, catalog) {
  for (const [id, entry] of Object.entries(catalog)) {
    const { type, value } = entry.match;
    if (type === 'prefix' && command.trim().startsWith(value)) return id;
    if (type === 'regex' && new RegExp(value).test(command)) return id;
  }
  return null;
}

// The command's argv, as the shell would see it, near enough: whitespace-split, with a single- or
// double-quoted span kept as one token and its quotes stripped. Good enough to tell an argument
// from a flag, which is all the caller below needs; it is not a shell parser and does not try to be.
function tokens(command) {
  const out = [];
  const re = /"([^"]*)"|'([^']*)'|(\S+)/g;
  for (const m of command.matchAll(re)) out.push(m[1] ?? m[2] ?? m[3]);
  return out;
}

// The first candidate flag already present in the command, or null — the caller uses this to tell
// "never tried" from "tried, and the output is still noisy". A candidate matches only as a whole
// argv token, never as a substring of one (final review I3: `-q` was found inside
// `tests/api-quota/` and `--quiet` inside a commit message, and a ledger verdict was written for a
// flag that was never applied). A candidate that is itself a parameter SET — the spec's
// `-q --no-fail-fast` — matches when every one of its tokens is present.
export function matchedCandidate(command, candidates) {
  const argv = new Set(tokens(command));
  return candidates.find((c) => c.split(/\s+/).every((flag) => argv.has(flag))) ?? null;
}
