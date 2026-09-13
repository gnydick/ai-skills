#!/usr/bin/env node
// Story: docs/superpowers/specs/2026-09-12-issue-tracking-config-design.md § Precedence (Ruling G) — the
// command-line entry the developer-friendliness skill runs, found through the session banner's
// "issue tracking command:" line. Subcommands are keys of COMMANDS, quoted, because the repository's
// copy check (scripts/issue-tracking-copy.mjs) reads them from this source.
//
// Exit codes: 0 done; 1 refused (nothing written); 2 cannot run (nothing written, no verdict printed —
// a check that could not run never reads as one that ran).
import path from 'node:path';
import { projectRoot } from './lib/root.mjs';
import { globalIssueTracking, projectIssueTracking } from './lib/config.mjs';
import { UNANSWERED, NONE } from './lib/layout.mjs';
import { decide, readIfPresent } from './lib/issue-tracking.mjs';

const VERDICT_ASK = 'issue_tracking: ask';
const VERDICT_DO_NOT_ASK = 'issue_tracking: do not ask';

class Refused extends Error {}
class CannotRun extends Error {}

const argv = process.argv.slice(2);
const opt = (flag) => { const i = argv.indexOf(flag); return i >= 0 ? (argv[i + 1] ?? '') : null; };

function resolveRoot() {
  const from = opt('--root') ?? process.cwd();
  try { return projectRoot(path.resolve(from)); }
  catch (e) { throw new CannotRun(`cannot resolve the project root from ${from}: ${e.message}`); }
}

// Describes a file's contents for the report. The decision itself is decide()'s alone.
function describe(contents) {
  if (contents === null) return 'absent';
  const text = contents.trim();
  if (text === '') return `empty, read as ${UNANSWERED}`;
  if (text === UNANSWERED || text === NONE) return text;
  return 'carries an answer';
}

function runDecide() {
  const root = resolveRoot();
  const files = { project: projectIssueTracking(root), global: globalIssueTracking() };
  const contents = { project: readIfPresent(files.project), global: readIfPresent(files.global) };
  const { ask, prefill } = decide(contents);
  const out = [
    `${ask ? VERDICT_ASK : VERDICT_DO_NOT_ASK} (read 2 of 2 file locations)`,
    `issue_tracking: project file ${files.project}: ${describe(contents.project)}`,
    `issue_tracking: global file ${files.global}: ${describe(contents.global)}`,
  ];
  if (prefill === null) out.push('issue_tracking: pre-fill: nothing to offer');
  else {
    const lines = prefill.split(/\r?\n/);
    out.push(`issue_tracking: pre-fill (${lines.length} line(s)):`, ...lines.map((l) => `| ${l}`));
  }
  process.stdout.write(`${out.join('\n')}\n`);
  return 0;
}

const COMMANDS = { 'decide': runDecide };
const USAGE = ['issue-tracking.mjs decide [--root <dir>]'];

function main() {
  const run = COMMANDS[argv[0]];
  if (!run) { process.stderr.write(`usage: ${USAGE.join('\n       ')}\n`); return 2; }
  return run();
}

try { process.exitCode = main(); }
catch (e) {
  if (e instanceof Refused) { process.stderr.write(`issue_tracking: refused: ${e.message}\n`); process.exitCode = 1; }
  else { process.stderr.write(`issue_tracking: CANNOT RUN: ${e.message}\n`); process.exitCode = 2; }
}
