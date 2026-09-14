import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { PLUGIN } from './helpers/run.mjs';
import { GLOBAL_ISSUE_TRACKING, PROJECT_ISSUE_TRACKING, UNANSWERED, NONE } from '../scripts/lib/layout.mjs';

// Issue tracking configuration, test 9 (docs/superpowers/specs/2026-09-12-issue-tracking-config-design.md).
// Two spellings of a file name is how the installer seeds one path and the function reads another;
// two spellings of a state word is the same failure, silent instead of loud — a machine where the
// prompt quietly stopped firing looks exactly like one where everything was answered.
// A shared name is spelled once as one shared definition, and a check built on searching always
// ships a case proving it still matches.

test('the names and the state words are the owner\'s, verbatim, and the two states are different words', () => {
  assert.equal(GLOBAL_ISSUE_TRACKING, 'global_issue_tracking.md');
  assert.equal(PROJECT_ISSUE_TRACKING, 'project_issue_tracking.md');
  assert.equal(UNANSWERED, 'unanswered');
  assert.equal(NONE, 'none');
  assert.notEqual(UNANSWERED, NONE);
});

const SPELLING = /(['"`])(?:unanswered|none)(?:\\[nrt])*\1|global_issue_tracking|project_issue_tracking/;

const walk = (d) => fs.readdirSync(d, { withFileTypes: true })
  .flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
const spellers = (dir) => walk(dir)
  .filter((f) => f.endsWith('.mjs') && SPELLING.test(fs.readFileSync(f, 'utf8')))
  .map((f) => path.relative(dir, f).split(path.sep).join('/'))
  .sort();

test('only lib/layout.mjs under scripts/ spells a state word or an issue-tracking file name — this scan cannot see a state word inside a longer string, a word or name assembled by concatenation, or anything outside scripts/', () => {
  assert.deepEqual(spellers(path.join(PLUGIN, 'scripts')), ['lib/layout.mjs']);
});

const SEEN = [
  ["fs.writeFileSync(f, 'unanswered\\n');", 'the seed written at a call site'],
  ['if (text === "unanswered") {}', 'a double-quoted comparison'],
  ['if (text === `none`) {}', 'a template literal'],
  ["const DECLINED_WORD = 'none';", 'the answered-negative word stored under another name'],
  ['// the file then says `unanswered`', 'a backtick-quoted word in a comment'],
  ["path.join(home, '.claude', 'rules', 'global_issue_tracking.md')", 'the global file name at a call site'],
  ['// seeds project_issue_tracking.md', 'the project file name in a comment'],
];

test('RED CHECK: the sole-spelling scan sees every way a second spelling has plausibly been written', () => {
  for (const [src, how] of SEEN) assert.match(src, SPELLING, how);
});

test('the scan does not flag the unrelated uses measured in this repository, or the constants themselves', () => {
  for (const clean of [
    "say('hosted check: none (the local merge gate is the sole blocking backstop)');",
    'export function none() { return null; }',
    'const label = `${UNANSWERED}`;',
    'if (text === NONE) return DECLINED;',
  ]) assert.doesNotMatch(clean, SPELLING, `false positive: ${clean}`);
});

// The title above names what the scan cannot see. Each is pinned unseen here, so a widening that
// starts catching one fails, and the title is corrected in the same change.
test('each blind spot named in the scan title is measured unseen', () => {
  for (const [src, how] of [
    ["if (text.includes('the file says unanswered')) {}", 'a state word inside a longer string'],
    ["const w = 'unans' + 'wered';", 'a word assembled by concatenation'],
    ["const f = 'project_' + 'issue_tracking.md';", 'a name assembled by concatenation'],
  ]) assert.doesNotMatch(src, SPELLING, `${how} is now SEEN — correct the scan title`);
});
