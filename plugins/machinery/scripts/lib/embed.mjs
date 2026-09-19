// Generic: Obsidian-style links in Markdown (#132 § 8). `[[id]]` links, `![[id]]` whole-note embeds
// and `![[id#Heading]]` heading embeds. It knows nothing about notes, kinds or subsystems: the
// caller hands it a resolver. Paragraph `#^id` embeds are not supported, by design.
//
// Code is text: a fenced code block or an inline code span is never read for links, embeds or
// headings, and flatten copies it unchanged.
import path from 'node:path';

export const LINK_RE = /(!?)\[\[([^\]#|]+)(?:#([^\]|]+))?\]\]/g;
const EMBED_LINE = /^\s*!\[\[[^\]]+\]\]\s*$/;
const HEADING = /^(#{1,6})\s+(.*?)\s*$/;

// For each line, true when it is a fence line or inside a fenced code block. CommonMark: a fence is
// three or more ` or ~ after at most three spaces; it closes at the same character, at least as
// long, with nothing after it; an unclosed fence runs to the end of the text.
function fenced(lines) {
  let open = null;
  return lines.map((l) => {
    const m = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(l);
    if (open) {
      if (m && m[1][0] === open[0] && m[1].length >= open.length && !m[2].trim()) open = null;
      return true;
    }
    if (m && !(m[1][0] === '`' && m[2].includes('`'))) open = m[1];
    return Boolean(open);
  });
}

// One flag per character of `text`: 1 where it is code. Fenced lines are code whole. An inline code
// span (CommonMark: a run of n backticks, closed by the next run of exactly n; a run with no match
// is literal text) may run across the lines of one paragraph, never across a blank line, a heading
// or a fence.
function codeMask(text) {
  const mask = new Uint8Array(text.length);
  const spans = (from, to) => {
    const runs = [...text.slice(from, to).matchAll(/`+/g)];
    for (let a = 0; a < runs.length; a++) {
      const b = runs.findIndex((r, k) => k > a && r[0].length === runs[a][0].length);
      if (b < 0) continue;
      mask.fill(1, from + runs[a].index, from + runs[b].index + runs[b][0].length);
      a = b;
    }
  };
  const lines = text.split('\n');
  const code = fenced(lines);
  let at = 0;
  let para = null;
  lines.forEach((l, k) => {
    const end = at + l.length;
    const heading = !code[k] && HEADING.test(l);
    if (code[k] || heading || !l.trim()) {
      if (para !== null) spans(para, at);
      para = null;
      if (code[k]) mask.fill(1, at, end);
      if (heading) spans(at, end);
    } else if (para === null) para = at;
    at = end + 1;
  });
  if (para !== null) spans(para, text.length);
  return mask;
}

const inCode = (mask, from, length) => mask.subarray(from, from + length).some(Boolean);

export function links(text) {
  const mask = codeMask(text);
  return [...text.matchAll(LINK_RE)]
    .filter((m) => !inCode(mask, m.index, m[0].length))
    .map((m) => ({ embed: m[1] === '!', id: m[2].trim(), heading: m[3]?.trim() ?? null, raw: m[0] }));
}

// The heading line through the line before the next heading of the same or higher level.
export function section(body, heading) {
  const lines = body.split('\n');
  const code = fenced(lines);
  const i = lines.findIndex((l, k) => !code[k] && HEADING.exec(l)?.[2] === heading);
  if (i < 0) return null;
  const level = /^(#+)/.exec(lines[i])[1].length;
  let j = i + 1;
  while (j < lines.length) {
    const m = !code[j] && /^(#{1,6})\s/.exec(lines[j]);
    if (m && m[1].length <= level) break;
    j++;
  }
  return lines.slice(i, j).join('\n').replace(/\n+$/, '');
}

// A line that is only an embed is replaced by the resolver's label line and the expanded text, set
// off by one blank line before and after. Any other link becomes a Markdown link to the resolver's
// href.
export function flatten(text, resolve, stack = []) {
  const mask = codeMask(text);
  const out = [];
  const blank = (l) => !l.trim();
  let afterEmbed = false;
  let at = 0;
  text.split('\n').forEach((line) => {
    const start = at;
    at += line.length + 1;
    const [l] = EMBED_LINE.test(line) && !inCode(mask, start, line.length) ? links(line) : [];
    if (l?.embed) {
      const key = l.heading ? `${l.id}#${l.heading}` : l.id;
      if (stack.includes(l.id)) throw new Error(`embed cycle: ${[...stack, l.id].join(' → ')}`);
      const t = resolve(l.id);
      if (!t) throw new Error(`embed of unknown note ${l.id}`);
      const part = l.heading ? section(t.body, l.heading) : t.body.replace(/^(?:[ \t]*\r?\n)+/, '').replace(/\n+$/, '');
      if (part === null) throw new Error(`embed of missing heading ${key}`);
      if (out.length && !blank(out.at(-1))) out.push('');
      out.push(t.label);
      if (part) out.push('', ...flatten(part, resolve, [...stack, l.id]).split('\n'));
      afterEmbed = true;
      return;
    }
    if (afterEmbed && !blank(line)) out.push('');
    afterEmbed = false;
    out.push(line.replace(LINK_RE, (raw, bang, id, heading, i) => {
      if (inCode(mask, start + i, raw.length)) return raw;
      const t = resolve(id.trim());
      if (!t) throw new Error(`link to unknown note ${id.trim()}`);
      return `[${t.title}${heading ? ` § ${heading.trim()}` : ''}](${t.href})`;
    }));
  });
  return out.join('\n');
}

// Relative Markdown links written from `fromDir`, rewritten to read from `toDir` (posix, repo-relative).
export function rebaseLinks(text, fromDir, toDir) {
  return text.replace(/\]\(([^)\s]+)\)/g, (raw, href) => (/^([a-z][a-z0-9+.-]*:|#|\/)/i.test(href) ? raw : `](${path.posix.relative(toDir, path.posix.join(fromDir, href))})`));
}
