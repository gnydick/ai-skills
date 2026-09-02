import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const PLUGIN = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

export function runScript(script, { stdin = '', cwd = PLUGIN, env = {}, args = [] } = {}) {
  const r = spawnSync(process.execPath, [path.join(PLUGIN, script), ...args], {
    cwd, input: stdin, encoding: 'utf8',
    env: { ...process.env, CLAUDE_PLUGIN_ROOT: PLUGIN, ...env },
  });
  return { code: r.status, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
}
