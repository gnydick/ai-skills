// Story: #132 § 11 and Amendment 1. Migration of one project into the slip box: the AI writes the
// plan, fills it and applies it, with no pause, in any checkout (D14, owner 2026-09-19:
// "Automatic anywhere"). The plan file stays as the record of what was decided. A dictation note's
// words come from the spec inbox, never from the old spec file (D11: assistant readings are not
// carried over).
import fs from 'node:fs';
import path from 'node:path';
import { git } from './git.mjs';
import { parseInbox, setDisposition } from './inbox.mjs';
import { slipboxPaths, stampToId, filedPath } from './layout.mjs';
import { setFrontmatter } from './frontmatter.mjs';
import { scan } from './embed.mjs';
import { loadSlipbox, inForce, readStructure } from './slipbox.mjs';
import { writeOnce, writeText, dictationNote, versionNote, placeEmbed, placeHeadingEmbed, placeLink, placeRef, syncGenerated } from './slipbox-write.mjs';
import { unmigrated } from './unmigrated.mjs';
import { commitPaths } from './commit.mjs';

const toPosix = (p) => p.split(path.sep).join('/');
const STATUSES = { design: ['draft', 'approved', 'historical'], plan: ['in-progress', 'done', 'abandoned', 'historical'], map: [null] };
const PLAN_LISTS = ['notes', 'versions', 'unsettled', 'superpowers', 'embeds', 'decisionLinks', 'refs', 'references'];
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
  const entries = filedEntries(repo).filter((e) => oldRel.includes(filedPath(e.disposition)));
  const homes = new Set(entries.map(homeOf));
  const unsettled = oldRel.flatMap((file) => headingsOf(fs.readFileSync(path.join(repo, file), 'utf8'))
    .filter((h) => !homes.has(`${file} § ${h}`))
    .map((heading) => ({ file, heading, resolution: null })));
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
    notes: entries.map((e) => ({ stamp: e.stamp, oldHome: homeOf(e), preview: e.text.slice(0, 160), title: null, subsystems: [], topic: null, supersedes: [] })),
    versions: [],
    unsettled,
    // Exactly the files unmigrated() counts, so a file the migration does not move can never be
    // both moved and read back as a reference afterwards.
    adr: { files: u.adrFiles },
    superpowers: u.bare.map((p) => ({ path: p, kind: p.includes('/superpowers/plans/') ? 'plan' : 'design', status: null, subsystems: [], ticket: null, supersedes: [] })),
    embeds: [], decisionLinks: [], refs: [], references,
  };
}

// Every gap in one list, so the AI and the owner fix them in one pass. Nothing here writes.
export function planProblems(repo, plan, u = unmigrated(repo)) {
  // Shape first: the owner hand-edits this file, and nothing below can read a malformed plan.
  if (plan === null || typeof plan !== 'object' || Array.isArray(plan)) return ['plan: not an object — write a fresh one with migrate --plan'];
  const shape = [];
  if (plan.version !== 1) shape.push(`plan: version ${String(plan.version)} is not supported — this build writes and reads version 1`);
  for (const k of PLAN_LISTS) if (!Array.isArray(plan[k])) shape.push(`plan: "${k}" must be a list`);
  if (!plan.adr || typeof plan.adr !== 'object' || !Array.isArray(plan.adr.files)) shape.push('plan: "adr.files" must be a list');
  if (shape.length) return shape;

  const out = [];
  const p = slipboxPaths(repo);
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
  const oldRel = oldPaths(u);
  for (const e of entries) {
    if (oldRel.includes(filedPath(e.disposition)) && !planStamps.has(e.stamp)) out.push(`note ${e.stamp}: filed into ${filedPath(e.disposition)}, which this migration removes, but no plan entry carries it — run migrate --plan again`);
  }
  for (const n of plan.notes) {
    if (!stamps.has(n.stamp)) out.push(`note ${n.stamp}: no FILED spec-inbox entry`);
    if (!n.title || !n.topic || !n.subsystems?.length) out.push(`note ${n.stamp}: title, topic and subsystems are required`);
  }

  const box = loadSlipbox(repo);
  const known = new Set([...box.notes.keys(), ...plan.notes.map((n) => stampToId(n.stamp))]);
  for (const { v, from, id } of versionIds(plan)) {
    if (!v.from || !v.supersedes || !v.topic || !v.text || !v.subsystems?.length) { out.push(`version from ${v.from ?? '?'}: from, supersedes, subsystems, topic and text are required`); continue; }
    if (!known.has(from)) out.push(`version from ${v.from}: no note ${from} in this plan or in the slip box`);
    if (!known.has(v.supersedes)) out.push(`version supersedes ${v.supersedes}: no such note in this plan or in the slip box`);
    if (id === from) out.push(`version from ${v.from}: would overwrite the dictation note itself`);
  }
  // A note is written once, so an already-applied plan refuses HERE, before anything is touched,
  // rather than throwing out of writeOnce with half the migration on disk.
  for (const id of [...plan.notes.map((n) => stampToId(n.stamp)), ...versionIds(plan).map((x) => x.id)]) {
    const f = path.join(p.notes, `${id}.md`);
    if (fs.existsSync(f)) out.push(`note ${id}: ${toPosix(path.relative(repo, f))} already exists — a note is written once; this plan has already been applied`);
  }

  for (const x of plan.unsettled) if (!x.resolution) out.push(`unsettled ${x.file} § ${x.heading}: no resolution`);
  for (const s of plan.superpowers) {
    if (!STATUSES[s.kind]) out.push(`superpowers ${s.path}: kind must be design, plan or map`);
    else if (s.kind !== 'map' && !STATUSES[s.kind].includes(s.status)) out.push(`superpowers ${s.path}: status is required for a ${s.kind} (${STATUSES[s.kind].join(', ')})`);
    if (s.kind === 'design' && s.status === 'approved' && s.subsystems?.length && !plan.embeds.some((e) => s.path.endsWith(`/${e.note}.md`))) out.push(`superpowers ${s.path}: an approved design with subsystems needs a heading in "embeds"`);
  }
  for (const r of plan.references) if (!r.reviewed) out.push(`reference ${r.path}: not reviewed`);

  // A note already in the slip box but not yet embedded has no topic in THIS plan, so the
  // migration cannot place it: it would splice a `## undefined` heading. Caught before any write.
  const topics = new Set([...plan.notes.map((n) => stampToId(n.stamp)), ...versionIds(plan).map((x) => x.id)]);
  const live = inForce(box);
  for (const n of box.notes.values()) {
    if (!['dictation', 'version'].includes(n.kind) || !live.has(n.id) || topics.has(n.id)) continue;
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
      kind: s.kind, status: s.status,
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
  const structure = (sub) => path.join(p.structure, `${sub}.md`);
  const cur = (sub) => (fs.existsSync(structure(sub)) ? fs.readFileSync(structure(sub), 'utf8') : null);
  // Each placement happens only when the structure note does not already hold it, exactly as
  // fileSpec, fileDecision and fileRef do: migrating a project twice places nothing twice.
  for (const n of [...box.notes.values()].filter((x) => ['dictation', 'version'].includes(x.kind) && live.has(x.id)).sort((a, b) => a.id.localeCompare(b.id))) {
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
  const body = plan.unsettled.map((x) => `${x.file} § ${x.heading}: ${x.resolution}`);
  const message = ['slip box migration 2/2: remove the old spec files; their dictations are notes now (#132)', ...(body.length ? ['', ...body] : [])].join('\n');
  const commit2 = old.length ? commitPaths(repo, old, message) : [];
  return { commit1, commit2, references };
}
