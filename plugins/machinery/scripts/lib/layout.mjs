import os from 'node:os';
import path from 'node:path';

// The machinery layout: the one spelling of every file name that more than one unit has to name,
// and the one test of whether a filed path lives inside the spec area.
//
// Two units name these files and neither can import the other: lib/config.mjs resolves paths for
// the hooks and the intake, and gate/gate.mjs builds its own layout because it ships standalone into
// an adopting project and must not point back at the plugin cache (spec I6). A name spelled in two
// places is a name that can drift, so it is declared once here and both read it. The generated rule
// and spec indexes are gone (recalibration decision 10); the gate checks the inboxes only.
export const INBOX = 'inbox.md';
export const SPEC_INBOX = 'spec-inbox.md';
// The user's universal rules (STATUS 54): a URULE is universal for the USER, so it files into
// ~/.claude/rules/universal.md — Claude Code's per-user always-loaded location, which reaches
// subagents through the CLAUDE.md hierarchy and survives uninstalling the plugin — and its inbox is
// ~/.claude/machinery/inbox.md. Neither is configurable and nothing points back at the plugin; the
// plugin's core.md and skills change only by editing the repo. The home is resolved HERE, once:
// MACHINERY_HOME is the test suites' throwaway home, and every reader of it goes through userHome().
export const UNIVERSAL_RULES = 'universal.md';
// Its one heading: install.mjs seeds the file with it (owner, 2026-09-15) and intake.mjs files each
// URULE under it, so the two must agree — a title place.mjs does not find is a section it appends.
export const UNIVERSAL_HEADING = '# Universal rules';
export const userHome = () => process.env.MACHINERY_HOME || os.homedir();
export const userInbox = (home) => path.join(home, '.claude', MACHINERY_DIR, INBOX);
export const userRules = (home) => path.join(home, '.claude', RULES_DIR, UNIVERSAL_RULES);
// Issue tracking configuration (docs/superpowers/specs/2026-09-12-issue-tracking-config-design.md).
// Two files hold the developer's one answer about where issue tracking lives. Three units name them
// and none can import another — install.mjs seeds them, lib/issue-tracking.mjs reads them through
// config.mjs, intake.mjs routes to one — which is the condition this file exists for.
//
// The NAMES are the owner's, verbatim, underscores included; renaming them to kebab-case is a change
// to what the owner dictated, not a tidy-up.
//
// The STATE WORDS: UNANSWERED means install seeded the file and nobody has been asked (an empty file
// reads the same); NONE means asked and answered, no issue tracking here. They are distinct states,
// neither merged into the other nor into absence of the file. Install writes the word and the
// precedence function compares against it, so a mismatch between the two would fail SILENTLY.
export const GLOBAL_ISSUE_TRACKING = 'global_issue_tracking.md';
export const PROJECT_ISSUE_TRACKING = 'project_issue_tracking.md';
export const UNANSWERED = 'unanswered';
export const NONE = 'none';
// Project-relative directories. Captured specifications persist at ONE fixed, known location —
// `docs/dictated-specs` at the project root — and nothing resolves, declares or guesses it per
// project (owner, 2026-09-07: "we just need a unique location to persist those specs", then "i
// don't want specs under .claude/rules i want docs/dicatated-specs", read as `dictated-specs`
// because the string becomes a path). The name matches the vocabulary the rules already use: a
// specification handed down is dictated, exactly as a standing rule is. It is machinery's own
// ground and not another plugin's — in particular not `docs/superpowers/`, where this repo's own
// machinery specification currently sits ("i don't want to mix with superpowers necessarily").
//
// This is not a fabricated default. What is forbidden is guessing at a setting whose absence
// means "inherit the project's own
// arrangement". This is machinery's own storage, the same kind of fact as
// `.claude/machinery/inbox.md`, which nobody declares either.
//
// WHAT THIS LOCATION IS NOT: auto-loaded. `docs/` is not under `.claude/`, so nothing puts a filed
// specification into a session's context. Making one reach a session is a separate piece of work
// (#81 Part 4) and no code, comment or test here may assume it happens.
export const RULES_DIR = 'rules';
export const DOCS_DIR = 'docs';
export const SPECS_DIR = 'dictated-specs';
export const MACHINERY_DIR = 'machinery';
// The project's recorded settings (recalibration decisions 22, 39, 41): written by setup.mjs
// through lib/settings.mjs, read by the hooks and skills that need an answer.
export const CONFIG = 'config.json';

// The disposition vocabulary for a filed specification (#81). Both the gate leg that refuses a bad
// filing and the intake that writes one need this test, and neither depends on the other, so it
// lives here rather than in either — a shared definition in a unit with no dependencies of its
// own. Two call sites spelling the containment test themselves is exactly how they drift apart.

// The path half of a `filed → <path> § <Section>` disposition, or null when the disposition is not
// a filing at all (a dismissal, or a line no writer of ours produced).
export function filedPath(disposition) {
  const m = /^filed\s*→\s*(.+)$/.exec(String(disposition ?? '').trim());
  if (!m) return null;
  const p = m[1].split(' § ')[0].trim();
  return p || null;
}

// True when `p`, as written in a disposition, names something under the project's spec area. A
// containment test, not an existence test: this judges where a specification was filed, never
// whether that file happens to be on this machine right now.
export function insideSpecArea(root, specsDir, p) {
  const toPosix = (s) => s.split(path.sep).join('/');
  const rel = toPosix(path.relative(root, specsDir)) + '/';
  const q = toPosix(path.isAbsolute(p) ? path.relative(root, p) : p).replace(/^\.\//, '');
  return q.startsWith(rel) && !q.split('/').includes('..');
}

// #132: the slip box (Zettelkasten). Every name is spelled here once; the gate, intake, the
// banner and install all build paths from slipboxPaths.
export const NOTES_DIR = 'notes';
export const DECISIONS_DIR = 'decisions';
export const STRUCTURE_DIR = 'structure';
export const INDEX_FILE = 'INDEX.md';
export const CURRENT_DIR = 'spec-current';
export const SUPERPOWERS_DIR = 'superpowers';
export const ADR_DIR = 'adr';

// A subsystem name is a FILE NAME: docs/dictated-specs/structure/<name>.md and
// docs/spec-current/<name>.md. Measured 2026-09-19 (merge review 2, F3): `--subsystems
// "tooling/deep"` wrote structure/tooling/deep.md, which the read model's non-recursive mdFiles
// never finds, while subsystemsOf still reported 'tooling/deep' — gate leg 3 then refused every
// commit in the project with advice that cannot work, the note was immutable, and --no-verify was
// the only way out. So every entry point that accepts a subsystem checks the name BEFORE it
// writes. The illegal set is Windows's, which is the stricter of the two; '.' and '..' are path
// segments that are not names, and a trailing dot or space is a name Windows cannot create.
const ILLEGAL_IN_A_FILENAME = /[\\/:*?"<>|\u0000-\u001f]/;
// Generic: is `name` writable as one file name? A subsystem is one (structure/<name>.md) and so is
// a note id (notes/<id>.md), and both are refused BEFORE anything is written, so `what` names the
// thing in the message rather than each caller spelling the test again.
export function fileNameProblem(name, what = 'name') {
  const s = typeof name === 'string' ? name : String(name ?? '');
  const bad = (why) => `${what} '${s}': ${why}`;
  if (!s.trim()) return bad(`a ${what} may not be empty`);
  if (ILLEGAL_IN_A_FILENAME.test(s)) return bad(`a ${what} is one path segment — no / \\ : * ? " < > | or control character`);
  if (s === '.' || s === '..') return bad(`a ${what} is one path segment, not '.' or '..'`);
  if (/[. ]$/.test(s)) return bad(`a ${what} may not end in a dot or a space — no such file name exists on Windows`);
  return null;
}
export const subsystemProblem = (name) => fileNameProblem(name, 'subsystem');
export function checkSubsystem(name) {
  const problem = subsystemProblem(name);
  if (problem) throw new Error(problem);
  return name;
}

// An OWNER note's id (#132; owner, 2026-09-19: "Carry them as owner notes"). Such a note was typed
// into an old spec file by hand, never captured, so it has no stamp to take an id from: the id is
// derived from the heading it was transcribed from. The `owner-` prefix keeps it out of the stamp
// ids' space — a stamp id always begins with a digit — and the slug is a legal file name by
// construction. null when nothing of the heading survives, which the caller refuses.
export function ownerId(heading) {
  const slug = String(heading ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return slug ? `owner-${slug}` : null;
}

// A capture stamp as a note id: ':' is illegal in a Windows filename (#132 § 3).
export const stampToId = (stamp) => stamp.replaceAll(':', '-');
export const idToStamp = (id) => id.replace(/T(\d\d)-(\d\d)-(\d\d)Z$/, 'T$1:$2:$3Z');

export function slipboxPaths(root) {
  const specs = path.join(root, DOCS_DIR, SPECS_DIR);
  return {
    specs,
    notes: path.join(specs, NOTES_DIR),
    decisions: path.join(specs, DECISIONS_DIR),
    structure: path.join(specs, STRUCTURE_DIR),
    index: path.join(specs, INDEX_FILE),
    current: path.join(root, DOCS_DIR, CURRENT_DIR),
    spSpecs: path.join(root, DOCS_DIR, SUPERPOWERS_DIR, 'specs'),
    spPlans: path.join(root, DOCS_DIR, SUPERPOWERS_DIR, 'plans'),
    adr: path.join(root, DOCS_DIR, ADR_DIR),
    specInbox: path.join(root, '.claude', MACHINERY_DIR, SPEC_INBOX),
  };
}
