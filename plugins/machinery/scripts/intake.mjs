#!/usr/bin/env node
// Story: skills/rule-intake/SKILL.md — the mechanical steps. Two pipelines, each one commit in one repo (spec I30).
import path from 'node:path';
import { git, realDir } from './lib/git.mjs';
import { projectRoot, isRootSession } from './lib/root.mjs';
import { projectInbox, projectRules, projectSpecs, projectSpecInbox, universalInbox, rulesSource } from './lib/config.mjs';
import { pending, setDisposition } from './lib/inbox.mjs';
import { insideSpecArea } from './lib/layout.mjs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const argv = process.argv.slice(2);
const cmd = argv[0];
const opt = (k) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : null; };
const here = path.dirname(fileURLToPath(import.meta.url));
const die = (m) => { process.stderr.write(m + '\n'); process.exit(1); };

function list() {
  const out = [];
  let root = null; try { root = projectRoot(opt('--root') || process.cwd()); } catch {}
  if (root && isRootSession(opt('--root') || process.cwd())) {
    for (const e of pending(projectInbox(root))) out.push([e.stamp, e.marker, projectInbox(root), e.text.split('\n')[0]]);
    // #81: the spec inbox is listed on the same line shape, so one `intake list` shows everything
    // that is blocking a commit rather than half of it.
    for (const e of pending(projectSpecInbox(root))) out.push([e.stamp, e.marker, projectSpecInbox(root), e.text.split('\n')[0]]);
  }
  for (const e of pending(universalInbox())) out.push([e.stamp, e.marker, universalInbox(), e.text.split('\n')[0]]);
  process.stdout.write(out.map((r) => r.join('\t')).join('\n') + (out.length ? '\n' : ''));
}

function commit() {
  const kind = opt('--kind'), stamp = opt('--stamp'), home = opt('--home');
  if (!['project', 'universal', 'spec'].includes(kind) || !stamp || !home) die('usage: intake commit --kind project|universal|spec [--root <dir>] --stamp <stamp> --home "<file § Section>"');
  let repo, inbox, rules, extra = [];
  // #81: a specification is filed exactly like a project rule — root session, one commit, one repo —
  // but into the spec area. The home is checked against that area HERE as well as at the gate, so
  // the intake cannot write the very disposition the gate rejects.
  if (kind === 'spec') {
    const cwd = opt('--root') || process.cwd();
    if (!isRootSession(cwd)) die(`a specification is filed only from the root session: run /machinery:rule-process from ${projectRoot(cwd)}`);
    repo = projectRoot(cwd); inbox = projectSpecInbox(repo); rules = projectSpecs(repo);
    const filed = home.split(' § ')[0].trim();
    if (!insideSpecArea(repo, rules, filed)) die(`refusing to file a specification outside the spec area: '${filed}' is not under ${rules}. The spec area is declared by /machinery:install and never guessed.`);
  } else if (kind === 'project') {
    const cwd = opt('--root') || process.cwd();
    if (!isRootSession(cwd)) die(`a project rule is filed only from the root session: run /machinery:rule-process from ${projectRoot(cwd)}`);
    repo = projectRoot(cwd); inbox = projectInbox(repo); rules = projectRules(repo);
  } else {
    // Story: spec I30, each pipeline is one commit in one repo — the universal
    // kind's repo is the top level of the checkout that HOLDS rulesSource()
    // (which may be configured outside the plugin), never the main checkout
    // a worktree's common dir would resolve to (projectRoot()).
    rules = rulesSource(); inbox = universalInbox();
    const rulesDir = realDir(rules);
    const top = git(['rev-parse', '--show-toplevel'], rulesDir);
    if (top.code !== 0) die(`not inside a git repository: ${rules}`);
    repo = realDir(top.stdout);
  }
  const entry = pending(inbox).find((e) => e.stamp === stamp);
  if (!entry) die(`no PENDING entry with stamp ${stamp} in ${inbox}`);
  if (kind === 'universal') {
    const plug = path.dirname(rules);
    const b = spawnSync(process.execPath, [path.join(here, 'bump.mjs'), '--plugin', plug], { encoding: 'utf8' });
    if (b.status !== 0) die(`bump failed: ${b.stderr}`);
    extra.push(path.join(plug, '.claude-plugin', 'plugin.json'));
    process.stdout.write(`bumped plugin version to ${b.stdout.trim()}\n`);
  }
  setDisposition(inbox, stamp, { state: 'FILED', detail: `filed → ${home}` });
  const files = [rules, inbox, ...extra].map((f) => path.relative(repo, f).split(path.sep).join('/'));
  const add = git(['add', '--', ...files], repo);
  if (add.code !== 0) die(`git add failed: ${add.stderr}`);
  const subject = `${kind === 'spec' ? 'spec' : 'rule'}: ${entry.text.split('\n')[0].slice(0, 72)}`;
  const c = git(['commit', '-q', '-m', `${subject}\n\nFiled → ${home}\nInbox entry ${stamp} (${entry.marker})`, '--', ...files], repo);
  if (c.code !== 0) die(`git commit failed: ${c.stderr}\n${c.stdout}`);
  process.stdout.write(`committed in ${repo}: ${subject}\n`);
}

if (cmd === 'list') list(); else if (cmd === 'commit') commit(); else die('usage: intake list [--root <dir>] | intake commit …');
