# CLAUDE.md § A gate script echoes its sub-check's denominator — full rule

Ruled by Gabe 2026-08-28 (RULE:-dictated, conversational — capture hook did
not fire, manually recorded in `docs/rule-inbox.md`): a merge/CI gate script
that redirects a sub-check's output to a log file must at minimum echo that
sub-check's own denominator line to its own stdout, not only pass/FAIL.
Distinct from the section above — that rule is about a measurement's SCOPE;
this one is about a gate script's own output plumbing discarding evidence
the sub-check already produced.

## Evidence and history

- **The mechanism.** `gate()` in `scripts/merge-gate.sh:115-127` redirects
  each gate's stdout+stderr wholly to a per-gate log: `"$@" >"$log" 2>&1`.
  Only the gate NAME and pass/FAIL reach the script's own stdout — every
  other line the sub-check prints, including a denominator line like
  `fmt_gate`'s "no Rust files changed", is invisible outside the log file.
  MEASURED (current tree): `target-gate/gate-logs/rustfmt:_changed_files_
  (skip_children).log` is 0 bytes, illustrating that the redirect can
  swallow a sub-check's own explanatory line entirely.
- **The asymmetry this rule targets.** `.claude/hooks/quiet_hook.py`'s
  `NOISY` regex names `merge-gate.sh` for output reduction (`.claude/hooks/quiet_hook.py:59`);
  the actual line filtering happens in `.claude/hooks/quiet_run.py`. MEASURED
  by reading both: `quiet_run.py`'s `BLOCK_START`/`KEYWORD` patterns keep any
  `FAIL` line and its surrounding block, but a bare `... pass` line matches
  none of `BLOCK_START`, `SUMMARY`, or `KEYWORD` and is dropped unless it
  falls in the last 8 lines of output. Failures stay visible; a pass for a
  bad reason — exactly the case that most needs seeing — is the one thing
  compressed away.
- **Not the cause of the GIT_566 miss.** Gabe asked whether the
  token-conserving output filter caused the rustfmt-gate miss (2026-08-28).
  Refuted: gate()'s redirect means the evidence never reached ANY stream,
  filtered or not (see the 0-byte log above), so filtering had nothing to
  drop. The question is credited here (§ Credit user contributions) because
  answering it is what surfaced this separate, real defect.
