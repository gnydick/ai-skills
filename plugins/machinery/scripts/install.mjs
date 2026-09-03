#!/usr/bin/env node
// Story: gates/commit-gate.md (activation per clone, never self-installing — this is the one path that sets core.hooksPath; spec I7).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { git } from './lib/git.mjs';
import { projectRoot } from './lib/root.mjs';
import { generateIndex } from './lib/index.mjs';
import { pluginRoot, rulesSource } from './lib/config.mjs';

const argv = process.argv.slice(2);
const opt = (k) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : null; };
const say = (s) => process.stdout.write(s + '\n');
const version = () => JSON.parse(fs.readFileSync(path.join(pluginRoot(), '.claude-plugin', 'plugin.json'), 'utf8')).version;

function link(target, source) {
  fs.mkdirSync(path.dirname(target), { recursive: true });
  if (fs.existsSync(target)) {
    if (fs.realpathSync.native(target) === fs.realpathSync.native(source)) return 'already';
    // A junction reports as a symbolic link to lstat on Windows; a real directory does not.
    // Never delete a real directory sitting at the target path (spec: refuse, don't clobber).
    if (!fs.lstatSync(target).isSymbolicLink()) return 'not-a-junction';
    fs.rmSync(target, { recursive: false, force: true });
  }
  if (process.platform === 'win32') execFileSync('cmd', ['/c', 'mklink', '/J', target, source], { stdio: 'pipe' });
  else fs.symlinkSync(source, target, 'dir');
  return 'created';
}

function installMachine() {
  const home = process.env.MACHINERY_HOME || os.homedir();
  const target = path.join(home, '.claude', 'rules', 'machinery');
  const src = rulesSource();
  if (!fs.existsSync(src)) { process.stderr.write(`rules source does not exist: ${src}\n`); return 1; }
  const result = link(target, src);
  if (result === 'not-a-junction') { process.stderr.write(`refusing to replace ${target}: not a junction; move it aside and rerun\n`); return 1; }
  say(`~/.claude/rules/machinery -> ${src}: ${result}`);
  return 0;
}

// A pre-commit that already invokes the installed gate is ours (or a prior install's) — safe to
// rewrite. Anything else is a foreign hook; refuse rather than clobber it (final review F).
const GATE_MARK = /machinery\/gate\.mjs/;

function installProject() {
  const root = opt('--root') ? path.resolve(opt('--root')) : projectRoot(process.cwd());
  if (git(['rev-parse', '--git-dir'], root).code !== 0) { process.stderr.write(`not a git repository: ${root}\n`); return 1; }
  const hooksDirEarly = path.join(root, '.githooks');
  const preCommitPath = path.join(hooksDirEarly, 'pre-commit');
  if (fs.existsSync(preCommitPath) && !GATE_MARK.test(fs.readFileSync(preCommitPath, 'utf8'))) {
    process.stderr.write(`refusing to overwrite ${path.relative(root, preCommitPath)}: it does not already invoke the machinery gate; move it aside and rerun\n`);
    return 1;
  }
  const curHooksPath = git(['config', 'core.hooksPath'], root).stdout;
  if (curHooksPath && curHooksPath !== '.githooks') {
    process.stderr.write(`refusing to change core.hooksPath: currently '${curHooksPath}', expected unset or '.githooks'\n`);
    return 1;
  }
  const rules = path.join(root, '.claude', 'rules'), mach = path.join(root, '.claude', 'machinery');
  fs.mkdirSync(rules, { recursive: true }); fs.mkdirSync(mach, { recursive: true });
  const inbox = path.join(mach, 'inbox.md');
  if (!fs.existsSync(inbox)) { fs.writeFileSync(inbox, ''); say(`created ${path.relative(root, inbox)}`); }
  fs.writeFileSync(path.join(mach, 'INDEX.md'), generateIndex(rules)); say('regenerated .claude/machinery/INDEX.md');
  const hooksDir = path.join(root, '.githooks'), gateDir = path.join(hooksDir, 'machinery');
  fs.rmSync(gateDir, { recursive: true, force: true });
  // The gate files import '../lib/...'; installed alongside gateDir/lib, so rewrite that prefix
  // to './lib/' during copy (spec I6: the installed gate never points at the plugin cache).
  fs.mkdirSync(gateDir, { recursive: true });
  for (const f of fs.readdirSync(path.join(pluginRoot(), 'scripts', 'gate'))) {
    const src = fs.readFileSync(path.join(pluginRoot(), 'scripts', 'gate', f), 'utf8').replaceAll("'../lib/", "'./lib/");
    fs.writeFileSync(path.join(gateDir, f), src);
  }
  // The gate's read-side lib, copied so the project never points at the plugin cache (spec I6).
  fs.mkdirSync(path.join(gateDir, 'lib'), { recursive: true });
  for (const f of ['git.mjs', 'root.mjs', 'inbox.mjs', 'frontmatter.mjs', 'index.mjs', 'report.mjs']) fs.copyFileSync(path.join(pluginRoot(), 'scripts', 'lib', f), path.join(gateDir, 'lib', f));
  fs.writeFileSync(path.join(gateDir, 'VERSION'), version() + '\n');
  fs.writeFileSync(path.join(hooksDir, 'pre-commit'), '#!/bin/sh\n# Installed by /machinery:install. Runs the machinery commit gate on every commit.\nexec node .githooks/machinery/gate.mjs\n');
  try { fs.chmodSync(path.join(hooksDir, 'pre-commit'), 0o755); } catch {}
  say(`installed gate ${version()} into .githooks/machinery/`);
  git(['config', 'core.hooksPath', '.githooks'], root);
  if (argv.includes('--hosted')) {
    const wf = path.join(root, '.github', 'workflows', 'machinery.yml');
    fs.mkdirSync(path.dirname(wf), { recursive: true });
    fs.copyFileSync(path.join(pluginRoot(), 'templates', 'hosted-check.yml'), wf); say('wrote .github/workflows/machinery.yml');
  }
  say(`core.hooksPath: ${git(['config', 'core.hooksPath'], root).stdout}`);
  say(`hosted check: ${fs.existsSync(path.join(root, '.github', 'workflows', 'machinery.yml')) ? 'present' : 'none (the local merge gate is the sole blocking backstop)'}`);
  // Final review A1(c): stage exactly the layout this run created/updated, so the first commit
  // after install has something to actually commit — the gate's register check otherwise sees
  // a generated-but-unstaged index and rejects a remedy (reindex) that would produce nothing new.
  git(['add', '--', '.claude/rules', '.claude/machinery/inbox.md', '.claude/machinery/INDEX.md', '.githooks'], root);
  return 0;
}

process.exitCode = argv.includes('--machine') ? installMachine() : installProject();
