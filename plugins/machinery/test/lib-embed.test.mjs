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
  assert.equal(out, '# S\n\n## T\n\n*Source: a · dictation*\n\n# A\n\n> alpha\n\n*Source: d · design*\n\n## Decisions\n\n- pick x\n\n### Detail\n\n- sub\n');
  assert.doesNotMatch(out, /Files touched/);
});

test('an expanded embed is set off by one blank line before and after, never two', () => {
  assert.equal(flatten('text\n![[a]]\nmore', resolve), 'text\n\n*Source: a · dictation*\n\n# A\n\n> alpha\n\nmore');
  assert.equal(flatten('text\n\n![[a]]\n\nmore', resolve), 'text\n\n*Source: a · dictation*\n\n# A\n\n> alpha\n\nmore');
  assert.equal(flatten('![[a]]\n![[a]]', resolve), '*Source: a · dictation*\n\n# A\n\n> alpha\n\n*Source: a · dictation*\n\n# A\n\n> alpha');
});

test('a wiki link inside inline code is text, left as is', () => {
  const t = '> use `[[id]]` to link, or ``![[x]]`` and `{ } [[ ]] (( ))`';
  assert.deepEqual(links(t), []);
  assert.equal(flatten(t, resolve), t);
  assert.equal(flatten('`[[nope]]` then [[a]]', resolve), '`[[nope]]` then [A](../n/a.md)');
});

test('an inline code span that runs across lines of one paragraph is text too', () => {
  const t = '  lead (`if then\n  coproc !` and `{ } [[ ]] (( ))`), no `x\n![[nope]]\n[[nope]]` end';
  assert.deepEqual(links(t), []);
  assert.equal(flatten(t, resolve), t);
  assert.equal(flatten('open `x\n\n[[a]] `', resolve), 'open `x\n\n[A](../n/a.md) `');
});

test('a wiki link inside a fenced code block is text, left as is', () => {
  const t = 'x\n\n```md\n![[id#Heading]]\n[[id]]\n```\n\n~~~~\n![[nope]]\n~~~\n```\n~~~~\n';
  assert.deepEqual(links(t), []);
  assert.equal(flatten(t, resolve), t);
});

test('a section holding a fenced # comment is returned whole', () => {
  const body = '# D\n\n## Decisions\n\n- pick x\n\n```bash\n# install it\nnpm i\n```\n\n- more\n\n## Next\n\nn\n';
  assert.equal(section(body, 'Decisions'), '## Decisions\n\n- pick x\n\n```bash\n# install it\nnpm i\n```\n\n- more');
  assert.equal(section('```\n# Inside\n```\n', 'Inside'), null);
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
