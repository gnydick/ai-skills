// The training loop's arithmetic, with no I/O of its own. Story: docs/superpowers/specs/
// 2026-09-04-tool-assimilation-design.md, "How an outcome pattern is learned". The session does the
// identifying (train-tool.mjs hands its pick in here); everything else — the matcher, the shadow
// comparison, the graduation count, the drift triggers — is a function of what was recorded, so the
// same picks always yield the same matcher (design verification 10), and a matcher is a prefix
// because the only thing that makes one is a longest common prefix (verification 9, by construction).
import { outcomeMatcher } from './catalog.mjs';

// K: the consecutive shadow agreements a matcher needs to graduate. Two, because a wrong graduation
// is bounded and reversible while a late one is paid in session attention: the matcher can only
// promote a line, never hide one (the floor, filter.mjs), and drift re-opens training the first run
// it matches nothing — so graduating too early costs a few extra lines shown until the next run
// corrects it. The first agreement after the prefix forms proves only that the prefix fits a run it
// had not seen; the second, consecutive, is the smallest count that separates a stable line from a
// coincidence of the two picks the prefix was built from. A third would cost every project one more
// identified run per tool for evidence the frozen fixture already carries.
export const GRADUATION_AGREEMENTS = 2;
// The most answer lines the session may identify in one run (#168; train-tool.mjs enforces it, the
// one caller that takes an identification from a person). Five, because a tool whose answer line
// repeats once per target prints a handful — `cargo test -p fs-core` prints three `test result:`
// lines, lib, integration and doctest — while a cap far below the size of a whole output section
// keeps an identification from being a way to declare half a run the answer. Nothing above three
// targets has been measured; a workspace run that needs more is the owner's call, not a silent
// raise. It bounds the IDENTIFIED set, not the match count: a matcher hitting more lines than the
// session identified is a disagreement by the set rule below, whatever the number.
export const AGREEMENT_MATCH_CAP = 5;
// The most recent picks the prefix is taken over. Bounded, so a tool that never graduates cannot grow
// the record without limit; wide enough for a formation (2) and a graduation (K) with room for a few
// disagreements between.
export const PICK_WINDOW = 8;
// The bare runs remembered for the shape trigger, and what "moved materially" means: the line count
// leaving a factor-of-three band around the remembered median, or the share of lines on stdout
// moving by more than half. Named here, once, because they are judgement calls.
export const SHAPE_WINDOW = 5;
export const SHAPE_FACTOR = 3;
export const SHAPE_SHARE_DELTA = 0.5;

const isObject = (v) => !!v && typeof v === 'object' && !Array.isArray(v);

export const emptyTraining = () => ({ picks: [], streak: 0, history: [] });

// One recorded pick, or null if the stored object is neither shape. A pick carries `texts`: the
// texts of EVERY line the session identified in that run. A pick written before #168 carries a
// single `text` and reads as a one-element set — no migration, it simply ages out of PICK_WINDOW.
function pickOf(p) {
  if (!isObject(p)) return null;
  const { text, ...rest } = p;
  const texts = Array.isArray(p.texts) ? p.texts.filter((s) => typeof s === 'string')
    : typeof text === 'string' ? [text] : [];
  return texts.length ? { ...rest, texts } : null;
}

// A training record that came off disk is external input: any field that is not the collection it
// should be reads as the empty one, so a hand edit cannot throw out of the runner or the trainer.
export function trainingOf(rec) {
  const t = isObject(rec) && isObject(rec.training) ? rec.training : {};
  return {
    picks: Array.isArray(t.picks) ? t.picks.map(pickOf).filter(Boolean) : [],
    streak: Number.isInteger(t.streak) && t.streak >= 0 ? t.streak : 0,
    history: Array.isArray(t.history) ? t.history.filter((h) => isObject(h) && Number.isInteger(h.lines)) : [],
    ...(typeof t.lastLog === 'string' ? { lastLog: t.lastLog } : {}),
    ...(isObject(t.open) ? { open: t.open } : {}),
  };
}

export function commonPrefix(strings) {
  if (!strings.length) return '';
  let prefix = strings[0];
  for (const s of strings.slice(1)) {
    let i = 0;
    while (i < prefix.length && i < s.length && prefix[i] === s[i]) i++;
    prefix = prefix.slice(0, i);
    if (!prefix) break;
  }
  return prefix;
}

// The matcher the picks so far derive: the longest common prefix over EVERY identified text in the
// window, or null while there is nothing to derive one from. Fewer than two texts is null — "a
// single observation can never graduate: there is nothing to take a common prefix OF" — and so is an
// empty common prefix, which would match every line. The count is of texts, not of picks (#168): one
// run in which the session identified three `test result:` lines already carries three forms of the
// answer, and a prefix taken over them is entitled to exactly what those three agree on.
export function deriveMatcher(picks) {
  const texts = picks.flatMap((p) => p.texts);
  if (texts.length < 2) return null;
  const value = commonPrefix(texts);
  return value ? { type: 'prefix', value } : null;
}

// The local matcher's own pick over a run: every index the prefix matches, tested by the same
// compiler the runner hands select() (catalog.mjs), not a second spelling of startsWith.
export function shadowPick(matcher, lines) {
  const m = outcomeMatcher({ outcome: matcher });
  return lines.flatMap((line, i) => (m.test(line) ? [i] : []));
}

// The identified set as everything downstream reads it: sorted, without repeats, so the same
// identification always yields the same picks, the same fixture and the same comparison however the
// session spelled its `--line` list (design verification 10).
const answerIndices = (indices) => [...new Set(indices)].sort((a, b) => a - b);

// One identification by the session. `indices` are the lines the session says are the answers, in
// `lines` — this run's normalised output. A run may hold several: `cargo test` prints one
// `test result:` line per target. The session identifies EVERY one of them (Gabe, 2026-09-22, #168);
// nothing here derives an answer by applying the pattern.
//
// The shadow comparison runs FIRST, against the matcher the picks BEFORE this one derive: agreement
// is that matcher's match set in this run EQUALLING the identified set — every identified line and
// no other, none missing, none extra. That is the original exactly-one-line rule generalised to a
// set, and it is what keeps the over-wide-prefix guard: a prefix that also hits a line nobody
// identified disagrees, whether it hit two lines or fifty, so it can never reach graduation and
// promote them. (#166 tried "the pick is among the matches, at most 5" and is superseded: it lets a
// matcher graduate over lines nobody read, which is the same thing survival.mjs refuses.)
//
// Then the pick joins the window and the matcher is re-derived. `graduates` is true when this
// agreement is the K-th in a row; the matcher returned is then the one to freeze — on an agreement
// it equals the one that agreed, because lines the prefix matched cannot shorten it.
export function identify(training, { lines, indices, log, at }) {
  const answers = answerIndices(indices);
  const before = deriveMatcher(training.picks);
  let agreed = null, streak = training.streak;
  if (before) {
    const shadow = shadowPick(before, lines);
    agreed = shadow.length === answers.length && shadow.every((i, k) => i === answers[k]);
    streak = agreed ? streak + 1 : 0;
  }
  const picks = [...training.picks, { texts: answers.map((i) => lines[i]), log, at }].slice(-PICK_WINDOW);
  const matcher = deriveMatcher(picks);
  const graduates = agreed === true && streak >= GRADUATION_AGREEMENTS && matcher !== null;
  return { training: { ...training, picks, streak }, agreed, matcher, graduates };
}

// What the wrapper records about one bare run: appended to the bounded history, oldest first.
export function noteRun(training, { log, lines, stdoutLines, stderrLines, code }) {
  const history = [...training.history, { lines, stdoutLines, stderrLines, code }].slice(-SHAPE_WINDOW);
  return { ...training, history, lastLog: log };
}

const median = (xs) => { const s = [...xs].sort((a, b) => a - b); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const share = (h) => (h.lines > 0 ? h.stdoutLines / h.lines : 0);

// The shape trigger. Two remembered runs are the least that have a shape to move from; with fewer,
// nothing has moved. Both halves are judged against the remembered median.
export function shapeMoved(history, run) {
  if (history.length < 2) return false;
  const lines = median(history.map((h) => h.lines)), s = median(history.map(share));
  if (run.lines > lines * SHAPE_FACTOR || run.lines * SHAPE_FACTOR < lines) return true;
  return Math.abs(share(run) - s) > SHAPE_SHARE_DELTA;
}

// Why a graduated matcher goes back into training after this run, or null. The design's three
// triggers, in its order, each a fact the wrapper already has: `matched` is how many lines the
// learned matcher promoted, `errorBlock` is filter.mjs's hasErrorBlock over the run.
export function driftReason(training, run) {
  if (run.matched === 0) return 'matched-nothing';
  if (run.code !== 0 && !run.errorBlock) return 'nonzero-without-error-block';
  if (shapeMoved(training.history, run)) return 'shape';
  return null;
}

// Re-opening discards the picks the doubted matcher was derived from, and the streak with them. The
// history stays: it is what the shape trigger reads.
export const reopen = (training, reason, log, at) => ({ ...training, picks: [], streak: 0, open: { reason, log, at } });

// After graduation the picks and the streak are frozen in the fixture and the re-open is answered;
// the history stays for drift.
export const graduated = (training) => { const { open, ...rest } = training; return { ...rest, picks: [], streak: 0 }; };

// The catalog id a learned entry takes. A bespoke key is a command shape — `bash scripts/battery.sh`
// — and an id names a fixture FILE and must satisfy promote-tool.mjs's own id rule, so every run of
// characters outside [A-Za-z0-9._-] becomes one dash and a leading non-alphanumeric run is dropped.
export function learnedId(key) {
  const id = key.replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^[^A-Za-z0-9]+/, '');
  if (!id) throw new Error(`no usable id can be made from the key: ${key}`);
  return id;
}

// The entry graduation writes: the `match` it was handed, the learned prefix as its outcome, no
// candidates (a bespoke tool has no documented quiet flags), and the `learned` mark that says a
// machine wrote it and drift may re-open it. The match is a PARAMETER, not built from the key here:
// on a re-graduation the key is already the learned id, and an entry matching its own id would
// match no command at all (graduate.mjs owns that choice, and says why).
export const learnedEntry = (match, matcher, at, picks) => ({
  match,
  outcome: matcher,
  candidates: [],
  learned: { at, picks },
});

// The frozen fixture, in the shape survival.mjs judges: this run's lines with every line the session
// identified in it as an answer, then every identified text of every earlier pick appended as a
// further recorded answer line — each one a line the tool really emitted on a run the session read —
// so a later change to the matcher has to survive every form the loop saw, not only the last.
// Answers are indices a person identified, never found by applying the pattern: the run's own
// unidentified lines stay in `lines` as non-answers, which is what makes survival.mjs's over-wide
// check able to fail at all.
export function frozenFixture({ lines, indices, picks, log, at, key }) {
  const extra = picks.flatMap((p) => p.texts);
  return {
    source: `${key}: frozen at graduation ${at} from ${log}; ${extra.length} earlier identified line(s) appended`,
    answers: [...answerIndices(indices), ...extra.map((_, i) => lines.length + i)],
    lines: [...lines, ...extra],
  };
}
