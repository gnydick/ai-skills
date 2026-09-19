// Story: #132 § 6–7. The slip box commands' logic. intake.mjs parses the flags and calls these;
// each throws an Error whose message is the refusal the user reads.
import fs from 'node:fs';
import path from 'node:path';
import { pending, setDisposition } from './inbox.mjs';
import { parseFrontmatter, setFrontmatter } from './frontmatter.mjs';
import { section } from './embed.mjs';
import { slipboxPaths, stampToId } from './layout.mjs';
import { loadSlipbox, inForce, readStructure } from './slipbox.mjs';
import { writeOnce, writeText, dictationNote, versionNote, placeEmbed, placeHeadingEmbed, placeLink, placeRef, dropSupersededLinks, swapEmbed, dropEmbed, syncGenerated } from './slipbox-write.mjs';
import { unmigrated, describeUnmigrated } from './unmigrated.mjs';
import { commitPaths } from './commit.mjs';

const rel = (repo, abs) => path.relative(repo, abs).split(path.sep).join('/');

export function refuseUnmigrated(repo) {
  const u = unmigrated(repo);
  if (u.any) throw new Error(`refusing to file: this project is not migrated to the slip box — ${describeUnmigrated(u)}. Run intake.mjs migrate --plan <file> first`);
}

export function fileSpec({ repo, stamp, subsystems, topic, title, supersedes = [], versions = [] }) {
  refuseUnmigrated(repo);
  if (versions.length && versions.length !== supersedes.length) throw new Error('--version needs one file per --supersedes id, in the same order');
  const p = slipboxPaths(repo);
  const entry = pending(p.specInbox).find((e) => e.stamp === stamp);
  if (!entry) throw new Error(`no PENDING entry with stamp ${stamp} in ${rel(repo, p.specInbox)}`);
  const box = loadSlipbox(repo);
  const live = inForce(box);
  for (const s of supersedes) {
    if (!box.notes.has(s)) throw new Error(`--supersedes ${s}: no such note`);
    if (!live.has(s)) throw new Error(`--supersedes ${s}: that note is no longer in force — supersede its successor`);
    // A subsystem left out would lose the old note's embed with nothing placed in its stead.
    const missing = box.notes.get(s).subsystems.filter((x) => !subsystems.includes(x));
    if (missing.length) throw new Error(`--supersedes ${s}: that note is also in ${missing.join(', ')} — list every one of its subsystems in --subsystems`);
  }
  const id = stampToId(stamp);
  const partial = versions.length > 0;
  const vIds = versions.map((_, i) => `${id}-v${i ? i + 1 : ''}`);
  const created = [id, ...vIds].map((n) => path.join(p.notes, `${n}.md`));
  for (const f of created) if (fs.existsSync(f)) throw new Error(`refusing to overwrite ${rel(repo, f)}: a note is written once`);
  const versionTexts = versions.map((f) => fs.readFileSync(f, 'utf8'));
  writeOnce(created[0], dictationNote({ id, subsystems, supersedes: partial ? [] : supersedes, title, text: entry.text }));
  vIds.forEach((v, i) => writeOnce(created[i + 1], versionNote({ id: v, subsystems, supersedes: supersedes[i], from: id, text: versionTexts[i] })));

  const successor = new Map(supersedes.map((s, i) => [s, partial ? vIds[i] : id]));
  const placed = partial ? vIds : [id];
  const touched = new Set();
  const newSubs = [];
  for (const [sub, st] of box.structures) {
    let text = st.text;
    for (const [old, next] of successor) {
      const swapped = subsystems.includes(sub) && !text.includes(`![[${next}]]`) ? swapEmbed(text, old, next) : null;
      text = swapped ?? dropEmbed(text, old);
    }
    if (text !== st.text) { writeText(path.join(p.structure, `${sub}.md`), text); touched.add(sub); }
  }
  for (const sub of subsystems) {
    const file = path.join(p.structure, `${sub}.md`);
    const before = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;
    if (before === null) newSubs.push(sub);
    let text = before;
    for (const pid of placed) if (!(text ?? '').includes(`![[${pid}]]`)) text = placeEmbed(text, sub, { id: pid, topic });
    if (text !== before) { writeText(file, text); touched.add(sub); }
  }

  const generated = syncGenerated(repo, loadSlipbox(repo));
  setDisposition(p.specInbox, stamp, { state: 'FILED', detail: `filed → ${rel(repo, created[0])}` });
  const subject = `spec: ${title}`.slice(0, 72);
  const body = [
    entry.text, '',
    `Filed → ${rel(repo, created[0])}`,
    ...vIds.map((v, i) => `Version ${v} supersedes ${supersedes[i]}`),
    ...(!partial && supersedes.length ? [`Supersedes ${supersedes.join(', ')}`] : []),
    `Inbox entry ${stamp} (SPEC)`,
  ].join('\n');
  commitPaths(repo, [...created, ...[...touched].map((s) => path.join(p.structure, `${s}.md`)), ...generated, p.specInbox], `${subject}\n\n${body}`);
  return { id, vIds, newSubs, partial, versionTexts, subject };
}

export const regen = (repo) => syncGenerated(repo, loadSlipbox(repo));

const listOf = (v) => (v == null || v === '' ? [] : Array.isArray(v) ? v : [v]);

// #132 § 4, § 6. A new ADR is linked under "Why it is this way" in each subsystem it names; an ADR
// this change marked "Superseded by …" leaves every "Why" section.
export function fileDecision({ repo, file }) {
  const p = slipboxPaths(repo);
  const abs = path.resolve(repo, file);
  if (path.dirname(abs) !== p.decisions || !/^\d{4}-.*\.md$/.test(path.basename(abs))) throw new Error(`a decision note lives at docs/dictated-specs/decisions/00NN-slug.md: '${file}'`);
  const { data } = parseFrontmatter(fs.readFileSync(abs, 'utf8'));
  if (data?.kind !== 'decision') throw new Error(`${rel(repo, abs)} needs front matter with kind: decision, subsystems and rests_on`);
  const subsystems = listOf(data.subsystems);
  if (!subsystems.length) throw new Error(`${rel(repo, abs)} names no subsystems`);
  const box = loadSlipbox(repo);
  for (const d of listOf(data.rests_on)) if (box.notes.get(d)?.kind !== 'dictation') throw new Error(`rests_on ${d}: not a dictation note`);
  const id = path.basename(abs, '.md');
  for (const sub of subsystems) {
    const f = path.join(p.structure, `${sub}.md`);
    const cur = fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : null;
    if (cur === null || !readStructure(cur).why.includes(id)) writeText(f, placeLink(cur, sub, id));
  }
  const after = loadSlipbox(repo);
  for (const [sub, st] of after.structures) {
    const next = dropSupersededLinks(st.text, after);
    if (next !== st.text) writeText(path.join(p.structure, `${sub}.md`), next);
  }
  return { id, subsystems, generated: syncGenerated(repo, loadSlipbox(repo)) };
}

// D12: a living map stays outside the slip box; a structure note may only link to it.
export function fileRef({ repo, subsystem, target }) {
  const p = slipboxPaths(repo);
  const abs = path.resolve(repo, target);
  if (!fs.existsSync(abs)) throw new Error(`--path ${target}: no such file`);
  const f = path.join(p.structure, `${subsystem}.md`);
  const href = path.relative(p.structure, abs).split(path.sep).join('/');
  const cur = fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : null;
  if (cur === null || !readStructure(cur).refs.includes(href)) writeText(f, placeRef(cur, subsystem, path.basename(abs), href));
  return { href, generated: syncGenerated(repo, loadSlipbox(repo)) };
}

// #132 § 10. The superpowers plugin keeps writing where it writes; these file its output in place.
function superpowersFile(repo, file, which) {
  const p = slipboxPaths(repo);
  const abs = path.resolve(repo, file);
  const dir = which === 'plans' ? p.spPlans : p.spSpecs;
  if (path.dirname(abs) !== dir || !abs.endsWith('.md')) throw new Error(`${file} is not a file directly under ${rel(repo, dir)}/`);
  const text = fs.readFileSync(abs, 'utf8');
  return { abs, text, data: parseFrontmatter(text).data ?? {} };
}

export function fileDesign({ repo, file, subsystems = [], supersedes = [], ticket = null }) {
  const f = superpowersFile(repo, file, 'specs');
  if (f.data.kind) throw new Error(`${file} is already filed as ${f.data.kind}`);
  const box = loadSlipbox(repo);
  for (const s of supersedes) if (box.notes.get(s)?.kind !== 'design') throw new Error(`--supersedes ${s}: not a design note`);
  writeText(f.abs, setFrontmatter(f.text, { kind: 'design', status: 'draft', ...(subsystems.length ? { subsystems } : {}), ...(ticket ? { ticket } : {}), ...(supersedes.length ? { supersedes } : {}) }));
}

export function approveDesign({ repo, file }) {
  const f = superpowersFile(repo, file, 'specs');
  // 'unfiled'/'unset', not the issue-tracking state words: only lib/layout.mjs spells those
  // (issue-tracking-names.test.mjs scans scripts/ for a second spelling).
  if (f.data.kind !== 'design' || f.data.status !== 'draft') throw new Error(`${file} is not a draft design note (kind ${f.data.kind ?? 'unfiled'}, status ${f.data.status ?? 'unset'})`);
  writeText(f.abs, setFrontmatter(f.text, { status: 'approved' }));
  const replaced = listOf(f.data.supersedes);
  const box = loadSlipbox(repo);
  for (const [sub, st] of box.structures) {
    const next = st.text.split('\n').filter((l) => !replaced.some((old) => l.trim().startsWith(`![[${old}#`))).join('\n');
    if (next !== st.text) writeText(path.join(box.paths.structure, `${sub}.md`), next);
  }
  return { id: path.basename(f.abs, '.md'), subsystems: listOf(f.data.subsystems), generated: syncGenerated(repo, loadSlipbox(repo)) };
}

// D9: only a decision, owner-constraint or principle heading is embedded. The gate cannot judge
// that; the command's output names the heading so the owner sees it.
export function embedDesign({ repo, file, subsystem, topic, heading }) {
  const f = superpowersFile(repo, file, 'specs');
  if (f.data.kind !== 'design' || f.data.status !== 'approved') throw new Error(`${file} is ${f.data.kind ?? 'unfiled'}${f.data.status ? ` (${f.data.status})` : ''}: only an approved design note is embedded`);
  if (section(parseFrontmatter(f.text).body, heading) === null) throw new Error(`${file} has no heading '${heading}'`);
  const st = path.join(slipboxPaths(repo).structure, `${subsystem}.md`);
  const cur = fs.existsSync(st) ? fs.readFileSync(st, 'utf8') : null;
  const id = path.basename(f.abs, '.md');
  if (!(cur ?? '').includes(`![[${id}#${heading}]]`)) writeText(st, placeHeadingEmbed(cur, subsystem, { id, heading, topic }));
  return { generated: syncGenerated(repo, loadSlipbox(repo)) };
}

export function filePlan({ repo, file, ticket }) {
  const f = superpowersFile(repo, file, 'plans');
  if (f.data.kind) throw new Error(`${file} is already filed as ${f.data.kind}`);
  if (!ticket) throw new Error('a plan is filed with its ticket: --ticket <n>');
  writeText(f.abs, setFrontmatter(f.text, { kind: 'plan', ticket, status: 'in-progress' }));
}

export function closePlan({ repo, file, status }) {
  const f = superpowersFile(repo, file, 'plans');
  if (!['done', 'abandoned'].includes(status)) throw new Error(`--status is done or abandoned, not '${status}'`);
  if (f.data.kind !== 'plan' || f.data.status !== 'in-progress') throw new Error(`${file} is not an in-progress plan (kind ${f.data.kind ?? 'unfiled'}, status ${f.data.status ?? 'unset'})`);
  writeText(f.abs, setFrontmatter(f.text, { status }));
}

export function fileMap({ repo, file }) {
  const f = superpowersFile(repo, file, 'specs');
  if (f.data.kind) throw new Error(`${file} is already filed as ${f.data.kind}`);
  writeText(f.abs, setFrontmatter(f.text, { kind: 'map' }));
}
