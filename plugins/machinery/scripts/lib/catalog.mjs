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

function readJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
}

// The universal table, with the project's own entries laid over it. A project wins on an id
// collision by design: the local record is the one that has actually watched the tool run here.
export function loadCatalog(root) {
  const universal = readJson(path.join(pluginRoot(), 'data', 'tool-catalog.json'), {});
  const project = readJson(path.join(root, '.claude', 'machinery', 'tool-catalog.json'), {});
  return { ...universal, ...project };
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
// "never tried" from "tried, and the output is still noisy".
export function matchedCandidate(command, candidates) {
  return candidates.find((c) => command.includes(c)) ?? null;
}
