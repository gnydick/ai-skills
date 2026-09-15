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
    // #107 (owner, 2026-09-15: "Updated installs have to handle migration"): the project keeps the
    // gate its last install wrote, so after a plugin update the installed copy can be older than
    // the plugin and name remedies the plugin no longer ships. Compared field by field, never as
    // strings: 0.1.9 is older than 0.1.10. Only "older" gets the remedy; a newer stamp is not a
    // fault this banner can name.
    const older = (a, b) => { const x = a.split('.').map(Number), y = b.split('.').map(Number); for (let i = 0; i < 3; i++) if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) < (y[i] || 0); return false; };
    const installed = fs.existsSync(stamp) ? fs.readFileSync(stamp, 'utf8').trim() : null;
    lines.push(`  gate: ${installed === null ? 'not installed' : `installed ${installed} (plugin ${pv})${older(installed, pv) ? ' — older than the plugin; run /machinery:install to migrate' : ''}`}`);
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
