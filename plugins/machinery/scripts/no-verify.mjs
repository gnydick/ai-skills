#!/usr/bin/env node
// Plan Task B4 (recalibration decision 29; mechanism 10): a Bash/PowerShell command that carries
// `--no-verify` stops at a permission prompt naming the hook(s) it would skip. It is not refused —
// the user answers — and the prompt is the whole mechanism: the commit and push hooks are the
// blocking checks, and skipping them silently is what this hook makes impossible.
//
// Which hooks: after a `git` token, the first of `commit` / `push` names the one; a `--no-verify`
// anywhere else (a make target, a script argument) could reach either, so both are named. Reads the
// tokens the way every other reader does (lib/quotes.mjs), so a flag inside a quoted message is
// still seen — quoting is not a way around the prompt. Fails OPEN: garbage stdin, or a command
// without the flag, prints nothing and exits 0.
import { readPayload } from './lib/stdin.mjs';
import { permission } from './lib/emit.mjs';
import { tokens } from './lib/quotes.mjs';

const FLAG = '--no-verify';

// The hook(s) the command would skip, as the prompt names them.
function skipped(command) {
  const t = tokens(command);
  const git = t.indexOf('git');
  if (git >= 0) {
    const verb = t.slice(git + 1).find((w) => w === 'commit' || w === 'push');
    if (verb === 'commit') return 'pre-commit';
    if (verb === 'push') return 'pre-push';
  }
  return 'pre-commit, pre-push';
}

const command = readPayload()?.tool_input?.command;
if (typeof command === 'string' && command.includes(FLAG)) {
  permission('ask', `${FLAG} skips the commit/push hooks (${skipped(command)}). Allow?`);
}
