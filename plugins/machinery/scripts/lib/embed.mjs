// Generic: Obsidian-style links in Markdown (#132 § 8). `[[id]]` links, `![[id]]` whole-note embeds
// and `![[id#Heading]]` heading embeds. It knows nothing about notes, kinds or subsystems: the
// caller hands it a resolver. Paragraph `#^id` embeds are not supported, by design.
import path from 'node:path';

export const LINK_RE = /(!?)\[\[([^\]#|]+)(?:#([^\]|]+))?\]\]/g;

export function links(text) {
  return [...text.matchAll(LINK_RE)].map((m) => ({ embed: m[1] === '!', id: m[2].trim(), heading: m[3]?.trim() ?? null, raw: m[0] }));
}

// The heading line through the line before the next heading of the same or higher level.
export function section(body, heading) {
  const lines = body.split('\n');
  const i = lines.findIndex((l) => /^(#{1,6})\s+(.*?)\s*$/.exec(l)?.[2] === heading);
  if (i < 0) return null;
  const level = /^(#+)/.exec(lines[i])[1].length;
  let j = i + 1;
  while (j < lines.length) {
    const m = /^(#{1,6})\s/.exec(lines[j]);
    if (m && m[1].length <= level) break;
    j++;
  }
  return lines.slice(i, j).join('\n').replace(/\n+$/, '');
}

// A line that is only an embed is replaced by the resolver's label line and the expanded text.
// Any other link becomes a Markdown link to the resolver's href.
export function flatten(text, resolve, stack = []) {
  return text.split('\n').map((line) => {
    if (/^\s*!\[\[[^\]]+\]\]\s*$/.test(line)) {
      const [l] = links(line);
      const key = l.heading ? `${l.id}#${l.heading}` : l.id;
      if (stack.includes(l.id)) throw new Error(`embed cycle: ${[...stack, l.id].join(' → ')}`);
      const t = resolve(l.id);
      if (!t) throw new Error(`embed of unknown note ${l.id}`);
      const part = l.heading ? section(t.body, l.heading) : t.body.replace(/\n+$/, '');
      if (part === null) throw new Error(`embed of missing heading ${key}`);
      return `${t.label}\n\n${flatten(part, resolve, [...stack, l.id])}`;
    }
    return line.replace(LINK_RE, (raw, bang, id, heading) => {
      const t = resolve(id.trim());
      if (!t) throw new Error(`link to unknown note ${id.trim()}`);
      return `[${t.title}${heading ? ` § ${heading.trim()}` : ''}](${t.href})`;
    });
  }).join('\n');
}

// Relative Markdown links written from `fromDir`, rewritten to read from `toDir` (posix, repo-relative).
export function rebaseLinks(text, fromDir, toDir) {
  return text.replace(/\]\(([^)\s]+)\)/g, (raw, href) => (/^([a-z][a-z0-9+.-]*:|#|\/)/i.test(href) ? raw : `](${path.posix.relative(toDir, path.posix.join(fromDir, href))})`));
}
