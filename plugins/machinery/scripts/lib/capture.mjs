// Story: the capture layer under quiet-run.mjs. Knows nothing about any tool —
// which command ran and what its output means is assimilate.mjs's job. What it
// replaces (spawnSync with stdout and stderr concatenated) lost two facts that
// cannot be recovered later: which stream a line came from, and when it arrived
// relative to the others. So both streams are read separately, records are
// pushed in the order chunks actually arrived, and every line carries an offset
// from ONE start time read once here — nobody downstream restamps, because a
// second clock would eventually disagree with the first.
import { spawn } from 'node:child_process';
// The chunk-to-lines rule (carry the unterminated remainder, decode multi-byte
// characters across chunk boundaries) lives in lib/lines.mjs, shared with
// lib/git.mjs's streamed diff (#19 fix round 1) — one splitter per stream here.
import { lineSplitter } from './lines.mjs';

export function captureRun(exe, args, { input, env } = {}) {
  return new Promise((resolve, reject) => {
    const start = process.hrtime.bigint();
    const elapsed = () => Number(process.hrtime.bigint() - start) / 1e9;
    const child = spawn(exe, args, {
      stdio: [input === undefined ? 'inherit' : 'pipe', 'pipe', 'pipe'],
      env: env ?? process.env,
    });
    const records = [];
    const splitter = { stdout: lineSplitter(), stderr: lineSplitter() };
    let settled = false;

    // A spawn failure (binary not found, and the like) arrives here, never as an
    // exit code; the caller gets the underlying message, not a raw stack.
    child.on('error', (err) => { if (!settled) { settled = true; reject(new Error(err.message)); } });

    const onData = (stream) => (chunk) => {
      const t = elapsed();
      for (const text of splitter[stream].push(chunk)) records.push({ t, stream, text });
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
        const text = splitter[stream].end();
        if (text) records.push({ t, stream, text });
      }
      resolve({ code: code ?? 1, records });
    });
  });
}
