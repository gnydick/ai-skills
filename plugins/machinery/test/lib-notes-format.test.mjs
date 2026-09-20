// plugins/machinery/test/lib-notes-format.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { parseFrontmatter, renderFrontmatter, setFrontmatter } from '../scripts/lib/frontmatter.mjs';
import { quote, unquote } from '../scripts/lib/blockquote.mjs';
import { stampToId, idToStamp, slipboxPaths, ownerId, fileNameProblem } from '../scripts/lib/layout.mjs';

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
  for (const bad of ['two\nlines', ' pad', '[x]']) assert.throws(() => renderFrontmatter({ k: bad }), /cannot be written/, bad);
  // A comma is what SEPARATES a list's elements, so an element holding one would read back as two.
  assert.throws(() => renderFrontmatter({ k: ['a, b'] }), /cannot be written/);
});

// Fix wave 4, measured on ferrislicer: one of the twelve owner rulings to carry is
// `§ D. Storage, persistence and GUI recovery — folds into #966/#967`. Its `source` threw inside
// applyChanges, after notes were already on disk. A `#` is only a comment in YAML, and this shape
// is explicitly not YAML: parseFrontmatter no longer strips one, so it round-trips like any other
// character — which is the only property renderFrontmatter is entitled to refuse for.
test('RED CHECK: a value holding # round-trips byte for byte, inside a heading and on its own', () => {
  const D = 'docs/dictated-specs/by-object-collision-model.md § D. Storage, persistence and GUI recovery — folds into #966/#967';
  for (const v of [D, 'x#y', '#966', 'a # b', 'trailing #']) {
    const text = renderFrontmatter({ id: 'owner-d', source: v }) + '# T\n';
    assert.equal(text, `---\nid: owner-d\nsource: ${v}\n---\n# T\n`, v);
    assert.equal(parseFrontmatter(text).data.source, v, v);
  }
  // A list element keeps its own rule: a comma would read back as two elements, a # would not.
  assert.deepEqual(parseFrontmatter(renderFrontmatter({ subsystems: ['a#1', 'b'] })).data.subsystems, ['a#1', 'b']);
});

// A whole line that is a comment is still skipped. Dropping THAT would make a hand-written file
// carrying one unreadable, and gate leg 2a refuses a slip box file whose front matter cannot be
// read — so the cost of keeping it is nothing (a `key:` line never starts with `#`) and the cost
// of removing it is a project that cannot commit.
test('RED CHECK: a whole-line comment is skipped, and a value is never truncated at a #', () => {
  const { data } = parseFrontmatter('---\n# a note to the reader\nid: a\nsource: x § folds into #966/#967\n---\nbody\n');
  assert.deepEqual(data, { id: 'a', source: 'x § folds into #966/#967' });
});

// An owner note's `source` is `<file> § <heading>`, and the owner's own headings hold commas
// ("§ 7. Four rulings (Gabe, 2026-09-07, later the same day)"). A comma in a SCALAR reads back
// byte for byte — only a bracketed value is read as a list — so refusing it blocked a real value
// for no reason the round trip can point at.
test('RED CHECK: a scalar value holding commas round-trips byte for byte', () => {
  const source = 'docs/dictated-specs/by-object-collision-model.md § 7. Four rulings (Gabe, 2026-09-07, later)';
  const text = renderFrontmatter({ id: 'owner-x', kind: 'owner', source }) + '# T\n';
  assert.equal(text, `---\nid: owner-x\nkind: owner\nsource: ${source}\n---\n# T\n`);
  assert.equal(parseFrontmatter(text).data.source, source);
});

test('a value ending in --- keeps every key in the block and leaves the body untouched', () => {
  const { data, body } = parseFrontmatter(renderFrontmatter({ title: 'pros---', id: 'a' }) + '# B\n');
  assert.deepEqual(data, { title: 'pros---', id: 'a' });
  assert.equal(body, '# B\n');
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

// #132, owner 2026-09-19 ("Carry them as owner notes"). An owner note has no capture stamp, so its
// id comes from the heading it was transcribed from. `owner-` puts it in a space a stamp id can
// never reach (a stamp id starts with a digit), and the slug is a legal file name by construction.
test('RED CHECK: an owner note id is derived from its source heading and is a legal file name', () => {
  assert.equal(ownerId('8.A — nozzle_height leaves ClearanceParams'), 'owner-8-a-nozzle-height-leaves-clearanceparams');
  assert.equal(ownerId('7. Four rulings (Gabe, 2026-09-07, later the same day)'), 'owner-7-four-rulings-gabe-2026-09-07-later-the-same-day');
  assert.equal(fileNameProblem(ownerId('8.A — x'), 'note id'), null);
  assert.match(fileNameProblem('a/b', 'note id'), /^note id 'a\/b': a note id is one path segment/);
  // Nothing of the heading survives slugification: there is no id to write, and it is refused.
  assert.equal(ownerId('— —'), null);
  assert.equal(ownerId(''), null);
});

test('RED CHECK: unquote and parseFrontmatter refuse what they cannot read', () => {
  assert.throws(() => unquote('> a\nplain'), /not a block quote line/);
  assert.throws(() => parseFrontmatter('---\n: nokey\n---\n'), /cannot read line/);
});
