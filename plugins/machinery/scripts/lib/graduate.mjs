// The one gate between a trained matcher and the project catalog. Story: the design's "Graduation
// freezes a fixture" — "a matcher that cannot be graduated with a fixture is not graduated."
// Everything that can refuse happens before the first write, and the judgement is not made here: it
// is read from survival.mjs, the same authority test/catalog.test.mjs enforces over the universal
// catalog and promote-tool.mjs enforces at promotion, so the loop cannot land an entry the suite
// would reject (rules/design-invariants.md § Never re-derive a fact). The entry's own loadability is
// read from catalog.mjs's entryProblem() the same way — a machine-derived outcome that is not a
// prefix or literal is refused here, at the writer, not only dropped later at the reader.
//
// One property worth knowing rather than assuming, because a reader would otherwise expect the CLI
// to exercise it: the survivalProblems() refusal below is UNREACHABLE from train-tool.mjs's own
// honest call sequence. That CLI hands identify() and graduate() the same `lines` and the same
// `index`, and agreement requires the pre-pick prefix to select exactly the identified line, so the
// post-pick matcher is always an extension of the prefix that agreed — even across PICK_WINDOW
// truncation, since dropping a pick can only lengthen a common prefix — and can never newly match a
// line the shadow check did not already rule on. So the survival gate guards hand-corrupted state:
// a training/matcher pair assembled by a caller that disagrees with itself, which is what
// test/lib-graduate.test.mjs's V11 case builds deliberately. It is defence in depth, not a path the
// loop can produce. (Recorded here rather than only in the effort's ledger, which does not survive.)
import fs from 'node:fs';
import path from 'node:path';
import { isLearned, entryProblem } from './catalog.mjs';
import { survivalProblems } from './survival.mjs';
import { learnedId, learnedEntry, frozenFixture, graduated } from './training.mjs';
import { moveRecord, withTraining } from './observations.mjs';

export const projectCatalogFile = (root) => path.join(root, '.claude', 'machinery', 'tool-catalog.json');
export const projectFixtureFile = (root, id) => path.join(root, '.claude', 'machinery', 'fixtures', `${id}.json`);

// The project catalog is written back whole, so it is read raw here — not through loadCatalog(),
// which lays it over the universal table and drops what it cannot use. A file that is present but
// unreadable is external input: a problem, never a replacement (rules/design-invariants.md
// § External input).
function readProjectCatalog(file) {
  if (!fs.existsSync(file)) return { value: {} };
  let value;
  try { value = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { return { problem: `${file} is not valid JSON: ${e.message}` }; }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return { problem: `${file} is not a JSON object` };
  return { value };
}

export function graduate(root, { key, catalog, observations, training, matcher, lines, index, log, at }) {
  // A tool has TWO identities and the loop has to close under both: the bespoke key
  // (`bash scripts/battery.sh`) before graduation, and the sanitized catalog id
  // (`bash-scripts-battery.sh`) after. From the first run after graduation matchTool() answers with
  // the id, so the runner and train-tool.mjs both key on the id from then on, and a re-graduation
  // after drift arrives with `key` ALREADY EQUAL to the id. catalog[key] being a learned entry is
  // the only way that can happen — a bespoke key is a command shape and never names an entry — so
  // it is the fact that identifies a re-graduation, read once, here. The entry's own `match` is then
  // PRESERVED rather than rebuilt from `key`: rebuilt, it would carry the id, which no command
  // starts with, leaving a dead entry that matches nothing forever (final whole-branch review, C1).
  const retrained = isLearned(catalog[key]) ? catalog[key] : null;
  const id = retrained ? key : learnedId(key);
  if (!retrained) {
    // A first graduation, so nothing at this id may already belong to another tool. Both refusals
    // stand exactly as they were; a genuine collision — a different tool's entry sitting at the id
    // this key sanitizes to — is still refused, hand-written or learned.
    const existing = catalog[id];
    if (existing && !isLearned(existing)) return { ok: false, problems: [`'${id}' is a hand-written catalog entry; training never overwrites one`] };
    if (existing && existing.match?.value !== key) return { ok: false, problems: [`'${id}' is already the learned entry for '${existing.match?.value}', not '${key}'`] };
  }
  const entry = learnedEntry(retrained ? retrained.match : { type: 'prefix', value: key }, matcher, at, training.picks.length);
  const unloadable = entryProblem(entry);
  if (unloadable) return { ok: false, problems: [`'${id}': ${unloadable}`] };
  // The last pick is this run's; the earlier ones are appended to the fixture as further answers.
  const fixture = frozenFixture({ lines, index, picks: training.picks.slice(0, -1), log, at, key });
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
