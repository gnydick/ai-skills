# Zettelkasten Slip Box Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** File `SPEC:` dictations, ADRs and ratified designs as immutable Zettelkasten notes, composed into a current state per subsystem, checked by the commit gate.

**Architecture:**
- Pure generic libs: front matter, block quote, embed/flatten.
- One read model (`lib/slipbox.mjs`) that the gate imports.
- One writer module (`lib/slipbox-write.mjs`) and one command module (`lib/slipbox-file.mjs`) that `intake.mjs` drives.
- One new blocking gate module (`scripts/gate/slipbox-check.mjs`).

**Tech Stack:** Node ESM, `node:test`, git. No new dependency.

**Spec:**
- https://github.com/gnydick/ai-skills/issues/132#issuecomment-5738788964 (implementation spec, D1–D12)
- https://github.com/gnydick/ai-skills/issues/132#issuecomment-5738823237 (Amendment 1, D13)

## Global Constraints

- No external dependency (core rule; D4).
- Nothing under `scripts/gate/` writes to the tree (spec I23; `test/gate-purity.test.mjs`).
- Every gate leg prints its denominator through `report()` (spec I25).
- `JSON.stringify` only in `lib/emit.mjs` or a file listed in `SERIALISES_TO_A_FILE` (`test/gate-purity.test.mjs`).
- Every test file has a test named `RED CHECK: …` (`test/meta.test.mjs`).
- Every `scripts/<name>.mjs --flag` a skill names appears in that script's source (`test/skills.test.mjs`).
- Generic code goes in `scripts/lib/` (universal rule, 2026-09-16).
- Every commit that touches `plugins/machinery/` bumps the plugin: `node plugins/machinery/scripts/bump.mjs --plugin plugins/machinery` (build check `validateVersions`).
- Commit named paths only: `git commit -m "<msg>" -- <paths>`. Message ends with the assistant trailer.
- Work in worktree `zettelkasten` (branch `zettelkasten`). Merge to main needs the owner's approval (`reviewBeforeMain: person`).
- Run one suite: `node --test plugins/machinery/test/<file>.test.mjs` from the worktree root.

## Deviations from the spec, stated

- **Leg 7 checks added files only.** Spec § 9 says "every `.md`"; spec § 10 says "a new file". § 10 governs. Existing files are the banner's job (D13), so an unmigrated repo is not locked out of every commit.
- **CI base.** Spec § 9 names `scripts/lib/base-ref.mjs`. Read: it is the worktree base policy, not a CI base. Leg 1 uses the index against HEAD, else `merge-base HEAD origin/HEAD`, else reports "no base".
- **`design --embed` is added.** D2 says filing places every embed. Spec § 6 listed no command that places a design heading embed. Task 8 adds one.
- **`config.mjs` and `gate.mjs` are not touched.** Spec § 13 listed both. `slipboxPaths` lives in `layout.mjs`, which the standalone gate already imports, and the gate's context already carries `root` and `specInbox`.
- **`intake.mjs map` is added.** D12 needs a way to mark a living map so leg 7 and leg 1 treat it as editable and never embedded.
- **Decision immutability applies to `00NN-*.md` only.** `decisions/README.md` stays editable, matching ferrislicer's own ADR filename rule.

## File map

| File | Responsibility |
|---|---|
| `scripts/lib/frontmatter.mjs` | parse, render, patch the flat front matter block |
| `scripts/lib/blockquote.mjs` | reversible text ↔ block quote |
| `scripts/lib/embed.mjs` | wiki links, heading sections, flatten, link rebase |
| `scripts/lib/layout.mjs` | slip box names, `slipboxPaths`, `stampToId`, `idToStamp` |
| `scripts/lib/slipbox.mjs` | read model: notes, in force, expected membership, generated pages |
| `scripts/lib/slipbox-write.mjs` | writers: notes, structure placement, generated sync |
| `scripts/lib/unmigrated.mjs` | detection of unmigrated content |
| `scripts/lib/commit.mjs` | commit named paths |
| `scripts/lib/slipbox-file.mjs` | `spec`, `decision`, `ref`, `design`, `plan` command logic |
| `scripts/lib/migrate.mjs` | `migrate --plan` and `--apply` logic |
| `scripts/lib/migrate-plan.mjs` | read and write the migration plan file |
| `scripts/gate/slipbox-check.mjs` | gate legs 1–7 |
| `scripts/intake.mjs` | flag parsing and dispatch for every new command |

---

### Task 1: Front matter, block quote, and the slip box layout

**Files:**
- Create: `plugins/machinery/scripts/lib/frontmatter.mjs`
- Create: `plugins/machinery/scripts/lib/blockquote.mjs`
- Modify: `plugins/machinery/scripts/lib/layout.mjs` (append after `insideSpecArea`)
- Test: `plugins/machinery/test/lib-notes-format.test.mjs`

**Interfaces:**
- Produces:
  - `parseFrontmatter(text) → { data: object|null, body: string }` (throws on an unreadable line)
  - `renderFrontmatter(data) → string` (throws on an unwritable value)
  - `setFrontmatter(text, patch) → string`
  - `quote(text) → string`, `unquote(block) → string`
  - `NOTES_DIR, DECISIONS_DIR, STRUCTURE_DIR, INDEX_FILE, CURRENT_DIR, SUPERPOWERS_DIR, ADR_DIR`
  - `stampToId(stamp) → string`, `idToStamp(id) → string`
  - `slipboxPaths(root) → { specs, notes, decisions, structure, index, current, spSpecs, spPlans, adr, specInbox }`

- [ ] **Step 1: Write the failing test**

```js
// plugins/machinery/test/lib-notes-format.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { parseFrontmatter, renderFrontmatter, setFrontmatter } from '../scripts/lib/frontmatter.mjs';
import { quote, unquote } from '../scripts/lib/blockquote.mjs';
import { stampToId, idToStamp, slipboxPaths } from '../scripts/lib/layout.mjs';

test('front matter round-trips strings and lists, and leaves the body byte for byte', () => {
  const text = renderFrontmatter({ id: 'a', kind: 'dictation', subsystems: ['x', 'y'], supersedes: [] }) + '# T\n\nbody\n';
  assert.equal(text, '---\nid: a\nkind: dictation\nsubsystems: [x, y]\nsupersedes: []\n---\n# T\n\nbody\n');
  const { data, body } = parseFrontmatter(text);
  assert.deepEqual(data, { id: 'a', kind: 'dictation', subsystems: ['x', 'y'], supersedes: [] });
  assert.equal(body, '# T\n\nbody\n');
});

test('a file with no front matter has data null and the whole text as body', () => {
  assert.deepEqual(parseFrontmatter('# plain\n'), { data: null, body: '# plain\n' });
});

test('setFrontmatter adds a block to a bare file and patches an existing one, body untouched', () => {
  const one = setFrontmatter('# Design\n\ntext\n', { kind: 'design', status: 'draft' });
  assert.equal(one, '---\nkind: design\nstatus: draft\n---\n# Design\n\ntext\n');
  assert.equal(setFrontmatter(one, { status: 'approved' }), '---\nkind: design\nstatus: approved\n---\n# Design\n\ntext\n');
});

test('an unwritable value is refused rather than written in a shape that reads back differently', () => {
  for (const bad of ['a, b', 'x#y', 'two\nlines', ' pad', '[x]']) assert.throws(() => renderFrontmatter({ k: bad }), /cannot be written/, bad);
});

test('quote then unquote returns awkward text byte for byte', () => {
  const t = 'SPEC: one\n\n  - indented — dash\n> already quoted\n\nC:\\path *x* "q"';
  assert.equal(unquote(quote(t)), t);
  assert.equal(quote('a\n\nb'), '> a\n>\n> b');
});

test('a stamp maps to a Windows-legal id and back', () => {
  const id = stampToId('2026-09-19T01:03:49Z');
  assert.equal(id, '2026-09-19T01-03-49Z');
  assert.doesNotMatch(id, /[<>:"/\\|?*]/);
  assert.equal(idToStamp(id), '2026-09-19T01:03:49Z');
});

test('slipboxPaths names every slip box location under the root', () => {
  const p = slipboxPaths('/r');
  const j = (...s) => path.join('/r', ...s);
  assert.equal(p.notes, j('docs', 'dictated-specs', 'notes'));
  assert.equal(p.structure, j('docs', 'dictated-specs', 'structure'));
  assert.equal(p.decisions, j('docs', 'dictated-specs', 'decisions'));
  assert.equal(p.index, j('docs', 'dictated-specs', 'INDEX.md'));
  assert.equal(p.current, j('docs', 'spec-current'));
  assert.equal(p.spSpecs, j('docs', 'superpowers', 'specs'));
  assert.equal(p.spPlans, j('docs', 'superpowers', 'plans'));
  assert.equal(p.adr, j('docs', 'adr'));
  assert.equal(p.specInbox, j('.claude', 'machinery', 'spec-inbox.md'));
});

test('RED CHECK: unquote and parseFrontmatter refuse what they cannot read', () => {
  assert.throws(() => unquote('> a\nplain'), /not a block quote line/);
  assert.throws(() => parseFrontmatter('---\n: nokey\n---\n'), /cannot read line/);
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node --test plugins/machinery/test/lib-notes-format.test.mjs`
Expected: FAIL — `Cannot find module …/frontmatter.mjs`.

- [ ] **Step 3: Write `scripts/lib/frontmatter.mjs`**

```js
// Generic: the `---` front matter block at the head of a Markdown file, in the one flat shape the
// slip box writes (#132 § 4): `key: value` lines, where a value is a plain string or a `[a, b]` list.
// Not YAML: no nesting, no quoting, no anchors. renderFrontmatter refuses any value that
// parseFrontmatter would read back differently, so a round trip is exact by construction.
const BLOCK = /^---\r?\n([\s\S]*?)\r?\n?---(?:\r?\n|$)/;

export function parseFrontmatter(text) {
  const m = BLOCK.exec(text);
  if (!m) return { data: null, body: text };
  const data = {};
  for (const line of m[1].split(/\r?\n/)) {
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
```

- [ ] **Step 4: Write `scripts/lib/blockquote.mjs`**

```js
// Generic, reversible: text ↔ a Markdown block quote. unquote(quote(t)) === t for every t, which is
// what lets the gate prove a dictation note still holds its inbox entry byte for byte (#132 § 9 leg 2).
export const quote = (text) => text.split('\n').map((l) => (l ? `> ${l}` : '>')).join('\n');

export function unquote(block) {
  return block.split('\n').map((l) => {
    if (l === '>') return '';
    if (l.startsWith('> ')) return l.slice(2);
    throw new Error(`not a block quote line: '${l}'`);
  }).join('\n');
}
```

- [ ] **Step 5: Append the slip box layout to `scripts/lib/layout.mjs`** (after `insideSpecArea`)

```js
// #132: the slip box (Zettelkasten). Every name is spelled here once; the gate, intake, the
// banner and install all build paths from slipboxPaths.
export const NOTES_DIR = 'notes';
export const DECISIONS_DIR = 'decisions';
export const STRUCTURE_DIR = 'structure';
export const INDEX_FILE = 'INDEX.md';
export const CURRENT_DIR = 'spec-current';
export const SUPERPOWERS_DIR = 'superpowers';
export const ADR_DIR = 'adr';

// A capture stamp as a note id: ':' is illegal in a Windows filename (#132 § 3).
export const stampToId = (stamp) => stamp.replaceAll(':', '-');
export const idToStamp = (id) => id.replace(/T(\d\d)-(\d\d)-(\d\d)Z$/, 'T$1:$2:$3Z');

export function slipboxPaths(root) {
  const specs = path.join(root, DOCS_DIR, SPECS_DIR);
  return {
    specs,
    notes: path.join(specs, NOTES_DIR),
    decisions: path.join(specs, DECISIONS_DIR),
    structure: path.join(specs, STRUCTURE_DIR),
    index: path.join(specs, INDEX_FILE),
    current: path.join(root, DOCS_DIR, CURRENT_DIR),
    spSpecs: path.join(root, DOCS_DIR, SUPERPOWERS_DIR, 'specs'),
    spPlans: path.join(root, DOCS_DIR, SUPERPOWERS_DIR, 'plans'),
    adr: path.join(root, DOCS_DIR, ADR_DIR),
    specInbox: path.join(root, '.claude', MACHINERY_DIR, SPEC_INBOX),
  };
}
```

- [ ] **Step 6: Run the suite to verify it passes**

Run: `node --test plugins/machinery/test/lib-notes-format.test.mjs`
Expected: PASS, 8 tests.

- [ ] **Step 7: Bump and commit**

```bash
node plugins/machinery/scripts/bump.mjs --plugin plugins/machinery
git add plugins/machinery/scripts/lib/frontmatter.mjs plugins/machinery/scripts/lib/blockquote.mjs plugins/machinery/test/lib-notes-format.test.mjs
git commit -m "slip box: front matter, block quote and layout names (#132)

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>" -- plugins/machinery/scripts/lib/frontmatter.mjs plugins/machinery/scripts/lib/blockquote.mjs plugins/machinery/scripts/lib/layout.mjs plugins/machinery/test/lib-notes-format.test.mjs plugins/machinery/.claude-plugin/plugin.json
```

---

### Task 2: Wiki links, heading sections and flatten

**Files:**
- Create: `plugins/machinery/scripts/lib/embed.mjs`
- Test: `plugins/machinery/test/lib-embed.test.mjs`

**Interfaces:**
- Produces:
  - `links(text) → Array<{ embed: boolean, id: string, heading: string|null, raw: string }>`
  - `section(body, heading) → string|null`
  - `flatten(text, resolve) → string`, where `resolve(id) → { body, title, href, label } | null`
  - `rebaseLinks(text, fromDir, toDir) → string` (posix dirs, repo-relative)

- [ ] **Step 1: Write the failing test**

```js
// plugins/machinery/test/lib-embed.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { links, section, flatten, rebaseLinks } from '../scripts/lib/embed.mjs';

const NOTES = {
  a: { body: '# A\n\n> alpha\n', title: 'A', href: '../n/a.md', label: '*Source: a · dictation*' },
  d: { body: '# D\n\n## Decisions\n\n- pick x\n\n### Detail\n\n- sub\n\n## Files touched\n\n- f.mjs\n', title: 'D', href: '../s/d.md', label: '*Source: d · design*' },
  loop: { body: '![[loop]]\n', title: 'L', href: 'l.md', label: '*Source: loop*' },
};
const resolve = (id) => NOTES[id] ?? null;

test('links reads links, whole-note embeds and heading embeds', () => {
  assert.deepEqual(links('see [[a]] and\n![[d#Decisions]]\n![[a]]').map(({ embed, id, heading }) => [embed, id, heading]),
    [[false, 'a', null], [true, 'd', 'Decisions'], [true, 'a', null]]);
});

test('a heading section runs to the next heading of the same or higher level', () => {
  assert.equal(section(NOTES.d.body, 'Decisions'), '## Decisions\n\n- pick x\n\n### Detail\n\n- sub');
  assert.equal(section(NOTES.d.body, 'Missing'), null);
});

test('flatten expands a whole-note embed and a heading embed, each under its label line', () => {
  const out = flatten('# S\n\n## T\n\n![[a]]\n![[d#Decisions]]\n', resolve);
  assert.equal(out, '# S\n\n## T\n\n*Source: a · dictation*\n\n# A\n\n> alpha\n*Source: d · design*\n\n## Decisions\n\n- pick x\n\n### Detail\n\n- sub\n');
  assert.doesNotMatch(out, /Files touched/);
});

test('flatten turns a link into a Markdown link to the resolved href', () => {
  assert.equal(flatten('- [[a]]', resolve), '- [A](../n/a.md)');
});

test('rebaseLinks rewrites relative Markdown links from one directory to another, and leaves absolute ones', () => {
  const t = '- [map](../../superpowers/models/p.html)\n- [web](https://x.y/z)\n- [anchor](#here)';
  assert.equal(rebaseLinks(t, 'docs/dictated-specs/structure', 'docs/spec-current'),
    '- [map](../superpowers/models/p.html)\n- [web](https://x.y/z)\n- [anchor](#here)');
});

test('RED CHECK: flatten refuses a cycle, an unknown note and a missing heading', () => {
  assert.throws(() => flatten('![[loop]]', resolve), /embed cycle/);
  assert.throws(() => flatten('![[nope]]', resolve), /unknown note nope/);
  assert.throws(() => flatten('![[d#Nope]]', resolve), /missing heading d#Nope/);
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node --test plugins/machinery/test/lib-embed.test.mjs`
Expected: FAIL — `Cannot find module …/embed.mjs`.

- [ ] **Step 3: Write `scripts/lib/embed.mjs`**

```js
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
```

- [ ] **Step 4: Run the suite to verify it passes**

Run: `node --test plugins/machinery/test/lib-embed.test.mjs`
Expected: PASS, 6 tests.

- [ ] **Step 5: Bump and commit**

```bash
node plugins/machinery/scripts/bump.mjs --plugin plugins/machinery
git add plugins/machinery/scripts/lib/embed.mjs plugins/machinery/test/lib-embed.test.mjs
git commit -m "slip box: wiki links, heading sections and flatten, no dependency (#132 D4)

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>" -- plugins/machinery/scripts/lib/embed.mjs plugins/machinery/test/lib-embed.test.mjs plugins/machinery/.claude-plugin/plugin.json
```

---

### Task 3: The slip box read model

**Files:**
- Create: `plugins/machinery/scripts/lib/slipbox.mjs`
- Test: `plugins/machinery/test/lib-slipbox.test.mjs`

**Interfaces:**
- Consumes: `parseFrontmatter` (Task 1), `slipboxPaths`, `INDEX_FILE` (Task 1), `links`, `flatten`, `rebaseLinks` (Task 2).
- Produces:
  - `WHY = 'Why it is this way'`, `REFS = 'References'`
  - `mdFiles(dir) → string[]` (top-level `.md` names, sorted)
  - `loadSlipbox(root) → { root, paths, notes: Map<id, Note>, structures: Map<subsystem, { subsystem, rel, text }> }`
  - `Note = { id, kind, data, body, rel, subsystems[], supersedes[], from[], status, error }`
  - `inForce(box) → Set<id>`
  - `expected(box, subsystem, live?) → { embeds: id[], designs: id[], decisions: id[] }`
  - `subsystemsOf(box, live?) → string[]`
  - `readStructure(text) → { embeds: id[], headingEmbeds: Link[], why: id[], refs: href[], links: Link[] }`
  - `dictationQuote(body) → string|null`
  - `adrStatus(body)`, `isSupersededDecision(note)`, `titleOf(note)`
  - `regenerate(box) → Map<repoRelPath, text>`, `staleGenerated(box, want?) → repoRelPath[]`

- [ ] **Step 1: Write the failing test**

```js
// plugins/machinery/test/lib-slipbox.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { loadSlipbox, inForce, expected, subsystemsOf, readStructure, dictationQuote, regenerate, staleGenerated, isSupersededDecision } from '../scripts/lib/slipbox.mjs';

function tree(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'slipbox-'));
  for (const [rel, text] of Object.entries(files)) { const f = path.join(root, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, text); }
  return root;
}
const N = 'docs/dictated-specs/notes/';
const note = (id, fm, body) => [`${N}${id}.md`, `---\nid: ${id}\n${fm}\n---\n${body}`];

const FILES = Object.fromEntries([
  note('2026-09-01T08-00-00Z', 'kind: dictation\nsubsystems: [config]', '# Old\n\n> SPEC: old rule\n'),
  note('2026-09-10T08-00-00Z', 'kind: dictation\nsubsystems: [config]\nsupersedes: [2026-09-01T08-00-00Z]', '# New\n\n> SPEC: new rule\n\nSupersedes [[2026-09-01T08-00-00Z]].\n'),
  note('2026-09-12T08-00-00Z', 'kind: dictation\nsubsystems: [config]', '# Partial\n\n> SPEC: change one bit\n'),
  note('2026-09-12T08-00-00Z-v', 'kind: version\nsubsystems: [config]\nsupersedes: [2026-09-10T08-00-00Z]\nfrom: [2026-09-12T08-00-00Z]', '*Composed by the assistant.*\n\n# New, changed\n\n> text\n'),
  ['docs/dictated-specs/decisions/0001-first.md', '# ADR 1\n\n- **Status:** Superseded by ADR-0002\n'],
  ['docs/dictated-specs/decisions/0002-second.md', '---\nkind: decision\nsubsystems: [config]\nrests_on: [2026-09-10T08-00-00Z]\n---\n# ADR 2\n\n- **Status:** Accepted\n'],
  ['docs/dictated-specs/decisions/README.md', '# not an ADR\n'],
  ['docs/superpowers/specs/2026-09-02-x-design.md', '---\nkind: design\nstatus: approved\nsubsystems: [config]\n---\n# X\n\n## Decisions\n\n- d\n\n## Files touched\n\n- f\n'],
  ['docs/superpowers/plans/2026-09-02-x.md', '---\nkind: plan\nticket: 7\nstatus: done\n---\n# plan\n'],
  ['docs/dictated-specs/structure/config.md', '# config — current state\n\n## Rules\n\n![[2026-09-12T08-00-00Z-v]]\n\n## Design\n\n![[2026-09-02-x-design#Decisions]]\n\n## Why it is this way\n\n- [[0002-second]]\n\n## References\n\n- [map](../../superpowers/models/p.html)\n'],
]);

test('a note superseded, or consumed by a version note, is not in force', () => {
  const box = loadSlipbox(tree(FILES));
  const live = inForce(box);
  assert.ok(!live.has('2026-09-01T08-00-00Z'), 'superseded');
  assert.ok(!live.has('2026-09-10T08-00-00Z'), 'superseded by the version note');
  assert.ok(!live.has('2026-09-12T08-00-00Z'), 'consumed by the version note');
  assert.ok(live.has('2026-09-12T08-00-00Z-v'));
  assert.ok(!box.notes.has('README'), 'decisions/README.md is not an ADR');
  assert.ok(isSupersededDecision(box.notes.get('0001-first')));
});

test('expected membership names the in-force notes, the approved designs and the live front-matter decisions', () => {
  const box = loadSlipbox(tree(FILES));
  assert.deepEqual(expected(box, 'config'), { embeds: ['2026-09-12T08-00-00Z-v'], designs: ['2026-09-02-x-design'], decisions: ['0002-second'] });
  assert.deepEqual(subsystemsOf(box), ['config']);
});

test('readStructure separates embeds, heading embeds, the Why links and the references', () => {
  const s = readStructure(FILES['docs/dictated-specs/structure/config.md']);
  assert.deepEqual(s.embeds, ['2026-09-12T08-00-00Z-v']);
  assert.deepEqual(s.headingEmbeds.map((l) => `${l.id}#${l.heading}`), ['2026-09-02-x-design#Decisions']);
  assert.deepEqual(s.why, ['0002-second']);
  assert.deepEqual(s.refs, ['../../superpowers/models/p.html']);
});

test('dictationQuote is the contiguous block quote of a dictation note', () => {
  assert.equal(dictationQuote('# T\n\n> a\n>\n> b\n\nSupersedes [[x]].\n'), '> a\n>\n> b');
  assert.equal(dictationQuote('# T\n\nno quote\n'), null);
});

test('regenerate writes INDEX.md and one flat page per structure note, with labels and rebased references', () => {
  const box = loadSlipbox(tree(FILES));
  const out = regenerate(box);
  assert.deepEqual([...out.keys()].sort(), ['docs/dictated-specs/INDEX.md', 'docs/spec-current/config.md']);
  assert.match(out.get('docs/dictated-specs/INDEX.md'), /^- \[config\]\(structure\/config\.md\)/m);
  const page = out.get('docs/spec-current/config.md');
  assert.match(page, /\*Source: \[`2026-09-12T08-00-00Z-v`\]\(\.\.\/dictated-specs\/notes\/2026-09-12T08-00-00Z-v\.md\) · version\*/);
  assert.match(page, /## Decisions\n\n- d/);
  assert.doesNotMatch(page, /Files touched/);
  assert.doesNotMatch(page, /SPEC: old rule/);
  assert.match(page, /\[map\]\(\.\.\/superpowers\/models\/p\.html\)/);
  assert.match(page, /\[ADR 2\]\(\.\.\/dictated-specs\/decisions\/0002-second\.md\)/);
});

test('a generated page with no structure note behind it is stale', () => {
  const root = tree({ ...FILES, 'docs/spec-current/gone.md': 'old\n' });
  assert.deepEqual(staleGenerated(loadSlipbox(root)), ['docs/spec-current/gone.md']);
});

test('RED CHECK: two notes sharing an id are refused, not silently merged', () => {
  const root = tree({ ...FILES, 'docs/superpowers/specs/2026-09-01T08-00-00Z.md': '# clash\n' });
  assert.throws(() => loadSlipbox(root), /two notes share the id 2026-09-01T08-00-00Z/);
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node --test plugins/machinery/test/lib-slipbox.test.mjs`
Expected: FAIL — `Cannot find module …/slipbox.mjs`.

- [ ] **Step 3: Write `scripts/lib/slipbox.mjs`**

```js
// Story: #132 (the Zettelkasten slip box). The READ model: every note, which are in force, what
// each structure note must hold, and the generated pages. Read-only — the gate imports it and
// nothing under scripts/gate/ writes (spec I23). The writers are lib/slipbox-write.mjs.
import fs from 'node:fs';
import path from 'node:path';
import { parseFrontmatter } from './frontmatter.mjs';
import { links, flatten, rebaseLinks } from './embed.mjs';
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

export function readStructure(text) {
  const out = { embeds: [], headingEmbeds: [], why: [], refs: [], links: [] };
  let sec = null;
  for (const line of text.split('\n')) {
    const h = /^## (.+?)\s*$/.exec(line);
    if (h) { sec = h[1]; continue; }
    if (sec === REFS) { for (const m of line.matchAll(/\]\(([^)\s]+)\)/g)) out.refs.push(m[1]); continue; }
    for (const l of links(line)) {
      if (sec === WHY) out.why.push(l.id);
      else if (l.embed && l.heading) out.headingEmbeds.push(l);
      else if (l.embed) out.embeds.push(l.id);
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
```

- [ ] **Step 4: Run the suite to verify it passes**

Run: `node --test plugins/machinery/test/lib-slipbox.test.mjs`
Expected: PASS, 7 tests.

- [ ] **Step 5: Bump and commit**

```bash
node plugins/machinery/scripts/bump.mjs --plugin plugins/machinery
git add plugins/machinery/scripts/lib/slipbox.mjs plugins/machinery/test/lib-slipbox.test.mjs
git commit -m "slip box: the read model — in force, membership, generated pages (#132 § 5, § 8)

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>" -- plugins/machinery/scripts/lib/slipbox.mjs plugins/machinery/test/lib-slipbox.test.mjs plugins/machinery/.claude-plugin/plugin.json
```

---

### Task 4: Filing a `SPEC:` — `intake.mjs spec` and `intake.mjs regen`

**Files:**
- Create: `plugins/machinery/scripts/lib/slipbox-write.mjs`
- Create: `plugins/machinery/scripts/lib/unmigrated.mjs`
- Create: `plugins/machinery/scripts/lib/commit.mjs`
- Create: `plugins/machinery/scripts/lib/slipbox-file.mjs`
- Modify: `plugins/machinery/scripts/intake.mjs` (new `spec`, `regen`; `commit` accepts `--kind project` only)
- Modify: `plugins/machinery/test/spec.test.mjs` (replace the `spec intake refuses a home outside the spec area…` test)
- Modify: `plugins/machinery/test/intake.test.mjs:142` (usage regex)
- Test: `plugins/machinery/test/slipbox-intake.test.mjs`

**Interfaces:**
- Consumes: Tasks 1–3; `pending`, `setDisposition` (`lib/inbox.mjs`); `git` (`lib/git.mjs`).
- Produces:
  - `writeOnce(abs, text)`, `writeText(abs, text)`
  - `dictationNote({ id, subsystems, supersedes, title, text }) → string`
  - `versionNote({ id, subsystems, supersedes, from, text }) → string`
  - `placeEmbed(text|null, subsystem, { id, topic }) → string`, `placeHeadingEmbed(text|null, subsystem, { id, heading, topic }) → string`
  - `swapEmbed(text, oldId, newId) → string|null`, `dropEmbed(text, id) → string`
  - `placeLink(text|null, subsystem, id) → string`, `dropSupersededLinks(text, box) → string`, `placeRef(text|null, subsystem, label, href) → string`
  - `syncGenerated(root, box) → repoRelPath[]`
  - `unmigrated(root) → { oldSpecs[], adr: boolean, adrFiles[], bare[], any: boolean }`, `describeUnmigrated(u) → string`
  - `commitPaths(repo, absOrRelPaths, message)`
  - `fileSpec({ repo, stamp, subsystems, topic, title, supersedes, versions }) → { id, vIds, newSubs, partial, versionTexts, subject }`
  - `regen(repo) → repoRelPath[]`

- [ ] **Step 1: Write the failing test**

```js
// plugins/machinery/test/slipbox-intake.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { makeRepo } from './helpers/repo.mjs';
import { runScript } from './helpers/run.mjs';
import { appendEntry, pending, parseInbox } from '../scripts/lib/inbox.mjs';
import { slipboxPaths } from '../scripts/lib/layout.mjs';

const g = (root, ...a) => execFileSync('git', a, { cwd: root, encoding: 'utf8' }).trim();
const write = (root, rel, text) => { const f = path.join(root, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, text); };
const read = (root, rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const env = () => ({ MACHINERY_HOME: fs.mkdtempSync(path.join(os.tmpdir(), 'home-')) });
const intake = (root, ...args) => runScript('scripts/intake.mjs', { args: [...args, '--root', root], cwd: root, env: env() });
const gate = (root) => runScript('scripts/gate/gate.mjs', { args: ['--root', root], cwd: root });
const DICTATION = 'SPEC: objects on plates don\'t have to have their own extruder. by default the first\nextruder is the default.\n\n  - plates can get their own — "assigned" extruder at C:\\x';

function project() {
  const r = makeRepo();
  write(r.root, '.claude/rules/t.md', '# T\n\n## S\n\n- a rule\n');
  write(r.root, '.claude/machinery/inbox.md', '');
  write(r.root, '.claude/machinery/spec-inbox.md', '');
  fs.mkdirSync(path.join(r.root, 'docs', 'dictated-specs'), { recursive: true });
  g(r.root, 'add', '-A'); g(r.root, 'commit', '-q', '-m', 'install');
  return r;
}
function capture(root, text, stamp) {
  appendEntry(slipboxPaths(root).specInbox, { marker: 'SPEC', text, session: 's', stamp });
  g(root, 'add', '-A'); g(root, 'commit', '-q', '-m', 'capture');
}
const fileOne = (root, stamp, ...extra) => intake(root, 'spec', '--stamp', stamp, '--subsystems', 'extruders', '--topic', 'Defaults', '--title', 'Objects need not have their own extruder', ...extra);

test('filing one SPEC creates exactly one note, quoting the inbox entry byte for byte, and commits the full dictation', () => {
  const r = project();
  try {
    capture(r.root, DICTATION, '2026-09-19T01:03:49Z');
    const res = fileOne(r.root, '2026-09-19T01:03:49Z');
    assert.equal(res.code, 0, res.stderr + res.stdout);
    const changed = g(r.root, 'show', '--name-status', '--format=', 'HEAD').split('\n').sort();
    assert.deepEqual(changed, [
      'A\tdocs/dictated-specs/INDEX.md',
      'A\tdocs/dictated-specs/notes/2026-09-19T01-03-49Z.md',
      'A\tdocs/dictated-specs/structure/extruders.md',
      'A\tdocs/spec-current/extruders.md',
      'M\t.claude/machinery/spec-inbox.md',
    ].sort());
    const note = read(r.root, 'docs/dictated-specs/notes/2026-09-19T01-03-49Z.md');
    assert.ok(note.includes(DICTATION.split('\n').map((l) => (l ? `> ${l}` : '>')).join('\n')), note);
    assert.match(read(r.root, 'docs/dictated-specs/structure/extruders.md'), /## Defaults\n\n!\[\[2026-09-19T01-03-49Z\]\]/);
    const msg = g(r.root, 'log', '-1', '--format=%B');
    assert.match(msg, /^spec: Objects need not have their own extruder\n/);
    assert.ok(msg.includes(DICTATION), 'the commit message carries the full dictation');
    const [e] = parseInbox(read(r.root, '.claude/machinery/spec-inbox.md'));
    assert.equal(e.disposition, 'filed → docs/dictated-specs/notes/2026-09-19T01-03-49Z.md');
    assert.match(res.stdout, /subsystems: extruders \(new\)/);
    assert.equal(g(r.root, 'status', '--porcelain'), '');
  } finally { r.cleanup(); }
});

test('a full supersede leaves the old note byte-identical and swaps exactly one structure line', () => {
  const r = project();
  try {
    capture(r.root, 'SPEC: old rule', '2026-09-01T08:00:00Z');
    assert.equal(fileOne(r.root, '2026-09-01T08:00:00Z').code, 0);
    const oldNote = read(r.root, 'docs/dictated-specs/notes/2026-09-01T08-00-00Z.md');
    capture(r.root, 'SPEC: new rule', '2026-09-10T08:00:00Z');
    const res = fileOne(r.root, '2026-09-10T08:00:00Z', '--supersedes', '2026-09-01T08-00-00Z');
    assert.equal(res.code, 0, res.stderr + res.stdout);
    assert.equal(read(r.root, 'docs/dictated-specs/notes/2026-09-01T08-00-00Z.md'), oldNote);
    const diff = g(r.root, 'diff', 'HEAD~1', 'HEAD', '--unified=0', '--', 'docs/dictated-specs/structure/extruders.md').split('\n').filter((l) => /^[-+][^-+]/.test(l));
    assert.deepEqual(diff, ['-![[2026-09-01T08-00-00Z]]', '+![[2026-09-10T08-00-00Z]]']);
    assert.match(read(r.root, 'docs/dictated-specs/notes/2026-09-10T08-00-00Z.md'), /supersedes: \[2026-09-01T08-00-00Z\][\s\S]*Supersedes \[\[2026-09-01T08-00-00Z\]\]\./);
    const page = read(r.root, 'docs/spec-current/extruders.md');
    assert.match(page, /SPEC: new rule/);
    assert.doesNotMatch(page, /SPEC: old rule/);
  } finally { r.cleanup(); }
});

test('a partial change writes the dictation and a version note; the version supersedes, the dictation is not embedded', () => {
  const r = project();
  try {
    capture(r.root, 'SPEC: each object has its own extruder. members never override.', '2026-09-01T08:00:00Z');
    assert.equal(fileOne(r.root, '2026-09-01T08:00:00Z').code, 0);
    capture(r.root, 'SPEC: members can override', '2026-09-19T01:03:49Z');
    const v = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'v-')), 'v.md');
    fs.writeFileSync(v, 'Each object has its own extruder. Members can override.\n');
    const res = fileOne(r.root, '2026-09-19T01:03:49Z', '--supersedes', '2026-09-01T08-00-00Z', '--version', v);
    assert.equal(res.code, 0, res.stderr + res.stdout);
    const version = read(r.root, 'docs/dictated-specs/notes/2026-09-19T01-03-49Z-v.md');
    assert.match(version, /kind: version\nsubsystems: \[extruders\]\nsupersedes: \[2026-09-01T08-00-00Z\]\nfrom: \[2026-09-19T01-03-49Z\]/);
    assert.match(version, /Composed by the assistant from \[\[2026-09-01T08-00-00Z\]\] and \[\[2026-09-19T01-03-49Z\]\]/);
    const st = read(r.root, 'docs/dictated-specs/structure/extruders.md');
    assert.match(st, /!\[\[2026-09-19T01-03-49Z-v\]\]/);
    assert.doesNotMatch(st, /!\[\[2026-09-19T01-03-49Z\]\]/);
    assert.doesNotMatch(st, /!\[\[2026-09-01T08-00-00Z\]\]/);
    assert.match(res.stdout, /Members can override\./, 'the report prints the version text');
  } finally { r.cleanup(); }
});

test('subsystems a,b embeds the note in both structure notes', () => {
  const r = project();
  try {
    capture(r.root, 'SPEC: shared', '2026-09-19T02:00:00Z');
    const res = intake(r.root, 'spec', '--stamp', '2026-09-19T02:00:00Z', '--subsystems', 'a,b', '--topic', 'T', '--title', 'Shared');
    assert.equal(res.code, 0, res.stderr + res.stdout);
    for (const s of ['a', 'b']) assert.match(read(r.root, `docs/dictated-specs/structure/${s}.md`), /!\[\[2026-09-19T02-00-00Z\]\]/);
    assert.match(read(r.root, 'docs/dictated-specs/notes/2026-09-19T02-00-00Z.md'), /subsystems: \[a, b\]/);
  } finally { r.cleanup(); }
});

test('RED CHECK: an existing note is never overwritten, and an unmigrated project refuses filing', () => {
  const r = project();
  try {
    capture(r.root, 'SPEC: x', '2026-09-19T03:00:00Z');
    write(r.root, 'docs/dictated-specs/notes/2026-09-19T03-00-00Z.md', 'already here\n');
    const clash = fileOne(r.root, '2026-09-19T03:00:00Z');
    assert.equal(clash.code, 1);
    assert.match(clash.stderr, /refusing to overwrite docs\/dictated-specs\/notes\/2026-09-19T03-00-00Z\.md/);
    assert.equal(read(r.root, 'docs/dictated-specs/notes/2026-09-19T03-00-00Z.md'), 'already here\n');
    assert.equal(pending(slipboxPaths(r.root).specInbox).length, 1);

    fs.rmSync(path.join(r.root, 'docs/dictated-specs/notes'), { recursive: true });
    write(r.root, 'docs/adr/0001-x.md', '# ADR\n');
    const old = fileOne(r.root, '2026-09-19T03:00:00Z');
    assert.equal(old.code, 1);
    assert.match(old.stderr, /not migrated to the slip box — docs\/adr\/ \(1 file\(s\)\)/);
  } finally { r.cleanup(); }
});

test('regen rewrites a stale page and the gate-facing files match afterwards', () => {
  const r = project();
  try {
    capture(r.root, 'SPEC: y', '2026-09-19T04:00:00Z');
    assert.equal(fileOne(r.root, '2026-09-19T04:00:00Z').code, 0);
    write(r.root, 'docs/spec-current/extruders.md', 'hand edit\n');
    const res = intake(r.root, 'regen');
    assert.equal(res.code, 0, res.stderr);
    assert.match(res.stdout, /regenerated docs\/spec-current\/extruders\.md/);
    assert.match(read(r.root, 'docs/spec-current/extruders.md'), /SPEC: y/);
  } finally { r.cleanup(); }
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node --test plugins/machinery/test/slipbox-intake.test.mjs`
Expected: FAIL — `usage: intake list …` (no `spec` command).

- [ ] **Step 3: Write `scripts/lib/slipbox-write.mjs`**

```js
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
```

- [ ] **Step 4: Write `scripts/lib/unmigrated.mjs`**

```js
// Story: #132 Amendment 1 (D13; owner, 2026-09-19: "it has to happen in every repo"). What in a
// project is not yet in the slip box. Read-only. The banner, install and intake.mjs call this one
// function, so the three can never disagree about whether a project is migrated.
import fs from 'node:fs';
import path from 'node:path';
import { parseFrontmatter } from './frontmatter.mjs';
import { slipboxPaths, INDEX_FILE } from './layout.mjs';
import { mdFiles } from './slipbox.mjs';

export function unmigrated(root) {
  const p = slipboxPaths(root);
  const oldSpecs = mdFiles(p.specs).filter((f) => f !== INDEX_FILE);
  const adr = fs.existsSync(p.adr);
  const adrFiles = adr ? mdFiles(p.adr) : [];
  const bare = [];
  for (const dir of [p.spSpecs, p.spPlans]) {
    for (const f of mdFiles(dir)) {
      let kind = null;
      try { kind = parseFrontmatter(fs.readFileSync(path.join(dir, f), 'utf8')).data?.kind ?? null; } catch {}
      if (!kind) bare.push(path.relative(root, path.join(dir, f)).split(path.sep).join('/'));
    }
  }
  return { oldSpecs, adr, adrFiles, bare, any: oldSpecs.length > 0 || adr || bare.length > 0 };
}

export function describeUnmigrated(u) {
  const parts = [];
  if (u.oldSpecs.length) parts.push(`${u.oldSpecs.length} old spec file(s) in docs/dictated-specs/`);
  if (u.adr) parts.push(`docs/adr/ (${u.adrFiles.length} file(s))`);
  if (u.bare.length) parts.push(`${u.bare.length} superpowers file(s) without front matter`);
  return parts.join(', ');
}
```

- [ ] **Step 5: Write `scripts/lib/commit.mjs`**

```js
// Generic: one commit of exactly the named paths (the worktree skill's commit rule). A path that
// no longer exists is staged as a removal: `git add` refuses a path that is gone from both the
// tree and the index (a `git mv` source), so those go through `git rm --cached --ignore-unmatch`.
// Absolute paths are made relative to the repository.
import fs from 'node:fs';
import path from 'node:path';
import { git } from './git.mjs';

export function commitPaths(repo, paths, message) {
  const rel = [...new Set(paths.map((p) => (path.isAbsolute(p) ? path.relative(repo, p) : p).split(path.sep).join('/')))];
  const present = rel.filter((p) => fs.existsSync(path.join(repo, p)));
  const gone = rel.filter((p) => !fs.existsSync(path.join(repo, p)));
  const add = present.length ? git(['add', '--', ...present], repo) : { code: 0 };
  if (add.code !== 0) throw new Error(`git add failed: ${add.stderr}`);
  const rm = gone.length ? git(['rm', '-q', '--cached', '--ignore-unmatch', '--', ...gone], repo) : { code: 0 };
  if (rm.code !== 0) throw new Error(`git rm --cached failed: ${rm.stderr}`);
  const c = git(['commit', '-q', '-m', message, '--', ...rel], repo);
  if (c.code !== 0) throw new Error(`git commit failed: ${c.stderr}\n${c.stdout}`);
  return rel;
}
```

- [ ] **Step 6: Write `scripts/lib/slipbox-file.mjs`** (the `spec` and `regen` half; Tasks 7–8 append to it)

```js
// Story: #132 § 6–7. The slip box commands' logic. intake.mjs parses the flags and calls these;
// each throws an Error whose message is the refusal the user reads.
import fs from 'node:fs';
import path from 'node:path';
import { pending, setDisposition } from './inbox.mjs';
import { slipboxPaths, stampToId } from './layout.mjs';
import { loadSlipbox, inForce } from './slipbox.mjs';
import { writeOnce, writeText, dictationNote, versionNote, placeEmbed, swapEmbed, dropEmbed, syncGenerated } from './slipbox-write.mjs';
import { unmigrated, describeUnmigrated } from './unmigrated.mjs';
import { commitPaths } from './commit.mjs';

const rel = (repo, abs) => path.relative(repo, abs).split(path.sep).join('/');

export function refuseUnmigrated(repo) {
  const u = unmigrated(repo);
  if (u.any) throw new Error(`refusing to file: this project is not migrated to the slip box — ${describeUnmigrated(u)}. Run intake.mjs migrate --plan <file> first`);
}

export function fileSpec({ repo, stamp, subsystems, topic, title, supersedes = [], versions = [] }) {
  refuseUnmigrated(repo);
  if (versions.length && versions.length !== supersedes.length) throw new Error('--version needs one file per --supersedes id, in the same order');
  const p = slipboxPaths(repo);
  const entry = pending(p.specInbox).find((e) => e.stamp === stamp);
  if (!entry) throw new Error(`no PENDING entry with stamp ${stamp} in ${rel(repo, p.specInbox)}`);
  const box = loadSlipbox(repo);
  const live = inForce(box);
  for (const s of supersedes) {
    if (!box.notes.has(s)) throw new Error(`--supersedes ${s}: no such note`);
    if (!live.has(s)) throw new Error(`--supersedes ${s}: that note is no longer in force — supersede its successor`);
  }
  const id = stampToId(stamp);
  const partial = versions.length > 0;
  const vIds = versions.map((_, i) => `${id}-v${i ? i + 1 : ''}`);
  const created = [id, ...vIds].map((n) => path.join(p.notes, `${n}.md`));
  for (const f of created) if (fs.existsSync(f)) throw new Error(`refusing to overwrite ${rel(repo, f)}: a note is written once`);
  const versionTexts = versions.map((f) => fs.readFileSync(f, 'utf8'));
  writeOnce(created[0], dictationNote({ id, subsystems, supersedes: partial ? [] : supersedes, title, text: entry.text }));
  vIds.forEach((v, i) => writeOnce(created[i + 1], versionNote({ id: v, subsystems, supersedes: supersedes[i], from: id, text: versionTexts[i] })));

  const successor = new Map(supersedes.map((s, i) => [s, partial ? vIds[i] : id]));
  const placed = partial ? vIds : [id];
  const touched = new Set();
  const newSubs = [];
  for (const [sub, st] of box.structures) {
    let text = st.text;
    for (const [old, next] of successor) {
      const swapped = subsystems.includes(sub) && !text.includes(`![[${next}]]`) ? swapEmbed(text, old, next) : null;
      text = swapped ?? dropEmbed(text, old);
    }
    if (text !== st.text) { writeText(path.join(p.structure, `${sub}.md`), text); touched.add(sub); }
  }
  for (const sub of subsystems) {
    const file = path.join(p.structure, `${sub}.md`);
    const before = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;
    if (before === null) newSubs.push(sub);
    let text = before;
    for (const pid of placed) if (!(text ?? '').includes(`![[${pid}]]`)) text = placeEmbed(text, sub, { id: pid, topic });
    if (text !== before) { writeText(file, text); touched.add(sub); }
  }

  const generated = syncGenerated(repo, loadSlipbox(repo));
  setDisposition(p.specInbox, stamp, { state: 'FILED', detail: `filed → ${rel(repo, created[0])}` });
  const subject = `spec: ${title}`.slice(0, 72);
  const body = [
    entry.text, '',
    `Filed → ${rel(repo, created[0])}`,
    ...vIds.map((v, i) => `Version ${v} supersedes ${supersedes[i]}`),
    ...(!partial && supersedes.length ? [`Supersedes ${supersedes.join(', ')}`] : []),
    `Inbox entry ${stamp} (SPEC)`,
  ].join('\n');
  commitPaths(repo, [...created, ...[...touched].map((s) => path.join(p.structure, `${s}.md`)), ...generated, p.specInbox], `${subject}\n\n${body}`);
  return { id, vIds, newSubs, partial, versionTexts, subject };
}

export const regen = (repo) => syncGenerated(repo, loadSlipbox(repo));
```

- [ ] **Step 7: Wire `spec` and `regen` into `scripts/intake.mjs`**

Add imports at the top:

```js
import { fileSpec, regen } from './lib/slipbox-file.mjs';
```

Add a `csv` helper beside `opt`:

```js
const csv = (k) => (opt(k) ?? '').split(',').map((s) => s.trim()).filter(Boolean);
```

In `commit()`, restrict the kind and delete the whole `if (kind === 'spec') { … } else` branch, keeping the project body:

```js
  if (kind !== 'project' || !stamp || !home) die('usage: intake commit --kind project [--root <dir>] --stamp <stamp> --home "<file § Section>" (a specification is filed with intake spec)');
  const cwd = opt('--root') || process.cwd();
  if (!isRootSession(cwd)) die(`a project rule is filed only from the root session: run /machinery:rule-process from ${projectRoot(cwd)}`);
  const repo = projectRoot(cwd), inbox = projectInbox(repo), rules = projectRules(repo);
```

Change `let subject = \`${kind === 'spec' ? 'spec' : 'rule'}: …\`` to:

```js
  let subject = `rule: ${entry.text.split('\n')[0].slice(0, 72)}`;
```

Remove `projectSpecs` and `insideSpecArea` from the imports if nothing else uses them.

Add the two commands before the dispatch line:

```js
// #132 § 7. The AI has chosen subsystems, topic and any supersede before this runs; the words
// come from the inbox entry only, never from the command line.
function spec() {
  const cwd = opt('--root') || process.cwd();
  if (!isRootSession(cwd)) die(`a specification is filed only from the root session: run /machinery:rule-process from ${projectRoot(cwd)}`);
  const stamp = opt('--stamp'), topic = opt('--topic'), title = opt('--title');
  const subsystems = csv('--subsystems'), supersedes = csv('--supersedes'), versions = csv('--version');
  if (!stamp || !topic || !title || !subsystems.length) die('usage: intake spec --stamp <s> --subsystems <a,b> --topic "<t>" --title "<title>" [--supersedes <id,…>] [--version <file,…>]');
  let r;
  try { r = fileSpec({ repo: projectRoot(cwd), stamp, subsystems, topic, title, supersedes, versions }); } catch (e) { die(e.message); }
  const lines = [
    `committed: ${r.subject}`,
    `note: ${r.id}`,
    `subsystems: ${subsystems.map((s) => (r.newSubs.includes(s) ? `${s} (new)` : s)).join(', ')}`,
    `topic: ${topic}`,
    `change: ${supersedes.length ? `${r.partial ? 'partial' : 'full'} — supersedes ${supersedes.join(', ')}` : 'new'}`,
    ...r.vIds.flatMap((v, i) => [`version note ${v} (composed by the assistant; review it):`, r.versionTexts[i].replace(/\n+$/, '')]),
  ];
  process.stdout.write(lines.join('\n') + '\n');
}

function regenerateCmd() {
  const repo = projectRoot(opt('--root') || process.cwd());
  let changed;
  try { changed = regen(repo); } catch (e) { die(e.message); }
  process.stdout.write(changed.length ? changed.map((c) => `regenerated ${c}`).join('\n') + '\n' : 'regen: nothing to regenerate\n');
}
```

Extend the dispatch:

```js
if (cmd === 'list') list(); else if (cmd === 'commit') commit(); else if (cmd === 'universal') universal();
else if (cmd === 'spec') spec(); else if (cmd === 'regen') regenerateCmd();
else die('usage: intake list [--root <dir>] | intake commit … | intake universal … | intake spec … | intake regen');
```

- [ ] **Step 8: Update the two existing tests that named `commit --kind spec`**

In `test/intake.test.mjs`, the RED CHECK's last regex becomes:

```js
  assert.equal(old.code, 1); assert.match(old.stderr, /usage: intake commit --kind project /);
```

In `test/spec.test.mjs`, replace the whole test `spec intake refuses a home outside the spec area, then files and commits in one commit in the root (#81)` with:

```js
test('spec intake files into the slip box in one commit in the root, and the old commit --kind spec is refused (#81, #132)', () => {
  const r = installedProject();
  try {
    const inbox = projectSpecInbox(r.root);
    appendEntry(inbox, { marker: 'SPEC', text: SPEC_TEXT, session: 's' });
    g(r.root, 'add', '-A'); g(r.root, 'commit', '-q', '-m', 'capture');
    const env = { MACHINERY_HOME: home() };
    const stamp = pending(inbox)[0].stamp;
    const old = runScript('scripts/intake.mjs', { args: ['commit', '--kind', 'spec', '--root', r.root, '--stamp', stamp, '--home', 'docs/dictated-specs/tooling.md § X'], cwd: r.root, env });
    assert.equal(old.code, 1);
    assert.match(old.stderr, /a specification is filed with intake spec/);
    assert.equal(pending(inbox).length, 1, 'the entry stays pending — nothing was filed');
    const res = runScript('scripts/intake.mjs', { args: ['spec', '--root', r.root, '--stamp', stamp, '--subsystems', 'tooling', '--topic', 'Resolving a tool', '--title', 'The tool resolver rejects a bare command name'], cwd: r.root, env });
    assert.equal(res.code, 0, res.stderr + res.stdout);
    assert.equal(pending(inbox).length, 0);
    const [e] = parseInbox(fs.readFileSync(inbox, 'utf8'));
    assert.match(e.disposition, /^filed → docs\/dictated-specs\/notes\/.+Z\.md$/);
    assert.match(g(r.root, 'log', '-1', '--format=%s'), /^spec: The tool resolver rejects a bare command name/);
    assert.equal(g(r.root, 'status', '--porcelain').trim(), '');
    assert.equal(gate(r.root).code, 0);
  } finally { r.cleanup(); }
});
```

- [ ] **Step 9: Run the three suites**

Run: `node --test plugins/machinery/test/slipbox-intake.test.mjs plugins/machinery/test/spec.test.mjs plugins/machinery/test/intake.test.mjs`
Expected: PASS, no failures.

- [ ] **Step 10: Bump and commit**

```bash
node plugins/machinery/scripts/bump.mjs --plugin plugins/machinery
git add plugins/machinery/scripts/lib/slipbox-write.mjs plugins/machinery/scripts/lib/unmigrated.mjs plugins/machinery/scripts/lib/commit.mjs plugins/machinery/scripts/lib/slipbox-file.mjs plugins/machinery/test/slipbox-intake.test.mjs
git commit -m "intake spec: a dictation is one immutable note, the commit carries all of it (#132 § 7)

Replaces commit --kind spec, whose subject cut the dictation at 72 characters (ferrislicer d031fa3b).

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>" -- plugins/machinery/scripts/lib/slipbox-write.mjs plugins/machinery/scripts/lib/unmigrated.mjs plugins/machinery/scripts/lib/commit.mjs plugins/machinery/scripts/lib/slipbox-file.mjs plugins/machinery/scripts/intake.mjs plugins/machinery/test/slipbox-intake.test.mjs plugins/machinery/test/spec.test.mjs plugins/machinery/test/intake.test.mjs plugins/machinery/.claude-plugin/plugin.json
```

---

### Task 5: Gate legs 2–6 — verbatim, membership, links, fresh, no fork

**Files:**
- Create: `plugins/machinery/scripts/gate/slipbox-check.mjs`
- Regenerate: `plugins/machinery/scripts/gate/manifest.mjs` (`node plugins/machinery/scripts/gate-manifest.mjs`)
- Modify: `plugins/machinery/scripts/install.mjs` (the gate lib copy list in `installProject`)
- Test: `plugins/machinery/test/slipbox-gate.test.mjs`

**Interfaces:**
- Consumes: Tasks 1–4; `report` (`lib/report.mjs`); `parseInbox` (`lib/inbox.mjs`).
- Produces: `slipboxCheck({ root, specInbox }) → boolean`; `declaration.id = 'slipbox_check'`.
- Every refusal line starts `commit refused: ` and names the fix.

- [ ] **Step 1: Write the failing test**

```js
// plugins/machinery/test/slipbox-gate.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { makeRepo } from './helpers/repo.mjs';
import { runScript } from './helpers/run.mjs';
import { appendEntry } from '../scripts/lib/inbox.mjs';
import { slipboxPaths } from '../scripts/lib/layout.mjs';

const g = (root, ...a) => execFileSync('git', a, { cwd: root, encoding: 'utf8' }).trim();
const write = (root, rel, text) => { const f = path.join(root, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, text); };
const read = (root, rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const env = () => ({ MACHINERY_HOME: fs.mkdtempSync(path.join(os.tmpdir(), 'home-')) });
const gate = (root) => runScript('scripts/gate/gate.mjs', { args: ['--root', root], cwd: root });
const ST = 'docs/dictated-specs/structure/extruders.md';
const OLD = '2026-09-01T08-00-00Z', NEW = '2026-09-10T08-00-00Z';

function project() {
  const r = makeRepo();
  write(r.root, '.claude/rules/t.md', '# T\n\n## S\n\n- a rule\n');
  write(r.root, '.claude/machinery/inbox.md', '');
  write(r.root, '.claude/machinery/spec-inbox.md', '');
  g(r.root, 'add', '-A'); g(r.root, 'commit', '-q', '-m', 'install');
  return r;
}
function file(root, stamp, text, ...extra) {
  appendEntry(slipboxPaths(root).specInbox, { marker: 'SPEC', text, session: 's', stamp });
  g(root, 'add', '-A'); g(root, 'commit', '-q', '-m', 'capture');
  const res = runScript('scripts/intake.mjs', { args: ['spec', '--root', root, '--stamp', stamp, '--subsystems', 'extruders', '--topic', 'Defaults', '--title', 'T', ...extra], cwd: root, env: env() });
  assert.equal(res.code, 0, res.stderr + res.stdout);
}
// A project with OLD superseded by NEW, all filed through intake.
function superseded() {
  const r = project();
  file(r.root, '2026-09-01T08:00:00Z', 'SPEC: old rule');
  file(r.root, '2026-09-10T08:00:00Z', 'SPEC: new rule', '--supersedes', OLD);
  return r;
}
const refused = (res, re) => { assert.equal(res.code, 1, res.stdout); assert.match(res.stdout, re, res.stdout); };

test('a slip box filed only through intake passes every leg, each printing its denominator', () => {
  const r = superseded();
  try {
    const res = gate(r.root);
    assert.equal(res.code, 0, res.stdout + res.stderr);
    for (const re of [/^slipbox_check: 0 of 2 dictation note\(s\) not verbatim/m, /^slipbox_check: 0 of 1 subsystem\(s\) with wrong membership/m,
      /^slipbox_check: 0 of \d+ file\(s\) with broken links/m, /^slipbox_check: 0 of 2 generated page\(s\) stale/m, /^slipbox_check: 0 of 1 superseded note\(s\) with a fork/m]) assert.match(res.stdout, re);
  } finally { r.cleanup(); }
});

test('a dictation note that no longer quotes its inbox entry is refused', () => {
  const r = superseded();
  try {
    const f = `docs/dictated-specs/notes/${NEW}.md`;
    write(r.root, f, read(r.root, f).replace('new rule', 'new rule, reworded'));
    refused(gate(r.root), /commit refused: docs\/dictated-specs\/notes\/2026-09-10T08-00-00Z\.md does not quote its inbox entry/);
  } finally { r.cleanup(); }
});

test('a superseded note still embedded is refused, and so is an in-force note left out', () => {
  const r = superseded();
  try {
    write(r.root, ST, read(r.root, ST).replace(`![[${NEW}]]`, `![[${OLD}]]`));
    const res = gate(r.root);
    refused(res, new RegExp(`commit refused: ${ST.replaceAll('/', '\\/')} embeds ${OLD}, which is superseded or consumed`));
    assert.match(res.stdout, new RegExp(`is missing the in-force note ${NEW}`));
  } finally { r.cleanup(); }
});

test('a dictation consumed by a version note, embedded, is refused', () => {
  const r = project();
  try {
    file(r.root, '2026-09-01T08:00:00Z', 'SPEC: old rule');
    const v = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'v-')), 'v.md');
    fs.writeFileSync(v, 'old rule, changed\n');
    file(r.root, '2026-09-19T01:03:49Z', 'SPEC: change it', '--supersedes', OLD, '--version', v);
    assert.equal(gate(r.root).code, 0);
    write(r.root, ST, read(r.root, ST) + '![[2026-09-19T01-03-49Z]]\n');
    refused(gate(r.root), /embeds 2026-09-19T01-03-49Z, which is superseded or consumed/);
  } finally { r.cleanup(); }
});

test('a broken link and a missing heading are refused', () => {
  const r = superseded();
  try {
    write(r.root, ST, read(r.root, ST).replace('## Defaults', '## Defaults\n\nsee [[nope]] and [[2026-09-10T08-00-00Z#Nope]]'));
    const res = gate(r.root);
    refused(res, /links \[\[nope\]\], which does not exist/);
    assert.match(res.stdout, /has no heading 'Nope'/);
  } finally { r.cleanup(); }
});

test('a stale INDEX.md and a stale flat page are refused, naming intake.mjs regen', () => {
  const r = superseded();
  try {
    write(r.root, 'docs/dictated-specs/INDEX.md', 'edited\n');
    write(r.root, 'docs/spec-current/extruders.md', 'edited\n');
    write(r.root, 'docs/spec-current/orphan.md', 'x\n');
    const res = gate(r.root);
    refused(res, /commit refused: docs\/dictated-specs\/INDEX\.md is stale — run intake\.mjs regen/);
    assert.match(res.stdout, /docs\/spec-current\/extruders\.md is stale/);
    assert.match(res.stdout, /docs\/spec-current\/orphan\.md has no structure note behind it/);
  } finally { r.cleanup(); }
});

test('RED CHECK: two notes superseding one note is a fork, refused', () => {
  const r = superseded();
  try {
    write(r.root, 'docs/dictated-specs/notes/2026-09-11T08-00-00Z.md', `---\nid: 2026-09-11T08-00-00Z\nkind: dictation\nsubsystems: [extruders]\nsupersedes: [${OLD}]\n---\n# F\n\n> SPEC: fork\n`);
    refused(gate(r.root), new RegExp(`commit refused: ${OLD} is superseded by 2 notes`));
  } finally { r.cleanup(); }
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node --test plugins/machinery/test/slipbox-gate.test.mjs`
Expected: FAIL — no `slipbox_check:` lines in the gate output.

- [ ] **Step 3: Write `scripts/gate/slipbox-check.mjs`**

```js
// Story: #132 § 9. The slip box's commit gate: a dictation note is verbatim, each structure note
// holds exactly the notes in force, every link resolves, the generated pages are fresh, and no
// note has two successors. Read-only (spec I23). Legs 1 and 7, which read the staged diff, are
// added by the next change.
import fs from 'node:fs';
import path from 'node:path';
import { report } from '../lib/report.mjs';
import { parseInbox } from '../lib/inbox.mjs';
import { unquote } from '../lib/blockquote.mjs';
import { links, section } from '../lib/embed.mjs';
import { idToStamp } from '../lib/layout.mjs';
import { loadSlipbox, inForce, expected, subsystemsOf, readStructure, regenerate, staleGenerated, dictationQuote, isSupersededDecision } from '../lib/slipbox.mjs';

export const declaration = Object.freeze({ id: 'slipbox_check', run: 'slipboxCheck', blocking: true, wired: true });

export function slipboxCheck({ root, specInbox }) {
  const box = loadSlipbox(root);
  const live = inForce(box);
  let ok = true;
  const leg = (bad, of, note, lines) => {
    report('slipbox_check', bad, of, note);
    for (const l of lines) process.stdout.write(`commit refused: ${l}\n`);
    if (lines.length) ok = false;
  };

  // Leg 2 — verbatim. Every file under notes/ is a dictation or version note, and a dictation note
  // quotes its FILED inbox entry byte for byte.
  const entries = fs.existsSync(specInbox) ? parseInbox(fs.readFileSync(specInbox, 'utf8')) : [];
  const filed = new Map(entries.filter((e) => e.state === 'FILED').map((e) => [e.stamp, e.text]));
  const inNotes = [...box.notes.values()].filter((n) => n.rel.startsWith(path.relative(root, box.paths.notes).split(path.sep).join('/') + '/'));
  const verbatim = inNotes.flatMap((n) => {
    if (n.kind === 'version') return [];
    if (n.kind !== 'dictation') return [`${n.rel} is under notes/ but is neither a dictation nor a version note${n.error ? ` (${n.error})` : ''}`];
    const want = filed.get(idToStamp(n.id));
    if (want === undefined) return [`${n.rel} has no FILED spec-inbox entry with stamp ${idToStamp(n.id)} — a dictation note is written only by intake.mjs spec`];
    let got = null;
    try { const q = dictationQuote(n.body); got = q === null ? null : unquote(q); } catch {}
    return got === want ? [] : [`${n.rel} does not quote its inbox entry ${idToStamp(n.id)} byte for byte — restore it from the inbox; a dictation note is never edited`];
  });
  leg(verbatim.length, inNotes.filter((n) => n.kind !== 'version').length, 'dictation note(s) not verbatim (must be 0)', verbatim);

  // Leg 3 — membership (#132 § 5).
  const why = (id) => {
    const n = box.notes.get(id);
    if (!n) return 'not a note';
    if (['map', 'plan'].includes(n.kind)) return `a ${n.kind}, never embedded`;
    return live.has(id) ? 'not an in-force note of this subsystem' : 'superseded or consumed';
  };
  const subs = subsystemsOf(box, live);
  const member = [];
  let badSubs = 0;
  for (const s of subs) {
    const before = member.length;
    const st = box.structures.get(s);
    const want = expected(box, s, live);
    if (!st) { member.push(`subsystem '${s}' has in-force notes but no structure note — file through intake.mjs, which creates it`); badSubs++; continue; }
    const have = readStructure(st.text);
    for (const id of have.embeds.filter((x) => !want.embeds.includes(x))) member.push(`${st.rel} embeds ${id}, which is ${why(id)} — embed the note in force instead`);
    for (const id of want.embeds.filter((x) => !have.embeds.includes(x))) member.push(`${st.rel} is missing the in-force note ${id}`);
    for (const h of have.headingEmbeds.filter((x) => !want.designs.includes(x.id))) member.push(`${st.rel} embeds ${h.id}#${h.heading}, which is ${why(h.id)} — only an approved, in-force design note is embedded by heading`);
    for (const id of want.designs.filter((x) => !have.headingEmbeds.some((h) => h.id === x))) member.push(`${st.rel} embeds no heading of the approved design note ${id} — run intake.mjs design --embed`);
    for (const id of have.why.filter((x) => { const n = box.notes.get(x); return n && isSupersededDecision(n); })) member.push(`${st.rel} links ${id} under "Why it is this way", but that decision is superseded — run intake.mjs decision --file on its successor`);
    for (const id of want.decisions.filter((x) => !have.why.includes(x))) member.push(`${st.rel} does not link the decision ${id} — run intake.mjs decision --file`);
    if (member.length > before) badSubs++;
  }
  leg(badSubs, subs.length, 'subsystem(s) with wrong membership (must be 0)', member);

  // Leg 4 — links resolve, headings exist, references exist.
  const specsRel = path.relative(root, box.paths.specs).split(path.sep).join('/') + '/';
  const texts = [
    ...[...box.notes.values()].filter((n) => n.rel.startsWith(specsRel)).map((n) => [n.rel, n.body]),
    ...[...box.structures.values()].map((s) => [s.rel, s.text]),
  ];
  const broken = [];
  const badFiles = new Set();
  for (const [rel, text] of texts) {
    for (const l of links(text)) {
      const t = box.notes.get(l.id);
      if (!t) { broken.push(`${rel} links [[${l.id}]], which does not exist`); badFiles.add(rel); }
      else if (l.heading && section(t.body, l.heading) === null) { broken.push(`${rel} links [[${l.id}#${l.heading}]], but ${t.rel} has no heading '${l.heading}'`); badFiles.add(rel); }
    }
  }
  for (const s of box.structures.values()) {
    for (const href of readStructure(s.text).refs) {
      if (/^([a-z][a-z0-9+.-]*:|#)/i.test(href) || fs.existsSync(path.join(root, path.dirname(s.rel), href))) continue;
      broken.push(`${s.rel} references ${href}, which does not exist`); badFiles.add(s.rel);
    }
  }
  leg(badFiles.size, texts.length, 'file(s) with broken links (must be 0)', broken);

  // Leg 5 — generated pages are fresh. Compared in memory; the gate never writes.
  let want = new Map();
  const stale = [];
  try { want = regenerate(box); } catch (e) { stale.push(`the current state cannot be generated — ${e.message}`); }
  for (const [rel, text] of want) {
    const abs = path.join(root, rel);
    const cur = fs.existsSync(abs) ? fs.readFileSync(abs, 'utf8') : null;
    if (cur !== text) stale.push(`${rel} is ${cur === null ? 'missing' : 'stale'} — run intake.mjs regen`);
  }
  for (const rel of staleGenerated(box, want)) stale.push(`${rel} has no structure note behind it — run intake.mjs regen`);
  leg(stale.length, want.size, 'generated page(s) stale (must be 0)', stale);

  // Leg 6 — no fork: each note has at most one successor.
  const by = new Map();
  for (const n of box.notes.values()) for (const s of n.supersedes) by.set(s, [...(by.get(s) ?? []), n.id]);
  const forks = [...by].filter(([, v]) => v.length > 1).map(([s, v]) => `${s} is superseded by ${v.length} notes (${v.join(', ')}) — the later one must supersede ${v[0]} instead`);
  leg(forks.length, by.size, 'superseded note(s) with a fork (must be 0)', forks);

  return ok;
}
```

- [ ] **Step 4: Regenerate the manifest**

Run: `node plugins/machinery/scripts/gate-manifest.mjs`
Expected: `gate_manifest: 0 of 4 gate module(s) undeclared or drifted — wrote plugins/machinery/scripts/gate/manifest.mjs`

- [ ] **Step 5: Add the read-side libs to the installed gate** (`scripts/install.mjs`, in `installProject`)

Change:

```js
  for (const f of ['git.mjs', 'lines.mjs', 'root.mjs', 'inbox.mjs', 'report.mjs', 'layout.mjs']) fs.copyFileSync(path.join(pluginRoot(), 'scripts', 'lib', f), path.join(gateDir, 'lib', f));
```

to:

```js
  // #132: the slip box check reads notes through the same read model intake writes them with.
  for (const f of ['git.mjs', 'lines.mjs', 'root.mjs', 'inbox.mjs', 'report.mjs', 'layout.mjs', 'frontmatter.mjs', 'blockquote.mjs', 'embed.mjs', 'slipbox.mjs']) fs.copyFileSync(path.join(pluginRoot(), 'scripts', 'lib', f), path.join(gateDir, 'lib', f));
```

- [ ] **Step 6: Run the gate, install, purity and manifest suites**

Run: `node --test plugins/machinery/test/slipbox-gate.test.mjs plugins/machinery/test/gate.test.mjs plugins/machinery/test/install.test.mjs plugins/machinery/test/gate-purity.test.mjs plugins/machinery/test/gate-manifest.test.mjs plugins/machinery/test/spec.test.mjs`
Expected: PASS. The install import walk resolves every new lib.

- [ ] **Step 7: Bump and commit**

```bash
node plugins/machinery/scripts/bump.mjs --plugin plugins/machinery
git add plugins/machinery/scripts/gate/slipbox-check.mjs plugins/machinery/test/slipbox-gate.test.mjs
git commit -m "gate: slipbox_check — verbatim, membership, links, fresh pages, no fork (#132 § 9 legs 2-6)

Membership is the check that would have caught ferrislicer's ADR 0010 contradicting a later dictation for eleven days.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>" -- plugins/machinery/scripts/gate/slipbox-check.mjs plugins/machinery/scripts/gate/manifest.mjs plugins/machinery/scripts/install.mjs plugins/machinery/test/slipbox-gate.test.mjs plugins/machinery/.claude-plugin/plugin.json
```

---

### Task 6: Gate legs 1 and 7 — immutability and filed superpowers files

**Files:**
- Modify: `plugins/machinery/scripts/gate/slipbox-check.mjs`
- Test: `plugins/machinery/test/slipbox-gate-diff.test.mjs`

**Interfaces:**
- Consumes: `gitRaw`, `git` (`lib/git.mjs`); `parseFrontmatter` (Task 1).
- Produces: no new export. Two more `slipbox_check:` lines.
- Base: the index against HEAD when anything is staged; else `merge-base HEAD origin/HEAD` against HEAD (CI); else "no base".

- [ ] **Step 1: Write the failing test**

```js
// plugins/machinery/test/slipbox-gate-diff.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { makeRepo } from './helpers/repo.mjs';
import { runScript } from './helpers/run.mjs';
import { appendEntry } from '../scripts/lib/inbox.mjs';
import { slipboxPaths } from '../scripts/lib/layout.mjs';

const g = (root, ...a) => execFileSync('git', a, { cwd: root, encoding: 'utf8' }).trim();
const write = (root, rel, text) => { const f = path.join(root, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, text); };
const read = (root, rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const gate = (root) => runScript('scripts/gate/gate.mjs', { args: ['--root', root], cwd: root });
const NOTE = 'docs/dictated-specs/notes/2026-09-01T08-00-00Z.md';
const ADR = 'docs/dictated-specs/decisions/0001-x.md';
const DESIGN = 'docs/superpowers/specs/2026-09-02-x-design.md';
const PLAN = 'docs/superpowers/plans/2026-09-02-x.md';

function project() {
  const r = makeRepo();
  write(r.root, '.claude/rules/t.md', '# T\n\n## S\n\n- a rule\n');
  write(r.root, '.claude/machinery/inbox.md', '');
  write(r.root, '.claude/machinery/spec-inbox.md', '');
  g(r.root, 'add', '-A'); g(r.root, 'commit', '-q', '-m', 'install');
  appendEntry(slipboxPaths(r.root).specInbox, { marker: 'SPEC', text: 'SPEC: a rule', session: 's', stamp: '2026-09-01T08:00:00Z' });
  g(r.root, 'add', '-A'); g(r.root, 'commit', '-q', '-m', 'capture');
  const res = runScript('scripts/intake.mjs', { args: ['spec', '--root', r.root, '--stamp', '2026-09-01T08:00:00Z', '--subsystems', 's', '--topic', 'T', '--title', 'A rule'], cwd: r.root, env: { MACHINERY_HOME: fs.mkdtempSync(path.join(os.tmpdir(), 'home-')) } });
  assert.equal(res.code, 0, res.stderr + res.stdout);
  write(r.root, ADR, '# ADR 1\n\n- **Status:** Accepted\n\nWe chose x.\n');
  write(r.root, DESIGN, '---\nkind: design\nstatus: approved\n---\n# X\n\n## Decisions\n\n- x\n');
  write(r.root, PLAN, '---\nkind: plan\nticket: 7\nstatus: done\n---\n# plan\n\n- [x] one\n');
  g(r.root, 'add', '-A'); g(r.root, 'commit', '-q', '-m', 'fixtures');
  return r;
}
const refused = (res, re) => { assert.equal(res.code, 1, res.stdout); assert.match(res.stdout, re, res.stdout); };

test('editing a note, deleting a note, and renaming a note are each refused', () => {
  for (const act of ['edit', 'delete', 'rename']) {
    const r = project();
    try {
      if (act === 'edit') { write(r.root, NOTE, read(r.root, NOTE) + '\nextra\n'); g(r.root, 'add', NOTE); }
      if (act === 'delete') g(r.root, 'rm', '-q', NOTE);
      if (act === 'rename') g(r.root, 'mv', NOTE, 'docs/dictated-specs/notes/moved.md');
      refused(gate(r.root), /commit refused: docs\/dictated-specs\/notes\/2026-09-01T08-00-00Z\.md was (modified|deleted|renamed) — a note is never edited/);
    } finally { r.cleanup(); }
  }
});

test('an ADR change confined to its status line passes; any other ADR change is refused', () => {
  const r = project();
  try {
    write(r.root, ADR, read(r.root, ADR).replace('Accepted', 'Superseded by ADR-0002')); g(r.root, 'add', ADR);
    const ok = gate(r.root);
    assert.doesNotMatch(ok.stdout, /0001-x\.md was/);
    write(r.root, ADR, read(r.root, ADR).replace('We chose x.', 'We chose y.')); g(r.root, 'add', ADR);
    refused(gate(r.root), /0001-x\.md was modified beyond its status line/);
  } finally { r.cleanup(); }
});

test('an approved design and a done plan are frozen; a draft design and a live plan are not', () => {
  const r = project();
  try {
    write(r.root, DESIGN, read(r.root, DESIGN) + '\n- more\n');
    write(r.root, PLAN, read(r.root, PLAN) + '- [ ] two\n');
    g(r.root, 'add', DESIGN, PLAN);
    const res = gate(r.root);
    refused(res, /2026-09-02-x-design\.md was modified, but it was approved — write a new design note that supersedes it/);
    assert.match(res.stdout, /2026-09-02-x\.md was modified, but it was done — a finished plan is history/);
    g(r.root, 'reset', '-q', '--hard');
    write(r.root, DESIGN, read(r.root, DESIGN).replace('approved', 'draft')); write(r.root, PLAN, read(r.root, PLAN).replace('done', 'in-progress'));
    g(r.root, 'add', '-A'); g(r.root, 'commit', '-q', '-m', 'reopen (fixture only; the fixture repo has no hooks)');
    write(r.root, DESIGN, read(r.root, DESIGN) + '\n- more\n'); write(r.root, PLAN, read(r.root, PLAN) + '- [ ] two\n');
    g(r.root, 'add', DESIGN, PLAN);
    assert.match(gate(r.root).stdout, /^slipbox_check: 0 of 2 frozen file\(s\) changed/m);
  } finally { r.cleanup(); }
});

test('RED CHECK: a new superpowers file without front matter is refused, naming the command that files it', () => {
  const r = project();
  try {
    write(r.root, 'docs/superpowers/specs/2026-09-19-new-design.md', '# New\n');
    write(r.root, 'docs/superpowers/plans/2026-09-19-new.md', '# New plan\n');
    g(r.root, 'add', '-A');
    const res = gate(r.root);
    refused(res, /docs\/superpowers\/specs\/2026-09-19-new-design\.md has no front matter — run intake\.mjs design --file/);
    assert.match(res.stdout, /docs\/superpowers\/plans\/2026-09-19-new\.md has no front matter — run intake\.mjs plan --file/);
    assert.match(res.stdout, /^slipbox_check: 2 of 2 added superpowers file\(s\) unfiled/m);
  } finally { r.cleanup(); }
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node --test plugins/machinery/test/slipbox-gate-diff.test.mjs`
Expected: FAIL — no `was modified` refusal; the edits pass.

- [ ] **Step 3: Add the diff legs to `scripts/gate/slipbox-check.mjs`**

Add imports:

```js
import { git, gitRaw } from '../lib/git.mjs';
import { parseFrontmatter } from '../lib/frontmatter.mjs';
```

Replace the header sentence "Legs 1 and 7, which read the staged diff, are added by the next change." with:

```js
// Legs 1 and 7 read the change being committed: the index against HEAD in the pre-commit hook,
// or HEAD against its merge base with origin/HEAD in CI. With neither, they say so.
```

Add these helpers above `slipboxCheck`:

```js
const VERB = { M: 'modified', D: 'deleted', R: 'renamed', T: 'retyped', C: 'copied' };

function changes(root) {
  const parse = (out) => out.split('\n').filter(Boolean).map((l) => { const [st, a, b] = l.split('\t'); return { status: st[0], path: a, to: b ?? null }; });
  const head = git(['rev-parse', '--verify', '-q', 'HEAD'], root);
  if (head.code !== 0) return { base: null, next: null, rows: [] };
  const staged = git(['diff', '--cached', '--name-status', '-M', 'HEAD'], root);
  if (staged.code === 0 && staged.stdout) return { base: 'HEAD', next: '', rows: parse(staged.stdout) };
  const mb = git(['merge-base', 'HEAD', 'origin/HEAD'], root);
  if (mb.code === 0 && mb.stdout && mb.stdout !== head.stdout) return { base: mb.stdout, next: 'HEAD', rows: parse(git(['diff', '--name-status', '-M', mb.stdout, 'HEAD'], root).stdout) };
  return { base: 'HEAD', next: '', rows: [] };
}
// `next` '' reads the index (`:path`); 'HEAD' reads the commit.
const show = (root, ref, rel) => { const r = gitRaw(['show', `${ref}:${rel}`], root); return r.code === 0 ? r.stdout : null; };
const frontOf = (text) => { try { return text === null ? null : parseFrontmatter(text).data; } catch { return null; } };
const withoutStatus = (t) => (t ?? '').split(/\r?\n/).filter((l) => !/^- \*\*Status:\*\* /.test(l)).join('\n').trim();
```

Inside `slipboxCheck`, right after `const leg = …`, add legs 1 and 7:

```js
  const ch = changes(root);
  const relDir = (abs) => path.relative(root, abs).split(path.sep).join('/');
  const directlyIn = (p, abs) => { const d = relDir(abs) + '/'; return p.startsWith(d) && !p.slice(d.length).includes('/'); };
  const P = box.paths;

  // Leg 1 — immutable (#132 § 9). A note is never edited; an ADR changes only its status line; a
  // design that was approved or historical, and a plan that was done, abandoned or historical, are frozen.
  const frozen = [];
  let considered = 0;
  for (const r of ch.rows) {
    if (r.status === 'A') continue;
    const p = r.path, verb = VERB[r.status] ?? 'changed';
    if (directlyIn(p, P.notes)) { considered++; frozen.push(`${p} was ${verb} — a note is never edited; file a new note that supersedes it`); continue; }
    if (directlyIn(p, P.decisions) && /^\d{4}-.*\.md$/.test(path.posix.basename(p))) {
      considered++;
      if (r.status !== 'M' || withoutStatus(show(root, ch.base, p)) !== withoutStatus(show(root, ch.next, p))) frozen.push(`${p} was ${verb} beyond its status line — a decision is superseded by a new ADR, never edited`);
      continue;
    }
    if ((directlyIn(p, P.spSpecs) || directlyIn(p, P.spPlans)) && p.endsWith('.md')) {
      considered++;
      const before = frontOf(show(root, ch.base, p));
      const locked = (before?.kind === 'design' && ['approved', 'historical'].includes(before.status)) || (before?.kind === 'plan' && ['done', 'abandoned', 'historical'].includes(before.status));
      if (locked) frozen.push(`${p} was ${verb}, but it was ${before.status} — ${before.kind === 'design' ? 'write a new design note that supersedes it' : 'a finished plan is history'}`);
    }
  }
  leg(frozen.length, considered, ch.base === null ? 'frozen file(s) changed (no base: nothing committed yet)' : 'frozen file(s) changed (must be 0)', frozen);

  // Leg 7 — filed (#132 § 10). A superpowers file added by this change carries front matter.
  const added = ch.rows.filter((r) => ['A', 'R', 'C'].includes(r.status)).map((r) => r.to ?? r.path)
    .filter((p) => (directlyIn(p, P.spSpecs) || directlyIn(p, P.spPlans)) && p.endsWith('.md'));
  const unfiled = added.filter((p) => !frontOf(show(root, ch.next, p))?.kind)
    .map((p) => `${p} has no front matter — run intake.mjs ${directlyIn(p, P.spPlans) ? 'plan --file <path> --ticket <n>' : 'design --file <path>'}`);
  leg(unfiled.length, added.length, 'added superpowers file(s) unfiled (must be 0)', unfiled);
```

- [ ] **Step 4: Run the gate suites**

Run: `node --test plugins/machinery/test/slipbox-gate-diff.test.mjs plugins/machinery/test/slipbox-gate.test.mjs plugins/machinery/test/gate.test.mjs plugins/machinery/test/gate-purity.test.mjs plugins/machinery/test/install.test.mjs`
Expected: PASS.

- [ ] **Step 5: Bump and commit**

```bash
node plugins/machinery/scripts/bump.mjs --plugin plugins/machinery
git add plugins/machinery/test/slipbox-gate-diff.test.mjs
git commit -m "gate: slipbox_check — notes, ADRs and finished designs and plans are frozen; new superpowers files are filed (#132 § 9 legs 1, 7)

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>" -- plugins/machinery/scripts/gate/slipbox-check.mjs plugins/machinery/test/slipbox-gate-diff.test.mjs plugins/machinery/.claude-plugin/plugin.json
```

---

### Task 7: `intake.mjs decision` and `intake.mjs ref`

**Files:**
- Modify: `plugins/machinery/scripts/lib/slipbox-file.mjs` (append)
- Modify: `plugins/machinery/scripts/intake.mjs` (two commands)
- Test: `plugins/machinery/test/slipbox-decision.test.mjs`

**Interfaces:**
- Consumes: `placeLink`, `placeRef`, `dropSupersededLinks`, `syncGenerated`, `writeText` (Task 4); `loadSlipbox`, `readStructure` (Task 3).
- Produces:
  - `fileDecision({ repo, file }) → { id, subsystems, generated }`
  - `fileRef({ repo, subsystem, target }) → { href, generated }`
- Neither commits. The ADR or map reference is committed with the work, as today.

- [ ] **Step 1: Write the failing test**

```js
// plugins/machinery/test/slipbox-decision.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { makeRepo } from './helpers/repo.mjs';
import { runScript } from './helpers/run.mjs';
import { appendEntry } from '../scripts/lib/inbox.mjs';
import { slipboxPaths } from '../scripts/lib/layout.mjs';

const g = (root, ...a) => execFileSync('git', a, { cwd: root, encoding: 'utf8' }).trim();
const write = (root, rel, text) => { const f = path.join(root, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, text); };
const read = (root, rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const env = () => ({ MACHINERY_HOME: fs.mkdtempSync(path.join(os.tmpdir(), 'home-')) });
const intake = (root, ...args) => runScript('scripts/intake.mjs', { args: [...args, '--root', root], cwd: root, env: env() });
const gate = (root) => runScript('scripts/gate/gate.mjs', { args: ['--root', root], cwd: root });
const D = '2026-09-01T08-00-00Z';
const ST = 'docs/dictated-specs/structure/config.md';
const adr = (n, status, extra = '') => `---\nkind: decision\nsubsystems: [config]\nrests_on: [${D}]\n---\n# ADR ${n}\n\n- **Status:** ${status}\n${extra}`;

function project() {
  const r = makeRepo();
  write(r.root, '.claude/rules/t.md', '# T\n\n## S\n\n- a rule\n');
  write(r.root, '.claude/machinery/inbox.md', '');
  write(r.root, '.claude/machinery/spec-inbox.md', '');
  g(r.root, 'add', '-A'); g(r.root, 'commit', '-q', '-m', 'install');
  appendEntry(slipboxPaths(r.root).specInbox, { marker: 'SPEC', text: 'SPEC: overrides at every level', session: 's', stamp: '2026-09-01T08:00:00Z' });
  g(r.root, 'add', '-A'); g(r.root, 'commit', '-q', '-m', 'capture');
  assert.equal(intake(r.root, 'spec', '--stamp', '2026-09-01T08:00:00Z', '--subsystems', 'config', '--topic', 'Levels', '--title', 'Overrides').code, 0);
  return r;
}

test('decision links a new ADR under "Why it is this way" and the gate passes', () => {
  const r = project();
  try {
    write(r.root, 'docs/dictated-specs/decisions/0010-overrides.md', adr(10, 'Accepted'));
    const res = intake(r.root, 'decision', '--file', 'docs/dictated-specs/decisions/0010-overrides.md');
    assert.equal(res.code, 0, res.stderr + res.stdout);
    assert.match(read(r.root, ST), /## Why it is this way\n\n- \[\[0010-overrides\]\]/);
    assert.match(read(r.root, 'docs/spec-current/config.md'), /\[ADR 10\]\(\.\.\/dictated-specs\/decisions\/0010-overrides\.md\)/);
    assert.equal(gate(r.root).code, 0, gate(r.root).stdout);
  } finally { r.cleanup(); }
});

test('filing a superseding ADR drops the superseded one from every "Why" section', () => {
  const r = project();
  try {
    write(r.root, 'docs/dictated-specs/decisions/0010-overrides.md', adr(10, 'Accepted'));
    assert.equal(intake(r.root, 'decision', '--file', 'docs/dictated-specs/decisions/0010-overrides.md').code, 0);
    write(r.root, 'docs/dictated-specs/decisions/0010-overrides.md', adr(10, 'Superseded by ADR-0011'));
    write(r.root, 'docs/dictated-specs/decisions/0011-every-level.md', adr(11, 'Accepted'));
    assert.equal(intake(r.root, 'decision', '--file', 'docs/dictated-specs/decisions/0011-every-level.md').code, 0);
    const st = read(r.root, ST);
    assert.match(st, /- \[\[0011-every-level\]\]/);
    assert.doesNotMatch(st, /0010-overrides/);
    assert.equal(gate(r.root).code, 0);
  } finally { r.cleanup(); }
});

test('a superseded ADR still linked under "Why" is refused by the gate', () => {
  const r = project();
  try {
    write(r.root, 'docs/dictated-specs/decisions/0010-overrides.md', adr(10, 'Accepted'));
    assert.equal(intake(r.root, 'decision', '--file', 'docs/dictated-specs/decisions/0010-overrides.md').code, 0);
    write(r.root, 'docs/dictated-specs/decisions/0010-overrides.md', adr(10, 'Superseded by ADR-0011'));
    const res = gate(r.root);
    assert.equal(res.code, 1);
    assert.match(res.stdout, /links 0010-overrides under "Why it is this way", but that decision is superseded/);
  } finally { r.cleanup(); }
});

test('ref links a living map under References; the gate refuses a reference to a missing file', () => {
  const r = project();
  try {
    write(r.root, 'docs/superpowers/models/preview.html', '<title>map</title>\n');
    const res = intake(r.root, 'ref', '--subsystem', 'config', '--path', 'docs/superpowers/models/preview.html');
    assert.equal(res.code, 0, res.stderr + res.stdout);
    assert.match(read(r.root, ST), /## References\n\n- \[preview\.html\]\(\.\.\/\.\.\/superpowers\/models\/preview\.html\)/);
    assert.match(read(r.root, 'docs/spec-current/config.md'), /\[preview\.html\]\(\.\.\/superpowers\/models\/preview\.html\)/);
    assert.equal(gate(r.root).code, 0);
    fs.rmSync(path.join(r.root, 'docs/superpowers/models/preview.html'));
    assert.match(gate(r.root).stdout, /references \.\.\/\.\.\/superpowers\/models\/preview\.html, which does not exist/);
  } finally { r.cleanup(); }
});

test('RED CHECK: decision refuses a file outside decisions/, one without decision front matter, and a rests_on that is not a dictation', () => {
  const r = project();
  try {
    write(r.root, 'docs/adr-elsewhere/0010-x.md', adr(10, 'Accepted'));
    assert.match(intake(r.root, 'decision', '--file', 'docs/adr-elsewhere/0010-x.md').stderr, /a decision note lives at docs\/dictated-specs\/decisions\/00NN-slug\.md/);
    write(r.root, 'docs/dictated-specs/decisions/0010-x.md', '# ADR\n\n- **Status:** Accepted\n');
    assert.match(intake(r.root, 'decision', '--file', 'docs/dictated-specs/decisions/0010-x.md').stderr, /needs front matter with kind: decision/);
    write(r.root, 'docs/dictated-specs/decisions/0010-x.md', adr(10, 'Accepted').replace(D, 'nope'));
    assert.match(intake(r.root, 'decision', '--file', 'docs/dictated-specs/decisions/0010-x.md').stderr, /rests_on nope: not a dictation note/);
    assert.doesNotMatch(read(r.root, ST), /0010-x/);
  } finally { r.cleanup(); }
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node --test plugins/machinery/test/slipbox-decision.test.mjs`
Expected: FAIL — `usage: intake list …` (no `decision` command).

- [ ] **Step 3: Append to `scripts/lib/slipbox-file.mjs`**

Extend the imports:

```js
import { parseFrontmatter } from './frontmatter.mjs';
import { readStructure } from './slipbox.mjs';
import { placeLink, placeRef, dropSupersededLinks } from './slipbox-write.mjs';
```

Append:

```js
const listOf = (v) => (v == null || v === '' ? [] : Array.isArray(v) ? v : [v]);

// #132 § 4, § 6. A new ADR is linked under "Why it is this way" in each subsystem it names; an ADR
// this change marked "Superseded by …" leaves every "Why" section.
export function fileDecision({ repo, file }) {
  const p = slipboxPaths(repo);
  const abs = path.resolve(repo, file);
  if (path.dirname(abs) !== p.decisions || !/^\d{4}-.*\.md$/.test(path.basename(abs))) throw new Error(`a decision note lives at docs/dictated-specs/decisions/00NN-slug.md: '${file}'`);
  const { data } = parseFrontmatter(fs.readFileSync(abs, 'utf8'));
  if (data?.kind !== 'decision') throw new Error(`${rel(repo, abs)} needs front matter with kind: decision, subsystems and rests_on`);
  const subsystems = listOf(data.subsystems);
  if (!subsystems.length) throw new Error(`${rel(repo, abs)} names no subsystems`);
  const box = loadSlipbox(repo);
  for (const d of listOf(data.rests_on)) if (box.notes.get(d)?.kind !== 'dictation') throw new Error(`rests_on ${d}: not a dictation note`);
  const id = path.basename(abs, '.md');
  for (const sub of subsystems) {
    const f = path.join(p.structure, `${sub}.md`);
    const cur = fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : null;
    if (cur === null || !readStructure(cur).why.includes(id)) writeText(f, placeLink(cur, sub, id));
  }
  const after = loadSlipbox(repo);
  for (const [sub, st] of after.structures) {
    const next = dropSupersededLinks(st.text, after);
    if (next !== st.text) writeText(path.join(p.structure, `${sub}.md`), next);
  }
  return { id, subsystems, generated: syncGenerated(repo, loadSlipbox(repo)) };
}

// D12: a living map stays outside the slip box; a structure note may only link to it.
export function fileRef({ repo, subsystem, target }) {
  const p = slipboxPaths(repo);
  const abs = path.resolve(repo, target);
  if (!fs.existsSync(abs)) throw new Error(`--path ${target}: no such file`);
  const f = path.join(p.structure, `${subsystem}.md`);
  const href = path.relative(p.structure, abs).split(path.sep).join('/');
  const cur = fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : null;
  if (cur === null || !readStructure(cur).refs.includes(href)) writeText(f, placeRef(cur, subsystem, path.basename(abs), href));
  return { href, generated: syncGenerated(repo, loadSlipbox(repo)) };
}
```

- [ ] **Step 4: Wire the commands into `scripts/intake.mjs`**

Change the import to `import { fileSpec, regen, fileDecision, fileRef } from './lib/slipbox-file.mjs';` and add:

```js
function decision() {
  const f = opt('--file');
  if (!f) die('usage: intake decision --file docs/dictated-specs/decisions/<00NN-slug>.md');
  let r;
  try { r = fileDecision({ repo: projectRoot(opt('--root') || process.cwd()), file: f }); } catch (e) { die(e.message); }
  process.stdout.write(`linked ${r.id} under "Why it is this way" in: ${r.subsystems.join(', ')}\n${r.generated.map((c) => `regenerated ${c}`).join('\n')}${r.generated.length ? '\n' : ''}commit the ADR and these files with the work\n`);
}

function ref() {
  const subsystem = opt('--subsystem'), target = opt('--path');
  if (!subsystem || !target) die('usage: intake ref --subsystem <s> --path <repo-relative file>');
  let r;
  try { r = fileRef({ repo: projectRoot(opt('--root') || process.cwd()), subsystem, target }); } catch (e) { die(e.message); }
  process.stdout.write(`referenced ${r.href} from ${subsystem}\n${r.generated.map((c) => `regenerated ${c}`).join('\n')}${r.generated.length ? '\n' : ''}`);
}
```

Dispatch:

```js
else if (cmd === 'decision') decision(); else if (cmd === 'ref') ref();
```

- [ ] **Step 5: Run the suites**

Run: `node --test plugins/machinery/test/slipbox-decision.test.mjs plugins/machinery/test/slipbox-intake.test.mjs plugins/machinery/test/slipbox-gate.test.mjs`
Expected: PASS.

- [ ] **Step 6: Bump and commit**

```bash
node plugins/machinery/scripts/bump.mjs --plugin plugins/machinery
git add plugins/machinery/test/slipbox-decision.test.mjs
git commit -m "intake decision and ref: ADRs are linked as the why, living maps as references (#132 § 4, D7, D12)

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>" -- plugins/machinery/scripts/lib/slipbox-file.mjs plugins/machinery/scripts/intake.mjs plugins/machinery/test/slipbox-decision.test.mjs plugins/machinery/.claude-plugin/plugin.json
```

---

### Task 8: `intake.mjs design`, `plan` and `map`

**Files:**
- Modify: `plugins/machinery/scripts/lib/slipbox-file.mjs` (append)
- Modify: `plugins/machinery/scripts/intake.mjs` (three commands)
- Test: `plugins/machinery/test/slipbox-superpowers.test.mjs`

**Interfaces:**
- Consumes: `setFrontmatter` (Task 1); `section` (Task 2); `placeHeadingEmbed`, `writeText`, `syncGenerated` (Task 4).
- Produces:
  - `fileDesign({ repo, file, subsystems, supersedes, ticket })` → sets `kind: design`, `status: draft`
  - `approveDesign({ repo, file }) → { id, subsystems, generated }` → `status: approved`; drops heading embeds of the designs it supersedes
  - `embedDesign({ repo, file, subsystem, topic, heading }) → { generated }`
  - `filePlan({ repo, file, ticket })` → `kind: plan`, `status: in-progress`
  - `closePlan({ repo, file, status })` → `done` or `abandoned`
  - `fileMap({ repo, file })` → `kind: map` (D12)
- None commits. The files are committed with the work.

- [ ] **Step 1: Write the failing test**

```js
// plugins/machinery/test/slipbox-superpowers.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { makeRepo } from './helpers/repo.mjs';
import { runScript } from './helpers/run.mjs';

const g = (root, ...a) => execFileSync('git', a, { cwd: root, encoding: 'utf8' }).trim();
const write = (root, rel, text) => { const f = path.join(root, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, text); };
const read = (root, rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const env = () => ({ MACHINERY_HOME: fs.mkdtempSync(path.join(os.tmpdir(), 'home-')) });
const intake = (root, ...args) => runScript('scripts/intake.mjs', { args: [...args, '--root', root], cwd: root, env: env() });
const gate = (root) => runScript('scripts/gate/gate.mjs', { args: ['--root', root], cwd: root });
const V1 = 'docs/superpowers/specs/2026-09-02-hub-design.md';
const V2 = 'docs/superpowers/specs/2026-09-15-hub-v2-design.md';
const PLAN = 'docs/superpowers/plans/2026-09-02-hub.md';
const ST = 'docs/dictated-specs/structure/config.md';
const BODY = (t) => `# ${t}\n\n## Decisions (Gabe, 2026-09-02)\n\n- ${t} decided\n\n## Files touched\n\n- hub.rs\n`;

function project() {
  const r = makeRepo();
  write(r.root, '.claude/rules/t.md', '# T\n\n## S\n\n- a rule\n');
  write(r.root, '.claude/machinery/inbox.md', '');
  write(r.root, '.claude/machinery/spec-inbox.md', '');
  g(r.root, 'add', '-A'); g(r.root, 'commit', '-q', '-m', 'install');
  return r;
}
const ok = (res) => assert.equal(res.code, 0, res.stderr + res.stdout);

test('a design is filed as a draft, approved, and embedded by one decisions heading; the flat page leaves out implementation', () => {
  const r = project();
  try {
    write(r.root, V1, BODY('Hub'));
    ok(intake(r.root, 'design', '--file', V1, '--subsystems', 'config', '--ticket', '12'));
    assert.equal(read(r.root, V1), `---\nkind: design\nstatus: draft\nsubsystems: [config]\nticket: 12\n---\n${BODY('Hub')}`);
    ok(intake(r.root, 'design', '--approve', V1));
    assert.match(read(r.root, V1), /status: approved/);
    assert.equal(gate(r.root).code, 1, 'approved but not yet embedded');
    ok(intake(r.root, 'design', '--embed', V1, '--subsystem', 'config', '--topic', 'Hub', '--heading', 'Decisions (Gabe, 2026-09-02)'));
    assert.match(read(r.root, ST), /## Hub\n\n!\[\[2026-09-02-hub-design#Decisions \(Gabe, 2026-09-02\)\]\]/);
    const page = read(r.root, 'docs/spec-current/config.md');
    assert.match(page, /Hub decided/);
    assert.doesNotMatch(page, /hub\.rs/);
    assert.equal(gate(r.root).code, 0, gate(r.root).stdout);
  } finally { r.cleanup(); }
});

test('an approved design superseded by a new one: the old file is untouched and its embed leaves the structure note', () => {
  const r = project();
  try {
    write(r.root, V1, BODY('Hub'));
    ok(intake(r.root, 'design', '--file', V1, '--subsystems', 'config'));
    ok(intake(r.root, 'design', '--approve', V1));
    ok(intake(r.root, 'design', '--embed', V1, '--subsystem', 'config', '--topic', 'Hub', '--heading', 'Decisions (Gabe, 2026-09-02)'));
    const v1 = read(r.root, V1);
    write(r.root, V2, BODY('Hub v2'));
    ok(intake(r.root, 'design', '--file', V2, '--subsystems', 'config', '--supersedes', '2026-09-02-hub-design'));
    ok(intake(r.root, 'design', '--approve', V2));
    ok(intake(r.root, 'design', '--embed', V2, '--subsystem', 'config', '--topic', 'Hub', '--heading', 'Decisions (Gabe, 2026-09-02)'));
    assert.equal(read(r.root, V1), v1);
    assert.doesNotMatch(read(r.root, ST), /2026-09-02-hub-design#/);
    assert.equal(gate(r.root).code, 0, gate(r.root).stdout);
  } finally { r.cleanup(); }
});

test('a plan is filed in progress with its ticket, then closed; a map is marked and never embedded', () => {
  const r = project();
  try {
    write(r.root, PLAN, '# Plan\n\n- [ ] one\n');
    ok(intake(r.root, 'plan', '--file', PLAN, '--ticket', '12'));
    assert.match(read(r.root, PLAN), /^---\nkind: plan\nticket: 12\nstatus: in-progress\n---\n# Plan/);
    ok(intake(r.root, 'plan', '--file', PLAN, '--status', 'done'));
    assert.match(read(r.root, PLAN), /status: done/);
    write(r.root, 'docs/superpowers/specs/2026-08-09-pipeline-map.md', '# Map\n\n## Stage\n\n- x\n');
    ok(intake(r.root, 'map', '--file', 'docs/superpowers/specs/2026-08-09-pipeline-map.md'));
    assert.match(read(r.root, 'docs/superpowers/specs/2026-08-09-pipeline-map.md'), /^---\nkind: map\n---\n/);
    const refuse = intake(r.root, 'design', '--embed', 'docs/superpowers/specs/2026-08-09-pipeline-map.md', '--subsystem', 'config', '--topic', 'T', '--heading', 'Stage');
    assert.equal(refuse.code, 1);
    assert.match(refuse.stderr, /only an approved design note is embedded/);
  } finally { r.cleanup(); }
});

test('RED CHECK: approving a non-draft, embedding a missing heading, and filing a file twice are refused', () => {
  const r = project();
  try {
    write(r.root, V1, BODY('Hub'));
    assert.match(intake(r.root, 'design', '--approve', V1).stderr, /is not a draft design note/);
    ok(intake(r.root, 'design', '--file', V1, '--subsystems', 'config'));
    assert.match(intake(r.root, 'design', '--file', V1).stderr, /is already filed as design/);
    ok(intake(r.root, 'design', '--approve', V1));
    assert.match(intake(r.root, 'design', '--embed', V1, '--subsystem', 'config', '--topic', 'T', '--heading', 'Nope').stderr, /has no heading 'Nope'/);
    write(r.root, 'docs/superpowers/plans/x.md', '# P\n');
    assert.match(intake(r.root, 'plan', '--file', 'docs/superpowers/plans/x.md', '--status', 'done').stderr, /is not an in-progress plan/);
  } finally { r.cleanup(); }
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node --test plugins/machinery/test/slipbox-superpowers.test.mjs`
Expected: FAIL — `usage: intake list …` (no `design` command).

- [ ] **Step 3: Append to `scripts/lib/slipbox-file.mjs`**

Extend the imports:

```js
import { setFrontmatter } from './frontmatter.mjs';
import { section } from './embed.mjs';
import { placeHeadingEmbed } from './slipbox-write.mjs';
```

Append:

```js
// #132 § 10. The superpowers plugin keeps writing where it writes; these file its output in place.
function superpowersFile(repo, file, which) {
  const p = slipboxPaths(repo);
  const abs = path.resolve(repo, file);
  const dir = which === 'plans' ? p.spPlans : p.spSpecs;
  if (path.dirname(abs) !== dir || !abs.endsWith('.md')) throw new Error(`${file} is not a file directly under ${rel(repo, dir)}/`);
  const text = fs.readFileSync(abs, 'utf8');
  return { abs, text, data: parseFrontmatter(text).data ?? {} };
}

export function fileDesign({ repo, file, subsystems = [], supersedes = [], ticket = null }) {
  const f = superpowersFile(repo, file, 'specs');
  if (f.data.kind) throw new Error(`${file} is already filed as ${f.data.kind}`);
  const box = loadSlipbox(repo);
  for (const s of supersedes) if (box.notes.get(s)?.kind !== 'design') throw new Error(`--supersedes ${s}: not a design note`);
  writeText(f.abs, setFrontmatter(f.text, { kind: 'design', status: 'draft', ...(subsystems.length ? { subsystems } : {}), ...(ticket ? { ticket } : {}), ...(supersedes.length ? { supersedes } : {}) }));
}

export function approveDesign({ repo, file }) {
  const f = superpowersFile(repo, file, 'specs');
  if (f.data.kind !== 'design' || f.data.status !== 'draft') throw new Error(`${file} is not a draft design note (kind ${f.data.kind ?? 'none'}, status ${f.data.status ?? 'none'})`);
  writeText(f.abs, setFrontmatter(f.text, { status: 'approved' }));
  const replaced = listOf(f.data.supersedes);
  const box = loadSlipbox(repo);
  for (const [sub, st] of box.structures) {
    const next = st.text.split('\n').filter((l) => !replaced.some((old) => l.trim().startsWith(`![[${old}#`))).join('\n');
    if (next !== st.text) writeText(path.join(box.paths.structure, `${sub}.md`), next);
  }
  return { id: path.basename(f.abs, '.md'), subsystems: listOf(f.data.subsystems), generated: syncGenerated(repo, loadSlipbox(repo)) };
}

// D9: only a decision, owner-constraint or principle heading is embedded. The gate cannot judge
// that; the command's output names the heading so the owner sees it.
export function embedDesign({ repo, file, subsystem, topic, heading }) {
  const f = superpowersFile(repo, file, 'specs');
  if (f.data.kind !== 'design' || f.data.status !== 'approved') throw new Error(`${file} is ${f.data.kind ?? 'unfiled'}${f.data.status ? ` (${f.data.status})` : ''}: only an approved design note is embedded`);
  if (section(parseFrontmatter(f.text).body, heading) === null) throw new Error(`${file} has no heading '${heading}'`);
  const st = path.join(slipboxPaths(repo).structure, `${subsystem}.md`);
  const cur = fs.existsSync(st) ? fs.readFileSync(st, 'utf8') : null;
  const id = path.basename(f.abs, '.md');
  if (!(cur ?? '').includes(`![[${id}#${heading}]]`)) writeText(st, placeHeadingEmbed(cur, subsystem, { id, heading, topic }));
  return { generated: syncGenerated(repo, loadSlipbox(repo)) };
}

export function filePlan({ repo, file, ticket }) {
  const f = superpowersFile(repo, file, 'plans');
  if (f.data.kind) throw new Error(`${file} is already filed as ${f.data.kind}`);
  if (!ticket) throw new Error('a plan is filed with its ticket: --ticket <n>');
  writeText(f.abs, setFrontmatter(f.text, { kind: 'plan', ticket, status: 'in-progress' }));
}

export function closePlan({ repo, file, status }) {
  const f = superpowersFile(repo, file, 'plans');
  if (!['done', 'abandoned'].includes(status)) throw new Error(`--status is done or abandoned, not '${status}'`);
  if (f.data.kind !== 'plan' || f.data.status !== 'in-progress') throw new Error(`${file} is not an in-progress plan (kind ${f.data.kind ?? 'none'}, status ${f.data.status ?? 'none'})`);
  writeText(f.abs, setFrontmatter(f.text, { status }));
}

export function fileMap({ repo, file }) {
  const f = superpowersFile(repo, file, 'specs');
  if (f.data.kind) throw new Error(`${file} is already filed as ${f.data.kind}`);
  writeText(f.abs, setFrontmatter(f.text, { kind: 'map' }));
}
```

- [ ] **Step 4: Wire the commands into `scripts/intake.mjs`**

Extend the import with `fileDesign, approveDesign, embedDesign, filePlan, closePlan, fileMap` and add:

```js
function design() {
  const repo = projectRoot(opt('--root') || process.cwd());
  try {
    if (opt('--approve')) {
      const r = approveDesign({ repo, file: opt('--approve') });
      process.stdout.write(`approved ${r.id}${r.subsystems.length ? ` — embed its decision heading in ${r.subsystems.join(', ')} with intake design --embed` : ''}\n`);
    } else if (opt('--embed')) {
      const heading = opt('--heading');
      embedDesign({ repo, file: opt('--embed'), subsystem: opt('--subsystem'), topic: opt('--topic'), heading });
      process.stdout.write(`embedded heading '${heading}' — it must record a decision, an owner constraint or a principle, never implementation\n`);
    } else if (opt('--file')) {
      fileDesign({ repo, file: opt('--file'), subsystems: csv('--subsystems'), supersedes: csv('--supersedes'), ticket: opt('--ticket') });
      process.stdout.write(`filed ${opt('--file')} as a draft design\n`);
    } else die('usage: intake design --file <path> [--subsystems a,b] [--ticket n] [--supersedes id] | --approve <path> | --embed <path> --subsystem <s> --topic "<t>" --heading "<h>"');
  } catch (e) { die(e.message); }
}

function plan() {
  const repo = projectRoot(opt('--root') || process.cwd());
  const f = opt('--file');
  if (!f) die('usage: intake plan --file <path> --ticket <n> | --file <path> --status done|abandoned');
  try {
    if (opt('--status')) closePlan({ repo, file: f, status: opt('--status') });
    else filePlan({ repo, file: f, ticket: opt('--ticket') });
  } catch (e) { die(e.message); }
  process.stdout.write(`plan ${f}: ${opt('--status') ?? 'in-progress'}\n`);
}

function map() {
  const f = opt('--file');
  if (!f) die('usage: intake map --file <path>');
  try { fileMap({ repo: projectRoot(opt('--root') || process.cwd()), file: f }); } catch (e) { die(e.message); }
  process.stdout.write(`${f} is a living map: kept by hand, never embedded, linked with intake ref\n`);
}
```

Dispatch:

```js
else if (cmd === 'design') design(); else if (cmd === 'plan') plan(); else if (cmd === 'map') map();
```

- [ ] **Step 5: Run the suites**

Run: `node --test plugins/machinery/test/slipbox-superpowers.test.mjs plugins/machinery/test/slipbox-gate-diff.test.mjs plugins/machinery/test/slipbox-decision.test.mjs`
Expected: PASS.

- [ ] **Step 6: Bump and commit**

```bash
node plugins/machinery/scripts/bump.mjs --plugin plugins/machinery
git add plugins/machinery/test/slipbox-superpowers.test.mjs
git commit -m "intake design, plan and map: superpowers output is filed in place (#132 § 10, D9, D12)

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>" -- plugins/machinery/scripts/lib/slipbox-file.mjs plugins/machinery/scripts/intake.mjs plugins/machinery/test/slipbox-superpowers.test.mjs plugins/machinery/.claude-plugin/plugin.json
```

---

### Task 9: The banner and install name an unmigrated project (D13)

**Files:**
- Modify: `plugins/machinery/scripts/banner.mjs` (inside `if (root) { … }`, after the `hosted check` line)
- Modify: `plugins/machinery/scripts/install.mjs` (end of `installProject`, after the migration lines)
- Test: `plugins/machinery/test/slipbox-detect.test.mjs`

**Interfaces:**
- Consumes: `unmigrated`, `describeUnmigrated` (Task 4).
- Produces: banner line `  slip box: NOT MIGRATED — <description>; run node "<plugin>/scripts/intake.mjs" migrate --plan <file>`; the same text from install. Nothing is printed for a migrated project.

- [ ] **Step 1: Write the failing test**

```js
// plugins/machinery/test/slipbox-detect.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { makeRepo } from './helpers/repo.mjs';
import { runScript, PLUGIN } from './helpers/run.mjs';

const base = JSON.parse(fs.readFileSync(path.join(PLUGIN, 'test/fixtures/payloads/SessionStart.json'), 'utf8'));
const home = () => { const h = fs.mkdtempSync(path.join(os.tmpdir(), 'home-')); fs.mkdirSync(path.join(h, '.claude')); return h; };
const banner = (cwd) => JSON.parse(runScript('scripts/banner.mjs', { stdin: JSON.stringify({ ...base, cwd }), cwd, env: { MACHINERY_HOME: home() } }).stdout).hookSpecificOutput.additionalContext;
const write = (root, rel, text) => { const f = path.join(root, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, text); };

function oldProject() {
  const r = makeRepo();
  write(r.root, 'docs/dictated-specs/collision-model.md', '# Collision\n\n## A\n');
  write(r.root, 'docs/dictated-specs/tooling.md', '# Tooling\n');
  write(r.root, 'docs/adr/0001-x.md', '# ADR\n');
  write(r.root, 'docs/superpowers/specs/2026-06-21-x-design.md', '# X\n');
  write(r.root, 'docs/superpowers/plans/2026-06-21-x.md', '# P\n');
  write(r.root, 'docs/superpowers/plans/2026-06-22-y.md', '---\nkind: plan\nticket: 1\nstatus: done\n---\n# P\n');
  return r;
}

test('the banner names each kind of unmigrated content with its count, with no gate installed', () => {
  const r = oldProject();
  try {
    const t = banner(r.root);
    assert.match(t, /gate: not installed/);
    assert.match(t, /slip box: NOT MIGRATED — 2 old spec file\(s\) in docs\/dictated-specs\/, docs\/adr\/ \(1 file\(s\)\), 2 superpowers file\(s\) without front matter; run node ".*intake\.mjs" migrate --plan <file>/);
  } finally { r.cleanup(); }
});

test('install prints the same line and migrates nothing', () => {
  const r = oldProject();
  try {
    const res = runScript('scripts/install.mjs', { args: ['--root', r.root], cwd: r.root });
    assert.equal(res.code, 0, res.stderr);
    assert.match(res.stdout, /slip box: NOT MIGRATED — 2 old spec file\(s\)/);
    assert.ok(fs.existsSync(path.join(r.root, 'docs/adr/0001-x.md')), 'install moved nothing');
  } finally { r.cleanup(); }
});

test('RED CHECK: a migrated project gets no slip box line at all', () => {
  const r = makeRepo();
  try {
    write(r.root, 'docs/dictated-specs/INDEX.md', '# index\n');
    write(r.root, 'docs/superpowers/plans/2026-06-22-y.md', '---\nkind: plan\nticket: 1\nstatus: done\n---\n# P\n');
    assert.doesNotMatch(banner(r.root), /slip box/);
  } finally { r.cleanup(); }
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node --test plugins/machinery/test/slipbox-detect.test.mjs`
Expected: FAIL — no `slip box:` line.

- [ ] **Step 3: Add the banner line** (`scripts/banner.mjs`)

Import:

```js
import { unmigrated, describeUnmigrated } from './lib/unmigrated.mjs';
```

After the `hosted check` line, inside `if (root) { … }`:

```js
    // #132 Amendment 1 (D13; owner, 2026-09-19: "it has to happen in every repo"). The banner runs
    // in every project the plugin is enabled in, installed gate or not, so this is where each repo
    // learns it has a migration to do. A migrated project prints nothing here.
    try {
      const u = unmigrated(root);
      if (u.any) lines.push(`  slip box: NOT MIGRATED — ${describeUnmigrated(u)}; run node "${path.join(pluginRoot(), 'scripts', 'intake.mjs')}" migrate --plan <file>`);
    } catch (e) { lines.push(`  slip box: could not check — ${e.message}`); }
```

- [ ] **Step 4: Add the install line** (`scripts/install.mjs`)

Import:

```js
import { unmigrated, describeUnmigrated } from './lib/unmigrated.mjs';
```

After `if (!migrated.length) say('migration: nothing to migrate');`:

```js
  // #132 D13: install detects; it never migrates, because migration needs the AI's judgements.
  const u = unmigrated(root);
  if (u.any) say(`slip box: NOT MIGRATED — ${describeUnmigrated(u)}; run node "${path.join(pluginRoot(), 'scripts', 'intake.mjs')}" migrate --plan <file>`);
```

- [ ] **Step 5: Run the suites**

Run: `node --test plugins/machinery/test/slipbox-detect.test.mjs plugins/machinery/test/banner.test.mjs plugins/machinery/test/install.test.mjs`
Expected: PASS.

- [ ] **Step 6: Bump and commit**

```bash
node plugins/machinery/scripts/bump.mjs --plugin plugins/machinery
git add plugins/machinery/test/slipbox-detect.test.mjs
git commit -m "banner and install: name an unmigrated project in every repo the plugin runs in (#132 D13)

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>" -- plugins/machinery/scripts/banner.mjs plugins/machinery/scripts/install.mjs plugins/machinery/test/slipbox-detect.test.mjs plugins/machinery/.claude-plugin/plugin.json
```

---

### Task 10: `intake.mjs migrate --plan` and `--apply`

**Files:**
- Create: `plugins/machinery/scripts/lib/migrate-plan.mjs`
- Create: `plugins/machinery/scripts/lib/migrate.mjs`
- Modify: `plugins/machinery/scripts/intake.mjs` (one command)
- Modify: `plugins/machinery/test/gate-purity.test.mjs` (`SERIALISES_TO_A_FILE` gains `lib/migrate-plan.mjs`)
- Test: `plugins/machinery/test/slipbox-migrate.test.mjs`

**Interfaces:**
- Consumes: everything from Tasks 1–8; `parseInbox`, `setDisposition` (`lib/inbox.mjs`); `filedPath` (`lib/layout.mjs`); `git` (`lib/git.mjs`).
- Produces:
  - `writePlan(file, plan)`, `readPlan(file) → plan`
  - `buildPlan(repo) → plan` (mechanical skeleton; the AI fills the `null`s and empty lists)
  - `planProblems(repo, plan) → string[]`
  - `applyPlan(repo, plan) → { commit1: string[], commit2: string[] }`
- Plan shape (JSON):

```json
{
  "version": 1,
  "notes": [{ "stamp": "2026-09-09T10:00:00Z", "oldHome": "docs/dictated-specs/x.md § A", "preview": "SPEC: …", "title": null, "subsystems": [], "topic": null, "supersedes": [] }],
  "versions": [{ "from": "2026-09-19T01:03:49Z", "supersedes": "<note id>", "subsystems": [], "topic": null, "text": null }],
  "unsettled": [{ "file": "docs/dictated-specs/x.md", "heading": "C. …", "resolution": null }],
  "adr": { "files": ["0001-x.md"] },
  "superpowers": [{ "path": "docs/superpowers/specs/…md", "kind": "design", "status": null, "subsystems": [], "ticket": null, "supersedes": [] }],
  "embeds": [{ "subsystem": "", "topic": "", "note": "<design id>", "heading": "" }],
  "decisionLinks": [{ "subsystem": "", "decision": "0011-…" }],
  "refs": [{ "subsystem": "", "path": "docs/superpowers/models/preview.html" }],
  "references": [{ "path": "scripts/adr_provenance_gate.py", "mentions": ["docs/adr"], "replace": [["docs/adr", "docs/dictated-specs/decisions"]], "reviewed": false }]
}
```

- [ ] **Step 1: Write the failing test**

```js
// plugins/machinery/test/slipbox-migrate.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { makeRepo } from './helpers/repo.mjs';
import { runScript } from './helpers/run.mjs';
import { formatEntry } from '../scripts/lib/inbox.mjs';
import { unmigrated } from '../scripts/lib/unmigrated.mjs';

const g = (root, ...a) => execFileSync('git', a, { cwd: root, encoding: 'utf8' }).trim();
const write = (root, rel, text) => { const f = path.join(root, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, text); };
const read = (root, rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const env = () => ({ MACHINERY_HOME: fs.mkdtempSync(path.join(os.tmpdir(), 'home-')) });
const intake = (root, ...args) => runScript('scripts/intake.mjs', { args: [...args, '--root', root], cwd: root, env: env() });
const gate = (root) => runScript('scripts/gate/gate.mjs', { args: ['--root', root], cwd: root });
const A = '2026-09-01T08:00:00Z', B = '2026-09-09T10:00:00Z';
const filed = (stamp, text, home) => formatEntry({ stamp, marker: 'SPEC', text, session: 's' }).replace('## PENDING', '## FILED').replace('disposition: PENDING', `disposition: filed → ${home}`);
const ADR = '# ADR 1\n\n- **Status:** Accepted\n';

function oldProject() {
  const r = makeRepo();
  write(r.root, '.claude/rules/t.md', '# T\n\n## S\n\n- a rule\n');
  write(r.root, '.claude/machinery/inbox.md', '');
  write(r.root, '.claude/machinery/spec-inbox.md', filed(A, 'SPEC: each object has its own extruder', 'docs/dictated-specs/collision.md § A') + filed(B, 'SPEC: objects need not have their own extruder', 'docs/dictated-specs/collision.md § B'));
  write(r.root, 'docs/dictated-specs/collision.md', '# Collision\n\n### A — REVERSED 2026-09-09\n\neach object has its own extruder (reworded)\n\nASSISTANT, offered so it can be struck: maybe per group\n\n### B\n\nobjects need not\n\n### C. never filed\n\ntext\n');
  write(r.root, 'docs/adr/0001-x.md', ADR);
  write(r.root, 'docs/adr/README.md', '# ADRs\n');
  write(r.root, 'docs/superpowers/specs/2026-06-21-hub-design.md', '# Hub\n\n## Decisions\n\n- one hub\n\n## Files touched\n\n- hub.rs\n');
  write(r.root, 'docs/superpowers/specs/2026-08-09-pipeline-map.md', '# Map\n');
  write(r.root, 'docs/superpowers/plans/2026-06-21-hub.md', '# Plan\n\n- [x] one\n');
  write(r.root, 'scripts/adr_gate.py', 'ADR_DIR = "docs/adr"\n');
  g(r.root, 'add', '-A'); g(r.root, 'commit', '-q', '-m', 'old layout');
  return r;
}
const planFile = () => path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'plan-')), 'plan.json');

function fill(p) {
  const byStamp = Object.fromEntries(p.notes.map((n) => [n.stamp, n]));
  Object.assign(byStamp[A], { title: 'Each object has its own extruder', subsystems: ['extruders'], topic: 'Defaults' });
  Object.assign(byStamp[B], { title: 'Objects need not have their own extruder', subsystems: ['extruders'], topic: 'Defaults', supersedes: ['2026-09-01T08-00-00Z'] });
  for (const u of p.unsettled) u.resolution = u.heading.startsWith('C.') ? 'not a dictation: a heading with no captured words; owner to dictate if wanted' : 'covered by its inbox entry';
  for (const s of p.superpowers) {
    if (s.path.endsWith('hub-design.md')) Object.assign(s, { status: 'approved', subsystems: ['extruders'] });
    else if (s.path.endsWith('pipeline-map.md')) Object.assign(s, { kind: 'map' });
    else Object.assign(s, { status: 'done', ticket: '3' });
  }
  p.embeds.push({ subsystem: 'extruders', topic: 'Hub', note: '2026-06-21-hub-design', heading: 'Decisions' });
  p.decisionLinks.push({ subsystem: 'extruders', decision: '0001-x' });
  p.refs.push({ subsystem: 'extruders', path: 'docs/superpowers/specs/2026-08-09-pipeline-map.md' });
  for (const r of p.references) Object.assign(r, { replace: [['docs/adr', 'docs/dictated-specs/decisions']], reviewed: true });
  return p;
}

test('--plan writes a skeleton listing every item, and changes nothing in the project', () => {
  const r = oldProject();
  try {
    const out = planFile();
    const res = intake(r.root, 'migrate', '--plan', out);
    assert.equal(res.code, 0, res.stderr + res.stdout);
    assert.equal(g(r.root, 'status', '--porcelain'), '');
    const p = JSON.parse(fs.readFileSync(out, 'utf8'));
    assert.deepEqual(p.notes.map((n) => [n.stamp, n.oldHome]), [[A, 'docs/dictated-specs/collision.md § A'], [B, 'docs/dictated-specs/collision.md § B']]);
    assert.deepEqual(p.unsettled.map((u) => u.heading), ['A — REVERSED 2026-09-09', 'C. never filed']);
    assert.deepEqual(p.adr.files, ['0001-x.md', 'README.md']);
    assert.deepEqual(p.superpowers.map((s) => [s.path, s.kind]), [
      ['docs/superpowers/specs/2026-06-21-hub-design.md', 'design'],
      ['docs/superpowers/specs/2026-08-09-pipeline-map.md', 'design'],
      ['docs/superpowers/plans/2026-06-21-hub.md', 'plan'],
    ]);
    assert.deepEqual(p.references.map((x) => [x.path, x.mentions]), [['scripts/adr_gate.py', ['docs/adr']]]);
    assert.match(res.stdout, /2 note\(s\), 2 unsettled heading\(s\), 2 ADR file\(s\), 3 superpowers file\(s\), 1 reference file\(s\)/);
  } finally { r.cleanup(); }
});

test('--apply migrates in two commits: notes from the inbox, ADRs moved intact, references fixed, old files removed; the gate passes', () => {
  const r = oldProject();
  try {
    const out = planFile();
    assert.equal(intake(r.root, 'migrate', '--plan', out).code, 0);
    fs.writeFileSync(out, JSON.stringify(fill(JSON.parse(fs.readFileSync(out, 'utf8')))));
    const res = intake(r.root, 'migrate', '--apply', out);
    assert.equal(res.code, 0, res.stderr + res.stdout);
    assert.equal(g(r.root, 'rev-list', '--count', 'HEAD~2..HEAD'), '2');
    assert.equal(g(r.root, 'status', '--porcelain'), '');
    assert.match(read(r.root, 'docs/dictated-specs/notes/2026-09-01T08-00-00Z.md'), /> SPEC: each object has its own extruder\n/);
    assert.doesNotMatch(read(r.root, 'docs/dictated-specs/notes/2026-09-01T08-00-00Z.md'), /reworded/);
    assert.equal(read(r.root, 'docs/dictated-specs/decisions/0001-x.md'), ADR);
    assert.ok(!fs.existsSync(path.join(r.root, 'docs/adr')));
    assert.equal(read(r.root, 'scripts/adr_gate.py'), 'ADR_DIR = "docs/dictated-specs/decisions"\n');
    assert.match(read(r.root, 'docs/superpowers/plans/2026-06-21-hub.md'), /^---\nkind: plan\nstatus: done\nticket: 3\n---\n/);
    assert.match(read(r.root, 'docs/superpowers/specs/2026-08-09-pipeline-map.md'), /^---\nkind: map\n---\n/);
    const page = read(r.root, 'docs/spec-current/extruders.md');
    assert.match(page, /SPEC: objects need not have their own extruder/);
    assert.doesNotMatch(page, /SPEC: each object has its own extruder/);
    assert.match(page, /one hub/);
    assert.doesNotMatch(page, /hub\.rs/);
    for (const f of g(r.root, 'ls-files').split('\n')) assert.doesNotMatch(read(r.root, f), /ASSISTANT, offered so it can be struck/, f);
    assert.ok(!fs.existsSync(path.join(r.root, 'docs/dictated-specs/collision.md')));
    assert.match(g(r.root, 'show', '--name-status', '--format=', 'HEAD'), /^D\tdocs\/dictated-specs\/collision\.md$/);
    assert.equal(unmigrated(r.root).any, false);
    assert.equal(gate(r.root).code, 0, gate(r.root).stdout);
  } finally { r.cleanup(); }
});

test('RED CHECK: --apply refuses an unfilled plan, lists every gap, and changes nothing', () => {
  const r = oldProject();
  try {
    const out = planFile();
    assert.equal(intake(r.root, 'migrate', '--plan', out).code, 0);
    const res = intake(r.root, 'migrate', '--apply', out);
    assert.equal(res.code, 1);
    assert.match(res.stderr, /note 2026-09-01T08:00:00Z: title, topic and subsystems are required/);
    assert.match(res.stderr, /unsettled docs\/dictated-specs\/collision\.md § C\. never filed: no resolution/);
    assert.match(res.stderr, /superpowers docs\/superpowers\/plans\/2026-06-21-hub\.md: status is required for a plan/);
    assert.match(res.stderr, /reference scripts\/adr_gate\.py: not reviewed/);
    assert.equal(g(r.root, 'status', '--porcelain'), '');
    assert.equal(g(r.root, 'rev-list', '--count', 'HEAD'), '2');
  } finally { r.cleanup(); }
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node --test plugins/machinery/test/slipbox-migrate.test.mjs`
Expected: FAIL — `usage: intake list …` (no `migrate` command).

- [ ] **Step 3: Write `scripts/lib/migrate-plan.mjs`**

```js
// Story: #132 § 11. The migration plan file: written by `migrate --plan`, filled by the AI,
// confirmed by the owner, read by `migrate --apply`. A file-writer exemption in
// test/gate-purity.test.mjs (it serialises to a FILE, never to the hook channel).
import fs from 'node:fs';

export function writePlan(file, plan) { fs.writeFileSync(file, JSON.stringify(plan, null, 2) + '\n', 'utf8'); }
export function readPlan(file) { return JSON.parse(fs.readFileSync(file, 'utf8')); }
```

- [ ] **Step 4: Write `scripts/lib/migrate.mjs`**

```js
// Story: #132 § 11 and Amendment 1. Migration of one project into the slip box: the AI proposes
// (the plan), the owner confirms, this applies. A dictation note's words come from the spec
// inbox, never from the old spec file (D11: assistant readings are not carried over).
import fs from 'node:fs';
import path from 'node:path';
import { git } from './git.mjs';
import { parseInbox, setDisposition } from './inbox.mjs';
import { slipboxPaths, stampToId, filedPath } from './layout.mjs';
import { setFrontmatter } from './frontmatter.mjs';
import { loadSlipbox, inForce } from './slipbox.mjs';
import { writeOnce, writeText, dictationNote, versionNote, placeEmbed, placeHeadingEmbed, placeLink, placeRef, syncGenerated } from './slipbox-write.mjs';
import { unmigrated } from './unmigrated.mjs';
import { commitPaths } from './commit.mjs';

const toPosix = (p) => p.split(path.sep).join('/');
const STATUSES = { design: ['draft', 'approved', 'historical'], plan: ['in-progress', 'done', 'abandoned', 'historical'], map: [null] };

function filedEntries(repo) {
  const p = slipboxPaths(repo);
  return fs.existsSync(p.specInbox) ? parseInbox(fs.readFileSync(p.specInbox, 'utf8')).filter((e) => e.state === 'FILED') : [];
}

export function buildPlan(repo) {
  const u = unmigrated(repo);
  const oldRel = u.oldSpecs.map((f) => `docs/dictated-specs/${f}`);
  const entries = filedEntries(repo).filter((e) => oldRel.includes(filedPath(e.disposition)));
  const homes = new Set(entries.map((e) => e.disposition.replace(/^filed\s*→\s*/, '').trim()));
  const unsettled = oldRel.flatMap((file) => fs.readFileSync(path.join(repo, file), 'utf8').split('\n')
    .map((l) => /^#{2,4} (.+?)\s*$/.exec(l)?.[1]).filter(Boolean)
    .filter((h) => !homes.has(`${file} § ${h}`))
    .map((heading) => ({ file, heading, resolution: null })));
  const needles = [...(u.adr ? ['docs/adr'] : []), ...oldRel];
  const skip = new Set([...oldRel, ...u.adrFiles.map((f) => `docs/adr/${f}`), '.claude/machinery/spec-inbox.md']);
  const references = [];
  if (needles.length) {
    const grep = git(['grep', '-l', '-F', ...needles.flatMap((n) => ['-e', n])], repo);
    for (const f of grep.stdout.split('\n').filter(Boolean).filter((f) => !skip.has(f))) {
      const text = fs.readFileSync(path.join(repo, f), 'utf8');
      references.push({ path: f, mentions: needles.filter((n) => text.includes(n)), replace: [], reviewed: false });
    }
  }
  return {
    version: 1,
    notes: entries.map((e) => ({ stamp: e.stamp, oldHome: e.disposition.replace(/^filed\s*→\s*/, '').trim(), preview: e.text.slice(0, 160), title: null, subsystems: [], topic: null, supersedes: [] })),
    versions: [],
    unsettled,
    adr: { files: u.adr ? fs.readdirSync(slipboxPaths(repo).adr).sort() : [] },
    superpowers: u.bare.map((p) => ({ path: p, kind: p.includes('/superpowers/plans/') ? 'plan' : 'design', status: null, subsystems: [], ticket: null, supersedes: [] })),
    embeds: [], decisionLinks: [], refs: [], references,
  };
}

export function planProblems(repo, plan) {
  const out = [];
  const u = unmigrated(repo);
  const planned = new Set(plan.superpowers.map((s) => s.path));
  for (const b of u.bare) if (!planned.has(b)) out.push(`superpowers ${b}: not in the plan — the plan is stale; run migrate --plan again`);
  const stamps = new Set(filedEntries(repo).map((e) => e.stamp));
  for (const n of plan.notes) {
    if (!stamps.has(n.stamp)) out.push(`note ${n.stamp}: no FILED spec-inbox entry`);
    if (!n.title || !n.topic || !n.subsystems?.length) out.push(`note ${n.stamp}: title, topic and subsystems are required`);
  }
  for (const v of plan.versions) if (!v.from || !v.supersedes || !v.topic || !v.text || !v.subsystems?.length) out.push(`version from ${v.from ?? '?'}: from, supersedes, subsystems, topic and text are required`);
  for (const x of plan.unsettled) if (!x.resolution) out.push(`unsettled ${x.file} § ${x.heading}: no resolution`);
  for (const s of plan.superpowers) {
    if (!STATUSES[s.kind]) out.push(`superpowers ${s.path}: kind must be design, plan or map`);
    else if (s.kind !== 'map' && !STATUSES[s.kind].includes(s.status)) out.push(`superpowers ${s.path}: status is required for a ${s.kind} (${STATUSES[s.kind].join(', ')})`);
    if (s.kind === 'design' && s.status === 'approved' && s.subsystems?.length && !plan.embeds.some((e) => s.path.endsWith(`/${e.note}.md`))) out.push(`superpowers ${s.path}: an approved design with subsystems needs a heading in "embeds"`);
  }
  for (const r of plan.references) if (!r.reviewed) out.push(`reference ${r.path}: not reviewed`);
  return out;
}

export function applyPlan(repo, plan) {
  const problems = planProblems(repo, plan);
  if (problems.length) throw new Error(`the plan is not ready:\n  ${problems.join('\n  ')}`);
  const p = slipboxPaths(repo);
  const u = unmigrated(repo);
  const touched = new Set();
  const note = (id) => path.join(p.notes, `${id}.md`);
  const byStamp = new Map(filedEntries(repo).map((e) => [e.stamp, e]));

  const notes = [...plan.notes].sort((a, b) => a.stamp.localeCompare(b.stamp));
  for (const n of notes) {
    const id = stampToId(n.stamp);
    writeOnce(note(id), dictationNote({ id, subsystems: n.subsystems, supersedes: n.supersedes ?? [], title: n.title, text: byStamp.get(n.stamp).text }));
    setDisposition(p.specInbox, n.stamp, { state: 'FILED', detail: `filed → ${toPosix(path.relative(repo, note(id)))}` });
    touched.add(note(id));
  }
  touched.add(p.specInbox);
  const topic = new Map(notes.map((n) => [stampToId(n.stamp), n.topic]));
  const counts = new Map();
  for (const v of plan.versions) {
    const from = stampToId(v.from);
    const k = (counts.get(from) ?? 0) + 1; counts.set(from, k);
    const id = `${from}-v${k > 1 ? k : ''}`;
    writeOnce(note(id), versionNote({ id, subsystems: v.subsystems, supersedes: v.supersedes, from, text: v.text }));
    topic.set(id, v.topic);
    touched.add(note(id));
  }

  if (u.adr) {
    fs.mkdirSync(p.decisions, { recursive: true });
    for (const f of fs.readdirSync(p.adr)) {
      const r = git(['mv', toPosix(path.relative(repo, path.join(p.adr, f))), toPosix(path.relative(repo, path.join(p.decisions, f)))], repo);
      if (r.code !== 0) throw new Error(`git mv docs/adr/${f} failed: ${r.stderr}`);
      touched.add(path.join(p.adr, f)); touched.add(path.join(p.decisions, f));
    }
    fs.rmSync(p.adr, { recursive: true, force: true });
  }

  for (const s of plan.superpowers) {
    const abs = path.join(repo, s.path);
    const fm = s.kind === 'map' ? { kind: 'map' } : {
      kind: s.kind, status: s.status,
      ...(s.subsystems?.length ? { subsystems: s.subsystems } : {}),
      ...(s.ticket ? { ticket: String(s.ticket) } : {}),
      ...(s.supersedes?.length ? { supersedes: s.supersedes } : {}),
    };
    writeText(abs, setFrontmatter(fs.readFileSync(abs, 'utf8'), fm));
    touched.add(abs);
  }

  for (const r of plan.references) {
    const abs = path.join(repo, r.path);
    let text = fs.readFileSync(abs, 'utf8');
    for (const [from, to] of r.replace) {
      if (!text.includes(from)) throw new Error(`reference ${r.path}: '${from}' not found`);
      text = text.replaceAll(from, to);
    }
    writeText(abs, text);
    touched.add(abs);
  }

  const box = loadSlipbox(repo);
  const live = inForce(box);
  const structure = (sub) => path.join(p.structure, `${sub}.md`);
  const cur = (sub) => (fs.existsSync(structure(sub)) ? fs.readFileSync(structure(sub), 'utf8') : null);
  for (const n of [...box.notes.values()].filter((x) => ['dictation', 'version'].includes(x.kind) && live.has(x.id)).sort((a, b) => a.id.localeCompare(b.id))) {
    for (const sub of n.subsystems) { writeText(structure(sub), placeEmbed(cur(sub), sub, { id: n.id, topic: topic.get(n.id) })); touched.add(structure(sub)); }
  }
  for (const e of plan.embeds) { writeText(structure(e.subsystem), placeHeadingEmbed(cur(e.subsystem), e.subsystem, { id: e.note, heading: e.heading, topic: e.topic })); touched.add(structure(e.subsystem)); }
  for (const d of plan.decisionLinks) { writeText(structure(d.subsystem), placeLink(cur(d.subsystem), d.subsystem, d.decision)); touched.add(structure(d.subsystem)); }
  for (const x of plan.refs) {
    const href = toPosix(path.relative(p.structure, path.join(repo, x.path)));
    writeText(structure(x.subsystem), placeRef(cur(x.subsystem), x.subsystem, path.basename(x.path), href));
    touched.add(structure(x.subsystem));
  }
  for (const g of syncGenerated(repo, loadSlipbox(repo))) touched.add(path.join(repo, g));

  const commit1 = commitPaths(repo, [...touched], 'slip box migration 1/2: notes from the spec inbox, decisions, superpowers front matter, structure notes (#132)');
  const old = u.oldSpecs.map((f) => path.join(p.specs, f));
  for (const f of old) fs.rmSync(f);
  const commit2 = commitPaths(repo, old, 'slip box migration 2/2: remove the old spec files; their dictations are notes now (#132)');
  return { commit1, commit2 };
}
```

- [ ] **Step 5: Wire `migrate` into `scripts/intake.mjs`**

Imports:

```js
import { buildPlan, applyPlan } from './lib/migrate.mjs';
import { writePlan, readPlan } from './lib/migrate-plan.mjs';
```

Command:

```js
// #132 § 11: the AI proposes (fills the plan), the owner confirms, --apply carries it out.
function migrate() {
  const repo = projectRoot(opt('--root') || process.cwd());
  if (!isRootSession(opt('--root') || process.cwd())) die(`a migration runs only from the root session: run it from ${repo}`);
  try {
    if (opt('--plan')) {
      const plan = buildPlan(repo);
      writePlan(opt('--plan'), plan);
      process.stdout.write(`wrote ${opt('--plan')}: ${plan.notes.length} note(s), ${plan.unsettled.length} unsettled heading(s), ${plan.adr.files.length} ADR file(s), ${plan.superpowers.length} superpowers file(s), ${plan.references.length} reference file(s). Fill every null, have the owner confirm it, then run intake migrate --apply ${opt('--plan')}\n`);
    } else if (opt('--apply')) {
      const r = applyPlan(repo, readPlan(opt('--apply')));
      process.stdout.write(`migrated in two commits: ${r.commit1.length} path(s), then ${r.commit2.length} old spec file(s) removed\n`);
    } else die('usage: intake migrate --plan <out.json> | --apply <plan.json>');
  } catch (e) { die(e.message); }
}
```

Dispatch:

```js
else if (cmd === 'migrate') migrate();
```

- [ ] **Step 6: Exempt the plan writer in `test/gate-purity.test.mjs`**

Append `path.join('lib', 'migrate-plan.mjs')` to the `SERIALISES_TO_A_FILE` array, and add `lib/migrate-plan.mjs the migration plan (#132)` to the comment above it.

- [ ] **Step 7: Run the suites**

Run: `node --test plugins/machinery/test/slipbox-migrate.test.mjs plugins/machinery/test/gate-purity.test.mjs plugins/machinery/test/slipbox-intake.test.mjs`
Expected: PASS.

- [ ] **Step 8: Bump and commit**

```bash
node plugins/machinery/scripts/bump.mjs --plugin plugins/machinery
git add plugins/machinery/scripts/lib/migrate-plan.mjs plugins/machinery/scripts/lib/migrate.mjs plugins/machinery/test/slipbox-migrate.test.mjs
git commit -m "intake migrate: the AI proposes a plan, the owner confirms, two commits apply it (#132 § 11, D10, D11, D13)

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>" -- plugins/machinery/scripts/lib/migrate-plan.mjs plugins/machinery/scripts/lib/migrate.mjs plugins/machinery/scripts/intake.mjs plugins/machinery/test/gate-purity.test.mjs plugins/machinery/test/slipbox-migrate.test.mjs plugins/machinery/.claude-plugin/plugin.json
```

---

### Task 11: The skill and the README, then the merge tier

**Files:**
- Modify: `claude-code/machinery/rule-process/SKILL.md` (the source; staged by the build)
- Regenerate: `plugins/machinery/skills/rule-process/SKILL.md` (`node scripts/build-skills.mjs build`)
- Modify: `plugins/machinery/README.md` (pre-commit bullet; "Where the rules live"; the filing paragraph)

**Interfaces:**
- Consumes: every command from Tasks 4, 7, 8 and 10, by the flags `intake.mjs` parses. `test/skills.test.mjs` fails on any flag the skill names that `intake.mjs` does not contain.

- [ ] **Step 1: Edit the skill's description** (front matter of `claude-code/machinery/rule-process/SKILL.md`)

```
description: Load the moment a PRULE:, URULE: or SPEC: prompt is captured (the capture hook says so), when a prompt starts with "N rules pending" or "N specifications pending", when a commit is refused for a pending inbox entry or by a slipbox_check leg, when filing an ADR, a design spec, a plan or a living map, and when the banner says the slip box is NOT MIGRATED. Files or dismisses each pending entry and commits. Replaces rule-intake and spec-intake.
```

- [ ] **Step 2: Replace the SPEC bullet in step 2**

Old:

```
   - SPEC (a specification to implement, not a rule or proposal): the file under `docs/dictated-specs/` that owns the subsystem, as a new section or an amendment to the owning one, keeping the dictated substance. Find its existing tickets; do not invent any.
```

New:

```
   - SPEC (a specification to implement, not a rule or proposal): one note in the slip box, filed by `intake.mjs spec` (§ Filing a SPEC). Find its existing tickets; do not invent any.
```

- [ ] **Step 3: Replace steps 3 and 4**

Old:

```
3. Write a project rule: `node "${CLAUDE_PLUGIN_ROOT}/scripts/place.mjs" --file <file> --section "<Heading>" --text "<wording>"`. Write a specification with Edit.
4. Commit a project filing and its disposition: `node "${CLAUDE_PLUGIN_ROOT}/scripts/intake.mjs" commit --kind project|spec --stamp <stamp> --home "<file> § <Heading>"`.
```

New:

```
3. Write a project rule: `node "${CLAUDE_PLUGIN_ROOT}/scripts/place.mjs" --file <file> --section "<Heading>" --text "<wording>"`. A specification is written only by `intake.mjs spec`, never with Edit.
4. Commit a project rule and its disposition: `node "${CLAUDE_PLUGIN_ROOT}/scripts/intake.mjs" commit --kind project --stamp <stamp> --home "<file> § <Heading>"`. A specification commits itself (§ Filing a SPEC).
```

- [ ] **Step 4: Append three sections at the end of the skill**

```
## Filing a SPEC
- A dictation is one note, written once from the inbox entry and never edited. Change is a new note.
1. Read `docs/dictated-specs/INDEX.md` and the flat pages in `docs/spec-current/`.
2. Choose the subsystems (existing, or a new one), the `##` topic, the in-force note it supersedes if any, and whether that change is full or partial.
3. Partial: write the superseded note's full text with the change applied to a scratchpad file. It becomes the version note, composed by you.
4. Run `node "${CLAUDE_PLUGIN_ROOT}/scripts/intake.mjs" spec --stamp <stamp> --subsystems <a,b> --topic "<topic>" --title "<short title>" [--supersedes <id>] [--version <file>]`. It writes the notes, updates the structure notes, regenerates, dispositions and commits with the full dictation in the message.
5. Show the owner the report: subsystems (new ones marked), topic, the change, and any version note in full.
6. Refused as not migrated: stop, and migrate the project first (§ Migrating a project).

## Decisions, designs, plans and maps
- A new ADR: `docs/dictated-specs/decisions/00NN-slug.md`, front matter `kind: decision`, `subsystems`, `rests_on` (the dictation notes behind it). Then `node "${CLAUDE_PLUGIN_ROOT}/scripts/intake.mjs" decision --file <path>`. To supersede: a new ADR, the old status line flipped to `Superseded by ADR-00NN`, then `decision --file` on the new one.
- A brainstorming spec, once written: `node "${CLAUDE_PLUGIN_ROOT}/scripts/intake.mjs" design --file <path> --subsystems <a,b> [--ticket <n>] [--supersedes <id>]`. On the owner's approval: `design --approve <path>`. Then, for each heading that records a decision, an owner constraint or a principle: `design --embed <path> --subsystem <s> --topic "<t>" --heading "<h>"`. Never an implementation heading such as "Files touched" or "Tests".
- A plan: `node "${CLAUDE_PLUGIN_ROOT}/scripts/intake.mjs" plan --file <path> --ticket <n>`; when finished, `plan --file <path> --status done|abandoned`.
- A living map stays outside the slip box: `node "${CLAUDE_PLUGIN_ROOT}/scripts/intake.mjs" map --file <path>` once, and link it with `ref --subsystem <s> --path <path>`. Never embed it.
- A stale generated page: `node "${CLAUDE_PLUGIN_ROOT}/scripts/intake.mjs" regen`. Never edit `INDEX.md`, `docs/spec-current/` or a structure note by hand.

## Migrating a project
1. From the root session: `node "${CLAUDE_PLUGIN_ROOT}/scripts/intake.mjs" migrate --plan <scratchpad>/plan.json`.
2. Fill every `null` and empty list: note titles, subsystems and topics; `supersedes` from the old REVERSED and SUPERSEDED marks; `versions` for partial changes; a resolution for each unsettled heading; each superpowers file's kind and status (only what the owner ratified is `approved`, the rest `historical`); design `embeds`; `decisionLinks`; `refs` for living maps; each reference's `replace` pairs with `reviewed: true`.
3. Show the owner the plan. Apply it only on their confirmation.
4. `node "${CLAUDE_PLUGIN_ROOT}/scripts/intake.mjs" migrate --apply <plan>`. It makes two commits.
```

- [ ] **Step 5: Stage the skill and update the README**

Run: `node scripts/build-skills.mjs build`
Expected: `plugins/machinery/skills/rule-process/SKILL.md` now equals the bucket.

In `plugins/machinery/README.md`:
- In the **pre-commit** bullet, after "a filed spec outside `docs/dictated-specs/` refuses it,", insert: "the slip box check refuses an edited note, an edited ADR beyond its status line, a changed approved design or finished plan, a new superpowers file without front matter, a dictation note that no longer quotes its inbox entry, a structure note that embeds a superseded note or misses an in-force one, a broken link, a stale generated page, and a note with two successors,".
- Replace the `docs/dictated-specs/` bullet under "Where the rules live" with:

```
- `docs/dictated-specs/` — the slip box: `notes/` (one file per dictation, and
  version notes), `decisions/` (ADRs), `structure/` (one current-state page per
  subsystem) and a generated `INDEX.md`. `docs/spec-current/` holds the
  generated flat pages. Superpowers specs and plans stay in `docs/superpowers/`
  with front matter. `docs/` is outside `.claude/`, so nothing loads these into
  a session; read the flat page.
```

- In the filing paragraph, replace "and a `SPEC:` into the specification under `docs/dictated-specs/` that owns the subsystem, each landed in one commit." with "each landed in one commit; a `SPEC:` becomes one note filed by `intake.mjs spec`, which also commits."

- [ ] **Step 6: Run the merge tier**

Run: `node scripts/test-tier.mjs merge`
Expected: the build check passes, then every suite passes.

- [ ] **Step 7: Bump and commit**

```bash
node plugins/machinery/scripts/bump.mjs --plugin plugins/machinery
git commit -m "rule-process: file a SPEC, an ADR, a design, a plan and a map into the slip box, and migrate a project (#132)

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>" -- claude-code/machinery/rule-process/SKILL.md plugins/machinery/skills/rule-process/SKILL.md plugins/machinery/README.md plugins/machinery/.claude-plugin/plugin.json
```

---

## After this plan

- Merge needs the owner's approval (`reviewBeforeMain: person`).
- After merge, this repository's own banner will read NOT MIGRATED (its `docs/superpowers/` files have no front matter). Its migration is the first run of Task 10, with the owner confirming the plan.
- ferrislicer and every other repository migrate the same way when a session opens there (D13).

## Glossary

- **base** — the side leg 1 compares against. It decides which edits count as edits.
- **consumed** — named in a version note's `from`. It keeps a dictation out of the current state once a version note carries it.
- **denominator** — the "N of M" each gate leg prints. It shows a pass covered every file.
- **embed** — `![[id]]`, or `![[id#Heading]]`. Filing places them; `flatten` expands them.
- **fork** — one note superseded by two. Leg 6 refuses it.
- **front matter** — the `---` block the slip box reads. Every gate leg keys on its fields.
- **in force** — not superseded and not consumed. It decides membership.
- **living map** — a hand-kept document about the code as built. It is only linked (D12).
- **membership** — which notes a structure note must embed. Leg 3 checks it.
- **slip box** — the notes, decisions, structure notes and filed superpowers files. The scope of every leg.
- **stamp** — an inbox entry's capture time. It is a dictation note's id, with `:` swapped for `-`.
- **structure note** — one subsystem's page of embeds. Its flat copy is the current state.
- **supersede** — replace a note by naming it in a new note's `supersedes`. The old file is never edited.
- **version note** — a changed note's full text with the change applied. It carries a partial change.
