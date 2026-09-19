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

export function renderFrontmatter(data) {
  const lines = ['---'];
  for (const [k, v] of Object.entries(data)) {
    if (v === undefined || v === null) continue;
    for (const s of Array.isArray(v) ? v : [v]) {
      if (typeof s !== 'string' || /[\n\r[\],#]/.test(s) || s !== s.trim()) throw new Error(`front matter: ${k} value '${s}' cannot be written in the flat shape`);
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
