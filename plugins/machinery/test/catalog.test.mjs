import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { PLUGIN } from './helpers/run.mjs';
import { loadCatalog, loadCatalogReport, matchTool, matchedCandidate } from '../scripts/lib/catalog.mjs';
import { classify } from '../scripts/lib/classify.mjs';
import { select } from '../scripts/lib/filter.mjs';
import { bury, survivalProblems } from '../scripts/lib/survival.mjs';

// loadCatalog reads the universal half through pluginRoot(); pin it at this checkout so the suite
// can never read an installed copy of the plugin instead (lib-config.test.mjs convention).
process.env.CLAUDE_PLUGIN_ROOT = PLUGIN;

const CATALOG_FILE = path.join(PLUGIN, 'data', 'tool-catalog.json');
const FIXTURES = path.join(PLUGIN, 'test', 'fixtures', 'tool-catalog');
const readCatalog = () => JSON.parse(fs.readFileSync(CATALOG_FILE, 'utf8'));
const readFixture = (id) => JSON.parse(fs.readFileSync(path.join(FIXTURES, `${id}.json`), 'utf8'));
const fixtureLines = (id) => readFixture(id).lines;

// Verification 7's per-entry contract lives in scripts/lib/survival.mjs, because promote-tool.mjs
// enforces the same contract at the gate where a project entry crosses into this catalog. One
// derivation, two callers — a second copy here would eventually disagree with the gate, and the
// disagreement would arrive as a red suite nobody could attribute. bury() comes from there too.
function assertOutcomeSurvives(id, entry, fixture) {
  const problems = survivalProblems(id, entry, fixture);
  assert.equal(problems.length, 0, problems.join('\n'));
}

test('matchTool recognises a real invocation by regex and by prefix, and declines unrelated commands', () => {
  const catalog = loadCatalog(PLUGIN);
  assert.equal(matchTool('git commit -m "x"', catalog), 'git-commit');
  assert.equal(matchTool('npm ci --no-audit', catalog), 'npm-install');
  assert.equal(matchTool('npm install foo', catalog), 'npm-install');
  assert.equal(matchTool('pytest tests/ -k foo', catalog), 'pytest');
  assert.equal(matchTool('ls -la', catalog), null);
  assert.equal(matchTool('git commitizen', catalog), null, 'the word boundary must not admit a longer subcommand');
  assert.equal(matchTool('echo git commit', catalog), null, 'the pattern is anchored: a mention is not an invocation');
  assert.equal(matchTool('npm run build', catalog), null);
});

test('matchedCandidate finds a flag already present in the command', () => {
  assert.equal(matchedCandidate('git commit --quiet -m x', ['--quiet']), '--quiet');
  assert.equal(matchedCandidate('git commit -m x', ['--quiet']), null);
  assert.equal(matchedCandidate('pytest -q tests/', ['-q']), '-q');
  assert.equal(matchedCandidate('pytest tests/', []), null, 'an empty candidate list is a clean null, not a crash');
});

// Final review I3, measured: substring matching found `-q` inside `tests/api-quota/` and `--quiet`
// inside a commit message, and the runner then WROTE a ledger verdict for a flag that was never on
// the command. A candidate is a whole argv token, never a substring of one — and a quoted argument
// is one token, whatever it contains.
test('matchedCandidate matches whole tokens only (final review I3)', () => {
  assert.equal(matchedCandidate('pytest tests/api-quota/', ['-q']), null);
  assert.equal(matchedCandidate('git commit -m "do not --quiet me"', ['--quiet']), null);
  assert.equal(matchedCandidate("git commit -m 'do not --quiet me'", ['--quiet']), null);
  assert.equal(matchedCandidate('pytest -q', ['-q']), '-q');
  assert.equal(matchedCandidate('pytest -qq', ['-q']), null, 'a longer flag is a different flag');
  assert.equal(matchedCandidate('npm install --silent-ish', ['--silent']), null);
  assert.equal(matchedCandidate('npm install --silent', ['--silent']), '--silent');
  // The spec's ledger example keys on a parameter SET (`-q --no-fail-fast`): every token present.
  assert.equal(matchedCandidate('cargo test --no-fail-fast -q', ['-q --no-fail-fast']), '-q --no-fail-fast');
  assert.equal(matchedCandidate('cargo test -q', ['-q --no-fail-fast']), null, 'half a set is not the set');
});

// Re-review R3, measured: the tokeniser only saw a quote at the START of a token, so in
// `-m"do not --quiet me"` the `\S+` branch swallowed `-m"do` and the rest split as bare tokens —
// `--quiet` among them, recorded as applied for a flag that lived inside a commit message. A quote
// opening anywhere in a token starts a quoted span that runs to its closing quote.
test('matchedCandidate treats a quote attached to a flag as opening a quoted span (re-review R3)', () => {
  assert.equal(matchedCandidate('git commit -m"do not --quiet me"', ['--quiet']), null);
  assert.equal(matchedCandidate("git commit -m'do not --quiet me'", ['--quiet']), null);
  assert.equal(matchedCandidate('git commit -m "do not --quiet me"', ['--quiet']), null, 'the detached form still does not match');
  assert.equal(matchedCandidate('git commit --quiet -m"x"', ['--quiet']), '--quiet', 'a real flag beside an attached quote still matches');
  assert.equal(matchedCandidate('git commit -m"x" --quiet', ['--quiet']), '--quiet', 'and after one');
  assert.equal(matchedCandidate('pytest -q', ['-q']), '-q');
  assert.equal(matchedCandidate('git commit -m"unterminated --quiet', ['--quiet']), null, 'an unterminated quote is data: the span runs to the end');
});

// Issue #11: the quote rule has ONE home, scripts/lib/quotes.mjs (rules/design-invariants.md §
// Never re-derive a fact). tokens() above and classify.mjs's segment splitter both read it. Field
// privacy cannot keep a second scanner out — one more `ch === '"'` loop compiles perfectly — so
// this is the check over the source the rule asks for: a file that compares a character against
// a quote is scanning quotes, and exactly one file under scripts/ may.
// The scan sees a quote character NAMED in the source: as a one-character string literal (plain,
// escaped, or cross-escaped — closed by the quote that opened it, so the display literal '""' in
// worktree-create.mjs's message is not one); a doubled literal of the two DIFFERENT quotes ('"\''),
// which is never a display form; a same-quote doubled literal ('""', "''") the moment a membership
// call follows it (.includes( / .indexOf( / .has( — fix round 2: that call is what turns a display
// literal into a scanner); a template literal or regex character class holding one quote or the
// two different ones (never "" or '', which are display and array forms); a hex or unicode escape;
// or a char-code call beside 34 / 39 / 0x22 / 0x27 on the same line.
//
// What it cannot see, each MEASURED unseen by the pin test below and named in the guard's own
// title, so the title claims no more than the scan detects (rules/design-invariants.md § Weak
// claims): a regex class mixing a quote with other members (`[\s"']`); a char code compared on a
// later line than its call; a range comparison bracketing a quote (`ch > '!' && ch < '#'`); a
// same-quote doubled literal stored in a variable before its membership call; and a quote computed
// at run time — String.fromCharCode of a non-literal, or a variable holding the character whose
// declaration is in another file.
const QUOTE_LITERAL = new RegExp([
  String.raw`(['"])\\?["']\1`,                                                          // '"'  "'"  '\''  "\""  '\"'  "\'"
  String.raw`'(?:\\?"\\?'|\\?'\\?")'|"(?:\\?'\\?"|\\?"\\?')"`,                          // '"\''  '\'"'  "'\""  "\"'"
  String.raw`(['"])(?:\\?["']){2}\2\)?\.(?:includes|indexOf|has)\(`,                    // '""'.includes(  "''".indexOf(  new Set("''").has(
  String.raw`\x60(?:["']|"'|'")\x60`,                                                   // `"`  `'`  `"'`  `'"`
  String.raw`\\(?:x22|x27|u0022|u0027)\b`,                                              // '\x22'  '''
  String.raw`\[\^?(?:["']|"'|'")\]`,                                                    // ["']  ['"]  [^"']  ["]
  String.raw`(?:charCodeAt|codePointAt|fromCharCode|fromCodePoint)[^\n]*\b(?:34|39|0x22|0x27)\b`,
].join('|'));
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
const quoteScanners = (dir) => walk(dir).filter((f) => f.endsWith('.mjs') && QUOTE_LITERAL.test(fs.readFileSync(f, 'utf8'))).map((f) => path.relative(dir, f).split(path.sep).join('/'));
test('exactly one file under scripts/ names a quote character — by literal, escape, template, regex class, char code, a doubled literal of the two different quotes, or a same-quote doubled literal asked about membership; invisible to this scan, measured: a regex class mixing a quote with other members, a char code compared on a later line than its call, a range comparison bracketing a quote, a same-quote doubled literal stored in a variable before its membership call, and a quote computed at run time — fromCharCode of a non-literal, or a variable holding the character declared in another file (issue #11)', () => {
  assert.deepEqual(quoteScanners(path.join(PLUGIN, 'scripts')), ['lib/quotes.mjs']);
});
// Fix round 1 for #11: the first pattern matched four spellings and a reviewer wrote six scanners
// past it. Every spelling below is a way a second scanner has actually been written; each must be
// SEEN, or the guard above claims more than it detects (rules/design-invariants.md § Weak claims).
const SPELLINGS = [
  [`if (ch === '"' || ch === "'") { quote = ch; inToken = true; continue; }`, 'the loop catalog.mjs used to carry'],
  [`const q = "'";`, 'a single quote in a double-quoted literal'],
  [`if (ch === '\\'' || ch === "\\"") {}`, 'the escaped forms'],
  [`if (ch === '\\"' || ch === "\\'") {}`, 'the cross-escaped forms'],
  ['if (ch === `"` || ch === `\'`) {}', 'template literals'],
  ['if (`"\'`.includes(ch)) {}', 'a template literal holding both'],
  [`if (ch === '\\x22' || ch === '\\x27') {}`, 'hex escapes'],
  [`if (ch === '\\u0022' || ch === '\\u0027') {}`, 'unicode escapes'],
  [`if (/["']/.test(ch)) {}`, 'a regex character class'],
  [`if (/['"]/.test(ch)) {}`, 'the class the other way round'],
  [`const QUOTE = /[^"']/;`, 'a negated class'],
  [`if (ch.charCodeAt(0) === 34 || ch.charCodeAt(0) === 39) {}`, 'charCodeAt against 34/39'],
  [`const q = String.fromCharCode(39);`, 'fromCharCode(39)'],
  [`if (ch.codePointAt(0) === 0x22) {}`, 'codePointAt against hex 0x22'],
  // Fix round 2: a doubled-quote literal is a display form until a membership call follows it.
  [`if ('""'.includes(ch)) {}`, 'a doubled double-quote literal asked about membership'],
  [`if ("''".includes(ch)) {}`, 'a doubled single-quote literal asked about membership'],
  [`if ('""'.includes(ch) || "''".includes(ch)) { quote = ch; }`, 'both, as the re-reviewer wrote it'],
  [`if ('"\\''.indexOf(ch) >= 0) {}`, 'the two different quotes, via indexOf'],
  [`if ("'\\"".includes(ch)) {}`, 'the two different quotes the other way round'],
  [`if (new Set('"\\'').has(ch)) {}`, 'the two different quotes through a Set'],
  [`const QUOTES = '"\\'';`, 'the two different quotes stored first — never a display form, so seen without a call'],
  [`const QUOTES = "'\\"";`, 'the same the other way round'],
];
test('RED CHECK: the quote-scanner scan sees every spelling a second scanner has been written in', () => {
  for (const [src, how] of SPELLINGS) assert.match(src, QUOTE_LITERAL, how);
  for (const clean of [`const s = 'no quotes here';`, `const items = ['a', "b"];`, `const n = 34 + 39;`, 'const msg = `the entry is ${id}`;', `const re = /[a-z]/;`,
    `name=\${name === '' ? '""' : name}`, `const empty = [""];`, 'const t = `""`;', `const e = "''";`, `fail(\`payload had name=\${name === '' ? '""' : name}\`)`]) {
    assert.doesNotMatch(clean, QUOTE_LITERAL, `false positive: ${clean}`);
  }
});
// The guard's stated limit, pinned: each idiom its title names as invisible IS unseen today. If a
// later widening catches one, this fails, and the title is shortened in the same change — the
// limit stays a measurement, never a belief.
const INVISIBLE = [
  [`if (/[\\s"']/.test(ch)) {}`, 'a regex class mixing a quote with other members'],
  [`const code = ch.charCodeAt(0);\nif (code === 34 || code === 39) {}`, 'a char code compared on a later line than its call'],
  [`if (ch > '!' && ch < '#') {}`, 'a range comparison bracketing a quote'],
  [`const Q = '""';\nif (Q.includes(ch)) {}`, 'a same-quote doubled literal stored in a variable before its membership call'],
  [`const q = String.fromCharCode(n);`, 'fromCharCode of a non-literal'],
  [`if (ch === DQ || QUOTES.includes(ch)) {}`, 'a variable holding the character, declared in another file'],
];
test('the guard title names exactly what the scan cannot see: each named idiom is measured unseen', () => {
  for (const [src, how] of INVISIBLE) assert.doesNotMatch(src, QUOTE_LITERAL, `${how} is now SEEN — shorten the guard title`);
});
// The behavioural half of the same claim: the tokeniser and the segment splitter see the same span,
// so one pair of quotes flips both answers, and an unterminated span runs to the end for both.
test('the tokeniser and the splitter read the same quoted span — one quote flips both (issue #11)', () => {
  const quoted = 'cat a -m"x && cargo build" && ls', bare = 'cat a -mx && cargo build && ls';
  assert.equal(classify(quoted), 'read', 'the && inside the span is data to the splitter');
  assert.equal(matchedCandidate(quoted, ['cargo']), null, 'and cargo inside the span is not a token to the tokeniser');
  assert.equal(classify(bare), 'noisy');
  assert.equal(matchedCandidate(bare, ['cargo']), 'cargo');
  const open = 'cat a -m"x && cargo build && ls';
  assert.equal(classify(open), 'read', 'unterminated: the splitter sees one segment');
  assert.equal(matchedCandidate(open, ['ls']), null, 'unterminated: the tokeniser sees one token');
});

test('project catalog entries override a universal id of the same name', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'catalog-'));
  fs.mkdirSync(path.join(tmp, '.claude', 'machinery'), { recursive: true });
  fs.writeFileSync(path.join(tmp, '.claude', 'machinery', 'tool-catalog.json'),
    JSON.stringify({ 'git-commit': { match: { type: 'prefix', value: 'git commit' }, outcome: 'OVERRIDDEN', candidates: [] } }));
  const catalog = loadCatalog(tmp);
  assert.equal(catalog['git-commit'].outcome, 'OVERRIDDEN');
  assert.ok(catalog['pytest'], 'the universal entries the project did not name are still there');
});

// Final review I2: `matchTool` destructured `entry.match` unguarded, so ONE project entry with no
// `match` threw out of the hook — which swallowed it — and switched assimilation off for every
// command in that project, silently. Hardened at the source: a malformed entry is dropped at load,
// the rest of the catalog survives, and the drop is part of the result rather than a side channel.
function projectWith(entries) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'catalog-'));
  fs.mkdirSync(path.join(tmp, '.claude', 'machinery'), { recursive: true });
  fs.writeFileSync(path.join(tmp, '.claude', 'machinery', 'tool-catalog.json'), JSON.stringify(entries));
  return tmp;
}
test('a malformed project entry is dropped, named, and the rest of the catalog is kept (final review I2)', () => {
  const tmp = projectWith({
    testq: { outcome: '^MERGE GATE', candidates: ['--quiet'] },                       // the review's exact case: no match
    badre: { match: { type: 'regex', value: '^(unclosed' } },                           // match that cannot compile
    badtype: { match: { type: 'glob', value: 'x' } },                                   // unknown match type
    notobj: 'a string where an entry should be',
    good: { match: { type: 'prefix', value: 'scripts/good.sh' }, outcome: '^OK', candidates: [] },
  });
  const { catalog, dropped } = loadCatalogReport(tmp);
  assert.ok(catalog.good, 'the well-formed sibling survives');
  assert.ok(catalog.pytest, 'the universal entries survive');
  for (const id of ['testq', 'badre', 'badtype', 'notobj']) assert.ok(!(id in catalog), `${id} must not be matchable`);
  assert.deepEqual(dropped.map((d) => d.id).sort(), ['badre', 'badtype', 'notobj', 'testq']);
  for (const d of dropped) assert.match(d.problem, /match|object/, `${d.id}: the reason names what was wrong`);
  assert.equal(matchTool('scripts/testq.sh --workspace', catalog), null, 'and matchTool over the result cannot throw');
  assert.deepEqual(loadCatalogReport(PLUGIN).dropped, [], 'the shipped universal catalog drops nothing');
});

test('loadCatalog says on stderr which entry it dropped, one line each, and nothing on a clean catalog', () => {
  const said = [];
  const orig = process.stderr.write;
  process.stderr.write = (s) => { said.push(String(s)); return true; };
  try {
    loadCatalog(projectWith({ testq: { outcome: '^MERGE GATE' } }));
    assert.equal(said.length, 1);
    assert.match(said[0], /testq/);
    assert.match(said[0], /match/);
    assert.ok(said[0].endsWith('\n') && !said[0].slice(0, -1).includes('\n'), 'exactly one line');
    said.length = 0;
    loadCatalog(projectWith({ good: { match: { type: 'prefix', value: 'x' } } }));
    assert.deepEqual(said, [], 'RED CHECK: a clean catalog prints nothing');
  } finally { process.stderr.write = orig; }
});

test('a project with no catalog of its own loads the universal one unchanged', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'catalog-'));
  assert.deepEqual(loadCatalog(tmp), readCatalog());
});

test('every universal catalog entry has a fixture proving its outcome survives filtering (design Verification 7)', () => {
  const catalog = readCatalog();
  const ids = Object.keys(catalog);
  assert.ok(ids.length > 0, 'zero catalog entries — this check would prove nothing');
  for (const id of ids) {
    const fixturePath = path.join(FIXTURES, `${id}.json`);
    assert.ok(fs.existsSync(fixturePath), `${id}: no fixture at ${fixturePath} — an entry with no fixture is not an entry`);
    assertOutcomeSurvives(id, catalog[id], readFixture(id));
  }
});

// The one non-vacuous proof that a declaration changes the outcome: git commit's answer line is
// caught by nothing in filter.mjs's generic heuristics, so buried it is dropped without the
// declaration and kept with it. If select() ever stopped honouring outcomePattern, this fails.
test('the outcome declaration is load-bearing: git commit’s answer lines are dropped without it', () => {
  const outcome = new RegExp(readCatalog()['git-commit'].outcome);
  const { lines, answers } = readFixture('git-commit');
  const buried = bury(lines);
  const without = select(buried), with_ = select(buried, outcome);
  for (const i of answers) {
    assert.ok(!without.has(i), `the generic heuristics already keep line ${i} — this test would prove nothing about it`);
    assert.ok(with_.has(i), `line ${i} was not kept by the declaration`);
  }
});

// A pin, not coverage. Measured 2026-09-04, once the fixtures carried every recorded form:
//   git-commit  all three bracket lines — kept by NOTHING generic
//   npm-install "added 1 package, …"     — kept by SUMMARY's `\badded \d+ packages?\b`
//               "up to date, audited …"  — kept by NOTHING generic (SUMMARY wants "added")
//   pytest      both summary lines       — kept by SUMMARY's `^={3,}.*={3,}$` / `\b\d+ passed\b`
// So two of the three entries carry a form whose survival rests on the declaration alone, and
// pytest's is today a belt over an existing brace. Recording that means a change on either side
// has to be re-reviewed rather than silently moving where the guarantee comes from.
test('pin: which entries carry an answer line that depends on their declaration once outside the tail window', () => {
  const dependent = Object.keys(readCatalog()).filter((id) => {
    const { lines, answers } = readFixture(id);
    const without = select(bury(lines));
    return answers.some((i) => !without.has(i));
  });
  assert.deepEqual(dependent.sort(), ['git-commit', 'npm-install']);
});

test('RED CHECK: the survival check catches a pattern that misses a real form, an undeclared fixture, an over-wide pattern, and the tail rule passing it', () => {
  const real = readFixture('git-commit');

  // 1. The reason the fixtures carry more than one recorded run. This is the plan's ORIGINAL
  //    git pattern — `\S+` cannot cross the space in `[main (root-commit) …]` or
  //    `[detached HEAD …]`. Against the real fixture it must go red, so reverting the correction
  //    cannot pass. Before the fixture carried those runs, this same revert passed silently.
  assert.throws(() => assertOutcomeSurvives('x', { outcome: '^\\[\\S+ [0-9a-f]{7,}\\]' }, real),
    /does not match a line this tool really emits/);

  // 2. A fixture that declares no answers proves nothing and must say so.
  assert.throws(() => assertOutcomeSurvives('x', real, { lines: real.lines, answers: [] }),
    /declares no answer lines/);

  // 3. A pattern cannot be "fixed" by widening it until it swallows ordinary chatter.
  assert.throws(() => assertOutcomeSurvives('x', { outcome: '.' }, real),
    /also matches a non-answer line/);

  // 4. The precondition the load-bearing test rests on: buried, a real answer line is dropped by
  //    select() with no declaration. If it were kept anyway, that test would be theatre.
  const buried = bury(['[main a1b2c3d] a commit message', ' 1 file changed, 2 insertions(+)']);
  assert.ok(!select(buried).has(0), 'select() keeps this line without a declaration — the checks above prove nothing');
});
