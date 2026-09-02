// Story: hooks/quiet-output.md steps 19–26. Ported from quiet_run.py:40-241.
export const PASS_THROUGH_LINES = 40, TAIL_LINES = 8, CONTEXT_AFTER = 2, MAX_SHOWN = 200;

const ANSI = /\x1b\[[0-9;?]*[ -/]*[@-~]|\x1b\][^\x07]*\x07/g;
const BLOCK_START = /^(error(\[E\d+\])?:|error:|ERROR|thread '.*' panicked|panicked at|Traceback \(most recent call last\)|---- .* (stdout|stderr) ----|failures:|FAILED|FAIL\b|npm ERR!|npm error|ERR!|fatal:|\s*Caused by:|The following warnings were emitted)/i;
const KEYWORD = /(\berror\b|\bfailed\b|\bfailure\b|\bfailures\b|\bpanick?|\bexception\b|\bfatal\b|\bunresolved\b|\bcould not\b|\bcannot\b|\bdenied\b|\btimed out\b|\btimeout\b|\babort|\bsegfault|\bkilled\b|\bFAIL\b|\bFAILED\b|\bassert)/i;
const SUMMARY = /(^test result:|^\s*Finished\b|^\s*Summary\b|^={3,}.*={3,}$|^\s*Doc-tests\b|^running \d+ tests?$|^\s*Running (unittests|tests\/)|\badded \d+ packages?\b|\bSuccessfully installed\b|\bSuccessfully built\b|^\s*warning: .* generated \d+ warnings?|^\s*warning: build failed|\bBuild succeeded\b|\bBUILD (SUCCESSFUL|FAILED)\b|\b\d+ passed\b|\b\d+ failed\b|^\s*[✓✔✗✘X!*-]\s|https?:\/\/github\.com\/\S+|^\s*(Merged|Created|Deleted|Closed|Reopened|Requested|Cloning|ANNOTATIONS|JOBS)\b|\bcompleted with\b|\b(succeeded|skipped|cancelled)\b|^Error: |^error: could not compile)/i;
// The one declared proof-line format: a heartbeat, or `<snake_case_tool>[ --flag]: <text>` (rules/tool-output.md § Heartbeats).
const PROOF_LINE = /(^HEARTBEAT\s|^[a-z][a-z0-9]*(?:_[a-z0-9]+)+(?:\s+--?[\w.-]+)?:\s+\S)/;
const INFRA_OK = /(^\[[^\]]+ [0-9a-f]{7,}\] |^\s*[0-9a-f]{7,}\.\.[0-9a-f]{7,}\s+\S+\s+->\s+\S+|^\s*\+\s+[0-9a-f]{7,}\.{3}[0-9a-f]{7,}\s+\S+\s+->|^\s*\*\s+\[new (?:branch|tag)\]|^\s*-\s+\[deleted\]|^Everything up-to-date$|^Already up to date\.?$|^Fast-forward$|^Updating [0-9a-f]{7,}\.\.[0-9a-f]{7,}$|^\s*\d+ files? changed|^Merge made by|^Successfully rebased|^Switched to|^HEAD is now at|^Preparing worktree|^Cloning into|^branch '.*' set up to track|https?:\/\/github\.com\/\S+|^\s*[✓✔]\s|^\s*(Merged|Created|Deleted|Closed|Reopened|Logged in)\b)/i;
const CHATTER = /^\s*(Compiling|Checking|Downloading|Downloaded|Updating|Fresh|Blocking|Installing|Locking|Adding|Removing|Documenting|Building|Collecting|Requirement already satisfied|Using cached|Preparing|Unpacking)\b|^test .* \.\.\. ok$|^\s*warning: unused|^\s*\|/;

export function normalise(raw) {
  const text = Buffer.isBuffer(raw) ? raw.toString('utf8') : String(raw);
  const out = [];
  for (let line of text.replace(/\r\n/g, '\n').split('\n')) {
    if (line.includes('\r')) line = line.split('\r').at(-1);
    out.push(line.replace(ANSI, '').trimEnd());
  }
  while (out.length && !out.at(-1)) out.pop();
  return out;
}

export function select(lines) {
  const n = lines.length, keep = new Set();
  let i = 0;
  while (i < n) {
    const line = lines[i];
    if (BLOCK_START.test(line)) {
      let j = i;
      while (j < n && (lines[j].trim() || j === i)) { keep.add(j); j++; }
      i = Math.max(j, i + 1);
      continue;
    }
    if (SUMMARY.test(line) || PROOF_LINE.test(line)) keep.add(i);
    else if (KEYWORD.test(line) && !CHATTER.test(line)) for (let k = i; k < Math.min(n, i + 1 + CONTEXT_AFTER); k++) keep.add(k);
    i++;
  }
  for (let k = Math.max(0, n - TAIL_LINES); k < n; k++) if (k === n - 1 || !CHATTER.test(lines[k])) keep.add(k);
  return keep;
}

export function selectInfra(lines, code) {
  if (code !== 0) return select(lines);
  const keep = new Set();
  lines.forEach((l, i) => { if (INFRA_OK.test(l) || PROOF_LINE.test(l)) keep.add(i); });
  if (!keep.size && lines.length) keep.add(lines.length - 1);
  return keep;
}

export function render(lines, keep, header) {
  let idx = [...keep].sort((a, b) => a - b);
  let note = null;
  if (idx.length > MAX_SHOWN) {
    const head = Math.floor(MAX_SHOWN * 3 / 5), tail = MAX_SHOWN - head;
    note = `... [${idx.length - MAX_SHOWN} kept lines elided between head and tail] ...`;
    idx = [...idx.slice(0, head), null, ...idx.slice(-tail)];
  }
  const out = [header];
  let prev = -1;
  let hadNote = false;
  for (const k of idx) {
    if (k === null) { out.push(note); hadNote = true; continue; }
    if (!hadNote && prev >= 0 && k !== prev + 1) out.push(`... [${k - prev - 1} lines omitted] ...`);
    hadNote = false;
    out.push(lines[k]);
    prev = k;
  }
  return out.join('\n');
}
