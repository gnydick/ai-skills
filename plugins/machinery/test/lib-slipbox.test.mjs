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
