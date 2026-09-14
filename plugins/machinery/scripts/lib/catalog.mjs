// The universal tool catalog: which off-the-shelf tool an invocation is, the pattern matching the
// line that is that tool's answer, and the finite list of documented quiet flags to suggest.
// Story: specs/2026-09-04-tool-assimilation-design.md ("Declared outcome patterns, per off-the-shelf
// tool" and "The ledger"). Loading and matching only — deciding what to keep is filter.mjs's job.
//
// Hand-written data may use regex; a machine-derived entry may not. That restriction is enforced
// HERE, at load, by entryProblem() below, and it keys on an entry's `learned` MARK rather than on
// which half of the catalog it came from: a learned entry carrying a regex `outcome` is dropped and
// named wherever it sits, while a hand-written entry in the PROJECT half may still carry one.
// lib/graduate.mjs calls the same entryProblem() before it writes, so the writer and the reader
// cannot disagree about what a usable entry is: one derivation, read by both.
import fs from 'node:fs';
import path from 'node:path';
import { pluginRoot } from './config.mjs';
import { tokens } from './quotes.mjs';

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
export function entryProblem(entry) {
  if (!isObject(entry)) return 'the entry is not a JSON object';
  const m = entry.match;
  if (!isObject(m)) return '"match" is missing or not an object';
  if (m.type !== 'prefix' && m.type !== 'regex') return `"match.type" is '${String(m.type)}', expected "prefix" or "regex"`;
  if (typeof m.value !== 'string' || m.value === '') return '"match.value" is missing or not a non-empty string';
  if (m.type === 'regex') { try { new RegExp(m.value); } catch (e) { return `"match.value" is not a valid regex: ${e.message}`; } }
  // Design verification 9: a machine-derived pattern is prefix or literal, never regex. The writer
  // (lib/graduate.mjs) can only produce the object form; this is the check over the record for
  // anything that arrived another way — a hand edit, an older file. A learned entry carrying a
  // regex string is dropped and named, and the tool falls back to the generic contract.
  if (isObject(entry.learned)) {
    const o = entry.outcome;
    if (!isObject(o) || (o.type !== 'prefix' && o.type !== 'literal') || typeof o.value !== 'string' || o.value === '')
      return 'a "learned" entry must carry an outcome of the form { type: prefix | literal, value }: a machine-derived pattern is never a regex (design verification 9)';
  }
  return null;
}

// The universal table, with the project's own entries laid over it. A project wins on an id
// collision by design: the local record is the one that has actually watched the tool run here.
// A malformed entry is dropped and the rest kept — one bad line in a hand-edited overlay must not
// switch the whole catalog off — and the drops come back AS PART OF THE RESULT, never as a side
// channel a caller can lose — a separate optional output lets a caller drop the warning unnoticed.
// A malformed project override leaves the universal entry it failed to replace in place.
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

// The one compiler of an entry's `outcome` into the thing select() tests lines with. Two forms, one
// per half of the design ("Match techniques, and which are allowed where"): a STRING is a regex — the
// human-reviewed universal form, a person has read it and a fixture exercises it — and an OBJECT
// { type: prefix | literal, value } is the machine-derived form, which can neither over-match
// silently nor backtrack. A prefix or literal is never compiled to a regex: it is tested by
// startsWith or equality, so there is no escaping step to get wrong. Returns undefined when the entry
// declares no outcome; throws, with a reason, on any other shape — the caller decides what a
// malformed outcome costs (the runner warns and falls back to the generic filter).
export function outcomeMatcher(entry) {
  const o = entry?.outcome;
  if (o === undefined) return undefined;
  if (typeof o === 'string') {
    if (o === '') throw new Error('the outcome pattern is empty');
    return new RegExp(o);
  }
  if (isObject(o) && typeof o.value === 'string' && o.value !== '') {
    if (o.type === 'prefix') return { type: 'prefix', value: o.value, test: (line) => line.startsWith(o.value) };
    if (o.type === 'literal') return { type: 'literal', value: o.value, test: (line) => line === o.value };
  }
  throw new Error('the outcome is neither a regex string nor an object of the form { type: prefix | literal, value }');
}

// A learned entry is one the training loop wrote (lib/graduate.mjs), marked by its `learned` field.
// The mark is what drift acts on and what a later graduation may overwrite; an entry without it was
// written by a person and is never trained over.
export const isLearned = (entry) => isObject(entry) && isObject(entry.learned);
