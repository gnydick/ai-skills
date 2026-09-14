import path from 'node:path';
import { pending } from '../lib/inbox.mjs';
import { report } from '../lib/report.mjs';

// The gate's composition is generated from this (ticket #73, I43). The rules index and its
// comparison are gone (recalibration decision 10): what blocks is a pending inbox entry, nothing else.
export const declaration = Object.freeze({
  id: 'register_check',
  run: 'registerCheck',
  blocking: true,
  wired: true,
});

// {inbox, root} → true if it passes. Never writes (spec I23). A refusal names the inbox and the one
// fix, and offers no bypass (recalibration decision 3).
export function registerCheck({ inbox, root }) {
  let n;
  try { n = pending(inbox).length; } catch (e) { report('register_check', 1, 1, `inbox malformed — ${e.message}`); return false; }
  report('register_check', n, n, `pending inbox entr${n === 1 ? 'y' : 'ies'} (must be 0)`);
  if (n) {
    const rel = path.relative(root, inbox).split(path.sep).join('/');
    process.stdout.write(`commit refused: ${n} pending entr${n === 1 ? 'y' : 'ies'} in ${rel} — run /machinery:rule-process\n`);
  }
  return n === 0;
}
