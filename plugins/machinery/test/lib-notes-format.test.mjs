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
