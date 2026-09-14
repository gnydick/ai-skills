#!/usr/bin/env node
// Story: gates/commit-gate.md (activation per clone, never self-installing — this is the one path that sets core.hooksPath; spec I7).
import fs from 'node:fs';
import path from 'node:path';
import { git } from './lib/git.mjs';
import { projectRoot } from './lib/root.mjs';
import { pluginRoot, projectIssueTracking } from './lib/config.mjs';
import { SPEC_INBOX, DOCS_DIR, SPECS_DIR, UNANSWERED } from './lib/layout.mjs';
import { ensureIgnored, OBSERVATIONS_IGNORE } from './lib/ignore.mjs';
import { MACHINERY_OWN } from './lib/own-files.mjs';
// The generated manifest is the sole source of which check modules exist and which are wired
// (#73, I43). Resolved from this file's own location, so the installer ships what its own plugin
// copy holds rather than whatever happens to be lying in the gate directory.
import { CHECK_FILES } from './gate/manifest.mjs';

const argv = process.argv.slice(2);
const opt = (k) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : null; };
const say = (s) => process.stdout.write(s + '\n');
const version = () => JSON.parse(fs.readFileSync(path.join(pluginRoot(), '.claude-plugin', 'plugin.json'), 'utf8')).version;

// Issue tracking (docs/superpowers/specs/2026-09-12-issue-tracking-config-design.md, "Install seeds
// them"): the only thing install ever does to the project file is create it when there is none. The
// `wx` flag makes "never overwritten, whatever it says — an empty file included" a property of the
// open itself rather than of a check made a moment earlier. Returns true when it created the file.
function seed(file) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  try { fs.writeFileSync(file, `${UNANSWERED}\n`, { flag: 'wx' }); return true; }
  catch (e) { if (e.code === 'EEXIST') return false; throw e; }
}
const seedLine = (shown, created) => `${shown}: ${created ? 'created' : 'present, left as it is'}`;

// Recalibration 21, 37: the universal rules are core.md, injected by the SessionStart and
// SubagentStart hooks of every session that has the plugin enabled. There is no per-machine
// junction to create, so the flag that used to create one is refused by name, not ignored.
function refuseMachine() {
  process.stderr.write("--machine was removed: machinery's SessionStart and SubagentStart hooks load core.md; enable machinery per project with claude plugin install machinery@ai-skills --scope project\n");
  return 2;
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
  // #81: captured specifications persist at ONE fixed, known location — docs/dictated-specs — that
  // nothing declares or resolves. Creating it here is convenience, not declaration: the address
  // holds whether or not the directory exists yet, exactly as .claude/machinery/inbox.md's does.
  // Note what this location is NOT: docs/ is outside .claude/, so nothing loads a filed
  // specification into a session. That is #81 Part 4 and is not built.
  const specs = path.join(root, DOCS_DIR, SPECS_DIR);
  fs.mkdirSync(rules, { recursive: true }); fs.mkdirSync(mach, { recursive: true }); fs.mkdirSync(specs, { recursive: true });
  const trackingFile = projectIssueTracking(root);
  say(seedLine(path.relative(root, trackingFile), seed(trackingFile)));
  const inbox = path.join(mach, 'inbox.md');
  if (!fs.existsSync(inbox)) { fs.writeFileSync(inbox, ''); say(`created ${path.relative(root, inbox)}`); }
  const specInbox = path.join(mach, SPEC_INBOX);
  if (!fs.existsSync(specInbox)) { fs.writeFileSync(specInbox, ''); say(`created ${path.relative(root, specInbox)}`); }
  // Ruling 2026-09-05 (specs: tool-assimilation, "The ledger"): tool-catalog.json is a team decision,
  // tracked like inbox.md; observations.json is per-machine measurement and is gitignored, never
  // staged — see the add list at the end, where it is deliberately absent.
  const toolCatalog = path.join(mach, 'tool-catalog.json');
  if (!fs.existsSync(toolCatalog)) { fs.writeFileSync(toolCatalog, '{}\n'); say(`created ${path.relative(root, toolCatalog)}`); }
  const observations = path.join(mach, 'observations.json');
  if (!fs.existsSync(observations)) { fs.writeFileSync(observations, '{}\n'); say(`created ${path.relative(root, observations)}`); }
  // The ignore entry itself is lib/ignore.mjs's job — the same function the record's creator calls
  // (final review I6), so the CRLF and idempotency rules have one spelling.
  const ignoreLine = OBSERVATIONS_IGNORE;
  const ignoreWritten = ensureIgnored(root, ignoreLine);
  if (ignoreWritten) say(`added ${ignoreLine} to .gitignore`);
  // An ignore entry does nothing for a file already in the index. Name it rather than let the
  // ruling look applied when it is not: silence here would read as success.
  if (git(['ls-files', '--error-unmatch', '--', ignoreLine], root).code === 0)
    process.stderr.write(`warning: ${ignoreLine} is tracked; it is per-machine data and should not be. Run: git rm --cached ${ignoreLine}\n`);
  const hooksDir = path.join(root, '.githooks'), gateDir = path.join(hooksDir, 'machinery');
  fs.rmSync(gateDir, { recursive: true, force: true });
  // The gate files import '../lib/...'; installed alongside gateDir/lib, so rewrite that prefix
  // to './lib/' during copy (spec I6: the installed gate never points at the plugin cache).
  fs.mkdirSync(gateDir, { recursive: true });
  // WHAT gets copied is derived from the generated manifest, never a hand-kept list and no longer
  // "whatever is in the directory" (#73, I43). Before this the installer shipped every module under
  // scripts/gate/ into every adopting project, including an unwired check imported by nothing
  // there (#29, 2026-09-05): a dead payload with a test holding it in place.
  // An unwired check is now structurally unable to reach a project that will never run it.
  for (const f of ['gate.mjs', 'manifest.mjs', ...CHECK_FILES]) {
    const src = fs.readFileSync(path.join(pluginRoot(), 'scripts', 'gate', f), 'utf8').replaceAll("'../lib/", "'./lib/");
    fs.writeFileSync(path.join(gateDir, f), src);
  }
  // The gate's read-side lib, copied so the project never points at the plugin cache (spec I6).
  // This list mirrors the gate's imports; test/install.test.mjs walks the installed copy's
  // imports and fails on any that does not resolve, so a lib added to git.mjs (lines.mjs, #19
  // fix round 1) and forgotten here is caught mechanically rather than at a project's next commit.
  fs.mkdirSync(path.join(gateDir, 'lib'), { recursive: true });
  for (const f of ['git.mjs', 'lines.mjs', 'root.mjs', 'inbox.mjs', 'report.mjs', 'layout.mjs']) fs.copyFileSync(path.join(pluginRoot(), 'scripts', 'lib', f), path.join(gateDir, 'lib', f));
  // The tier runner the pre-commit calls after the gate (plan Task B2), with the settings and
  // components readers it imports. It lives in scripts/ and imports './lib/...' already, so it is
  // copied as is; the same import walk in test/install.test.mjs covers it.
  fs.copyFileSync(path.join(pluginRoot(), 'scripts', 'tiers.mjs'), path.join(gateDir, 'tiers.mjs'));
  for (const f of ['settings.mjs', 'components.mjs', 'own-files.mjs']) fs.copyFileSync(path.join(pluginRoot(), 'scripts', 'lib', f), path.join(gateDir, 'lib', f));
  fs.writeFileSync(path.join(gateDir, 'VERSION'), version() + '\n');
  fs.writeFileSync(path.join(hooksDir, 'pre-commit'), '#!/bin/sh\n# Installed by /machinery:install.\nnode .githooks/machinery/gate.mjs && exec node .githooks/machinery/tiers.mjs fast\n');
  try { fs.chmodSync(path.join(hooksDir, 'pre-commit'), 0o755); } catch {}
  // The pre-push runs the merge tier on pushes to main, in place (plan Task B3; decision 13 amended).
  fs.writeFileSync(path.join(hooksDir, 'pre-push'), '#!/bin/sh\n# Installed by /machinery:install.\nexec node .githooks/machinery/tiers.mjs merge\n');
  try { fs.chmodSync(path.join(hooksDir, 'pre-push'), 0o755); } catch {}
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
  // after install has something to actually commit.
  // .gitignore is staged only when this run wrote it, so a user's own uncommitted edits to it are
  // not swept into the next commit. observations.json is deliberately absent from this list.
  // The list is MACHINERY_OWN (lib/own-files.mjs), spelled once and shared with the tier runner's
  // exemption (STATUS 51); test/tiers.test.mjs fails if what lands in the index is not that list.
  git(['add', '--', ...MACHINERY_OWN.filter((p) => p !== '.gitignore' || ignoreWritten)], root);
  return 0;
}

process.exitCode = argv.includes('--machine') ? refuseMachine() : installProject();
