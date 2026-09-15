#!/usr/bin/env node
// Story: skills/rule-process/SKILL.md — the mechanical steps. A project rule or a specification is one
// commit in the project (spec I30); a universal rule is one dated bullet in the user's own
// ~/.claude/rules/universal.md, with nothing to commit (STATUS 54).
import fs from 'node:fs';
import path from 'node:path';
import { git } from './lib/git.mjs';
import { projectRoot, isRootSession } from './lib/root.mjs';
import { projectInbox, projectRules, projectSpecs, projectSpecInbox, projectIssueTracking, universalInbox, universalRules } from './lib/config.mjs';
import { pending, setDisposition, newStamp } from './lib/inbox.mjs';
import { insideSpecArea, UNANSWERED } from './lib/layout.mjs';
import { CAPTURE_NOTE, normalizeAnswer, readIfPresent } from './lib/issue-tracking.mjs';
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
  // The user's inbox is listed from any directory: filing it needs no repository (STATUS 54).
  for (const e of pending(universalInbox())) out.push([e.stamp, e.marker, universalInbox(), e.text.split('\n')[0]]);
  process.stdout.write(out.map((r) => r.join('\t')).join('\n') + (out.length ? '\n' : ''));
}

function commit() {
  const kind = opt('--kind'), stamp = opt('--stamp');
  let home = opt('--home');
  if (!['project', 'spec'].includes(kind) || !stamp || !home) die('usage: intake commit --kind project|spec [--root <dir>] --stamp <stamp> --home "<file § Section>"');
  let repo, inbox, rules;
  const cwd = opt('--root') || process.cwd();
  // #81: a specification is filed exactly like a project rule — root session, one commit, one repo —
  // but into the spec area. The home is checked against that area HERE as well as at the gate, so
  // the intake cannot write the very disposition the gate rejects.
  if (kind === 'spec') {
    if (!isRootSession(cwd)) die(`a specification is filed only from the root session: run /machinery:rule-process from ${projectRoot(cwd)}`);
    repo = projectRoot(cwd); inbox = projectSpecInbox(repo); rules = projectSpecs(repo);
    const filed = home.split(' § ')[0].trim();
    if (!insideSpecArea(repo, rules, filed)) die(`refusing to file a specification outside the spec area: '${filed}' is not under ${rules}. The spec area is declared by /machinery:install and never guessed.`);
  } else {
    if (!isRootSession(cwd)) die(`a project rule is filed only from the root session: run /machinery:rule-process from ${projectRoot(cwd)}`);
    repo = projectRoot(cwd); inbox = projectInbox(repo); rules = projectRules(repo);
  }
  const entry = pending(inbox).find((e) => e.stamp === stamp);
  if (!entry) die(`no PENDING entry with stamp ${stamp} in ${inbox}`);
  let subject = `${kind === 'spec' ? 'spec' : 'rule'}: ${entry.text.split('\n')[0].slice(0, 72)}`;
  // An issue-tracking answer (recalibration 33, 36; #99): recorded by issue-tracking.mjs
  // record-project with CAPTURE_NOTE, it is filed as the WHOLE project file — one current answer,
  // never a history — and only there; a re-run replaces it, and the commit names old and new so git
  // holds the history the file does not.
  if (kind === 'project' && entry.text.endsWith(CAPTURE_NOTE)) {
    const toPosix = (p) => p.split(path.sep).join('/');
    const file = projectIssueTracking(repo);
    const rel = toPosix(path.relative(repo, file));
    if (home.split(' § ')[0].trim() !== rel) die(`an issue-tracking entry is filed only to ${rel} — run again with --home "${rel}"`);
    const answer = normalizeAnswer(entry.text.slice(0, -CAPTURE_NOTE.length));
    const old = (readIfPresent(file) ?? UNANSWERED).trim().split('\n')[0];
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, `${answer}\n`, 'utf8');
    home = rel; // the disposition is `filed → <file>`: the whole file, no section
    subject = `rule: issue tracking: ${old.slice(0, 40)} → ${answer.split('\n')[0].slice(0, 40)}`;
  }
  setDisposition(inbox, stamp, { state: 'FILED', detail: `filed → ${home}` });
  const files = [rules, inbox].map((f) => path.relative(repo, f).split(path.sep).join('/'));
  const add = git(['add', '--', ...files], repo);
  if (add.code !== 0) die(`git add failed: ${add.stderr}`);
  const c = git(['commit', '-q', '-m', `${subject}\n\nFiled → ${home}\nInbox entry ${stamp} (${entry.marker})`, '--', ...files], repo);
  if (c.code !== 0) die(`git commit failed: ${c.stderr}\n${c.stdout}`);
  process.stdout.write(`committed in ${repo}: ${subject}\n`);
}

// STATUS 54: a URULE is universal for the USER. It files as one dated bullet in
// ~/.claude/rules/universal.md — created on demand with its one-line heading, so place.mjs (the one
// bullet writer) appends under that title — and the user's inbox entry is dispositioned. The home
// is not a repository: nothing is bumped, built or committed, and the plugin's core.md and skills
// are never touched. Works from any directory, a worktree included.
const UNIVERSAL_HEADING = '# Universal rules';
function universal() {
  const stamp = opt('--stamp'), text = opt('--text');
  if (!stamp || !text) die('usage: intake universal --stamp <stamp> --text "<rule>"');
  const inbox = universalInbox();
  const entry = pending(inbox).find((e) => e.stamp === stamp);
  if (!entry) die(`no PENDING entry with stamp ${stamp} in ${inbox}`);
  const file = universalRules();
  if (!fs.existsSync(file)) { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, `${UNIVERSAL_HEADING}\n`, 'utf8'); }
  const dated = `${text.trim()} (URULE, ${newStamp().slice(0, 10)})`;
  const p = spawnSync(process.execPath, [path.join(here, 'place.mjs'), '--file', file, '--section', UNIVERSAL_HEADING.slice(2), '--text', dated], { encoding: 'utf8' });
  if (p.status !== 0) die(`place.mjs failed: ${p.stderr}`);
  setDisposition(inbox, stamp, { state: 'FILED', detail: `filed → ${file}` });
  process.stdout.write(`filed → ${file}: ${dated}\nInbox entry ${stamp} (${entry.marker}) dispositioned in ${inbox}. Nothing to commit: the file is the user's, not a repository's.\n`);
}

if (cmd === 'list') list(); else if (cmd === 'commit') commit(); else if (cmd === 'universal') universal();
else die('usage: intake list [--root <dir>] | intake commit … | intake universal …');
