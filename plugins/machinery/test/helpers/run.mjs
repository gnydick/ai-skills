import './env.mjs';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const PLUGIN = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

// The universal inbox and rules are the user's, under the home (STATUS 54): a script spawned with
// no home of its own would read and write the REAL ~/.claude. So every spawn gets a throwaway home
// unless the test hands it one — one per test process, so a test that captures and then reads back
// without naming a home still sees its own writes.
const SCRATCH_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'home-'));

export function runScript(script, { stdin = '', cwd = PLUGIN, env = {}, args = [] } = {}) {
  const r = spawnSync(process.execPath, [path.join(PLUGIN, script), ...args], {
    cwd, input: stdin, encoding: 'utf8',
    env: { ...process.env, MACHINERY_HOME: SCRATCH_HOME, CLAUDE_PLUGIN_ROOT: PLUGIN, ...env },
  });
  return { code: r.status, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
}
