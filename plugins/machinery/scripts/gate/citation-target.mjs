import { gitLines, gitRaw } from '../lib/git.mjs';
import { report } from '../lib/report.mjs';

// Ported from citation_creation_gate.py:95-137 plus the union's `file § Section` form.
const EXTS = 'md|rs|py|mjs|js|ts|tsx|json|toml|yaml|yml|sh|ps1|txt|html|css';
const LINE_CITE = new RegExp(String.raw`\x60([\w.][\w./\\-]*\.(?:${EXTS})):(\d+)(?:-(\d+))?\x60`, 'g');
const SECTION_CITE = new RegExp(String.raw`\x60([\w.][\w./\\-]*\.md)\x60\s*§\s*([^\n|]+?)(?=\s*(?:[|.;,)]|$))`, 'gm');
const SELF_EXCLUDE = [/scripts\/gate\/citation-target\.mjs$/, /test\/gate\.test\.mjs$/];
const stemHasLetter = (p) => /[A-Za-z]/.test(p.split(/[\\/]/).at(-1).replace(/\.[^.]+$/, ''));

// Diff hunks of ADDED lines, one at a time from a stream of diff lines (ticket #19: the whole
// diff was held as one string and died at 1 MiB; the owner ruled "operate on a stream"). Held
// at any moment: the hunk being assembled — a `§ Heading` that wraps across two added lines
// must be joined before it's matched (final review A4), so a hunk is the unit, never a line.
export async function* addedHunks(lines) {
  let file = null; let cur = null;
  const keep = (h) => h && h.file && !SELF_EXCLUDE.some((re) => re.test(h.file));
  for await (const line of lines) {
    if (line.startsWith('+++ b/')) { if (keep(cur)) yield cur; file = line.slice(6); cur = null; }
    else if (line.startsWith('@@')) { if (keep(cur)) yield cur; cur = { file, lines: [] }; }
    else if (line.startsWith('+') && !line.startsWith('+++') && cur) cur.lines.push(line.slice(1));
  }
  if (keep(cur)) yield cur;
}

function scanHunk(h, cites) {
  // Line citations stay per-line (a `path:N` citation is inherently line-scoped; joining
  // hunks would not change what it matches, and keeping it per-line keeps `from` accurate).
  for (const text of h.lines) {
    for (const m of text.matchAll(LINE_CITE)) if (stemHasLetter(m[1])) cites.push({ from: h.file, kind: 'line', path: m[1].replace(/\\/g, '/'), line: Number(m[2]) });
  }
  // Section citations are matched against the whole hunk, joined with a single space, so a
  // heading that wraps across two added lines is not truncated at the line break (A4).
  const joined = h.lines.join(' ');
  for (const m of joined.matchAll(SECTION_CITE)) cites.push({ from: h.file, kind: 'section', path: m[1].replace(/\\/g, '/'), section: m[2].trim() });
}

// Every citation in a stream of diff lines. A source that fails part-way rejects: the
// citations that arrived before the death are never reported, because a partial scan that
// says "0 of 0" is the silent pass this leg exists to prevent.
export async function collectCitations(lines) {
  const cites = [];
  for await (const h of addedHunks(lines)) scanHunk(h, cites);
  return cites;
}

// Resolve a cited path against --root first (`:./<path>`, cwd = root — matches how the plugin's
// own docs cite plugin-relative paths like `rules/x.md`), falling back to the repo top level
// (final review A3). Untrimmed (final review A2): leading/trailing blank lines are real content
// that a `path:N` citation counts against.
function showAt(root, ref, file) {
  const nested = gitRaw(['show', `${ref}:./${file}`], root);
  if (nested.code === 0) return nested;
  return gitRaw(['show', `${ref}:${file}`], root);
}

function blobLine(root, mergeMode, file, n) {
  const ref = mergeMode ? 'HEAD' : '';
  const r = showAt(root, ref, file);
  if (r.code !== 0) return null;
  const lines = r.stdout.split('\n');
  return n >= 1 && n <= lines.length ? lines[n - 1] : null;
}

export async function citationTarget({ root, mergeMode = false }) {
  const args = mergeMode ? ['diff', '-U0', 'HEAD^1', 'HEAD'] : ['diff', '--cached', '-U0'];
  let cites;
  try { cites = await collectCitations(gitLines(args, root)); }
  catch (e) { throw new Error(`git diff failed: ${e.message}`); }
  const failures = [];
  for (const c of cites) {
    if (c.kind === 'line') {
      const l = blobLine(root, mergeMode, c.path, c.line);
      if (l === null || !l.trim()) failures.push(`${c.from}: \`${c.path}:${c.line}\` → ${l === null ? 'no such file/line in the index' : 'blank line'}`);
    } else {
      const r = showAt(root, mergeMode ? 'HEAD' : '', c.path);
      const ok = r.code === 0 && r.stdout.split('\n').some((x) => x.trim() === `## ${c.section}` || x.trim() === `# ${c.section}`);
      if (!ok) failures.push(`${c.from}: \`${c.path}\` § ${c.section} → ${r.code === 0 ? 'no such heading' : 'no such file in the index'}`);
    }
  }
  report('citation_target', failures.length, cites.length, `new citations failed (validated once, at authoring)`);
  for (const f of failures) process.stdout.write(`  ${f}\n`);
  return failures.length === 0;
}
