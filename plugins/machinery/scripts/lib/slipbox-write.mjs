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

export function dictationNote({ id, subsystems, supersedes = [], title, text }) {
  const fm = { id, kind: 'dictation', subsystems, ...(supersedes.length ? { supersedes } : {}) };
  const tail = supersedes.length ? `\n\n${supersedes.map((s) => `Supersedes [[${s}]].`).join('\n')}` : '';
  return `${renderFrontmatter(fm)}# ${title}\n\n${quote(text)}${tail}\n`;
}

export function versionNote({ id, subsystems, supersedes, from, text }) {
  const fm = { id, kind: 'version', subsystems, supersedes: [supersedes], from: [from] };
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
