// plugins/machinery/test/observe-every-command-e2e.test.mjs
//
// #160, end to end: a `> file` command and a `| filter` command are observed like any other.
//
// Owner, 2026-09-21, verbatim: "it is redirected into a file, but i don't care to assume if
// something outputs or not. we run commands, observe them, then learn how to wrap them"; asked
// about the pipe exemption the same day, verbatim: "cover pipes too". classify() used to answer
// both shapes from syntax alone — 'redirected' for a `> file` with no `2>&1`, 'piped' for a pipe
// into a POSIX filter — and the hook leaves a command of either kind alone, so it never ran under
// the runner, left no record in observations.json, and the training loop never saw it.
//
// lib-classify.test.mjs asserts the kinds. This file asserts the consequence the ticket is
// actually about: the whole path — PreToolUse hook, the cmdfile it writes, the runner it names,
// the record the runner saves — carries both shapes to a record now.
//
// The line counts are the point of each case and neither is copied from a run. The redirect sends
// every line of the fixture's output to a file, so the runner sees NONE of it: a 0-line entry, and
// `noisy: false` is a true observation — nothing reached the session's context (owner, same day).
// The `| tail -5` fixture prints 50 lines into a filter that passes 5, so the runner sees exactly
// what the trailing stage let through: a 5-line entry.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { runScript, PLUGIN } from './helpers/run.mjs'; // imports ./env.mjs first — GIT_* is scrubbed (spec I41)

const bash = fs.existsSync('C:/Program Files/Git/bin/bash.exe') || process.platform !== 'win32';
const repo = (prefix) => { const d = fs.mkdtempSync(path.join(os.tmpdir(), prefix)); execFileSync('git', ['init', '-q'], { cwd: d }); return fs.realpathSync.native(d); };
const fixture = (command) => {
  const p = JSON.parse(fs.readFileSync(path.join(PLUGIN, 'test/fixtures/payloads/PreToolUse-Bash.json'), 'utf8'));
  p.tool_input = { ...p.tool_input, command, description: 'd' };
  return JSON.stringify(p);
};
const hookOut = (stdout) => JSON.parse(stdout).hookSpecificOutput;
const OBS = (root) => path.join(root, '.claude', 'machinery', 'observations.json');
const RUNNER = /^node "([^"]*quiet-run\.mjs)" --shell bash --mode (\w+) "([^"]+)"$/;

// Prints `n` lines on stdout and nothing else.
const prints = (n) => `node -e "for(let i=0;i<${n};i++)console.log('line '+i)"`;

// The hook, then the runner the hook named, in one fixture repository — the emitted command IS
// `node "<runner>" --shell bash --mode <mode> "<cmdfile>"`, so running it as that process is
// running what the shell would have run, with the cmdfile the hook itself wrote.
function hookThenRun(root, command) {
  const h = runScript('scripts/quiet.mjs', { cwd: root, stdin: fixture(command) });
  assert.equal(h.code, 0, `the hook failed on ${JSON.stringify(command)}: ${h.stderr}`);
  if (h.stdout === '') return { wrapped: false, mode: null };
  const emitted = hookOut(h.stdout).updatedInput.command;
  const m = emitted.match(RUNNER);
  assert.ok(m, `the hook emitted something other than one runner invocation: ${emitted}`);
  const [, runner, mode, cmdfile] = m;
  assert.equal(fs.readFileSync(cmdfile, 'utf8'), command, 'the cmdfile holds the command verbatim, redirect or pipe included');
  const r = runScript(path.relative(PLUGIN, runner), { cwd: root, args: ['--shell', 'bash', '--mode', mode, cmdfile] });
  return { wrapped: true, mode, run: r };
}

// The single record the one wrapped command in a fresh repository left, and its latest run.
function onlyRecord(root) {
  assert.ok(fs.existsSync(OBS(root)), 'no observations.json: the command was never run under the runner');
  const obs = JSON.parse(fs.readFileSync(OBS(root), 'utf8'));
  const keys = Object.keys(obs);
  assert.equal(keys.length, 1, `expected one record for the one command that ran, got ${JSON.stringify(keys)}`);
  return obs[keys[0]];
}

test('#160 e2e: a `> file` command is run under the runner and recorded — 0 lines, because the file took them all', { skip: !bash }, () => {
  const root = repo('observe-redirect-');
  const { wrapped, run } = hookThenRun(root, `${prints(7)} > out.txt`);
  assert.equal(wrapped, true, 'the hook left the command alone: it was still exempt');
  // The command really ran and really produced output — without this, a 0-line entry could mean
  // "nothing ran" just as well as "the redirect took everything".
  assert.equal(fs.readFileSync(path.join(root, 'out.txt'), 'utf8').trim().split('\n').length, 7);
  assert.equal(run.code, 0);

  const rec = onlyRecord(root);
  // The OBSERVATION is unchanged and is still the honest one: 0 lines reached the session, and the
  // shape history says so. #160 stands — the command ran under the runner and was recorded.
  assert.deepEqual(rec.training.history, [{ lines: 0, stdoutLines: 0, stderrLines: 0, code: 0 }]);
  // MOVED to the new behaviour (#164, owner 2026-09-21): the VERDICT is no longer taken from it.
  // This used to assert `lines: 0` and `noisy: false`. Under the identity head the redirected run
  // and the bare run share one record, so a `noisy: false` written here routes the next bare run to
  // `plain` — unwrapped. Only a run with output on the pipe decides `noisy`; with none yet, the
  // fields are absent, which is the unseen state decide() observes.
  assert.ok(!('noisy' in rec), `noisy must be absent, got ${JSON.stringify(rec.noisy)}`);
  assert.ok(!('lines' in rec), `lines must be absent, got ${JSON.stringify(rec.lines)}`);
});

test('#160 e2e: a `| tail -5` command is run under the runner and recorded — 5 lines, what the filter let through', { skip: !bash }, () => {
  const root = repo('observe-pipe-');
  const { wrapped, run } = hookThenRun(root, `${prints(50)} | tail -5`);
  assert.equal(wrapped, true, 'the hook left the command alone: it was still exempt');
  assert.equal(run.code, 0);

  const rec = onlyRecord(root);
  assert.deepEqual(rec.training.history, [{ lines: 5, stdoutLines: 5, stderrLines: 0, code: 0 }]);
  assert.equal(rec.lines, 5);
  // The 50 the producer wrote are NOT what is recorded: the record measures what reached the
  // session, which is the last stage's output. A 50 here would mean the pipe was not honoured.
  assert.notEqual(rec.lines, 50);
});

// ---- RED CHECK ----
//
// The ticket asks for the proof that restoring either exemption fails the case above. Its two
// halves are asserted here rather than by re-introducing the deleted code, because a copy of a
// deleted branch kept alive in a test is a second spelling of a rule the product no longer has.
//
// Half one: the two commands above are exactly what the deleted predicates matched, so each case
// really does sit inside the exemption that was removed — not next to it.
const DELETED_PIPED = /\|\s*(?:tail|head|grep|rg|wc|sed|awk|sort|uniq|jq|tee|less|cut|python|py|quiet[-_]run)\b/;
const DELETED_FILE_REDIRECT = /\d?>\s*\S/;
const wasExempt = (c) => DELETED_PIPED.test(c) || (c.includes('>') && DELETED_FILE_REDIRECT.test(c) && !c.includes('2>&1'));

test('RED CHECK (1): both e2e commands are ones the deleted exemptions claimed', () => {
  assert.equal(wasExempt(`${prints(7)} > out.txt`), true);
  assert.equal(wasExempt(`${prints(50)} | tail -5`), true);
  assert.equal(wasExempt('cargo test'), false, 'positive control: the predicates are not the identity');
});

// Half two: the harness above can actually see "no record". A command the hook leaves alone writes
// no observations.json at all — measured on the same path, with a `> file` command that is still
// exempt for the reason that survived #160 (ruling C1: `cat` is a byte-mover, file or no file).
// An exemption restored over the e2e commands would put them in exactly this state.
test('RED CHECK (2): a command the hook leaves alone leaves no record — the e2e assertion can fail', { skip: !bash }, () => {
  const root = repo('observe-still-exempt-');
  fs.writeFileSync(path.join(root, 'in.txt'), 'a\nb\nc\n');
  const { wrapped } = hookThenRun(root, 'cat in.txt > out.txt');
  assert.equal(wrapped, false, 'a byte-mover is exempt by kind — that is ruling C1, which #160 did not touch');
  assert.equal(fs.existsSync(OBS(root)), false, 'not wrapped, not run under the runner, no record');
});
