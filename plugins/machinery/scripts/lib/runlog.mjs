// The one home of the per-run log: where it lives, how a run is written into it, and how it is read
// back. Two readers of the same bytes — quiet-run.mjs writes one after every wrapped run, and
// train-tool.mjs reads one when the session identifies a tool's answer line in it — so the format is
// spelled once (rules/design-invariants.md § Never re-derive a fact). The log is verbatim: a record's
// text keeps its bare \r and its ANSI, because filter.mjs's normalise() owns collapsing progress
// frames and stripping colour, and it runs on the way OUT of the records exactly as it runs on the
// way to the display. linesOf() is that single derivation; the runner and the trainer both call it.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { normalise } from './filter.mjs';

export function logDir() {
  const job = process.env.CLAUDE_JOB_DIR;
  return job ? path.join(job, 'tmp') : path.join(os.tmpdir(), 'claude-quiet');
}

// `$ <command>` first, then one line per record: the offset in seconds to three places, a three-letter
// stream tag, two spaces, the text verbatim. A record's text never contains \n — lib/lines.mjs split on
// it — so a record is exactly one line of the file, and a multi-line command is however many lines it
// has before the first record.
const TAG = { stdout: 'out', stderr: 'err' };
export function formatRunLog(command, records) {
  const body = records.map((r) => `${r.t.toFixed(3)} ${TAG[r.stream]}  ${r.text}`).join('\n');
  return `$ ${command}\n${body}${body ? '\n' : ''}`;
}

// The `s` flag makes `.` match a bare \r inside the text; without it a progress-frame record would
// fail to parse as a record at all. `$` without `m` is the end of this one line only.
const RECORD = /^(\d+\.\d{3}) (out|err)  (.*)$/s;
export function parseRunLog(text) {
  // A one-off split of a finished blob into lines — a different fact from the streaming carry rule
  // lib/lines.mjs owns (rules/design-invariants.md § Never re-derive a fact), so the trailing empty
  // entry a terminating \n leaves behind is dropped by a slice, not the carry rule's own pop().
  let lines = text.split('\n');
  if (lines.at(-1) === '') lines = lines.slice(0, -1);
  if (!lines.length || !lines[0].startsWith('$ ')) throw new Error('not a run log: the first line does not start with a dollar sign and a space');
  const command = [lines[0].slice(2)];
  const records = [];
  let i = 1;
  while (i < lines.length && !RECORD.test(lines[i])) command.push(lines[i++]);
  for (; i < lines.length; i++) {
    const m = RECORD.exec(lines[i]);
    if (!m) throw new Error(`not a run log: line ${i + 1} is neither a record nor part of the command`);
    records.push({ t: Number(m[1]), stream: m[2] === 'out' ? 'stdout' : 'stderr', text: m[3] });
  }
  return { command: command.join('\n'), records };
}

export const linesOf = (records) => normalise(records.map((r) => r.text).join('\n'));

// The stamp in a log's name (YYYYMMDD-HHMMSS) sorts lexically, so newest first is a name sort reversed;
// no stat per file. A directory that is not there holds no logs.
export function listRunLogs(dir = logDir()) {
  let names;
  try { names = fs.readdirSync(dir); } catch { return []; }
  return names.filter((n) => /^quiet-.*\.log$/.test(n)).sort().reverse().map((n) => path.join(dir, n));
}
