// Story: #132 § 11 and Amendment 1. Migration of one project into the slip box: the AI writes the
// plan, fills it and applies it, with no pause, in any checkout (D14, owner 2026-09-19:
// "Automatic anywhere"). The plan file stays as the record of what was decided. A dictation note's
// words come from the spec inbox, never from the old spec file (D11: assistant readings are not
// carried over).
import fs from 'node:fs';
import path from 'node:path';
import { git } from './git.mjs';
import { parseInbox, setDisposition } from './inbox.mjs';
import { slipboxPaths, stampToId, filedPath, subsystemProblem, checkSubsystem, insideSpecArea, ownerId, fileNameProblem } from './layout.mjs';
import { setFrontmatter, frontmatterProblem } from './frontmatter.mjs';
import { scan, section, links } from './embed.mjs';
import { loadSlipbox, inForce, readStructure, adrStatus, isSupersededDecision, readText, EMBEDDED_KINDS } from './slipbox.mjs';
import { writeOnce, writeText, dictationNote, versionNote, ownerNote, dictationFrontmatter, versionFrontmatter, ownerFrontmatter, placeEmbed, placeHeadingEmbed, placeLink, placeRef, syncGenerated } from './slipbox-write.mjs';
import { unmigrated } from './unmigrated.mjs';
import { commitPaths } from './commit.mjs';

const toPosix = (p) => p.split(path.sep).join('/');
const STATUSES = { design: ['draft', 'approved', 'historical'], plan: ['in-progress', 'done', 'abandoned', 'historical'], map: [null] };
// The owner ruled on 2026-09-19 that only ratified work is approved and "the rest historical".
// A migration of a large project is ~240 judgements, most of them this one, so a row that leaves
// `status` null is not a gap to fill: it IS historical, for a design and for a plan alike. An
// explicit status still wins — this is the default, not an override.
const DEFAULT_STATUS = 'historical';
const PLAN_LISTS = ['notes', 'versions', 'ownerNotes', 'unsettled', 'superpowers', 'embeds', 'decisionLinks', 'refs', 'references'];
// Undoing a run that stopped part-way. `git reset --hard`, not `git checkout -- .`: the ADR move
// is a `git mv`, which stages the rename, and checkout restores the worktree FROM the index, so
// the move would survive both commands and leave a tree --apply can never accept again. The
// clean-tree precondition is what makes a reset safe here: nothing of the user's is in the way.
const RECOVERY = 'git reset --hard && git clean -fd';

function filedEntries(repo) {
  const p = slipboxPaths(repo);
  return fs.existsSync(p.specInbox) ? parseInbox(fs.readFileSync(p.specInbox, 'utf8')).filter((e) => e.state === 'FILED') : [];
}

const homeOf = (e) => e.disposition.replace(/^filed\s*→\s*/, '').trim();
const oldPaths = (u) => u.oldSpecs.map((f) => `docs/dictated-specs/${f}`);

// Which FILED entries this migration must carry into notes. An entry filed into one of the old
// spec files, of course — and ALSO one filed into a spec-area file that is no longer there.
// Measured on ferrislicer 2026-09-19: four FILED entries named
// docs/dictated-specs/extruder-ownership-and-assignment.md, deleted long ago, and the existence
// filter dropped all four in silence — no note, no unsettled row, no refusal. Their words are in
// the inbox, so carrying them guesses nothing. An entry filed into a file that IS on disk and is
// not an old spec file (a note from an earlier migration) is already home and is not carried.
function carriedEntries(repo, oldRel) {
  const specs = slipboxPaths(repo).specs;
  return filedEntries(repo).filter((e) => {
    const home = filedPath(e.disposition);
    if (!home) return false;
    return oldRel.includes(home) || (insideSpecArea(repo, specs, home) && !fs.existsSync(path.join(repo, home)));
  });
}
const homeIsGone = (repo, e) => !fs.existsSync(path.join(repo, filedPath(e.disposition)));
// An unsettled row names a heading, or the whole file when the file has no heading to name.
const where = (x) => (x.heading ? `${x.file} § ${x.heading}` : x.file);

// Read through embed.mjs's scan, like every other reader in this feature: a `## ` line inside a
// fenced block is code, not a heading, and is never listed as an unsettled heading.
const headingsOf = (text) => scan(text).filter((r) => r.heading && r.heading.level >= 2 && r.heading.level <= 4).map((r) => r.heading.text);

// The ids applyPlan will write for the plan's version notes, derived once so planProblems can
// pre-flight them against the notes already on disk.
function versionIds(plan) {
  const counts = new Map();
  return plan.versions.map((v) => {
    const from = stampToId(v.from ?? '');
    const k = (counts.get(from) ?? 0) + 1; counts.set(from, k);
    return { v, from, id: `${from}-v${k > 1 ? k : ''}` };
  });
}

export function buildPlan(repo, u = unmigrated(repo)) {
  const oldRel = oldPaths(u);
  const entries = carriedEntries(repo, oldRel);
  const homes = new Set(entries.map(homeOf));
  // A file whose only heading is its `#` title yields no unsettled row, and with no FILED entry
  // pointing at it, no note either — yet commit 2 deletes it and builds its message body from this
  // list. The WHOLE file is listed then (`heading: null`), so its resolution is recorded somewhere.
  const unsettled = oldRel.flatMap((file) => {
    const rows = headingsOf(fs.readFileSync(path.join(repo, file), 'utf8'))
      .filter((h) => !homes.has(`${file} § ${h}`))
      .map((heading) => ({ file, heading, resolution: null }));
    if (rows.length || entries.some((e) => filedPath(e.disposition) === file)) return rows;
    return [{ file, heading: null, resolution: null }];
  });
  const needles = [...(u.adr ? ['docs/adr'] : []), ...oldRel];
  const skip = new Set([...oldRel, ...u.adrFiles.map((f) => `docs/adr/${f}`), '.claude/machinery/spec-inbox.md']);
  const references = [];
  if (needles.length) {
    const grep = git(['grep', '-l', '-F', ...needles.flatMap((n) => ['-e', n])], repo);
    for (const f of grep.stdout.split('\n').filter(Boolean).filter((f) => !skip.has(f))) {
      const text = fs.readFileSync(path.join(repo, f), 'utf8');
      const mentions = needles.filter((n) => text.includes(n));
      // Every matching line travels with the plan, so what a rewrite will change is recorded
      // where the decision is, and a count that does not match it is visible afterwards.
      const matches = text.split('\n').flatMap((line, i) => (mentions.some((n) => line.includes(n)) ? [{ line: i + 1, text: line }] : []));
      references.push({ path: f, mentions, matches, replace: [], reviewed: false });
    }
  }
  return {
    version: 1,
    // `oldHomeMissing` is the flag for a row whose old home is already gone: there is no file to
    // read the surrounding context from, only the inbox entry itself.
    notes: entries.map((e) => ({ stamp: e.stamp, oldHome: homeOf(e), oldHomeMissing: homeIsGone(repo, e), preview: e.text.slice(0, 160), title: null, subsystems: [], topic: null, supersedes: [] })),
    versions: [],
    // Left EMPTY on purpose, and never invented here: buildPlan cannot know which of an old spec
    // file's headings are the owner's own rulings and which are assistant prose. Every uncarried
    // heading shows up in `unsettled`; the AI moves the owner's rulings across into this list
    // (owner, 2026-09-19: "Carry them as owner notes").
    ownerNotes: [],
    unsettled,
    // Exactly the files unmigrated() counts, so a file the migration does not move can never be
    // both moved and read back as a reference afterwards.
    adr: { files: u.adrFiles },
    // `status: null` is not a gap here: it migrates as `historical` (DEFAULT_STATUS, the owner's
    // 2026-09-19 ruling). Fill it only where the owner ratified something — a design that is
    // `approved` or still `draft`, a plan that is `in-progress`, `done` or `abandoned`.
    superpowers: u.bare.map((p) => ({ path: p, kind: p.includes('/superpowers/plans/') ? 'plan' : 'design', status: null, subsystems: [], ticket: null, supersedes: [] })),
    embeds: [], decisionLinks: [], refs: [], references,
  };
}

// Every gap in one list, so the AI fixes them all in one pass. Nothing here writes.
export function planProblems(repo, plan, u = unmigrated(repo)) {
  // Shape first: the AI fills the plan between --plan and --apply, and nothing below can
  // read a malformed one.
  if (plan === null || typeof plan !== 'object' || Array.isArray(plan)) return ['plan: not an object — write a fresh one with migrate --plan'];
  const shape = [];
  if (plan.version !== 1) shape.push(`plan: version ${String(plan.version)} is not supported — this build writes and reads version 1`);
  for (const k of PLAN_LISTS) if (!Array.isArray(plan[k])) shape.push(`plan: "${k}" must be a list`);
  if (!plan.adr || typeof plan.adr !== 'object' || !Array.isArray(plan.adr.files)) shape.push('plan: "adr.files" must be a list');
  if (shape.length) return shape;

  const out = [];
  const p = slipboxPaths(repo);
  // A subsystem name is a file name (F3). Checked HERE, over every list that names one, so the
  // migration never writes structure/a/b.md — a file the non-recursive read model cannot see, in a
  // project whose every commit would then be refused with advice that cannot work.
  const named = [
    ...plan.notes.flatMap((n) => n.subsystems ?? []),
    ...plan.versions.flatMap((v) => v.subsystems ?? []),
    ...plan.ownerNotes.flatMap((o) => o.subsystems ?? []),
    ...plan.superpowers.flatMap((s) => s.subsystems ?? []),
    ...plan.embeds.map((e) => e.subsystem),
    ...plan.decisionLinks.map((d) => d.subsystem),
    ...plan.refs.map((x) => x.subsystem),
  ].filter((s) => s != null);
  for (const s of new Set(named)) { const bad = subsystemProblem(s); if (bad) out.push(bad); }
  const planned = new Set(plan.superpowers.map((s) => s.path));
  for (const b of u.bare) if (!planned.has(b)) out.push(`superpowers ${b}: not in the plan — the plan is stale; run migrate --plan again`);
  // A file in docs/adr that unmigrated() does not count would be swept away with the directory.
  if (u.adr) {
    const extra = fs.readdirSync(p.adr).filter((f) => !u.adrFiles.includes(f));
    if (extra.length) out.push(`docs/adr holds ${extra.join(', ')}, which the migration does not move — move ${extra.length > 1 ? 'them' : 'it'} yourself first`);
  }

  const entries = filedEntries(repo);
  const stamps = new Set(entries.map((e) => e.stamp));
  const planStamps = new Set(plan.notes.map((n) => n.stamp));
  // The mirror of the staleness check above: commit 2 deletes the old spec files, so a FILED entry
  // whose home is one of them and which no plan row carries would be orphaned, pointing at nothing.
  // An entry whose home is already gone is orphaned ALREADY, and is refused in the same breath —
  // the check is over exactly the entries buildPlan carries, so neither can be dropped in silence.
  const oldRel = oldPaths(u);
  for (const e of carriedEntries(repo, oldRel)) {
    if (planStamps.has(e.stamp)) continue;
    const home = filedPath(e.disposition);
    const why = oldRel.includes(home) ? 'which this migration removes' : 'which no longer exists';
    out.push(`note ${e.stamp}: filed into ${home}, ${why}, but no plan entry carries it — run migrate --plan again`);
  }
  for (const n of plan.notes) {
    if (!stamps.has(n.stamp)) out.push(`note ${n.stamp}: no FILED spec-inbox entry`);
    if (!n.title || !n.topic || !n.subsystems?.length) { out.push(`note ${n.stamp}: title, topic and subsystems are required`); continue; }
    // Can this note's front matter be written at all? A comma and a bracket are both legal in a
    // FILE name, so subsystemProblem passes them, and the block would then read back as something
    // else. Asked here, not thrown from applyChanges once notes are already on disk.
    const bad = frontmatterProblem(dictationFrontmatter({ id: stampToId(n.stamp), subsystems: n.subsystems, supersedes: n.supersedes ?? [] }));
    if (bad) out.push(`note ${n.stamp}: ${bad}`);
  }

  const box = loadSlipbox(repo);
  // Owner notes (owner, 2026-09-19: "Carry them as owner notes"). The AI writes these rows by
  // hand, and each becomes a note that is never edited afterwards, so every one of them is
  // pre-flighted here: the id, the words, and what it supersedes.
  const ownerRows = plan.ownerNotes.map((o) => ({ o, id: o.heading == null ? null : ownerId(o.heading), at: `owner note ${o.file ?? '?'} § ${o.heading ?? '?'}` }));
  const known = new Set([...box.notes.keys(), ...plan.notes.map((n) => stampToId(n.stamp)), ...ownerRows.map((r) => r.id).filter(Boolean)]);
  const seenOwner = new Set();
  for (const { o, id, at } of ownerRows) {
    if (!o.file || !o.heading) { out.push(`${at}: file and heading are required — an owner note is transcribed from one heading of one old spec file`); continue; }
    if (!o.title || !o.topic || !o.subsystems?.length) out.push(`${at}: title, topic and subsystems are required`);
    if (!id) { out.push(`${at}: no id can be derived from that heading — nothing of it survives as a file name`); continue; }
    const badId = fileNameProblem(id, 'note id');
    if (badId) out.push(`${at}: ${badId}`);
    if (seenOwner.has(id)) out.push(`${at}: two rows would be written to the note ${id} — one of them needs a heading of its own`);
    seenOwner.add(id);
    for (const s of o.supersedes ?? []) if (!known.has(s)) out.push(`${at}: supersedes ${s}, which is no note in this plan or in the slip box`);
    // Can this note's front matter be written at all? `source` is `<file> § <heading>` and the
    // heading is the owner's own prose. Measured on ferrislicer before this check existed: one of
    // the twelve rulings to carry threw from inside applyChanges, after notes were on disk, with a
    // message naming neither the row nor the heading.
    const fmBad = frontmatterProblem(ownerFrontmatter({ id, subsystems: o.subsystems ?? [], supersedes: o.supersedes ?? [], source: `${o.file} § ${o.heading}` }));
    if (fmBad) out.push(`${at}: ${fmBad}`);
    if (!oldRel.includes(o.file)) { out.push(`${at}: not one of the old spec files this migration removes${oldRel.length ? ` (${oldRel.join(', ')})` : ''}`); continue; }
    const text = readText(path.join(repo, o.file));
    if (section(text, o.heading) === null) out.push(`${at}: ${o.file} has no heading '${o.heading}'`);
    // The words are the owner's, so they are COPIED from that file, never retyped. A row whose
    // text is not in the file is the one thing gate leg 2 can never catch afterwards.
    if (typeof o.text !== 'string' || !o.text.trim() || !text.includes(o.text)) out.push(`${at}: its text is not in ${o.file} byte for byte — an owner note is copied from that file, never retyped`);
    // A [[link]] the slip box will not resolve would make gate leg 4 refuse the migration's own
    // commit, and leg 1 then freezes the note, so there is no legal edit out of it.
    for (const l of links(typeof o.text === 'string' ? o.text : '')) if (!known.has(l.id)) out.push(`${at}: its text links [[${l.id}]], which is no note — remove that link or the gate refuses the migration's own commit`);
  }
  for (const { v, from, id } of versionIds(plan)) {
    if (!v.from || !v.supersedes || !v.topic || !v.text || !v.subsystems?.length) { out.push(`version from ${v.from ?? '?'}: from, supersedes, subsystems, topic and text are required`); continue; }
    const fmBad = frontmatterProblem(versionFrontmatter({ id, subsystems: v.subsystems, supersedes: v.supersedes, from }));
    if (fmBad) out.push(`version from ${v.from}: ${fmBad}`);
    if (!known.has(from)) out.push(`version from ${v.from}: no note ${from} in this plan or in the slip box`);
    if (!known.has(v.supersedes)) out.push(`version supersedes ${v.supersedes}: no such note in this plan or in the slip box`);
    if (id === from) out.push(`version from ${v.from}: would overwrite the dictation note itself`);
  }
  // A note is written once, so an already-applied plan refuses HERE, before anything is touched,
  // rather than throwing out of writeOnce with half the migration on disk.
  for (const id of [...plan.notes.map((n) => stampToId(n.stamp)), ...versionIds(plan).map((x) => x.id), ...seenOwner]) {
    const f = path.join(p.notes, `${id}.md`);
    if (fs.existsSync(f)) out.push(`note ${id}: ${toPosix(path.relative(repo, f))} already exists — a note is written once; this plan has already been applied`);
  }

  for (const x of plan.unsettled) if (!x.resolution) out.push(`unsettled ${where(x)}: no resolution`);
  // Commit 2 deletes every old spec file. One carried by neither a FILED entry nor an unsettled
  // row would go with nothing recording it — buildPlan lists such a file whole, so this only
  // catches a plan that has since been edited or gone stale.
  for (const file of oldRel) {
    if (entries.some((e) => filedPath(e.disposition) === file)) continue;
    if (plan.unsettled.some((x) => x.file === file)) continue;
    // An owner note carries it too: a file whose every heading is one of the owner's own rulings
    // has no unsettled row left once the AI has moved them all across.
    if (plan.ownerNotes.some((o) => o.file === file)) continue;
    out.push(`old spec ${file}: no note and no unsettled row carries it, but commit 2 deletes it — run migrate --plan again`);
  }
  for (const s of plan.superpowers) {
    if (!STATUSES[s.kind]) out.push(`superpowers ${s.path}: kind must be design, plan or map`);
    // A null status is the owner's default, not a gap; a status that is spelled must be one of the
    // kind's own.
    else if (s.kind !== 'map' && s.status != null && !STATUSES[s.kind].includes(s.status)) out.push(`superpowers ${s.path}: status '${s.status}' is not one of a ${s.kind}'s (${STATUSES[s.kind].join(', ')}), and null migrates as ${DEFAULT_STATUS}`);
    // EACH subsystem, not merely one row somewhere: a subsystem with no heading embed of an
    // approved design is what gate leg 3 refuses with "embeds no heading of the approved design".
    if (s.kind === 'design' && s.status === 'approved') {
      const id = path.basename(String(s.path ?? ''), '.md');
      for (const sub of s.subsystems ?? []) {
        if (!plan.embeds.some((e) => e.note === id && e.subsystem === sub)) out.push(`superpowers ${s.path}: subsystem ${sub} has no heading in "embeds"`);
      }
    }
  }
  // Amendment 2 promises every note this writes is pre-flighted. The placements are notes too: each
  // is spliced into a structure note that gate leg 3 or leg 4 then judges.
  for (const e of plan.embeds) {
    if (!e.subsystem || !e.note || !e.heading || !e.topic) { out.push(`embed ${e.note ?? '?'}: subsystem, note, heading and topic are required`); continue; }
    if (!box.notes.has(e.note)) out.push(`embed ${e.note}: no superpowers file of that id is in the slip box`);
  }
  // A docs/adr file that is not named 00NN-slug.md moves byte-identical and loadSlipbox never loads
  // it (slipbox.mjs's ADR_FILE), so a link to it is a broken link in every structure note.
  const adrIds = u.adrFiles.filter((f) => /^\d{4}-.*\.md$/.test(f));
  const willBeDecisions = new Set([
    ...adrIds.map((f) => f.slice(0, -3)),
    ...[...box.notes.values()].filter((n) => n.kind === 'decision').map((n) => n.id),
  ]);
  // A decision whose status line already reads "Superseded by …" leaves every "Why" section, so
  // leg 3 would refuse the migration's own commit — and the command it names, `decision --file` on
  // the successor, refuses in turn, because a migrated ADR has no front matter (F7). The same test
  // the gate uses, over the ADRs about to move and the decision notes already filed.
  const superseded = new Set([
    ...adrIds.filter((f) => /^Superseded by/.test(adrStatus(fs.readFileSync(path.join(p.adr, f), 'utf8')) ?? '')).map((f) => f.slice(0, -3)),
    ...[...box.notes.values()].filter((n) => isSupersededDecision(n)).map((n) => n.id),
  ]);
  for (const d of plan.decisionLinks) {
    if (!d.subsystem || !d.decision) { out.push(`decision link ${d.decision ?? '?'}: subsystem and decision are required`); continue; }
    if (!willBeDecisions.has(d.decision)) out.push(`decision link ${d.decision}: the slip box will hold no decision note with that id — a decision note is docs/dictated-specs/decisions/00NN-slug.md; rename the file first`);
    else if (superseded.has(d.decision)) out.push(`decision link ${d.decision}: its status line reads "Superseded by …", and a structure note never links a superseded decision — link its successor instead, or drop this link`);
  }
  for (const x of plan.refs) {
    if (!x.subsystem || !x.path) { out.push(`ref ${x.path ?? '?'}: subsystem and path are required`); continue; }
    if (!fs.existsSync(path.join(repo, x.path))) out.push(`ref ${x.path}: no such file`);
  }
  for (const r of plan.references) if (!r.reviewed) out.push(`reference ${r.path}: not reviewed`);

  // A note already in the slip box but not yet embedded has no topic in THIS plan, so the
  // migration cannot place it: it would splice a `## undefined` heading. Caught before any write.
  const topics = new Set([...plan.notes.map((n) => stampToId(n.stamp)), ...versionIds(plan).map((x) => x.id), ...seenOwner]);
  const live = inForce(box);
  for (const n of box.notes.values()) {
    if (!EMBEDDED_KINDS.includes(n.kind) || !live.has(n.id) || topics.has(n.id)) continue;
    for (const sub of n.subsystems) {
      const f = path.join(p.structure, `${sub}.md`);
      const cur = fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : '';
      if (!readStructure(cur).embeds.includes(n.id)) out.push(`note ${n.id}: not embedded in ${sub} and not in this plan, so it has no topic — add it to the plan`);
    }
  }
  return out;
}

export function applyPlan(repo, plan) {
  // A failed migration is undone with RECOVERY, so it never starts on a tree holding work of the
  // user's that the undo would throw away with it. `git checkout -- .` is NOT enough: `git mv`
  // stages the rename, so checkout restores the worktree from that index and the move survives.
  const status = git(['status', '--porcelain'], repo);
  if (status.code !== 0) throw new Error(`git status failed: ${status.stderr}`);
  if (status.stdout.trim()) throw new Error(`the working tree is not clean — commit or discard these first, so that '${RECOVERY}' undoes a failed migration without touching your own work:\n  ${status.stdout.trim().split('\n').map((l) => l.trim()).join('\n  ')}`);
  const u = unmigrated(repo);
  const problems = planProblems(repo, plan, u);
  if (problems.length) throw new Error(`the plan is not ready:\n  ${problems.join('\n  ')}`);
  // Everything past here writes. A throw in the middle leaves the tree part-migrated, so the
  // failure carries the command that undoes it — the underlying error alone leaves the user with
  // a dirty tree and no way back, because --apply then refuses.
  const done = { commits: 0 };
  try {
    return applyChanges(repo, plan, u, done);
  } catch (e) {
    const undo = done.commits ? `git reset --hard HEAD~${done.commits} && git clean -fd` : RECOVERY;
    throw new Error(`${e.message}\n  this run stopped part-way; undo it with: ${undo}`);
  }
}

function applyChanges(repo, plan, u, done) {
  const p = slipboxPaths(repo);
  const touched = new Set();
  const note = (id) => path.join(p.notes, `${id}.md`);
  const byStamp = new Map(filedEntries(repo).map((e) => [e.stamp, e]));

  const notes = [...plan.notes].sort((a, b) => a.stamp.localeCompare(b.stamp));
  for (const n of notes) {
    const id = stampToId(n.stamp);
    writeOnce(note(id), dictationNote({ id, subsystems: n.subsystems, supersedes: n.supersedes ?? [], title: n.title, text: byStamp.get(n.stamp).text }));
    setDisposition(p.specInbox, n.stamp, { state: 'FILED', detail: `filed → ${toPosix(path.relative(repo, note(id)))}` });
    touched.add(note(id));
  }
  touched.add(p.specInbox);
  const topic = new Map(notes.map((n) => [stampToId(n.stamp), n.topic]));
  for (const { v, from, id } of versionIds(plan)) {
    writeOnce(note(id), versionNote({ id, subsystems: v.subsystems, supersedes: v.supersedes, from, text: v.text }));
    topic.set(id, v.topic);
    touched.add(note(id));
  }
  // The owner's own rulings, transcribed from the old spec file before commit 2 removes it.
  for (const o of plan.ownerNotes) {
    const id = ownerId(o.heading);
    writeOnce(note(id), ownerNote({ id, subsystems: o.subsystems, supersedes: o.supersedes ?? [], title: o.title, source: `${o.file} § ${o.heading}`, text: o.text }));
    topic.set(id, o.topic);
    touched.add(note(id));
  }

  if (u.adr) {
    fs.mkdirSync(p.decisions, { recursive: true });
    for (const f of u.adrFiles) {
      const r = git(['mv', toPosix(path.relative(repo, path.join(p.adr, f))), toPosix(path.relative(repo, path.join(p.decisions, f)))], repo);
      if (r.code !== 0) throw new Error(`git mv docs/adr/${f} failed: ${r.stderr}`);
      touched.add(path.join(p.adr, f)); touched.add(path.join(p.decisions, f));
    }
    // The DIRECTORY, not only its files: unmigrated() reports fs.existsSync(docs/adr), so an empty
    // leftover would keep every session in the project saying NOT MIGRATED for ever. planProblems
    // has already refused anything in here the loop above does not move.
    fs.rmSync(p.adr, { recursive: true, force: true });
  }

  for (const s of plan.superpowers) {
    const abs = path.join(repo, s.path);
    const fm = s.kind === 'map' ? { kind: 'map' } : {
      kind: s.kind, status: s.status ?? DEFAULT_STATUS,
      ...(s.subsystems?.length ? { subsystems: s.subsystems } : {}),
      ...(s.ticket ? { ticket: String(s.ticket) } : {}),
      ...(s.supersedes?.length ? { supersedes: s.supersedes } : {}),
    };
    writeText(abs, setFrontmatter(fs.readFileSync(abs, 'utf8'), fm));
    touched.add(abs);
  }

  const references = [];
  for (const r of plan.references) {
    const abs = path.join(repo, r.path);
    const before = fs.readFileSync(abs, 'utf8');
    let text = before, count = 0;
    for (const [from, to] of r.replace ?? []) {
      if (!text.includes(from)) throw new Error(`reference ${r.path}: '${from}' not found`);
      count += text.split(from).length - 1;
      text = text.replaceAll(from, to);
    }
    // A reviewed file with no replacement in the plan is left exactly as it is.
    if (text !== before) { writeText(abs, text); touched.add(abs); }
    references.push({ path: r.path, count });
  }

  const box = loadSlipbox(repo);
  const live = inForce(box);
  // planProblems has already refused a bad name; this is the single place every placement below
  // turns a subsystem into a path, so no future caller can get one past it.
  const structure = (sub) => path.join(p.structure, `${checkSubsystem(sub)}.md`);
  const cur = (sub) => (fs.existsSync(structure(sub)) ? fs.readFileSync(structure(sub), 'utf8') : null);
  // Each placement happens only when the structure note does not already hold it, exactly as
  // fileSpec, fileDecision and fileRef do: migrating a project twice places nothing twice.
  for (const n of [...box.notes.values()].filter((x) => EMBEDDED_KINDS.includes(x.kind) && live.has(x.id)).sort((a, b) => a.id.localeCompare(b.id))) {
    for (const sub of n.subsystems) {
      if ((cur(sub) ?? '').includes(`![[${n.id}]]`)) continue;
      const t = topic.get(n.id);
      if (t === undefined) throw new Error(`note ${n.id}: no topic in this plan, so it cannot be placed in ${sub}`);
      writeText(structure(sub), placeEmbed(cur(sub), sub, { id: n.id, topic: t })); touched.add(structure(sub));
    }
  }
  for (const e of plan.embeds) {
    if ((cur(e.subsystem) ?? '').includes(`![[${e.note}#${e.heading}]]`)) continue;
    writeText(structure(e.subsystem), placeHeadingEmbed(cur(e.subsystem), e.subsystem, { id: e.note, heading: e.heading, topic: e.topic })); touched.add(structure(e.subsystem));
  }
  for (const d of plan.decisionLinks) {
    if (readStructure(cur(d.subsystem) ?? '').why.includes(d.decision)) continue;
    writeText(structure(d.subsystem), placeLink(cur(d.subsystem), d.subsystem, d.decision)); touched.add(structure(d.subsystem));
  }
  for (const x of plan.refs) {
    const href = toPosix(path.relative(p.structure, path.join(repo, x.path)));
    if (readStructure(cur(x.subsystem) ?? '').refs.includes(href)) continue;
    writeText(structure(x.subsystem), placeRef(cur(x.subsystem), x.subsystem, path.basename(x.path), href));
    touched.add(structure(x.subsystem));
  }
  for (const g of syncGenerated(repo, loadSlipbox(repo))) touched.add(path.join(repo, g));

  const changed = () => git(['status', '--porcelain'], repo).stdout.trim().length > 0;
  const commit1 = changed() ? commitPaths(repo, [...touched], 'slip box migration 1/2: notes from the spec inbox, decisions, superpowers front matter, structure notes (#132)') : [];
  if (commit1.length) done.commits++;
  // Already gone is not an error: the tree may have moved on since the plan was written.
  const old = u.oldSpecs.map((f) => path.join(p.specs, f)).filter((f) => fs.existsSync(f));
  for (const f of old) fs.rmSync(f);
  // The resolutions belong in the message of the commit that deletes the files they are about:
  // git then holds the reasoning, which the plan file — written outside the project — does not.
  const body = plan.unsettled.map((x) => `${where(x)}: ${x.resolution}`);
  const message = ['slip box migration 2/2: remove the old spec files; their dictations are notes now (#132)', ...(body.length ? ['', ...body] : [])].join('\n');
  const commit2 = old.length ? commitPaths(repo, old, message) : [];
  return { commit1, commit2, references };
}
