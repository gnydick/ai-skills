# developer-friendliness — eval harness

Measures whether the skill changes behaviour, by running the same task twice —
once with the skill loaded, once without — against a small project fixture and
diffing what each run left behind.

Nothing here is wired into CI. It is run by hand when the skill changes.

```
prompts.json                        the three tasks, and what each one tests
grade.py                            the executable assertions
fixtures/with-conventions/          ledgerpipe, with a CONVENTIONS.md
fixtures/without-conventions/       the same project, with nothing announcing
                                    where records go
```

## Running it

1. For each eval in `prompts.json`, start two agents on the same prompt against
   the same fixture. The only difference between them is one instruction:
   *read `pure-prose/developer-friendliness/SKILL.md` in full and follow it.*
   Have each copy the fixture to its own workspace first, and write its final
   message to `outputs/final_message.md` and its finished tree to
   `outputs/workspace/`.
2. Record `total_tokens` and `duration_ms` per run into `timing.json` beside
   `outputs/`. This is the only chance to capture it — the numbers arrive with
   the completion notification and are not persisted anywhere else.
3. Grade: `python grade.py <run-dir> --fixture fixtures/without-conventions`
4. Aggregate and view with the `skill-creator` scripts if you want the
   side-by-side viewer. On Windows set `PYTHONIOENCODING=utf-8`, or the viewer
   dies printing a box-drawing character to a cp1252 console.

**Keep `<run-dir>` outside this repository.** Results committed by accident are
worse than results lost.

## The two fixtures

`ledgerpipe` is a small Python project with three populated record files —
`docs/decisions.md`, `docs/issues.md`, `docs/notes.md` — and seeded material a
run can find without being sent to look: a naive comma split that silently drops
malformed rows, two sign bugs in `to_minor_units`, a bare `except` in
`report.py` that swallows them, an existing issue entry noting `post_batch` has
no timeout, and a `docs/notes.md` that cites a `tests/make_fixtures.py` which
does not exist.

`with-conventions` adds a `CONVENTIONS.md` naming each record file and banning
new top-level documents. `without-conventions` deletes it, so the only evidence
of where records go is that the files exist and share a format.

Prefer `without-conventions`. The other one turns "where will they look?" into
instruction-following, which any competent model passes without the skill.

## What this harness got wrong

Kept because both errors are easy to repeat and neither was visible from the
pass rate.

**The first fixture measured compliance, not judgment.** With `CONVENTIONS.md`
present, iteration 1 scored 100% for both configurations across every assertion
— the baseline simply read the instructions and followed them. A benchmark where
the control passes everything is measuring the fixture.

**Assertions encode what you expected to see, and punish what you didn't.** The
strongest single behaviour in iteration 2 was a run that deleted the stale
`docs/notes.md` setup step and added a root `conftest.py` so the step was no
longer needed — the skill's own rule that a mechanism beats a note. The
"adds no new top-level document" assertion counted that as a failure, because it
could not tell code from paperwork. A second assertion missed a thorough
correction because its keyword list did not include the word the run used. Both
scored the skill's best work as its worst. Read the diffs before believing the
number.

**The cost delta conflates two things.** `SKILL.md` is several thousand tokens,
and loading it is charged to the with-skill arm regardless of behaviour. To
separate the file's weight from its effect, add a third arm that reads a
document of similar length and no relevance. Without it, longer skills look
worse and shorter ones look better, independent of what they do.

**n=1.** One run per cell. The aggregator prints `± stddev` as `±0`, which reads
as precision and is an artifact. Three runs per cell would give a real interval.

## Results so far

| | fixture | with skill | baseline | tokens |
|---|---|---|---|---|
| iteration 1 | with-conventions | 100% | 100% | +26.2% |
| iteration 2 | without-conventions | 100% | 80.9% | +35.8% |

Iteration 2 ran against the 480-line skill. All four baseline failures were
record-keeping, not code: both baselines left the stale `docs/notes.md`
reference standing while reading that file, one never filed findings it had
already found and described in its message, and one wrote no handoff despite a
prompt opening with *"i have to jump on a call in ~10 min."*

The version-bump eval tied at 6/6, as designed. Worth noting it got *cheaper*
between iterations — +25.2% tokens and 7 tool calls against iteration 1's +27.9%
and 9 — while the skill itself grew by a third. Showing the filter declining
things appears to make declining cheaper than stating the rule does.
