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
