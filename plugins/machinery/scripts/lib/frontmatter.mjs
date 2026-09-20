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
    // A WHOLE line that is a comment is skipped, and only that. The inline `# …` strip this used to
    // do is gone (#132 fix wave 4): `#` is a comment in YAML, and this shape is explicitly not
    // YAML, so the strip silently truncated a legitimate value — measured on ferrislicer's
    // `§ D. Storage, persistence and GUI recovery — folds into #966/#967`, whose source line came
    // back as `x § folds into`. The line skip stays: a `key:` line never starts with `#`, so it
    // costs nothing, and removing it would make a file carrying such a line unreadable — which gate
    // leg 2a refuses, in a project with no legal edit out of it.
    if (!line.trim() || line.trimStart().startsWith('#')) continue;
    const kv = /^([A-Za-z_][\w-]*):[ \t]*(.*?)[ \t]*$/.exec(line);
    if (!kv) throw new Error(`front matter: cannot read line '${line}'`);
    const v = kv[2];
    data[kv[1]] = /^\[.*\]$/.test(v) ? v.slice(1, -1).split(',').map((s) => s.trim()).filter(Boolean) : v;
  }
  return { data, body: text.slice(m[0].length) };
}

// What parseFrontmatter would read back differently, per value — and nothing else. A comma
// separates a LIST's elements, so an element holding one would come back as two; a bracketed
// scalar would come back as a list; a newline ends the line. That is the whole set. `#` was once
// refused here because the parser stripped an inline comment; the parser does not any more, so
// refusing it would refuse a value that round-trips — measured on ferrislicer's own heading
// `§ D. … folds into #966/#967`, one of the twelve rulings this migration exists to carry.
const UNWRITABLE = { scalar: /[\n\r[\]]/, element: /[\n\r[\],]/ };
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

// The same test, asked as a question instead of thrown. A caller that must refuse BEFORE it starts
// writing — the migration checks its whole plan first — cannot use a throw: by the time it lands,
// notes are on disk (#132 fix wave 4, measured: an unrenderable `source` threw inside applyChanges
// with a message naming neither the row nor the heading).
export function frontmatterProblem(data) {
  try { renderFrontmatter(data); return null; } catch (e) { return e.message; }
}

// Replaces the block, or adds one, and keeps the body byte for byte.
export function setFrontmatter(text, patch) {
  const { data, body } = parseFrontmatter(text);
  return renderFrontmatter({ ...(data ?? {}), ...patch }) + body;
}
