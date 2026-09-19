// Story: #132 (the Zettelkasten slip box). The READ model: every note, which are in force, what
// each structure note must hold, and the generated pages. Read-only — the gate imports it and
// nothing under scripts/gate/ writes (spec I23). The writers are lib/slipbox-write.mjs.
import fs from 'node:fs';
import path from 'node:path';
import { parseFrontmatter } from './frontmatter.mjs';
import { scan, flatten, rebaseLinks } from './embed.mjs';
import { slipboxPaths } from './layout.mjs';

export const WHY = 'Why it is this way';
export const REFS = 'References';
const ADR_FILE = /^\d{4}-.*\.md$/;
const toPosix = (p) => p.split(path.sep).join('/');
const list = (v) => (v == null || v === '' ? [] : Array.isArray(v) ? v : [v]);

export const mdFiles = (dir) => (fs.existsSync(dir)
  ? fs.readdirSync(dir, { withFileTypes: true }).filter((e) => e.isFile() && e.name.endsWith('.md')).map((e) => e.name).sort()
  : []);
export const adrStatus = (body) => /^- \*\*Status:\*\* (.+)$/m.exec(body)?.[1].trim() ?? null;
export const isSupersededDecision = (n) => n.kind === 'decision' && /^Superseded by/.test(adrStatus(n.body) ?? '');
export const titleOf = (n) => /^# (.+)$/m.exec(n.body)?.[1].trim() ?? n.id;

// A superpowers file is someone else's text: front matter this reader cannot parse is recorded as
// `error`, not thrown, so one odd file never stops every commit in the project.
function readNote(root, abs, fallbackKind) {
  const text = fs.readFileSync(abs, 'utf8');
  let data = null, body = text, error = null;
  try { ({ data, body } = parseFrontmatter(text)); } catch (e) { error = e.message; }
  const d = data ?? {};
  return {
    id: path.basename(abs, '.md'), kind: d.kind ?? fallbackKind, data: d, body, error,
    rel: toPosix(path.relative(root, abs)),
    subsystems: list(d.subsystems), supersedes: list(d.supersedes), from: list(d.from), status: d.status ?? null,
  };
}

export function loadSlipbox(root) {
  const paths = slipboxPaths(root);
  const notes = new Map();
  const add = (n) => {
    if (notes.has(n.id)) throw new Error(`two notes share the id ${n.id}: ${notes.get(n.id).rel} and ${n.rel}`);
    notes.set(n.id, n);
  };
  for (const f of mdFiles(paths.notes)) add(readNote(root, path.join(paths.notes, f), null));
  for (const f of mdFiles(paths.decisions)) if (ADR_FILE.test(f)) add(readNote(root, path.join(paths.decisions, f), 'decision'));
  for (const dir of [paths.spSpecs, paths.spPlans]) for (const f of mdFiles(dir)) add(readNote(root, path.join(dir, f), null));
  const structures = new Map();
  for (const f of mdFiles(paths.structure)) {
    const abs = path.join(paths.structure, f);
    structures.set(f.slice(0, -3), { subsystem: f.slice(0, -3), rel: toPosix(path.relative(root, abs)), text: fs.readFileSync(abs, 'utf8') });
  }
  return { root, paths, notes, structures };
}

// In force: no note supersedes it, and no version note consumed it (#132 § 5). A design's
// `supersedes` takes effect only once that design is approved.
export function inForce(box) {
  const live = new Set(box.notes.keys());
  for (const n of box.notes.values()) {
    if (n.kind === 'design' && n.status !== 'approved') continue;
    for (const s of n.supersedes) live.delete(s);
    if (n.kind === 'version') for (const f of n.from) live.delete(f);
  }
  return live;
}

export function expected(box, subsystem, live = inForce(box)) {
  const pick = (pred) => [...box.notes.values()]
    .filter((n) => live.has(n.id) && n.subsystems.includes(subsystem) && pred(n))
    .map((n) => n.id).sort();
  return {
    embeds: pick((n) => n.kind === 'dictation' || n.kind === 'version'),
    designs: pick((n) => n.kind === 'design' && n.status === 'approved'),
    decisions: pick((n) => n.data.kind === 'decision' && !isSupersededDecision(n)),
  };
}

export function subsystemsOf(box, live = inForce(box)) {
  const s = new Set(box.structures.keys());
  for (const n of box.notes.values()) {
    const counts = ['dictation', 'version'].includes(n.kind) || (n.kind === 'design' && n.status === 'approved');
    if (counts && live.has(n.id)) for (const x of n.subsystems) s.add(x);
  }
  return [...s].sort();
}

// Read through embed.mjs's scan, the reading flatten uses: a section switches only at a `## ` heading
// outside fences, an embed is a whole-line embed outside code (in any section), and nothing inside
// code is counted. So `embeds` and `headingEmbeds` are exactly what the generated page expands.
export function readStructure(text) {
  const out = { embeds: [], headingEmbeds: [], why: [], refs: [], links: [] };
  let sec = null;
  for (const r of scan(text)) {
    if (r.heading?.level === 2) { sec = r.heading.text; continue; }
    if (r.fenced) continue;
    if (r.embed) { if (r.embed.heading) out.headingEmbeds.push(r.embed); else out.embeds.push(r.embed.id); continue; }
    if (sec === REFS) { for (const m of r.line.matchAll(/\]\(([^)\s]+)\)/g)) out.refs.push(m[1]); continue; }
    for (const l of r.links) {
      if (sec === WHY) out.why.push(l.id);
      else out.links.push(l);
    }
  }
  return out;
}

export function dictationQuote(body) {
  const lines = body.split('\n');
  const i = lines.findIndex((l) => l.startsWith('>'));
  if (i < 0) return null;
  let j = i;
  while (j < lines.length && lines[j].startsWith('>')) j++;
  return lines.slice(i, j).join('\n');
}

export function renderIndex(box) {
  const subs = [...box.structures.keys()].sort();
  return ['# Dictated specifications — index', '', '<!-- generated by intake.mjs regen; do not edit -->', '',
    ...subs.map((s) => `- [${s}](structure/${s}.md) — flat: [${s}](../spec-current/${s}.md)`), ''].join('\n');
}

export function renderCurrent(box, subsystem) {
  const st = box.structures.get(subsystem);
  const currentDir = toPosix(path.relative(box.root, box.paths.current));
  const resolve = (id) => {
    const n = box.notes.get(id);
    if (!n) return null;
    const href = path.posix.relative(currentDir, n.rel);
    return { body: n.body, title: titleOf(n), href, label: `*Source: [\`${id}\`](${href}) · ${n.kind ?? 'unfiled'}*` };
  };
  const text = rebaseLinks(st.text, path.posix.dirname(st.rel), currentDir);
  return `<!-- generated by intake.mjs regen from ${st.rel}; do not edit -->\n\n${flatten(text, resolve).replace(/\n+$/, '')}\n`;
}

// Every generated file, by repo-relative path. A project with no structure note has none.
export function regenerate(box) {
  const out = new Map();
  if (!box.structures.size) return out;
  const rel = (abs) => toPosix(path.relative(box.root, abs));
  out.set(rel(box.paths.index), renderIndex(box));
  for (const s of box.structures.keys()) out.set(rel(path.join(box.paths.current, `${s}.md`)), renderCurrent(box, s));
  return out;
}

export function staleGenerated(box, want = regenerate(box)) {
  const rel = (abs) => toPosix(path.relative(box.root, abs));
  const have = mdFiles(box.paths.current).map((f) => rel(path.join(box.paths.current, f)));
  if (fs.existsSync(box.paths.index)) have.push(rel(box.paths.index));
  return have.filter((r) => !want.has(r));
}
