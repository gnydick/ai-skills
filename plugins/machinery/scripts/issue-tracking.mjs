#!/usr/bin/env node
// Story: docs/superpowers/specs/2026-09-12-issue-tracking-config-design.md § Precedence (Ruling G) — the
// command-line entry the developer-friendliness skill runs, found through the session banner's
// "issue tracking command:" line. Subcommands are keys of COMMANDS, quoted, because the repository's
// copy check (scripts/issue-tracking-copy.mjs) reads them from this source.
//
// Exit codes: 0 done; 1 refused (nothing written); 2 cannot run (nothing written, no verdict printed —
// a check that could not run never reads as one that ran).
import fs from 'node:fs';
import path from 'node:path';
import { projectRoot } from './lib/root.mjs';
import { globalIssueTracking, projectIssueTracking, universalSource, projectInbox } from './lib/config.mjs';
import { UNANSWERED, NONE } from './lib/layout.mjs';
import { appendEntry, formatEntry, newStamp, parseInbox } from './lib/inbox.mjs';
import { decide, readIfPresent, normalizeAnswer, PROJECT_ENTRY_KIND, entryText, findRecorded, pendingIssueTracking } from './lib/issue-tracking.mjs';

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

function requireAnswer() {
  const raw = opt('--answer');
  if (raw === null) throw new Refused('--answer "<answer>" is required');
  try { return normalizeAnswer(raw); } catch (e) { throw new Refused(e.message); }
}

const real = (p) => { try { return fs.realpathSync.native(p); } catch { return path.resolve(p); } };
const inside = (child, parent) => { const rel = path.relative(parent, child); return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel)); };

// Ruling A, made testable (the plan's Decision 1): the answer for every project on this machine is
// written straight into the global file — no inbox entry, no intake, no commit, and never a project
// file (Ruling D; this command resolves no project at all). The one thing it checks first is that the
// file would not land under universalSource(), which ships to everyone who installs machinery.
function runRecordGlobal() {
  const answer = requireAnswer();
  const file = globalIssueTracking();
  const source = universalSource();
  if (inside(real(path.dirname(file)), real(source))) {
    throw new Refused(`${file} is under the plugin source ${source}, which ships to everyone who installs machinery; nothing written`);
  }
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${answer}\n`, 'utf8');
  process.stdout.write(`issue_tracking: wrote 1 of 1 file: ${file}\n`
    + 'issue_tracking: nothing else was written — no inbox entry, no intake, no commit, and no project file\n');
  return 0;
}

// The one read of the session id: resolved once here, everything else reads the result.
function resolveSession() {
  const value = opt('--session') || process.env.CLAUDE_CODE_SESSION_ID || '';
  if (!value) throw new CannotRun('no session id: looked at --session and $CLAUDE_CODE_SESSION_ID, and found neither');
  if (/\s/.test(value)) throw new Refused(`the session id "${value}" contains whitespace, which an inbox heading cannot carry`);
  return value;
}

// Ruling F, made testable (the plan's Decision 1): the assistant records the project answer as one inbox
// entry, which intake then files. Everything that can be checked before writing is checked before
// writing, because the inbox is append-only; the entry is then read back through the parser, because
// the parser skips an unrecognised heading without a word.
function runRecordProject() {
  const answer = requireAnswer();
  const session = resolveSession();
  const root = resolveRoot();
  const inbox = projectInbox(root);
  const before = readIfPresent(inbox) ?? '';
  let existing;
  try { existing = parseInbox(before); }
  catch (e) { throw new CannotRun(`${inbox} does not parse, so nothing was written: ${e.message}`); }
  const already = pendingIssueTracking(before);
  if (already.length) throw new Refused(`an issue-tracking answer is already recorded and pending in ${inbox} at ${already[0].stamp}; file that entry with rule intake rather than recording a second`);
  const stamp = newStamp();
  if (existing.some((e) => e.stamp === stamp)) throw new CannotRun(`an entry stamped ${stamp} is already in ${inbox}, and intake addresses entries by stamp; run the command again in a second`);
  const text = entryText(answer);
  const expected = { stamp, session, text };
  let wouldRead = 0;
  try { wouldRead = findRecorded(before + formatEntry({ stamp, marker: PROJECT_ENTRY_KIND, text, session }), expected).length; }
  catch { wouldRead = 0; }
  if (wouldRead !== 1) throw new Refused(`this answer would not read back from the inbox as exactly one entry (it would read as ${wouldRead}): a line in it looks like inbox structure, so nothing was written`);
  appendEntry(inbox, { marker: PROJECT_ENTRY_KIND, text, session, stamp });
  const found = findRecorded(fs.readFileSync(inbox, 'utf8'), expected).length;
  if (found !== 1) {
    process.stderr.write(`issue_tracking: FAILED: wrote an entry stamped ${stamp} to ${inbox}, and the inbox parser reads back ${found} matching entries, not 1. The inbox is append-only: dismiss that entry with disposition.mjs --dismissed, then record again.\n`);
    return 1;
  }
  process.stdout.write(`issue_tracking: recorded 1 of 1 entry: PENDING ${stamp} ${PROJECT_ENTRY_KIND} ${session} in ${inbox}\n`
    + `issue_tracking: next: file entry ${stamp} with rule intake, from a root session\n`);
  return 0;
}

const COMMANDS = { 'decide': runDecide, 'record-global': runRecordGlobal, 'record-project': runRecordProject };
const USAGE = [
  'issue-tracking.mjs decide [--root <dir>]',
  'issue-tracking.mjs record-global --answer "<answer>"',
  'issue-tracking.mjs record-project --answer "<answer>" [--session <id>] [--root <dir>]',
];

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
