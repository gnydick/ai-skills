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
import { parseFrontmatter } from '../lib/frontmatter.mjs';
import { unquote } from '../lib/blockquote.mjs';
import { links, section } from '../lib/embed.mjs';
import { idToStamp } from '../lib/layout.mjs';
import { loadSlipbox, inForce, expected, subsystemsOf, readStructure, regenerate, staleGenerated, dictationQuote, isSupersededDecision, readText } from '../lib/slipbox.mjs';

export const declaration = Object.freeze({ id: 'slipbox_check', run: 'slipboxCheck', blocking: true, wired: true });

const VERB = { M: 'modified', D: 'deleted', R: 'renamed', T: 'retyped', C: 'copied' };

// The change is read in the tree the gate RUNS in, never in `root`. In a linked worktree those are
// two different repositories: projectRoot() resolves a worktree to the main checkout, and measured
// here on 2026-09-19, diffing the worktree's index against the MAIN checkout's HEAD reported every
// file this branch had ever added as added by this commit. Paths come back relative to the
// repository top either way, so the directory tests below are unaffected.
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

export function slipboxCheck({ root, specInbox }) {
  const box = loadSlipbox(root);
  const live = inForce(box);
  let ok = true;
  const leg = (bad, of, note, lines) => {
    report('slipbox_check', bad, of, note);
    for (const l of lines) process.stdout.write(`commit refused: ${l}\n`);
    if (lines.length) ok = false;
  };

  const repo = process.cwd(); // the repository this commit is happening in (see changes())
  const ch = changes(repo);
  const relDir = (abs) => path.relative(root, abs).split(path.sep).join('/');
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

  const specsRel = path.relative(root, box.paths.specs).split(path.sep).join('/') + '/';

  // Leg 2a — front matter the reader cannot parse, in a file the slip box OWNS. Such a block leaves
  // `kind`, `subsystems` and `supersedes` empty, so a decision note drops out of membership and what
  // it superseded comes back to life with no leg saying a word. A superpowers file is someone
  // else's text and is never refused: an unmigrated project stays committable (D13).
  const owned = [...box.notes.values()].filter((n) => n.rel.startsWith(specsRel));
  const unreadable = owned.filter((n) => n.error).map((n) => `${n.rel} has front matter this reader cannot read — ${n.error}; fix the --- block`);
  leg(unreadable.length, owned.length + box.structures.size, 'slip box file(s) whose front matter cannot be read (must be 0)', unreadable);

  // Leg 2 — verbatim. Every file under notes/ is a dictation or version note, and a dictation note
  // quotes its FILED inbox entry byte for byte.
  const entries = fs.existsSync(specInbox) ? parseInbox(fs.readFileSync(specInbox, 'utf8')) : [];
  const filed = new Map(entries.filter((e) => e.state === 'FILED').map((e) => [e.stamp, e.text]));
  const inNotes = [...box.notes.values()].filter((n) => n.rel.startsWith(path.relative(root, box.paths.notes).split(path.sep).join('/') + '/'));
  const verbatim = inNotes.flatMap((n) => {
    if (n.kind === 'version') return [];
    if (n.kind !== 'dictation') return [`${n.rel} is under notes/ but is neither a dictation nor a version note${n.error ? ` (${n.error})` : ''}`];
    const want = filed.get(idToStamp(n.id));
    if (want === undefined) return [`${n.rel} has no FILED spec-inbox entry with stamp ${idToStamp(n.id)} — a dictation note is written only by intake.mjs spec`];
    let got = null;
    try { const q = dictationQuote(n.body); got = q === null ? null : unquote(q); } catch {}
    return got === want ? [] : [`${n.rel} does not quote its inbox entry ${idToStamp(n.id)} byte for byte — restore it from the inbox; a dictation note is never edited`];
  });
  leg(verbatim.length, inNotes.filter((n) => n.kind !== 'version').length, 'dictation note(s) not verbatim (must be 0)', verbatim);

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
      if (/^([a-z][a-z0-9+.-]*:|#)/i.test(href) || fs.existsSync(path.join(root, path.dirname(s.rel), href))) continue;
      broken.push(`${s.rel} references ${href}, which does not exist`); badFiles.add(s.rel);
    }
  }
  leg(badFiles.size, texts.length, 'file(s) with broken links (must be 0)', broken);

  // Leg 5 — generated pages are fresh. Compared in memory; the gate never writes.
  let want = new Map();
  const stale = [];
  try { want = regenerate(box); } catch (e) { stale.push(`the current state cannot be generated — ${e.message}`); }
  for (const [rel, text] of want) {
    const abs = path.join(root, rel);
    // Read through the read model, so a CRLF checkout is not reported as a stale page.
    const cur = fs.existsSync(abs) ? readText(abs) : null;
    if (cur !== text) stale.push(`${rel} is ${cur === null ? 'missing' : 'stale'} — run intake.mjs regen`);
  }
  for (const rel of staleGenerated(box, want)) stale.push(`${rel} has no structure note behind it — run intake.mjs regen`);
  leg(stale.length, want.size, 'generated page(s) stale (must be 0)', stale);

  // Leg 6 — no fork: each note has at most one successor.
  const by = new Map();
  for (const n of box.notes.values()) for (const s of n.supersedes) by.set(s, [...(by.get(s) ?? []), n.id]);
  const forks = [...by].filter(([, v]) => v.length > 1).map(([s, v]) => `${s} is superseded by ${v.length} notes (${v.join(', ')}) — the later one must supersede ${v[0]} instead`);
  leg(forks.length, by.size, 'superseded note(s) with a fork (must be 0)', forks);

  return ok;
}
