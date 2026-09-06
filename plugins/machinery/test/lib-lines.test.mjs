import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { PLUGIN } from './helpers/run.mjs';
import { lineSplitter } from '../scripts/lib/lines.mjs';

// #19 fix round 1: the chunk-to-lines rule (split on '\n', pop the unterminated remainder,
// carry it into the next chunk, decode multi-byte characters across the boundary) was typed
// twice — lib/capture.mjs and lib/git.mjs — and rules/design-invariants.md § Never re-derive a
// fact says a second derivation will eventually disagree. lib/lines.mjs is its one home; both
// import it. The scan below is what keeps a third copy from appearing, and its positive control
// is lines.mjs itself, so a scan that stopped matching cannot pass as a codebase that complies.

const SAMPLE = 'x§é✓😀y'; // 1-, 2-, 2-, 3- and 4-byte characters, then a 1-byte tail

test('a line and a multi-byte character split across a chunk boundary come through intact, at every possible cut', () => {
  const buf = Buffer.from(`${SAMPLE}\n${SAMPLE}\nz`, 'utf8');
  assert.ok(buf.length > SAMPLE.length * 2, 'the sample really is multi-byte, or the cut can never fall inside a character');
  for (let cut = 1; cut < buf.length; cut += 1) {
    const s = lineSplitter();
    const lines = [...s.push(buf.subarray(0, cut)), ...s.push(buf.subarray(cut))];
    const rest = s.end();
    assert.deepEqual(lines, [SAMPLE, SAMPLE], `cut at byte ${cut}`);
    assert.equal(rest, 'z', `cut at byte ${cut}`);
  }
});

test('a text ending on a newline leaves no phantom empty line; end() returns the unterminated tail once', () => {
  const s = lineSplitter();
  assert.deepEqual(s.push(Buffer.from('a\n\nb\n')), ['a', '', 'b']);
  assert.equal(s.end(), '');
  const t = lineSplitter();
  assert.deepEqual(t.push(Buffer.from('a')), []);
  assert.deepEqual(t.push(Buffer.from('b\nc')), ['ab']);
  assert.equal(t.end(), 'c');
  assert.equal(t.end(), '', 'end() hands the tail over once');
});

// The carry rule's own spelling: split on '\n' with the remainder popped off within a few
// characters, anywhere under scripts/lib.
//
// The check is purely SYNTACTIC and excludes nothing — final review M4, which corrected a comment
// here claiming it exempted a one-off split of a finished blob. It does not: it matches that shape
// too, because no pattern over source text can see the thing that actually separates the two,
// namely whether the popped remainder is carried on state into the next chunk. Narrowing it to look
// for the carry would be a guess that goes stale silently, which is the exact failure the RED CHECK
// below exists to catch. So the rule this really enforces is the stronger, checkable one: inside
// scripts/lib, only lines.mjs writes that shape AT ALL. A file with a genuine one-off blob split
// writes it another way — lib/runlog.mjs drops the trailing empty entry with `.slice(0, -1)` and
// says at the site why it is not the carry rule — and that cost is the price of a check that cannot
// quietly stop meaning what it says.
const CARRY_RULE = /split\('\\n'\)[\s\S]{0,80}\.pop\(\)/;
const libFiles = () => fs.readdirSync(path.join(PLUGIN, 'scripts', 'lib')).filter((f) => f.endsWith('.mjs'));

test('the stream line-splitting rule is spelled once, in lib/lines.mjs (rules/design-invariants.md § Never re-derive a fact)', () => {
  const owners = libFiles().filter((f) => CARRY_RULE.test(fs.readFileSync(path.join(PLUGIN, 'scripts', 'lib', f), 'utf8')));
  assert.deepEqual(owners, ['lines.mjs'], `files spelling the carry rule: ${owners.join(', ')}`);
});

test('RED CHECK: the scan sees the rule where it lives, so a scan that quietly stopped matching cannot read as compliance', () => {
  assert.match(fs.readFileSync(path.join(PLUGIN, 'scripts', 'lib', 'lines.mjs'), 'utf8'), CARRY_RULE);
  assert.ok(libFiles().length >= 5, 'the scan saw the lib directory');
});
