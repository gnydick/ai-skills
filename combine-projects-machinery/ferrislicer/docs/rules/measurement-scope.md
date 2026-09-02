# CLAUDE.md § A measurement's scope is part of its claim — full rule

Ruled by Gabe 2026-08-26, after four instances in one day. State what the
measurement COULD see in the same breath as the claim it supports. A measurement
whose scope differs from its claim is not weak evidence — it is evidence for a
different question, and it reads exactly like evidence for yours.

- **The test that caught all four: ask WHY the result looks like that, not
  WHETHER it does.** Every one was green, plausible, and answering a question
  nobody had asked.
- **A subagent's confidence is not scope.** An adjudication returned 21 rows at
  CERTAIN and the file held 22; high confidence about the rows it read said
  nothing about the row it missed. Verify the COUNT independently — a
  complete-looking table is not evidence of completeness.
- This is the general form of two rules that already exist as instances: probe
  shape and denominator (`docs/dev/traps.md`), and gate integrity (`docs/ci.md`).
- **A clean check does not shorten the list (Gabe, 2026-08-29, adjudicated in
  conversation).** Gabe's framing, verbatim: "maybe the rule is you should
  never short circuit full due diligence no matter how clean or positive any
  one of the checks feels?" Narrowed here from unbounded "full due diligence"
  (unenforceable) to a checkable form: what a change requires is enumerated
  BEFORE the first check runs, and a pass on one check never cancels another.
  A positive result is the most dangerous place to stop, because stopping
  feels earned. Mechanical test: was the list of required checks written
  before the first check ran, or after — that is answerable; "did you feel
  diligent" is not.

## Evidence and history

- **The concrete case: `git diff` / `git show` without `-w` is not a diff of the
  CODE.** A line rewritten with different whitespace appears on BOTH sides, so a
  grep over added lines counts an unchanged line as new. `-w --stat` is the
  discriminator: `344d1d0d` reads `37 insertions(+), 2 deletions(-)` raw and
  `35 insertions(+)` under `-w` — the deletions collapsing to zero is the tell.
- **The four, all 2026-08-26, one shape.** A citation gate scanned zero files and
  reported OK. A register check skipped every numbered heading on a leading-digit
  test and reported them checked. A red-check went green because the fixture's
  title absorbed the citation by prefix, proving nothing about the bug it existed
  to catch. A grep counted whitespace as code, and the retraction of that false
  finding cost two `git show` runs — cheap, and the reason to raise it anyway.
- **A fifth instance, 2026-08-28 — a merge gate trusting `HEAD^1`.** REFINES
  this section rather than competing with it: same shape, gate/scope
  specialization. `scripts/merge-gate.sh`'s `BASE_REF` fallback (added
  `bcbf4c7c`, 2026-08-24) assumes a merge commit's first parent is pre-merge
  `main`. Merge commit `3360180e` ("Merge branch 'main' into GIT_566") was
  made ON the feature branch, so parent 1 (`c4186036`) was the branch's own
  prior tip and parent 2 (`9c1f5e5e`) was `main` — MEASURED:
  `git diff --name-only c4186036 3360180e -- '*.rs'` = 0 files, so the
  rustfmt gate (gate 4 of 16) passed on an empty scope while 4 files were
  genuinely unformatted (fixed later at `2b8c1bb4`). `docs/ci.md` never
  documents `BASE_REF` (MEASURED: zero hits) — the undocumented scope is
  itself an instance of this rule, since an unstated scope reads as no
  limitation at all. Two concrete requirements follow: **(a)** a gate that
  computes a working subset must print its own denominator on every run —
  MEASURED: 12 of `merge-gate.sh`'s 16 gates already do; the two compile
  gates, clippy, and rustfmt do not; **(b)** a merge gate must never trust
  merge-parent order alone — diff against both parents, or resolve the
  pre-merge tip directly, and cover it with a fixture that constructs a
  merge in the "wrong" direction (built on the feature branch, `main`
  merged in) with a real cross-branch diff, asserting the gate goes RED —
  the same shape as `citation_source_gate_test.py`'s existing
  `zero_files_scanned_case` positive control (MEASURED present,
  `scripts/citation_source_gate_test.py:202`).
  - **This renames what most of this section's instances actually share, on
    independent re-read.** Of the "four, all 2026-08-26" above, three
    (citation gate scanned zero files and reported OK; register check
    skipped every heading on a leading-digit test and reported them checked;
    red-check went green because a fixture's title absorbed the citation by
    prefix) are not really an instrument SEEING LESS than claimed — they are
    a CLEAN, POSITIVE result (a pass) stopping the inquiry before it asked
    WHY the result looked that way. Only the fourth, `git diff`/`git show`
    without `-w`, is a genuinely different defect: a wrong instrument, not
    an early stop on a clean one. The subagent-confidence and merge-gate
    `BASE_REF` additions above are this same clean-stops-inquiry pattern,
    not the scope-of-instrument pattern.
  - **Worked example (GIT_85, 2026-08-29):** a doc comment (`eb014d7d`)
    asserted that two config-loading functions (`fs_preset::load_into_config`
    and `fs_config_io::type_pairs`) differed only in legacy-key migration,
    on the strength of one clean check — grepping one function for one call
    (`migrate_key`) and getting a negative. That single clean result was
    written up as the whole answer; the second function's body was never
    read. MEASURED: the two differ in SIX ways (migration, range-clamping,
    origin tracking, warning richness, input shape, return shape). The
    stated blast radius ("no G-code change for a preset with no legacy
    keys") was VIOLATED: the un-inspected clamping difference moves output
    for an out-of-range value even with no legacy keys at all
    (`printable_height=500000` now clamps to `214700`). It survived review
    because the fixture used an in-range value, so the clamp difference
    never fired. Corrected at `199ab575`. The § Every change states its
    assumptions and its blast radius machinery worked as designed — the
    falsifiable prediction was forced, it failed, and that triggered the
    mandatory post-mortem; the gap this bullet closes is one level upstream,
    in how the assumption was built in the first place.
