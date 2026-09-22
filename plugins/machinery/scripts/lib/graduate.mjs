// The one gate between a trained matcher and the project catalog. Story: the design's "Graduation
// freezes a fixture" — "a matcher that cannot be graduated with a fixture is not graduated."
// Everything that can refuse happens before the first write, and the judgement is not made here: it
// is read from survival.mjs, the same authority test/catalog.test.mjs enforces over the universal
// catalog and promote-tool.mjs enforces at promotion, so the loop cannot land an entry the suite
// would reject — one derivation, read by all three. The entry's own loadability is
// read from catalog.mjs's entryProblem() the same way — a machine-derived outcome that is not a
// prefix or literal is refused here, at the writer, not only dropped later at the reader.
//
// One property worth knowing rather than assuming, because a reader would otherwise expect the CLI
// to exercise it: the survivalProblems() refusal below is UNREACHABLE from train-tool.mjs's own
// honest call sequence. That CLI hands identify() and graduate() the same `lines` and the same
// `indices`, and agreement under the set rule (#168) requires the pre-pick prefix to select EXACTLY
// the identified set — every identified line and no other. The post-pick matcher is the common
// prefix over the window's texts, every one of which the agreeing prefix is a prefix of, so it is an
// extension of the prefix that agreed — even across PICK_WINDOW truncation, since dropping a pick
// can only lengthen a common prefix. Being an extension it matches a SUBSET of what agreed, which
// was exactly the identified set, and being their common prefix it matches every one of them: so in
// this run it selects the identified set again, and it heads every appended earlier text, which the
// fixture declares an answer too. It can never newly match a line the shadow check did not already
// rule on. So the survival gate guards hand-corrupted state: a training/matcher pair assembled by a
// caller that disagrees with itself, which is what test/lib-graduate.test.mjs's V11 case builds
// deliberately. It is defence in depth, not a path the loop can produce. (Recorded here rather than
// only in the effort's ledger, which does not survive.)
import fs from 'node:fs';
import path from 'node:path';
import { isLearned, entryProblem } from './catalog.mjs';
import { survivalProblems } from './survival.mjs';
import { learnedId, learnedEntry, frozenFixture, graduated } from './training.mjs';
import { moveRecord, withTraining, isToolKey } from './observations.mjs';

export const projectCatalogFile = (root) => path.join(root, '.claude', 'machinery', 'tool-catalog.json');
export const projectFixtureFile = (root, id) => path.join(root, '.claude', 'machinery', 'fixtures', `${id}.json`);

// The project catalog is written back whole, so it is read raw here — not through loadCatalog(),
// which lays it over the universal table and drops what it cannot use. A file that is present but
// unreadable is external input: a problem the user is told about, never a replacement and
// never a crash.
function readProjectCatalog(file) {
  if (!fs.existsSync(file)) return { value: {} };
  let value;
  try { value = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { return { problem: `${file} is not valid JSON: ${e.message}` }; }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return { problem: `${file} is not a JSON object` };
  return { value };
}

export function graduate(root, { tool, catalog, observations, training, matcher, lines, indices, log, at }) {
  // `tool` is observations.mjs's toolKey() pair, never a bare key string: whether the catalog
  // MATCHED this command is not recoverable from the key, and the branch below turns on it. A
  // caller cannot forge the pair — the brand is a module-private symbol — so it cannot claim a
  // match it never made. This is a programmer error, not external input, so it throws.
  if (!isToolKey(tool)) throw new TypeError('graduate() takes the pair observations.mjs toolKey() makes, not a key string: whether the catalog matched this command is not recoverable from the key');
  const { key, matched, prefix } = tool;
  // A tool has TWO identities and the loop has to close under both: the bespoke key
  // (`bash scripts/battery.sh`) before graduation, and the sanitized catalog id
  // (`bash-scripts-battery.sh`) after. From the first run after graduation matchTool() answers with
  // the id, so the runner and train-tool.mjs both key on the id from then on, and a re-graduation
  // after drift arrives with `key` ALREADY EQUAL to the id. The entry's own `match` is then
  // PRESERVED rather than rebuilt from `key`: rebuilt, it would carry the id, which no command
  // starts with, leaving a dead entry that matches nothing forever (final whole-branch review, C1).
  //
  // What makes it a re-graduation is that the entry's OWN match answered for this command —
  // `matched`, decided at the one site that derives the key — and not merely that a learned entry
  // sits at the same string. A bespoke key can land on that string by coincidence: `./a.sh`
  // graduates to the id `a.sh`, and a later `a.sh --x` keys on `a.sh` without matching that entry
  // at all. Read as identity, that overwrites one invocation's learned answer with the other's and
  // leaves `match.value` pointing at the first (final re-review). A coincidence is a COLLISION, and
  // falls through to the guards below, which refuse and write nothing.
  const retrained = matched && isLearned(catalog[key]) ? catalog[key] : null;
  const id = retrained ? key : learnedId(key);
  if (!retrained) {
    // A first graduation, so nothing at this id may already belong to another tool. Both refusals
    // stand exactly as they were; a genuine collision — a different tool's entry sitting at the id
    // this key sanitizes to — is still refused, hand-written or learned.
    const existing = catalog[id];
    if (existing && !isLearned(existing)) return { ok: false, problems: [`'${id}' is a hand-written catalog entry; training never overwrites one`] };
    if (existing && existing.match?.value !== prefix) return { ok: false, problems: [`'${id}' is already the learned entry for '${existing.match?.value}', not '${prefix}'`] };
  }
  // The match is the pair's PREFIX, not its key (#87). A key is the generalized command form and
  // holds placeholders — `gh issue edit %d` — so an entry built from it would start no command
  // that was ever run and would match nothing, forever. The prefix is the literal leading run of
  // the command the pick was made on, derived in the same walk that made the key, so the two
  // cannot disagree about where the generalization began.
  const entry = learnedEntry(retrained ? retrained.match : { type: 'prefix', value: prefix }, matcher, at, training.picks.length);
  const unloadable = entryProblem(entry);
  if (unloadable) return { ok: false, problems: [`'${id}': ${unloadable}`] };
  // The last pick is this run's; the earlier ones are appended to the fixture as further answers.
  const fixture = frozenFixture({ lines, indices, picks: training.picks.slice(0, -1), log, at, key });
  const problems = survivalProblems(id, entry, fixture);
  if (problems.length) return { ok: false, problems };
  const catalogFile = projectCatalogFile(root), fixtureFile = projectFixtureFile(root, id);
  const project = readProjectCatalog(catalogFile);
  if (project.problem) return { ok: false, problems: [project.problem] };
  // Fixture first, entry second: an entry with no fixture is what promote-tool.mjs refuses, while a
  // fixture with no entry is inert. A failure between the two writes leaves the harmless state.
  fs.mkdirSync(path.dirname(fixtureFile), { recursive: true });
  fs.writeFileSync(fixtureFile, JSON.stringify(fixture, null, 2) + '\n');
  fs.writeFileSync(catalogFile, JSON.stringify({ ...project.value, [id]: entry }, null, 2) + '\n');
  const moved = key === id ? observations : moveRecord(observations, key, id);
  return { ok: true, id, files: [catalogFile, fixtureFile], observations: withTraining(moved, id, graduated(training)) };
}
