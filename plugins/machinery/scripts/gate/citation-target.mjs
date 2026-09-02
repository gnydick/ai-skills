import path from 'node:path';
import { git } from '../lib/git.mjs';
import { report } from '../lib/report.mjs';

// Ported from citation_creation_gate.py:95-137 plus the union's `file § Section` form.
const EXTS = 'md|rs|py|mjs|js|ts|tsx|json|toml|yaml|yml|sh|ps1|txt|html|css';
const LINE_CITE = new RegExp(String.raw`\x60([\w.][\w./\\-]*\.(?:${EXTS})):(\d+)(?:-(\d+))?\x60`, 'g');
const SECTION_CITE = new RegExp(String.raw`\x60([\w.][\w./\\-]*\.md)\x60\s*§\s*([^\n|]+?)(?=\s*(?:[|.;,)]|$))`, 'gm');
const SELF_EXCLUDE = [/scripts\/gate\/citation-target\.mjs$/, /test\/gate\.test\.mjs$/];
const stemHasLetter = (p) => /[A-Za-z]/.test(p.split(/[\\/]/).at(-1).replace(/\.[^.]+$/, ''));

function stagedAdded(root, mergeMode) {
  const args = mergeMode ? ['diff', '-U0', 'HEAD^1', 'HEAD'] : ['diff', '--cached', '-U0'];
  const d = git(args, root);
  if (d.code !== 0) throw new Error(`git diff failed: ${d.stderr}`);
  const out = []; let file = null;
  for (const line of d.stdout.split('\n')) {
    if (line.startsWith('+++ b/')) file = line.slice(6);
    else if (line.startsWith('+') && !line.startsWith('+++') && file) out.push({ file, text: line.slice(1) });
  }
  return out.filter((x) => !SELF_EXCLUDE.some((re) => re.test(x.file)));
}

function blobLine(root, mergeMode, file, n) {
  const ref = mergeMode ? 'HEAD' : '';
  const r = git(['show', `${ref}:${file}`], root);
  if (r.code !== 0) return null;
  const lines = r.stdout.split('\n');
  return n >= 1 && n <= lines.length ? lines[n - 1] : null;
}

export function citationTarget({ root, mergeMode = false }) {
  const added = stagedAdded(root, mergeMode);
  const cites = [];
  for (const { file, text } of added) {
    for (const m of text.matchAll(LINE_CITE)) if (stemHasLetter(m[1])) cites.push({ from: file, kind: 'line', path: m[1].replace(/\\/g, '/'), line: Number(m[2]) });
    for (const m of text.matchAll(SECTION_CITE)) cites.push({ from: file, kind: 'section', path: m[1].replace(/\\/g, '/'), section: m[2].trim() });
  }
  const failures = [];
  for (const c of cites) {
    if (c.kind === 'line') {
      const l = blobLine(root, mergeMode, c.path, c.line);
      if (l === null || !l.trim()) failures.push(`${c.from}: \`${c.path}:${c.line}\` → ${l === null ? 'no such file/line in the index' : 'blank line'}`);
    } else {
      const r = git(['show', `${mergeMode ? 'HEAD' : ''}:${c.path}`], root);
      const ok = r.code === 0 && r.stdout.split('\n').some((x) => x.trim() === `## ${c.section}` || x.trim() === `# ${c.section}`);
      if (!ok) failures.push(`${c.from}: \`${c.path}\` § ${c.section} → ${r.code === 0 ? 'no such heading' : 'no such file in the index'}`);
    }
  }
  report('citation_target', failures.length, cites.length, `new citations failed (validated once, at authoring)`);
  for (const f of failures) process.stdout.write(`  ${f}\n`);
  return failures.length === 0;
}
