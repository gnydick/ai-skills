# CLAUDE.md § Every change states its assumptions and its blast radius — full rule

Ruled by Gabe 2026-08-25 (RULE:-dictated): **a change ships with its ASSUMPTIONS
COMPILED — the beliefs that make the choice and the design legitimate — and with
its EXPECTED BLAST RADIUS, naming what SHOULD change and what SHOULD NOT. When the
coding is done, every one of those assumptions and every one of those expected
truths is CONFIRMED.**

- **Both halves of the radius are stated.** "What should not change" is the half
  that carries the information. A change predicting "no emitted G-code moves" has
  said something falsifiable; a change that only lists what it improves has not.
- **Written BEFORE the coding, confirmed AFTER.** Assumptions compiled after the
  fact are a description of what happened, not a prediction that could have failed.
  The confirmation pass names each assumption and each expected truth and reports
  it HELD or DID NOT HOLD — never a blanket "tests pass."
- **An unconfirmed expectation is an unfinished change.** Not a caveat, not a
  follow-up ticket: the change is not done. § Be straightforward already forbids
  "fixed"/"safe" without evidence in the same message; this rule says which
  evidence, and that it was specified in advance.
- **A violated expectation is a REPORTABLE RESULT, not a failure to hide.** The
  prediction failing is the rule working. It is reported at full strength (§ Be
  straightforward), and then either the change is wrong, or the assumption was —
  and which one is an explicit finding.
- **Relation to the output bar.** § Verification — what "correct output" means in
  `docs/RULES-GROUPED.md` sets WHICH bar applies — byte-identity for value-neutral
  changes, structural parity and invariants for deliberate algorithmic work. This
  rule requires the change to DECLARE which of those it is claiming, in advance.
  Mislabelling a behaviour change as a refactor is how that bar gets dodged.

## Evidence and history

- **Worked example, the one that produced this rule (GIT_401, 2026-08-25):**
  `dcd81611` was labelled "refactor … one type for narrow and fat ground", an
  implicit assumption of zero behaviour change and a blast radius of no moved
  G-code. Neither was written down, so neither was checked. It moved FOUR goldens:
  the internal-bridge intersect silently changed from reading the eroded centreline
  DOMAIN to the un-eroded FOOTPRINT, which re-classified bridges and moved fan
  speed and feedrate with them. Stated up front, that prediction fails in one test
  run; unstated, it survives to a merge.
