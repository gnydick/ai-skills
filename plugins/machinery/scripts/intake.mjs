#!/usr/bin/env node
// Story: skills/rule-process/SKILL.md — the mechanical steps. A project rule or a specification is one
// commit in the project (spec I30); a universal rule is one dated bullet in the user's own
// ~/.claude/rules/universal.md, with nothing to commit (STATUS 54).
import fs from 'node:fs';
import path from 'node:path';
import { git } from './lib/git.mjs';
import { projectRoot, checkoutRoot, isRootSession } from './lib/root.mjs';
import { projectInbox, projectRules, projectSpecInbox, projectIssueTracking, universalInbox, universalRules } from './lib/config.mjs';
import { pending, setDisposition, newStamp } from './lib/inbox.mjs';
import { UNANSWERED, UNIVERSAL_HEADING } from './lib/layout.mjs';
import { fileSpec, regen, fileDecision, fileRef, fileDesign, approveDesign, embedDesign, filePlan, closePlan, fileMap } from './lib/slipbox-file.mjs';
import { CAPTURE_NOTE, normalizeAnswer, readIfPresent } from './lib/issue-tracking.mjs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const argv = process.argv.slice(2);
const cmd = argv[0];
const opt = (k) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : null; };
const csv = (k) => (opt(k) ?? '').split(',').map((s) => s.trim()).filter(Boolean);
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
  if (kind !== 'project' || !stamp || !home) die('usage: intake commit --kind project [--root <dir>] --stamp <stamp> --home "<file § Section>" (a specification is filed with intake spec)');
  const cwd = opt('--root') || process.cwd();
  if (!isRootSession(cwd)) die(`a project rule is filed only from the root session: run /machinery:rule-process from ${projectRoot(cwd)}`);
  const repo = projectRoot(cwd), inbox = projectInbox(repo), rules = projectRules(repo);
  const entry = pending(inbox).find((e) => e.stamp === stamp);
  if (!entry) die(`no PENDING entry with stamp ${stamp} in ${inbox}`);
  let subject = `rule: ${entry.text.split('\n')[0].slice(0, 72)}`;
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
// ~/.claude/rules/universal.md — seeded with its one-line heading by install.mjs (owner, 2026-09-15),
// and created here the same way for a home no install has run on, so place.mjs (the one bullet
// writer) appends under that title — and the user's inbox entry is dispositioned. The home is not a
// repository: nothing is bumped, built or committed, and the plugin's core.md and skills are never
// touched. Works from any directory, a worktree included.
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

// #132 § 7. The AI has chosen subsystems, topic and any supersede before this runs; the words
// come from the inbox entry only, never from the command line.
function spec() {
  const cwd = opt('--root') || process.cwd();
  if (!isRootSession(cwd)) die(`a specification is filed only from the root session: run /machinery:rule-process from ${projectRoot(cwd)}`);
  const stamp = opt('--stamp'), topic = opt('--topic'), title = opt('--title');
  const subsystems = csv('--subsystems'), supersedes = csv('--supersedes'), versions = csv('--version');
  if (!stamp || !topic || !title || !subsystems.length) die('usage: intake spec --stamp <s> --subsystems <a,b> --topic "<t>" --title "<title>" [--supersedes <id,…>] [--version <file,…>]');
  let r;
  try { r = fileSpec({ repo: projectRoot(cwd), stamp, subsystems, topic, title, supersedes, versions }); } catch (e) { die(e.message); }
  const lines = [
    `committed: ${r.subject}`,
    `note: ${r.id}`,
    `subsystems: ${subsystems.map((s) => (r.newSubs.includes(s) ? `${s} (new)` : s)).join(', ')}`,
    `topic: ${topic}`,
    `change: ${supersedes.length ? `${r.partial ? 'partial' : 'full'} — supersedes ${supersedes.join(', ')}` : 'new'}`,
    ...r.vIds.flatMap((v, i) => [`version note ${v} (composed by the assistant; review it):`, r.versionTexts[i].replace(/\n+$/, '')]),
  ];
  process.stdout.write(lines.join('\n') + '\n');
}

// Owner, 2026-09-19: the writer and the checker must agree on one tree. The gate judges the
// CHECKOUT being committed (#132 § 9), so an ADR is linked in the checkout it is committed with —
// checkoutRoot, not projectRoot, which would resolve a linked worktree to the main checkout and
// land the link where the gate never looks. Only the spec inbox stays shared, and spec() keeps it.
function decision() {
  const f = opt('--file');
  if (!f) die('usage: intake decision --file docs/dictated-specs/decisions/<00NN-slug>.md');
  let r;
  try { r = fileDecision({ repo: checkoutRoot(opt('--root') || process.cwd()), file: f }); } catch (e) { die(e.message); }
  process.stdout.write(`linked ${r.id} under "Why it is this way" in: ${r.subsystems.join(', ')}\n${r.generated.map((c) => `regenerated ${c}`).join('\n')}${r.generated.length ? '\n' : ''}commit the ADR and these files with the work\n`);
}

// checkoutRoot for the same reason as decision(): the reference is written where the gate's link
// leg (#132 § 9) reads it, which is the checkout being committed.
function ref() {
  const subsystem = opt('--subsystem'), target = opt('--path');
  if (!subsystem || !target) die('usage: intake ref --subsystem <s> --path <repo-relative file>');
  let r;
  try { r = fileRef({ repo: checkoutRoot(opt('--root') || process.cwd()), subsystem, target }); } catch (e) { die(e.message); }
  process.stdout.write(`referenced ${r.href} from ${subsystem}\n${r.generated.map((c) => `regenerated ${c}`).join('\n')}${r.generated.length ? '\n' : ''}`);
}

// checkoutRoot for the same reason as decision(): a design is written, approved and embedded in
// the checkout it is committed with, which is the tree the gate's legs (#132 § 9) read.
function design() {
  const repo = checkoutRoot(opt('--root') || process.cwd());
  try {
    if (opt('--approve')) {
      const r = approveDesign({ repo, file: opt('--approve') });
      process.stdout.write(`approved ${r.id}${r.subsystems.length ? ` — embed its decision heading in ${r.subsystems.join(', ')} with intake design --embed` : ''}\n`);
    } else if (opt('--embed')) {
      const heading = opt('--heading'), subsystem = opt('--subsystem'), topic = opt('--topic');
      // Measured 2026-09-19: without these the placement interpolated `null`, writing
      // structure/null.md and a null row in INDEX.md — a junk subsystem that then refuses every
      // commit, and D2 forbids deleting a structure note by hand. Guarded before anything is written.
      if (!subsystem || !topic) die('usage: intake design --embed <path> --subsystem <s> --topic "<t>" --heading "<h>"');
      embedDesign({ repo, file: opt('--embed'), subsystem, topic, heading });
      process.stdout.write(`embedded heading '${heading}' — it must record a decision, an owner constraint or a principle, never implementation\n`);
    } else if (opt('--file')) {
      fileDesign({ repo, file: opt('--file'), subsystems: csv('--subsystems'), supersedes: csv('--supersedes'), ticket: opt('--ticket') });
      process.stdout.write(`filed ${opt('--file')} as a draft design\n`);
    } else die('usage: intake design --file <path> [--subsystems a,b] [--ticket n] [--supersedes id] | --approve <path> | --embed <path> --subsystem <s> --topic "<t>" --heading "<h>"');
  } catch (e) { die(e.message); }
}

// checkoutRoot for the same reason as decision(): the plan is filed in the checkout being committed.
function plan() {
  const repo = checkoutRoot(opt('--root') || process.cwd());
  const f = opt('--file');
  if (!f) die('usage: intake plan --file <path> --ticket <n> | --file <path> --status done|abandoned');
  try {
    if (opt('--status')) closePlan({ repo, file: f, status: opt('--status') });
    else filePlan({ repo, file: f, ticket: opt('--ticket') });
  } catch (e) { die(e.message); }
  process.stdout.write(`plan ${f}: ${opt('--status') ?? 'in-progress'}\n`);
}

// checkoutRoot for the same reason as decision(): the map is marked in the checkout being committed.
function map() {
  const f = opt('--file');
  if (!f) die('usage: intake map --file <path>');
  try { fileMap({ repo: checkoutRoot(opt('--root') || process.cwd()), file: f }); } catch (e) { die(e.message); }
  process.stdout.write(`${f} is a living map: kept by hand, never embedded, linked with intake ref\n`);
}

// checkoutRoot for the same reason as decision(): regen rewrites the generated pages the gate's
// freshness leg (#132 § 9) compares, and that leg reads the checkout being committed.
function regenerateCmd() {
  const repo = checkoutRoot(opt('--root') || process.cwd());
  let changed;
  try { changed = regen(repo); } catch (e) { die(e.message); }
  process.stdout.write(changed.length ? changed.map((c) => `regenerated ${c}`).join('\n') + '\n' : 'regen: nothing to regenerate\n');
}

if (cmd === 'list') list(); else if (cmd === 'commit') commit(); else if (cmd === 'universal') universal();
else if (cmd === 'spec') spec(); else if (cmd === 'regen') regenerateCmd();
else if (cmd === 'decision') decision(); else if (cmd === 'ref') ref();
else if (cmd === 'design') design(); else if (cmd === 'plan') plan(); else if (cmd === 'map') map();
else die('usage: intake list [--root <dir>] | intake commit … | intake universal … | intake spec … | intake decision … | intake ref … | intake design … | intake plan … | intake map … | intake regen');
