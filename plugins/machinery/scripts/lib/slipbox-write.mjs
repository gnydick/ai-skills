// Story: #132. The slip box WRITERS: a note written once, the placements filing makes in a
// structure note (D2: filing maintains structure notes, nobody edits them by hand), and the
// generated pages. Never imported by the gate (spec I23).
import fs from 'node:fs';
import path from 'node:path';
import { renderFrontmatter } from './frontmatter.mjs';
import { quote } from './blockquote.mjs';
import { regenerate, staleGenerated, isSupersededDecision, WHY, REFS } from './slipbox.mjs';

export function writeOnce(abs, text) {
  if (fs.existsSync(abs)) throw new Error(`refusing to overwrite ${abs}: a note is written once`);
  writeText(abs, text);
}
export function writeText(abs, text) {
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, text, 'utf8');
}

// The front matter each note kind carries, spelled ONCE. The migration asks whether a planned note
// can be written at all (frontmatterProblem) using the very object its writer will render, so the
// question and the answer can never drift apart (#132 fix wave 4).
export const dictationFrontmatter = ({ id, subsystems, supersedes = [] }) => ({ id, kind: 'dictation', subsystems, ...(supersedes.length ? { supersedes } : {}) });
export const ownerFrontmatter = ({ id, subsystems, supersedes = [], source }) => ({ id, kind: 'owner', subsystems, ...(supersedes.length ? { supersedes } : {}), source });
export const versionFrontmatter = ({ id, subsystems, supersedes, from }) => ({ id, kind: 'version', subsystems, supersedes: [supersedes], from: [from] });

export function dictationNote({ id, subsystems, supersedes = [], title, text }) {
  const fm = dictationFrontmatter({ id, subsystems, supersedes });
  const tail = supersedes.length ? `\n\n${supersedes.map((s) => `Supersedes [[${s}]].`).join('\n')}` : '';
  return `${renderFrontmatter(fm)}# ${title}\n\n${quote(text)}${tail}\n`;
}

// An OWNER note (owner, 2026-09-19: "Carry them as owner notes"). The owner's own ruling, typed
// into an old spec file by hand and never captured, so NO inbox entry holds its words and gate
// leg 2 can never prove it verbatim. The words are carried anyway — the alternative measured on
// ferrislicer was commit 2 deleting twelve of them — and the note's own first line tells the
// reader exactly what the machinery could not check. `source` is the file and heading it came
// from; after the migration that file is gone, so the source line is where the trail continues.
export function ownerNote({ id, subsystems, supersedes = [], title, source, text }) {
  const fm = ownerFrontmatter({ id, subsystems, supersedes, source });
  const tail = supersedes.length ? `\n${supersedes.map((s) => `Supersedes [[${s}]].`).join('\n')}\n` : '';
  const said = `*Transcribed from ${source}. It was not captured through the \`SPEC:\` marker, so the verbatim check cannot prove it.*`;
  return `${renderFrontmatter(fm)}# ${title}\n\n${said}\n\n${text.replace(/\n+$/, '')}\n${tail}`;
}

export function versionNote({ id, subsystems, supersedes, from, text }) {
  const fm = versionFrontmatter({ id, subsystems, supersedes, from });
  return `${renderFrontmatter(fm)}*Composed by the assistant from [[${supersedes}]] and [[${from}]]. Not the owner's words.*\n\n${text.replace(/\n+$/, '')}\n\nSupersedes [[${supersedes}]].\n`;
}

const skeleton = (subsystem) => `# ${subsystem} — current state\n`;
const headings = (lines) => lines.flatMap((l, i) => { const m = /^## (.+?)\s*$/.exec(l); return m ? [{ name: m[1], i }] : []; });

// Appends `line` at the end of `## name`. A missing section is created before the first of
// `before` that exists, or at the end.
function appendToSection(text, name, line, before) {
  const lines = text.replace(/\n+$/, '').split('\n');
  const hs = headings(lines);
  const at = hs.find((h) => h.name === name);
  if (at) {
    const next = hs.find((h) => h.i > at.i);
    let end = next ? next.i : lines.length;
    while (end > at.i + 1 && lines[end - 1] === '') end--;
    lines.splice(end, 0, line);
    return `${lines.join('\n')}\n`;
  }
  const tail = hs.find((h) => before.includes(h.name));
  if (tail) { lines.splice(tail.i, 0, `## ${name}`, '', line, ''); return `${lines.join('\n')}\n`; }
  return `${[...lines, '', `## ${name}`, '', line].join('\n')}\n`;
}

export const placeEmbed = (text, subsystem, { id, topic }) => appendToSection(text ?? skeleton(subsystem), topic, `![[${id}]]`, [WHY, REFS]);
export const placeHeadingEmbed = (text, subsystem, { id, heading, topic }) => appendToSection(text ?? skeleton(subsystem), topic, `![[${id}#${heading}]]`, [WHY, REFS]);
export const placeLink = (text, subsystem, id) => appendToSection(text ?? skeleton(subsystem), WHY, `- [[${id}]]`, [REFS]);
export const placeRef = (text, subsystem, label, href) => appendToSection(text ?? skeleton(subsystem), REFS, `- [${label}](${href})`, []);

export function swapEmbed(text, oldId, newId) {
  const lines = text.split('\n');
  const i = lines.findIndex((l) => l.trim() === `![[${oldId}]]`);
  if (i < 0) return null;
  lines[i] = `![[${newId}]]`;
  return lines.join('\n');
}
export const dropEmbed = (text, id) => text.split('\n').filter((l) => l.trim() !== `![[${id}]]`).join('\n');

// A decision whose status line now reads "Superseded by …" leaves every "Why" section.
export const dropSupersededLinks = (text, box) => text.split('\n').filter((l) => {
  const m = /^- \[\[(.+?)\]\]\s*$/.exec(l);
  const n = m && box.notes.get(m[1]);
  return !(n && isSupersededDecision(n));
}).join('\n');

// Writes every generated page that differs and removes every orphan. Returns repo-relative paths.
export function syncGenerated(root, box) {
  const want = regenerate(box);
  const changed = [];
  for (const [rel, text] of want) {
    const abs = path.join(root, rel);
    if ((fs.existsSync(abs) ? fs.readFileSync(abs, 'utf8') : null) !== text) { writeText(abs, text); changed.push(rel); }
  }
  for (const rel of staleGenerated(box, want)) { fs.rmSync(path.join(root, rel)); changed.push(rel); }
  return changed;
}
