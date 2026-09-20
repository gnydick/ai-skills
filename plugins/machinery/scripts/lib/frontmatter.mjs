// Generic: the `---` front matter block at the head of a Markdown file, in the one flat shape the
// slip box writes (#132 § 4): `key: value` lines, where a value is a plain string or a `[a, b]` list.
// Not YAML: no nesting, no quoting, no anchors. renderFrontmatter refuses any value that
// parseFrontmatter would read back differently, so a round trip is exact by construction.
const BLOCK = /^---\r?\n(?:([\s\S]*?)\r?\n)?---(?:\r?\n|$)/;

export function parseFrontmatter(text) {
  const m = BLOCK.exec(text);
  if (!m) return { data: null, body: text };
  const data = {};
  for (const line of (m[1] ?? '').split(/\r?\n/)) {
    if (!line.trim() || line.trimStart().startsWith('#')) continue;
    const kv = /^([A-Za-z_][\w-]*):[ \t]*(.*?)[ \t]*$/.exec(line);
    if (!kv) throw new Error(`front matter: cannot read line '${line}'`);
    const v = kv[2].replace(/[ \t]+#.*$/, '');
    data[kv[1]] = /^\[.*\]$/.test(v) ? v.slice(1, -1).split(',').map((s) => s.trim()).filter(Boolean) : v;
  }
  return { data, body: text.slice(m[0].length) };
}

// What parseFrontmatter would read back differently, per value. A comma separates a LIST's
// elements, so an element holding one would come back as two — but a scalar is only read as a list
// when it is bracketed, so a comma in one round-trips byte for byte. An owner note's `source` is
// `<file> § <heading>` and the owner's own headings hold commas (#132, 2026-09-19), so the
// scalar case is spelled as what the round trip can actually prove.
const UNWRITABLE = { scalar: /[\n\r[\]#]/, element: /[\n\r[\],#]/ };
export function renderFrontmatter(data) {
  const lines = ['---'];
  for (const [k, v] of Object.entries(data)) {
    if (v === undefined || v === null) continue;
    const re = Array.isArray(v) ? UNWRITABLE.element : UNWRITABLE.scalar;
    for (const s of Array.isArray(v) ? v : [v]) {
      if (typeof s !== 'string' || re.test(s) || s !== s.trim()) throw new Error(`front matter: ${k} value '${s}' cannot be written in the flat shape`);
    }
    lines.push(`${k}: ${Array.isArray(v) ? `[${v.join(', ')}]` : v}`);
  }
  lines.push('---', '');
  return lines.join('\n');
}

// Replaces the block, or adds one, and keeps the body byte for byte.
export function setFrontmatter(text, patch) {
  const { data, body } = parseFrontmatter(text);
  return renderFrontmatter({ ...(data ?? {}), ...patch }) + body;
}
