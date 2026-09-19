// Story: #132 § 11 and Amendment 1. Migration of one project into the slip box: the AI proposes
// (the plan), the owner confirms, this applies. A dictation note's words come from the spec
// inbox, never from the old spec file (D11: assistant readings are not carried over).
import fs from 'node:fs';
import path from 'node:path';
import { git } from './git.mjs';
import { parseInbox, setDisposition } from './inbox.mjs';
import { slipboxPaths, stampToId, filedPath } from './layout.mjs';
import { setFrontmatter } from './frontmatter.mjs';
import { loadSlipbox, inForce } from './slipbox.mjs';
import { writeOnce, writeText, dictationNote, versionNote, placeEmbed, placeHeadingEmbed, placeLink, placeRef, syncGenerated } from './slipbox-write.mjs';
import { unmigrated } from './unmigrated.mjs';
import { commitPaths } from './commit.mjs';

const toPosix = (p) => p.split(path.sep).join('/');
const STATUSES = { design: ['draft', 'approved', 'historical'], plan: ['in-progress', 'done', 'abandoned', 'historical'], map: [null] };

function filedEntries(repo) {
  const p = slipboxPaths(repo);
  return fs.existsSync(p.specInbox) ? parseInbox(fs.readFileSync(p.specInbox, 'utf8')).filter((e) => e.state === 'FILED') : [];
}

export function buildPlan(repo) {
  const u = unmigrated(repo);
  const oldRel = u.oldSpecs.map((f) => `docs/dictated-specs/${f}`);
  const entries = filedEntries(repo).filter((e) => oldRel.includes(filedPath(e.disposition)));
  const homes = new Set(entries.map((e) => e.disposition.replace(/^filed\s*→\s*/, '').trim()));
  const unsettled = oldRel.flatMap((file) => fs.readFileSync(path.join(repo, file), 'utf8').split('\n')
    .map((l) => /^#{2,4} (.+?)\s*$/.exec(l)?.[1]).filter(Boolean)
    .filter((h) => !homes.has(`${file} § ${h}`))
    .map((heading) => ({ file, heading, resolution: null })));
  const needles = [...(u.adr ? ['docs/adr'] : []), ...oldRel];
  const skip = new Set([...oldRel, ...u.adrFiles.map((f) => `docs/adr/${f}`), '.claude/machinery/spec-inbox.md']);
  const references = [];
  if (needles.length) {
    const grep = git(['grep', '-l', '-F', ...needles.flatMap((n) => ['-e', n])], repo);
    for (const f of grep.stdout.split('\n').filter(Boolean).filter((f) => !skip.has(f))) {
      const text = fs.readFileSync(path.join(repo, f), 'utf8');
      references.push({ path: f, mentions: needles.filter((n) => text.includes(n)), replace: [], reviewed: false });
    }
  }
  return {
    version: 1,
    notes: entries.map((e) => ({ stamp: e.stamp, oldHome: e.disposition.replace(/^filed\s*→\s*/, '').trim(), preview: e.text.slice(0, 160), title: null, subsystems: [], topic: null, supersedes: [] })),
    versions: [],
    unsettled,
    adr: { files: u.adr ? fs.readdirSync(slipboxPaths(repo).adr).sort() : [] },
    superpowers: u.bare.map((p) => ({ path: p, kind: p.includes('/superpowers/plans/') ? 'plan' : 'design', status: null, subsystems: [], ticket: null, supersedes: [] })),
    embeds: [], decisionLinks: [], refs: [], references,
  };
}

export function planProblems(repo, plan) {
  const out = [];
  const u = unmigrated(repo);
  const planned = new Set(plan.superpowers.map((s) => s.path));
  for (const b of u.bare) if (!planned.has(b)) out.push(`superpowers ${b}: not in the plan — the plan is stale; run migrate --plan again`);
  const stamps = new Set(filedEntries(repo).map((e) => e.stamp));
  for (const n of plan.notes) {
    if (!stamps.has(n.stamp)) out.push(`note ${n.stamp}: no FILED spec-inbox entry`);
    if (!n.title || !n.topic || !n.subsystems?.length) out.push(`note ${n.stamp}: title, topic and subsystems are required`);
  }
  for (const v of plan.versions) if (!v.from || !v.supersedes || !v.topic || !v.text || !v.subsystems?.length) out.push(`version from ${v.from ?? '?'}: from, supersedes, subsystems, topic and text are required`);
  for (const x of plan.unsettled) if (!x.resolution) out.push(`unsettled ${x.file} § ${x.heading}: no resolution`);
  for (const s of plan.superpowers) {
    if (!STATUSES[s.kind]) out.push(`superpowers ${s.path}: kind must be design, plan or map`);
    else if (s.kind !== 'map' && !STATUSES[s.kind].includes(s.status)) out.push(`superpowers ${s.path}: status is required for a ${s.kind} (${STATUSES[s.kind].join(', ')})`);
    if (s.kind === 'design' && s.status === 'approved' && s.subsystems?.length && !plan.embeds.some((e) => s.path.endsWith(`/${e.note}.md`))) out.push(`superpowers ${s.path}: an approved design with subsystems needs a heading in "embeds"`);
  }
  for (const r of plan.references) if (!r.reviewed) out.push(`reference ${r.path}: not reviewed`);
  return out;
}

export function applyPlan(repo, plan) {
  const problems = planProblems(repo, plan);
  if (problems.length) throw new Error(`the plan is not ready:\n  ${problems.join('\n  ')}`);
  const p = slipboxPaths(repo);
  const u = unmigrated(repo);
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
  const counts = new Map();
  for (const v of plan.versions) {
    const from = stampToId(v.from);
    const k = (counts.get(from) ?? 0) + 1; counts.set(from, k);
    const id = `${from}-v${k > 1 ? k : ''}`;
    writeOnce(note(id), versionNote({ id, subsystems: v.subsystems, supersedes: v.supersedes, from, text: v.text }));
    topic.set(id, v.topic);
    touched.add(note(id));
  }

  if (u.adr) {
    fs.mkdirSync(p.decisions, { recursive: true });
    for (const f of fs.readdirSync(p.adr)) {
      const r = git(['mv', toPosix(path.relative(repo, path.join(p.adr, f))), toPosix(path.relative(repo, path.join(p.decisions, f)))], repo);
      if (r.code !== 0) throw new Error(`git mv docs/adr/${f} failed: ${r.stderr}`);
      touched.add(path.join(p.adr, f)); touched.add(path.join(p.decisions, f));
    }
    // The DIRECTORY, not only its files: unmigrated() reports fs.existsSync(docs/adr), so an empty
    // leftover would keep every session in the project saying NOT MIGRATED for ever.
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

  for (const r of plan.references) {
    const abs = path.join(repo, r.path);
    let text = fs.readFileSync(abs, 'utf8');
    for (const [from, to] of r.replace) {
      if (!text.includes(from)) throw new Error(`reference ${r.path}: '${from}' not found`);
      text = text.replaceAll(from, to);
    }
    writeText(abs, text);
    touched.add(abs);
  }

  const box = loadSlipbox(repo);
  const live = inForce(box);
  const structure = (sub) => path.join(p.structure, `${sub}.md`);
  const cur = (sub) => (fs.existsSync(structure(sub)) ? fs.readFileSync(structure(sub), 'utf8') : null);
  for (const n of [...box.notes.values()].filter((x) => ['dictation', 'version'].includes(x.kind) && live.has(x.id)).sort((a, b) => a.id.localeCompare(b.id))) {
    for (const sub of n.subsystems) { writeText(structure(sub), placeEmbed(cur(sub), sub, { id: n.id, topic: topic.get(n.id) })); touched.add(structure(sub)); }
  }
  for (const e of plan.embeds) { writeText(structure(e.subsystem), placeHeadingEmbed(cur(e.subsystem), e.subsystem, { id: e.note, heading: e.heading, topic: e.topic })); touched.add(structure(e.subsystem)); }
  for (const d of plan.decisionLinks) { writeText(structure(d.subsystem), placeLink(cur(d.subsystem), d.subsystem, d.decision)); touched.add(structure(d.subsystem)); }
  for (const x of plan.refs) {
    const href = toPosix(path.relative(p.structure, path.join(repo, x.path)));
    writeText(structure(x.subsystem), placeRef(cur(x.subsystem), x.subsystem, path.basename(x.path), href));
    touched.add(structure(x.subsystem));
  }
  for (const g of syncGenerated(repo, loadSlipbox(repo))) touched.add(path.join(repo, g));

  const commit1 = commitPaths(repo, [...touched], 'slip box migration 1/2: notes from the spec inbox, decisions, superpowers front matter, structure notes (#132)');
  const old = u.oldSpecs.map((f) => path.join(p.specs, f));
  for (const f of old) fs.rmSync(f);
  const commit2 = commitPaths(repo, old, 'slip box migration 2/2: remove the old spec files; their dictations are notes now (#132)');
  return { commit1, commit2 };
}
