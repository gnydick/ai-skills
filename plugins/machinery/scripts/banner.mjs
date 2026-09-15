#!/usr/bin/env node
// Story: hooks/session-banner.md. Prints only what it measured (spec I7, I27, I38). Loud, non-blocking.
import fs from 'node:fs';
import path from 'node:path';
import { readPayload } from './lib/stdin.mjs';
import { context } from './lib/emit.mjs';
import { git } from './lib/git.mjs';
import { projectRoot } from './lib/root.mjs';
import { markers, universalInbox, universalRules, projectInbox, pluginRoot } from './lib/config.mjs';
import { userHome } from './lib/layout.mjs';
import { pending } from './lib/inbox.mjs';

function banner() {
  const p = readPayload() ?? {};
  const cwd = p.cwd || process.cwd();
  const home = userHome();
  const m = markers();
  const lines = ['machinery:'];
  // The core is core.md in the plugin itself, injected by the SessionStart and SubagentStart hooks
  // (recalibration 21): measured here as present or missing, nothing more. The user's universal
  // rules (STATUS 54) are ~/.claude/rules/universal.md, loaded by Claude Code itself; absent is a
  // fact, not a fault — nothing has been filed there yet.
  const core = path.join(pluginRoot(), 'core.md');
  lines.push(`  core: ${core} (${fs.existsSync(core) ? 'present' : 'MISSING — reinstall machinery'})`);
  const universal = universalRules();
  lines.push(`  universal rules: ${universal} (${fs.existsSync(universal) ? 'present' : 'absent'})`);
  let root = null;
  try { root = projectRoot(cwd); } catch { lines.push('  project: not a git repository'); }
  let proj = 0;
  if (root) {
    const hp = git(['config', 'core.hooksPath'], root).stdout;
    lines.push(`  core.hooksPath: ${hp || 'not set — run /machinery:install'}`);
    const stamp = path.join(root, '.githooks', 'machinery', 'VERSION');
    const pv = JSON.parse(fs.readFileSync(path.join(pluginRoot(), '.claude-plugin', 'plugin.json'), 'utf8')).version;
    lines.push(`  gate: ${fs.existsSync(stamp) ? `installed ${fs.readFileSync(stamp, 'utf8').trim()} (plugin ${pv})` : 'not installed'}`);
    lines.push(`  hosted check: ${fs.existsSync(path.join(root, '.github', 'workflows', 'machinery.yml')) ? 'present' : 'none — the pre-push hook is the blocking check before main; /machinery:install --hosted-ci writes one'}`);
    try { proj = pending(projectInbox(root)).length; } catch (e) { lines.push(`  project inbox: MALFORMED — ${e.message}`); }
  }
  let univ = 0;
  try { univ = pending(universalInbox()).length; } catch (e) { lines.push(`  universal inbox: MALFORMED — ${e.message}`); }
  lines.push(`  pending: project ${proj}, universal ${univ}${proj + univ ? ' — intake runs at the next prompt in an eligible session' : ''}`);
  lines.push(`  worktree hook: ${fs.existsSync(path.join(home, '.claude', 'machinery-observed-worktree')) ? 'observed firing on this machine' : 'never observed on this machine'}`);
  // Issue tracking (docs/superpowers/specs/2026-09-12-issue-tracking-config-design.md; the plan's
  // Decision 3): the developer-friendliness skill finds the decide command by this line, and a session
  // with no such line is a session without machinery. Measured: a missing script is named MISSING and
  // never offered as runnable. Printing the path runs nothing.
  const trackingCommand = path.join(pluginRoot(), 'scripts', 'issue-tracking.mjs');
  lines.push(`  issue tracking command: ${fs.existsSync(trackingCommand) ? `node "${trackingCommand}"` : `MISSING — expected at ${trackingCommand}`}`);
  lines.push(`  markers: ${m.project} (project) ${m.universal} (universal); a bare ${m.ambiguous} captures nothing`);
  return lines.join('\n');
}

let text;
try { text = banner(); } catch (e) { text = `machinery: banner failed — ${e.message}`; }
try { context(text, 'SessionStart'); } catch {}
process.exitCode = 0;
