// Story: the capture layer under quiet-run.mjs. Knows nothing about any tool —
// which command ran and what its output means is assimilate.mjs's job. What it
// replaces (spawnSync with stdout and stderr concatenated) lost two facts that
// cannot be recovered later: which stream a line came from, and when it arrived
// relative to the others. So both streams are read separately, records are
// pushed in the order chunks actually arrived, and every line carries an offset
// from ONE start time read once here (rules/design-invariants.md § One
// authority per switch; § Never re-derive a fact — nobody downstream restamps).
import { spawn } from 'node:child_process';
import { StringDecoder } from 'node:string_decoder';

// Splits what has arrived so far into whole lines plus the unterminated
// remainder. split('\n') always yields at least one element and the last one is
// exactly the part with no newline after it yet — '' when the text ended on a
// newline — so popping it is the entire rule. The remainder is carried into the
// next chunk rather than emitted, or a line straddling a chunk boundary would
// be recorded as two half-lines.
function linesOf(text) {
  const parts = text.split('\n');
  const leftover = parts.pop();
  return { complete: parts, leftover };
}

export function captureRun(exe, args, { input, env } = {}) {
  return new Promise((resolve, reject) => {
    const start = process.hrtime.bigint();
    const elapsed = () => Number(process.hrtime.bigint() - start) / 1e9;
    const child = spawn(exe, args, {
      stdio: [input === undefined ? 'inherit' : 'pipe', 'pipe', 'pipe'],
      env: env ?? process.env,
    });
    const records = [];
    const leftover = { stdout: '', stderr: '' };
    // One decoder per stream: a chunk boundary can fall inside a multi-byte
    // character, and toString('utf8') on either half yields a replacement
    // character. The decoder holds the partial bytes back instead.
    const decoder = { stdout: new StringDecoder('utf8'), stderr: new StringDecoder('utf8') };
    let settled = false;

    // A spawn failure (binary not found, and the like) arrives here, never as an
    // exit code; the caller gets the underlying message, not a raw stack.
    child.on('error', (err) => { if (!settled) { settled = true; reject(new Error(err.message)); } });

    const onData = (stream) => (chunk) => {
      const t = elapsed();
      const { complete, leftover: rest } = linesOf(leftover[stream] + decoder[stream].write(chunk));
      leftover[stream] = rest;
      for (const text of complete) records.push({ t, stream, text });
    };
    child.stdout.on('data', onData('stdout'));
    child.stderr.on('data', onData('stderr'));

    if (input !== undefined) {
      // A child that exits without reading its stdin makes this pipe EPIPE, and
      // an unhandled stream 'error' would take the whole process down. Declining
      // to read our input is the child's business, not a capture failure.
      child.stdin.on('error', () => {});
      child.stdin.write(input);
      child.stdin.end();
    }

    // 'close' — not 'exit' — because only 'close' promises the stdio streams
    // have been drained and closed, so no 'data' can still be in flight.
    child.on('close', (code) => {
      if (settled) return;
      settled = true;
      const t = elapsed();
      for (const stream of ['stdout', 'stderr']) {
        const text = leftover[stream] + decoder[stream].end();
        if (text) records.push({ t, stream, text });
      }
      resolve({ code: code ?? 1, records });
    });
  });
}
