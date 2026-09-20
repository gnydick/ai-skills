// Story: #132 § 9. The slip box's commit gate: a dictation note is verbatim, each structure note
// holds exactly the notes in force, every link resolves, the generated pages are fresh, and no
// note has two successors. Read-only (spec I23).
// Legs 1 and 7 read the change being committed: the index against HEAD in the pre-commit hook,
// or HEAD against its merge base with origin/HEAD in CI. With neither, they say so.
import fs from 'node:fs';
import path from 'node:path';
import { report } from '../lib/report.mjs';
import { parseInbox } from '../lib/inbox.mjs';
import { git, gitRaw } from '../lib/git.mjs';
import { checkoutRoot } from '../lib/root.mjs';
import { parseFrontmatter } from '../lib/frontmatter.mjs';
import { unquote } from '../lib/blockquote.mjs';
import { links, section } from '../lib/embed.mjs';
import { findMarkers, resolveMarkers } from '../lib/markers.mjs';
import { idToStamp } from '../lib/layout.mjs';
import { loadSlipbox, inForce, expected, subsystemsOf, readStructure, regenerate, renderCurrent, staleGenerated, dictationQuote, isSupersededDecision, readText } from '../lib/slipbox.mjs';

export const declaration = Object.freeze({ id: 'slipbox_check', run: 'slipboxCheck', blocking: true, wired: true });

const VERB = { M: 'modified', D: 'deleted', R: 'renamed', T: 'retyped', C: 'copied' };

function changes(root) {
  const parse = (out) => out.split('\n').filter(Boolean).map((l) => { const [st, a, b] = l.split('\t'); return { status: st[0], path: a, to: b ?? null }; });
  const head = git(['rev-parse', '--verify', '-q', 'HEAD'], root);
  if (head.code !== 0) return { base: null, next: null, rows: [] };
  const staged = git(['diff', '--cached', '--name-status', '-M', 'HEAD'], root);
  if (staged.code === 0 && staged.stdout) return { base: 'HEAD', next: '', rows: parse(staged.stdout) };
  const mb = git(['merge-base', 'HEAD', 'origin/HEAD'], root);
  if (mb.code === 0 && mb.stdout && mb.stdout !== head.stdout) return { base: mb.stdout, next: 'HEAD', rows: parse(git(['diff', '--name-status', '-M', mb.stdout, 'HEAD'], root).stdout) };
  return { base: 'HEAD', next: '', rows: [] };
}
// `next` '' reads the index (`:path`); 'HEAD' reads the commit.
const show = (root, ref, rel) => { const r = gitRaw(['show', `${ref}:${rel}`], root); return r.code === 0 ? r.stdout : null; };
const frontOf = (text) => { try { return text === null ? null : parseFrontmatter(text).data; } catch { return null; } };
const withoutStatus = (t) => (t ?? '').split(/\r?\n/).filter((l) => !/^- \*\*Status:\*\* /.test(l)).join('\n').trim();

// STATUS 52's split, ruled for the slip box on 2026-09-19: the NOTES are ordinary files written on
// a branch and merged, so every leg judges the CHECKOUT being committed — from a linked worktree
// that is the worktree, where the gate's `root` is the main checkout. Only the spec inbox stays at
// `root`: a capture is shared by every worktree. Measured before the ruling: with `root`, a commit
// in a worktree had its notes read, and its diff taken, in the main checkout — so the diff called
// every file the branch had ever added an addition of that one commit.
export function slipboxCheck({ specInbox }) {
  const repo = checkoutRoot();
  // loadSlipbox throws when two files share an id. Unwrapped, that throw escapes to gate.mjs and
  // becomes `gate check slipbox_check could not run`: no leg, no denominator, no fix named — and
  // it refuses every commit in the project, the rename that cures it included, so only --no-verify
  // gets out. An unmigrated project can hit it too. As a leg it prints its denominator and the fix.
  let box;
  try { box = loadSlipbox(repo); } catch (e) {
    report('slipbox_check', 1, 1, 'slip box file(s) with a clashing id (must be 0)');
    process.stdout.write(`commit refused: the slip box cannot be read — ${e.message}; rename one of them so every note has its own id, and commit that rename\n`);
    return false;
  }
  const live = inForce(box);
  let ok = true;
  const leg = (bad, of, note, lines) => {
    report('slipbox_check', bad, of, note);
    for (const l of lines) process.stdout.write(`commit refused: ${l}\n`);
    if (lines.length) ok = false;
  };

  const ch = changes(repo);
  const relDir = (abs) => path.relative(repo, abs).split(path.sep).join('/');
  const directlyIn = (p, abs) => { const d = relDir(abs) + '/'; return p.startsWith(d) && !p.slice(d.length).includes('/'); };
  const P = box.paths;

  // Leg 1 — immutable (#132 § 9). A note is never edited; an ADR changes only its status line; a
  // design that was approved or historical, and a plan that was done, abandoned or historical, are frozen.
  const frozen = [];
  let considered = 0;
  for (const r of ch.rows) {
    if (r.status === 'A') continue;
    const p = r.path, verb = VERB[r.status] ?? 'changed';
    if (directlyIn(p, P.notes)) { considered++; frozen.push(`${p} was ${verb} — a note is never edited; file a new note that supersedes it`); continue; }
    if (directlyIn(p, P.decisions) && /^\d{4}-.*\.md$/.test(path.posix.basename(p))) {
      considered++;
      if (r.status !== 'M' || withoutStatus(show(repo, ch.base, p)) !== withoutStatus(show(repo, ch.next, p))) frozen.push(`${p} was ${verb} beyond its status line — a decision is superseded by a new ADR, never edited`);
      continue;
    }
    if ((directlyIn(p, P.spSpecs) || directlyIn(p, P.spPlans)) && p.endsWith('.md')) {
      considered++;
      const before = frontOf(show(repo, ch.base, p));
      const locked = (before?.kind === 'design' && ['approved', 'historical'].includes(before.status)) || (before?.kind === 'plan' && ['done', 'abandoned', 'historical'].includes(before.status));
      if (locked) frozen.push(`${p} was ${verb}, but it was ${before.status} — ${before.kind === 'design' ? 'write a new design note that supersedes it' : 'a finished plan is history'}`);
    }
  }
  leg(frozen.length, considered, ch.base === null ? 'frozen file(s) changed (no base: nothing committed yet)' : 'frozen file(s) changed (must be 0)', frozen);

  // Leg 7 — filed (#132 § 10). A superpowers file added by this change carries front matter.
  const added = ch.rows.filter((r) => ['A', 'R', 'C'].includes(r.status)).map((r) => r.to ?? r.path)
    .filter((p) => (directlyIn(p, P.spSpecs) || directlyIn(p, P.spPlans)) && p.endsWith('.md'));
  const unfiled = added.filter((p) => !frontOf(show(repo, ch.next, p))?.kind)
    .map((p) => `${p} has no front matter — run intake.mjs ${directlyIn(p, P.spPlans) ? 'plan --file <path> --ticket <n>' : 'design --file <path>'}`);
  leg(unfiled.length, added.length, 'added superpowers file(s) unfiled (must be 0)', unfiled);

  const specsRel = path.relative(repo, box.paths.specs).split(path.sep).join('/') + '/';

  // Leg 2a — front matter the reader cannot parse, in a file the slip box OWNS. Such a block leaves
  // `kind`, `subsystems` and `supersedes` empty, so a decision note drops out of membership and what
  // it superseded comes back to life with no leg saying a word. A superpowers file is someone
  // else's text and is never refused: an unmigrated project stays committable (D13).
  const owned = [...box.notes.values()].filter((n) => n.rel.startsWith(specsRel));
  const unreadable = owned.filter((n) => n.error).map((n) => `${n.rel} has front matter this reader cannot read — ${n.error}; fix the --- block`);
  leg(unreadable.length, owned.length + box.structures.size, 'slip box file(s) whose front matter cannot be read (must be 0)', unreadable);

  // Leg 2 — verbatim. Every file under notes/ is a dictation, a version or an owner note, and a
  // dictation note quotes its FILED inbox entry byte for byte.
  //
  // An OWNER note is skipped, denominator included (owner, 2026-09-19: "Carry them as owner
  // notes"). It was transcribed from an old spec file the owner typed by hand, so BY DEFINITION it
  // has no inbox entry and this leg can never prove it: the note says so in its own first line.
  // Leg 1 still freezes it — an owner note is never edited — and leg 3 still demands its embed.
  const entries = fs.existsSync(specInbox) ? parseInbox(fs.readFileSync(specInbox, 'utf8')) : [];
  const filed = new Map(entries.filter((e) => e.state === 'FILED').map((e) => [e.stamp, e.text]));
  const inNotes = [...box.notes.values()].filter((n) => n.rel.startsWith(path.relative(repo, box.paths.notes).split(path.sep).join('/') + '/'));
  const unjudgeable = (n) => ['version', 'owner'].includes(n.kind);
  const verbatim = inNotes.flatMap((n) => {
    if (unjudgeable(n)) return [];
    if (n.kind !== 'dictation') return [`${n.rel} is under notes/ but is neither a dictation, a version nor an owner note${n.error ? ` (${n.error})` : ''}`];
    const want = filed.get(idToStamp(n.id));
    if (want === undefined) return [`${n.rel} has no FILED spec-inbox entry with stamp ${idToStamp(n.id)} — a dictation note is written only by intake.mjs spec`];
    let got = null;
    try { const q = dictationQuote(n.body); got = q === null ? null : unquote(q); } catch {}
    return got === want ? [] : [`${n.rel} does not quote its inbox entry ${idToStamp(n.id)} byte for byte — restore it from the inbox; a dictation note is never edited`];
  });
  leg(verbatim.length, inNotes.filter((n) => !unjudgeable(n)).length, 'dictation note(s) not verbatim (must be 0)', verbatim);

  // Leg 3 — membership (#132 § 5).
  const why = (id) => {
    const n = box.notes.get(id);
    if (!n) return 'not a note';
    if (['map', 'plan'].includes(n.kind)) return `a ${n.kind}, never embedded`;
    return live.has(id) ? 'not an in-force note of this subsystem' : 'superseded or consumed';
  };
  const subs = subsystemsOf(box, live);
  const member = [];
  let badSubs = 0;
  for (const s of subs) {
    const before = member.length;
    const st = box.structures.get(s);
    const want = expected(box, s, live);
    if (!st) { member.push(`subsystem '${s}' has in-force notes but no structure note — file through intake.mjs, which creates it`); badSubs++; continue; }
    const have = readStructure(st.text);
    for (const id of have.embeds.filter((x) => !want.embeds.includes(x))) member.push(`${st.rel} embeds ${id}, which is ${why(id)} — embed the note in force instead`);
    for (const id of want.embeds.filter((x) => !have.embeds.includes(x))) member.push(`${st.rel} is missing the in-force note ${id}`);
    for (const h of have.headingEmbeds.filter((x) => !want.designs.includes(x.id))) member.push(`${st.rel} embeds ${h.id}#${h.heading}, which is ${why(h.id)} — only an approved, in-force design note is embedded by heading`);
    for (const id of want.designs.filter((x) => !have.headingEmbeds.some((h) => h.id === x))) member.push(`${st.rel} embeds no heading of the approved design note ${id} — run intake.mjs design --embed`);
    for (const id of have.why.filter((x) => { const n = box.notes.get(x); return n && isSupersededDecision(n); })) member.push(`${st.rel} links ${id} under "Why it is this way", but that decision is superseded — run intake.mjs decision --file on its successor`);
    for (const id of want.decisions.filter((x) => !have.why.includes(x))) member.push(`${st.rel} does not link the decision ${id} — run intake.mjs decision --file`);
    if (member.length > before) badSubs++;
  }
  leg(badSubs, subs.length, 'subsystem(s) with wrong membership (must be 0)', member);

  // Leg 4 — links resolve, headings exist, references exist.
  const texts = [
    ...[...box.notes.values()].filter((n) => n.rel.startsWith(specsRel)).map((n) => [n.rel, n.body]),
    ...[...box.structures.values()].map((s) => [s.rel, s.text]),
  ];
  const broken = [];
  const badFiles = new Set();
  for (const [rel, text] of texts) {
    for (const l of links(text)) {
      const t = box.notes.get(l.id);
      if (!t) { broken.push(`${rel} links [[${l.id}]], which does not exist`); badFiles.add(rel); }
      else if (l.heading && section(t.body, l.heading) === null) { broken.push(`${rel} links [[${l.id}#${l.heading}]], but ${t.rel} has no heading '${l.heading}'`); badFiles.add(rel); }
    }
  }
  for (const s of box.structures.values()) {
    for (const href of readStructure(s.text).refs) {
      if (/^([a-z][a-z0-9+.-]*:|#)/i.test(href) || fs.existsSync(path.join(repo, path.dirname(s.rel), href))) continue;
      broken.push(`${s.rel} references ${href}, which does not exist`); badFiles.add(s.rel);
    }
  }
  leg(badFiles.size, texts.length, 'file(s) with broken links (must be 0)', broken);

  // Leg 4b — the code's citations resolve (#136). Same failure mode as leg 4: a citation that
  // resolves to nothing. The direction is the other way round — the code cites the note — so the
  // scan is over the CHECKOUT's tracked files, not over the slip box.
  //
  // The slip box is excluded from the scan: the notes are the authority a marker points AT, and a
  // note quoting a marker is quoting, not citing.
  //
  // `git grep` exits 1 for "no matches" and >1 for a real error. A real error is reported as the
  // leg failing to run rather than as zero markers: a scan that could not look must never read as
  // a scan that looked and found nothing.
  const hits = git(['grep', '-I', '--no-color', '-z', '-e', 'spec:', '--', '.', ':!docs/dictated-specs'], repo);
  if (hits.code > 1) {
    leg(1, 1, 'marker scan(s) that could not run (must be 0)', [`the marker scan failed — ${hits.stderr || `git grep exited ${hits.code}`}; fix that, then commit again`]);
  } else {
    const files = hits.code === 0 ? hits.stdout.split(/\r?\n/).filter(Boolean).map((row) => {
      const cut = row.indexOf('\0');
      return { path: row.slice(0, cut), text: row.slice(cut + 1) };
    }) : [];
    const { marked, unknown } = resolveMarkers(findMarkers(files), box);
    const stranded = unknown.flatMap(({ id, paths }) => paths.map((p) => `${p} marks spec:${id}, but no note has that id — fix the marker, or file the note it means`));
    leg(unknown.length, marked.size + unknown.length, 'marker(s) naming a note that does not exist (must be 0)', stranded);
  }

  // Leg 5 — generated pages are fresh. Compared in memory; the gate never writes.
  //
  // ONE page that cannot be generated used to cascade: `want` stayed empty, so the orphan sweep
  // below reported every existing generated page as "has no structure note behind it", and the
  // denominator read 0 — no count behind a wall of wrong advice (merge review 2, F6). A failure is
  // now reported as itself, against the number of pages this leg covers, and the sweep does not
  // run: with nothing generated there is nothing to compare an existing page against.
  let want = null;
  try { want = regenerate(box); } catch (e) {
    const who = [...box.structures.keys()].find((s) => { try { renderCurrent(box, s); return false; } catch { return true; } });
    const which = who ? relDir(path.join(P.current, `${who}.md`)) : 'the slip box';
    leg(1, box.structures.size + 1, 'generated page(s) stale (must be 0)', [`${which} cannot be generated — ${e.message}; fix what that names, then run intake.mjs regen`]);
  }
  if (want) {
    const stale = [];
    for (const [rel, text] of want) {
      const abs = path.join(repo, rel);
      // Read through the read model, so a CRLF checkout is not reported as a stale page.
      const cur = fs.existsSync(abs) ? readText(abs) : null;
      if (cur !== text) stale.push(`${rel} is ${cur === null ? 'missing' : 'stale'} — run intake.mjs regen`);
    }
    for (const rel of staleGenerated(box, want)) stale.push(`${rel} has no structure note behind it — run intake.mjs regen`);
    leg(stale.length, want.size, 'generated page(s) stale (must be 0)', stale);
  }

  // Leg 6 — no fork: each note has at most one successor.
  const by = new Map();
  for (const n of box.notes.values()) for (const s of n.supersedes) by.set(s, [...(by.get(s) ?? []), n.id]);
  const forks = [...by].filter(([, v]) => v.length > 1).map(([s, v]) => `${s} is superseded by ${v.length} notes (${v.join(', ')}) — the later one must supersede ${v[0]} instead`);
  leg(forks.length, by.size, 'superseded note(s) with a fork (must be 0)', forks);

  return ok;
}
