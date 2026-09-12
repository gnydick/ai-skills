// Tests for scripts/pair-census.mjs — the ticket-pair census (#97).
//
// Every case runs against a FIXTURE list of issue nodes shaped exactly like the
// GraphQL query's `repository.issues.nodes`, never the live tracker. That is a
// hard requirement, not a convenience: this suite runs on the pre-commit hook
// (`node --test 'scripts/test/*.test.mjs'`) and the gate's 20-second budget is
// why the census itself was ruled a CI leg rather than a gate leg (Gabe,
// 2026-09-11, "graphql query plus CI"). A network call from here would put back
// exactly what that ruling kept out.
//
// The positive control is the point of the file, not a nicety: a census that has
// quietly stopped matching `Context: #N` looks exactly like a tracker that
// complies (rules/verification-and-evidence.md), so the cases below feed the
// detector a deliberately unlinked companion and a deliberately wrong-parent one
// and require it to name both, separately.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  COMPANION_TITLE, census, proofLine, reportLines, CensusUnavailable, QUERY,
} from '../pair-census.mjs';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SCRIPT = path.join(REPO, 'scripts', 'pair-census.mjs');

// The count line this file owes its own output (rules/tool-output.md § Proof
// lines and denominators): node --test's `# pass N` summary is not the declared
// proof format, so it gets compressed away and a pass for a bad reason — an
// empty file, a suite that registered nothing — looks exactly like a pass.
let registered = 0, passed = 0;
const check = (name, fn) => { registered++; test(name, async (t) => { await fn(t); passed++; }); };
after(() => console.log(`pair_census_tests: ${passed} of ${registered} test(s) passed`));

const ticket = (n) => ({ number: n, title: `A work ticket #${n}`, state: 'OPEN', parent: null });
const companion = (n, ticketNumber, parentNumber) => ({
  number: n, title: `Context: #${ticketNumber}`, state: 'OPEN',
  parent: parentNumber === null ? null : { number: parentNumber },
});

// One fixture shape for the whole file: four pairs, of which the caller decides
// how many are broken. Built from the same two constructors the good case uses,
// so a broken fixture differs from a clean one in exactly the link and nothing
// else.
const LINKED_ONLY = [
  ticket(5), companion(6, 5, 5),
  ticket(7), companion(8, 7, 7),
  ticket(9), companion(10, 9, 9),
  ticket(11), companion(12, 11, 11),
];

check('an all-linked tracker reports zero offenders against its real denominator', () => {
  const result = census(LINKED_ONLY);
  assert.equal(result.companions.length, 4);
  assert.equal(result.offenders.length, 0);
  assert.equal(result.unlinked.length, 0);
  assert.equal(result.wrongParent.length, 0);
});

check('the proof line carries the count and its denominator in the declared shape', () => {
  assert.equal(
    proofLine(census(LINKED_ONLY)),
    'pair_census: 0 of 4 companion(s) unlinked or attached to the wrong ticket',
  );
});

// POSITIVE CONTROL on the detector: a companion with no parent at all is the
// exact defect measured on 2026-09-10 (12 of 46). If this case ever passes
// silently the census has stopped being a census.
check('positive control: a companion with no parent is named as unlinked', () => {
  const nodes = [...LINKED_ONLY, ticket(13), companion(14, 13, null)];
  const result = census(nodes);
  assert.equal(result.companions.length, 5);
  assert.equal(result.unlinked.length, 1);
  assert.equal(result.unlinked[0].companion, 14);
  assert.equal(result.unlinked[0].ticket, 13);
  assert.equal(result.offenders.length, 1);
  assert.equal(proofLine(result), 'pair_census: 1 of 5 companion(s) unlinked or attached to the wrong ticket');
});

// POSITIVE CONTROL on the other defect: attached, but to somebody else's ticket.
// Measured at 0 on 2026-09-10, which is precisely why it needs a control — a
// detector for a defect nobody has seen fail is a detector nobody has seen work.
check('positive control: a companion parented to the wrong ticket is named as wrong-parent', () => {
  const nodes = [...LINKED_ONLY, ticket(13), companion(14, 13, 11)];
  const result = census(nodes);
  assert.equal(result.unlinked.length, 0);
  assert.equal(result.wrongParent.length, 1);
  assert.deepEqual(result.wrongParent[0], { companion: 14, ticket: 13, parent: 11 });
  assert.equal(proofLine(result), 'pair_census: 1 of 5 companion(s) unlinked or attached to the wrong ticket');
});

// The two are different defects — one pair was never bound, the other is bound to
// the wrong thing — and collapsing them into one message would send whoever reads
// the failure looking for the wrong repair.
check('the two defects are reported as two distinct messages, never collapsed', () => {
  const nodes = [
    ...LINKED_ONLY,
    ticket(13), companion(14, 13, null),
    ticket(15), companion(16, 15, 11),
  ];
  const lines = reportLines(census(nodes));
  const unlinkedLine = lines.find((l) => l.includes('#14'));
  const wrongLine = lines.find((l) => l.includes('#16'));
  assert.ok(unlinkedLine, 'the unlinked companion is named');
  assert.ok(wrongLine, 'the wrong-parent companion is named');
  assert.notEqual(unlinkedLine, wrongLine);
  assert.match(unlinkedLine, /no sub-issue parent/);
  assert.match(wrongLine, /parent is #11, expected #15/);
});

// POSITIVE CONTROL on the title matcher itself. The census can only see what this
// regex admits, so a matcher that has drifted returns a smaller denominator and a
// clean bill of health at the same time.
check('positive control: the title matcher admits Context: #N and nothing adjacent to it', () => {
  assert.equal('Context: #97'.match(COMPANION_TITLE)[1], '97');
  assert.equal('Context: #5'.match(COMPANION_TITLE)[1], '5');
  for (const title of [
    'Context: #97 — pickup',   // trailing text: not the pair shape
    'Contexts: #97',
    'context: #97',            // case matters; the convention is capitalised
    'Context #97',             // no colon
    'Context: 97',             // no hash
    'Re: Context: #97',
    'Context: #',
  ]) assert.equal(COMPANION_TITLE.exec(title), null, `must not match: ${title}`);
});

check('a non-companion issue never enters the denominator', () => {
  const result = census([...LINKED_ONLY, { number: 99, title: 'Context for the reader', state: 'OPEN', parent: null }]);
  assert.equal(result.companions.length, 4);
  assert.equal(result.offenders.length, 0);
});

// A closed companion is still a pair. Six of the 12 found on 2026-09-10 were
// closed, so a census restricted to open issues would have seen half the defect.
check('closed companions are counted, not skipped', () => {
  const shut = { ...companion(14, 13, null), state: 'CLOSED' };
  const result = census([...LINKED_ONLY, { ...ticket(13), state: 'CLOSED' }, shut]);
  assert.equal(result.companions.length, 5);
  assert.equal(result.unlinked.length, 1);
});

// The whole defect being fixed is invisibility, so the two ways this check could
// pass while blind must be failures with names, never a quiet zero.
check('an empty issue list fails loudly rather than reporting a clean zero', () => {
  assert.throws(() => census([]), (e) => e instanceof CensusUnavailable && /returned 0 issue/.test(e.message));
});

check('issues present but no companion matched fails loudly rather than reporting a clean zero', () => {
  assert.throws(
    () => census([ticket(5), ticket(7), ticket(9)]),
    (e) => e instanceof CensusUnavailable && /matched no .Context: #N. companion/.test(e.message),
  );
});

check('the report says what the census cannot see', () => {
  const lines = reportLines(census(LINKED_ONLY)).join('\n');
  assert.match(lines, /not titled `Context: #N`/);
  assert.match(lines, /no companion at all/);
  assert.match(lines, /any link other than the sub-issue link/);
});

// The query is the whole mechanism: one request per page for every pair, rather
// than the by-hand sweep's one REST call per companion (Gabe, 2026-09-11).
check('the query asks for both issue states, the parent link, and a page cursor', () => {
  assert.match(QUERY, /states:\s*\[OPEN,\s*CLOSED\]/);
  assert.match(QUERY, /parent\s*\{\s*number\s*\}/);
  assert.match(QUERY, /pageInfo\s*\{\s*hasNextPage\s+endCursor\s*\}/);
  assert.match(QUERY, /after:\s*\$cursor/);
});

// Runs the real CLI with the token stripped: it must name what it could not find
// and exit non-zero, because a check that cannot run must never look like one
// that passed (rules/environment-and-platform.md § Resolving a tool).
check('the CLI with no token fails loudly, naming the variables it looked for', () => {
  const env = { ...process.env };
  delete env.GITHUB_TOKEN;
  delete env.GH_TOKEN;
  const run = spawnSync(process.execPath, [SCRIPT, '--repo', 'gnydick/ai-skills'], { env, encoding: 'utf8' });
  assert.notEqual(run.status, 0, 'a census that cannot authenticate must not exit 0');
  assert.match(run.stderr, /GITHUB_TOKEN/);
  assert.match(run.stderr, /GH_TOKEN/);
  assert.doesNotMatch(run.stdout, /pair_census: 0 of 0/, 'it must not print a clean-looking zero');
});

check('the CLI with no repository fails loudly, naming where it looked', () => {
  const env = { ...process.env, GITHUB_TOKEN: 'not-a-real-token' };
  delete env.GITHUB_REPOSITORY;
  const run = spawnSync(process.execPath, [SCRIPT], { env, encoding: 'utf8' });
  assert.notEqual(run.status, 0);
  assert.match(run.stderr, /GITHUB_REPOSITORY/);
  assert.match(run.stderr, /--repo/);
});

// Ticket #97 required behaviour 3: the census prints linked, unlinked and
// wrong-parent counts against the total, not only the offender count. The
// headline proof line above carries the number that decides pass or fail; this
// second line carries the breakdown, so a reader sees which of the two repairs
// is owed without counting the lines underneath.
check('the report also states linked, unlinked and wrong-parent counts against the total', () => {
  const nodes = [
    ...LINKED_ONLY,
    ticket(13), companion(14, 13, null),
    ticket(15), companion(16, 15, null),
    ticket(17), companion(18, 17, 11),
  ];
  const lines = reportLines(census(nodes));
  assert.equal(
    lines[1],
    'pair_census: 4 of 7 companion(s) correctly linked; 2 unlinked, 1 attached to the wrong ticket',
  );
});

check('the breakdown line is printed on a clean tracker too, not only on failure', () => {
  const lines = reportLines(census(LINKED_ONLY));
  assert.equal(
    lines[1],
    'pair_census: 4 of 4 companion(s) correctly linked; 0 unlinked, 0 attached to the wrong ticket',
  );
});
